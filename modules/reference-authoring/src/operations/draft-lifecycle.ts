import type { ReferenceEntryManifest } from "@cpp-learn/reference";
import { validateReferenceEntryManifest } from "@cpp-learn/reference-schema";

import { authoringInputDigest } from "../digest.ts";
import {
  catalogProposal,
  createDraftManifest,
  createDraftWorkspace,
  emptyCatalogProposal,
  jsonFile,
} from "../draft.ts";
import { authoringFactEvidenceDigest } from "../fact-evidence.ts";
import { PROFILE_BY_KIND } from "../profiles.ts";
import type { AuthoringFinding } from "../gates.ts";
import {
  analyzeAuthoringImpact,
  evaluateAuthoringGraphGate,
  hardFinding,
  materializeWorkspaceEvidence,
  parseCandidateEntry,
  qualityFindings,
  sameTarget,
  schemaFindings,
  validateContentProfile,
  validateEntryIdentity,
  validateExamples,
  validateFactCoverage,
  validateFactReuse,
  validateGeneratedContentReview,
  validateGenerationArtifacts,
  validateSourceAlignment,
} from "../gates.ts";
import {
  validateAuthoringCatalogProposal,
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringPublicationPlan,
  validateAuthoringReport,
  validateAuthoringSourceLedger,
} from "../validation.ts";

import type {
  AuthoringCatalogContext,
  AuthoringCatalogContextAdapter,
  AuthoringDraftManifest,
  AuthoringFactGroup,
  AuthoringFactSheet,
  AuthoringPublicationCandidate,
  AuthoringValidationIssue,
  AuthoringReport,
  DraftWorkspace,
  AuthoringContentQualityValidator,
  AuthoringExampleValidator,
  AuthoringPublisher,
  AuthoringValidationCache,
  CheckDraftRequest,
  CheckDraftResult,
  PrepareDraftRequest,
  PrepareDraftResult,
  PublishDraftRequest,
  PublishDraftResult,
  ReferenceDraftRepository,
} from "../index.ts";

async function applyPreparedFactReuse(
  workspace: DraftWorkspace,
  reuse: NonNullable<PrepareDraftRequest["reuse"]>,
  repository: ReferenceDraftRepository,
): Promise<
  | { readonly ok: true; readonly workspace: DraftWorkspace }
  | { readonly ok: false; readonly issues: readonly AuthoringValidationIssue[] }
> {
  const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
  if (
    !stableId.test(reuse.draftId) ||
    reuse.factGroupIds.length === 0 ||
    new Set(reuse.factGroupIds).size !== reuse.factGroupIds.length ||
    reuse.factGroupIds.some((id) => !stableId.test(id))
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "/reuse",
          message: "A source draft and unique fact group IDs are required",
          keyword: "request",
        },
      ],
    };
  }
  if (!workspace.proposal.relatedEntryIds.includes(reuse.draftId)) {
    return {
      ok: false,
      issues: [
        {
          path: "/reuse/draftId",
          message: `Reusable facts must come from a related draft: ${reuse.draftId}`,
          keyword: "fact-reuse-unrelated",
        },
      ],
    };
  }
  const sourceWorkspace = await repository.get(reuse.draftId);
  if (
    sourceWorkspace === undefined ||
    sourceWorkspace.draft.state !== "checked" ||
    sourceWorkspace.report.status !== "ready" ||
    sourceWorkspace.report.draftRevision !== sourceWorkspace.draft.revision ||
    sourceWorkspace.report.inputDigest !==
      authoringInputDigest(sourceWorkspace.files)
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "/reuse/draftId",
          message: "Reusable fact source must be an unchanged ready draft",
          keyword: "fact-reuse-source-unverified",
        },
      ],
    };
  }
  const selectedGroups: AuthoringFactGroup[] = [];
  for (const [index, groupId] of reuse.factGroupIds.entries()) {
    const sourceGroup = sourceWorkspace.facts.groups.find(
      ({ id }) => id === groupId,
    );
    const targetGroup = workspace.facts.groups.find(({ id }) => id === groupId);
    if (
      sourceGroup?.status !== "verified" ||
      targetGroup === undefined ||
      targetGroup.kind !== sourceGroup.kind
    ) {
      return {
        ok: false,
        issues: [
          {
            path: `/reuse/factGroupIds/${index}`,
            message: `Fact group ${groupId} is not verified and compatible with the target profile`,
            keyword: "fact-reuse-source-unverified",
          },
        ],
      };
    }
    selectedGroups.push(sourceGroup);
  }
  const sourceIds = new Set(selectedGroups.flatMap((group) => group.sourceIds));
  if (
    sourceWorkspace.sources.sources.filter(({ id }) => sourceIds.has(id))
      .length !== sourceIds.size
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "/reuse/factGroupIds",
          message: "Reusable fact source evidence is incomplete",
          keyword: "fact-evidence-incomplete",
        },
      ],
    };
  }
  const groups = workspace.facts.groups.map((targetGroup) => {
    const sourceGroup = selectedGroups.find(({ id }) => id === targetGroup.id);
    if (sourceGroup === undefined) return targetGroup;
    return {
      ...targetGroup,
      status: "verified" as const,
      summary: "",
      sourceIds: [],
      reusedFrom: {
        draftId: sourceWorkspace.draft.draftId,
        draftRevision: sourceWorkspace.draft.revision,
        groupId: sourceGroup.id,
        evidenceDigest: authoringFactEvidenceDigest(
          sourceGroup,
          sourceWorkspace.sources.sources,
        ),
      },
    };
  });
  const facts: AuthoringFactSheet = { ...workspace.facts, groups };
  const files = {
    ...workspace.files,
    "facts.json": jsonFile(facts),
  };
  const report: AuthoringReport = {
    ...workspace.report,
    inputDigest: authoringInputDigest(files),
  };
  return {
    ok: true,
    workspace: {
      ...workspace,
      facts,
      report,
      files: { ...files, "report.json": jsonFile(report) },
    },
  };
}

/**
 * Draft lifecycle: prepare, check, and publish.
 *
 * `prepare` scaffolds or resumes a draft; `check` runs the deterministic gates
 * and returns a risk-ranked review queue; `publish` re-checks the expected
 * revision, writes every canonical file atomically, and never commits to Git.
 * All three are pure with respect to the facade: every adapter arrives as a
 * dependency.
 */
export interface DraftLifecycleOperationsContext {
  readonly drafts: ReferenceDraftRepository;
  readonly catalog: AuthoringCatalogContextAdapter | undefined;
  readonly cache: AuthoringValidationCache | undefined;
  readonly examples: AuthoringExampleValidator | undefined;
  readonly quality: AuthoringContentQualityValidator | undefined;
  readonly publisher: AuthoringPublisher | undefined;
  readonly clock: () => Date;
}

export interface DraftLifecycleOperations {
  readonly prepare: (
    request: PrepareDraftRequest,
  ) => Promise<PrepareDraftResult>;
  readonly check: (request: CheckDraftRequest) => Promise<CheckDraftResult>;
  readonly publish: (
    request: PublishDraftRequest,
  ) => Promise<PublishDraftResult>;
}

export function createDraftLifecycleOperations(
  context: DraftLifecycleOperationsContext,
): DraftLifecycleOperations {
  async function prepare(
    request: PrepareDraftRequest,
  ): Promise<PrepareDraftResult> {
    const profile = PROFILE_BY_KIND[request.target.kind];
    const now = context.clock().toISOString();
    let proposal = emptyCatalogProposal(request.target);
    if (context.catalog !== undefined) {
      let catalog: AuthoringCatalogContext;
      try {
        catalog = await context.catalog.load();
      } catch (error) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/catalog",
              message:
                error instanceof Error
                  ? error.message
                  : "Active Reference catalog is unreadable",
              keyword: "read",
            },
          ],
        };
      }
      const activeOwner = Object.entries(catalog.slugsByEntryId).find(
        ([entryId, slug]) =>
          entryId !== request.target.entryId && slug === request.target.slug,
      );
      const redirectOwner = catalog.redirects.find(
        ({ fromSlug }) => fromSlug === request.target.slug,
      );
      if (activeOwner !== undefined || redirectOwner !== undefined) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/target/slug",
              message:
                activeOwner === undefined
                  ? `Slug is preserved as a historical redirect to ${redirectOwner!.toEntryId}`
                  : `Slug is already owned by ${activeOwner[0]}`,
              keyword: "conflict",
            },
          ],
        };
      }
      proposal = catalogProposal(request.target, catalog);
    }
    const draft = createDraftManifest(request.target, profile, now, [
      request.target.entryId,
      ...proposal.relatedEntryIds,
    ]);
    const issues = validateAuthoringDraft(draft);
    if (issues.length > 0) {
      return { ok: false, code: "invalid_request", issues };
    }

    let workspace = createDraftWorkspace(draft, proposal);
    if (request.reuse !== undefined) {
      let reuseResult: Awaited<ReturnType<typeof applyPreparedFactReuse>>;
      try {
        reuseResult = await applyPreparedFactReuse(
          workspace,
          request.reuse,
          context.drafts,
        );
      } catch (error) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/reuse/draftId",
              message:
                error instanceof Error
                  ? error.message
                  : "Reusable fact source is unreadable",
              keyword: "read",
            },
          ],
        };
      }
      if (!reuseResult.ok) {
        return {
          ok: false,
          code: "invalid_request",
          issues: reuseResult.issues,
        };
      }
      workspace = reuseResult.workspace;
    }
    const reservation = await context.drafts.reserve(workspace);
    if (!reservation.created) {
      if (!sameTarget(reservation.workspace.draft.target, request.target)) {
        return {
          ok: false,
          code: "draft_conflict",
          issues: [
            {
              path: "/target",
              message: "Draft identity is already reserved for another target",
              keyword: "conflict",
            },
          ],
        };
      }
      if (
        request.reuse !== undefined &&
        request.reuse.factGroupIds.some((groupId) => {
          const group = reservation.workspace.facts.groups.find(
            ({ id }) => id === groupId,
          );
          return group?.reusedFrom?.draftId !== request.reuse!.draftId;
        })
      ) {
        return {
          ok: false,
          code: "draft_conflict",
          issues: [
            {
              path: "/reuse",
              message:
                "The existing draft was created without the requested fact reuse; prepare-time reuse cannot be applied while resuming it",
              keyword: "conflict",
            },
          ],
        };
      }
      return { ok: true, created: false, workspace: reservation.workspace };
    }
    return { ok: true, created: true, workspace: reservation.workspace };
  }

  async function check(request: CheckDraftRequest): Promise<CheckDraftResult> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId)) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/draftId",
            message: "must be a stable lowercase Entry ID",
            keyword: "pattern",
          },
        ],
      };
    }

    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(request.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/draft",
            message:
              error instanceof Error ? error.message : "Draft is unreadable",
            keyword: "read",
          },
        ],
      };
    }
    if (workspace === undefined) {
      return { ok: false, code: "draft_not_found", issues: [] };
    }
    const checkedAt = context.clock().toISOString();
    const draftIssues = validateAuthoringDraft(workspace.draft);
    if (draftIssues.length > 0) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: draftIssues.map((issue) => ({
          ...issue,
          path: `/draft${issue.path}`,
        })),
      };
    }
    const factIssues = validateAuthoringFactSheet(workspace.facts);
    const sourceIssues = validateAuthoringSourceLedger(workspace.sources);
    const reportIssues = validateAuthoringReport(workspace.report);
    const proposalIssues = validateAuthoringCatalogProposal(workspace.proposal);
    let evidenceWorkspace = workspace;
    const reuseFindings: AuthoringFinding[] = [];
    if (
      factIssues.length === 0 &&
      sourceIssues.length === 0 &&
      proposalIssues.length === 0
    ) {
      try {
        const reuseIssues = await validateFactReuse(workspace, context.drafts);
        reuseFindings.push(
          ...reuseIssues.map((issue) =>
            hardFinding(
              issue.keyword,
              `facts.json${issue.path}`,
              issue.message,
            ),
          ),
        );
        if (reuseIssues.length === 0) {
          evidenceWorkspace = await materializeWorkspaceEvidence(
            workspace,
            context.drafts,
          );
        }
      } catch (error) {
        reuseFindings.push(
          hardFinding(
            "fact-reuse-source-unreadable",
            "facts.json",
            error instanceof Error
              ? error.message
              : "Reusable fact source draft is unreadable",
          ),
        );
      }
    }

    const findings: AuthoringFinding[] = [
      ...schemaFindings(
        "catalog-proposal-schema",
        "catalog-proposal.json",
        proposalIssues,
      ),
      ...schemaFindings("facts-schema", "facts.json", factIssues),
      ...schemaFindings("sources-schema", "sources.json", sourceIssues),
      ...schemaFindings("report-schema", "report.json", reportIssues),
      ...(factIssues.length === 0 && sourceIssues.length === 0
        ? validateFactCoverage(evidenceWorkspace)
        : []),
      ...validateContentProfile(workspace),
      ...validateGenerationArtifacts(workspace),
      ...validateGeneratedContentReview(workspace.report),
      ...reuseFindings,
    ];

    const artifactDraftIds: [string, string][] = [];
    if (proposalIssues.length === 0) {
      artifactDraftIds.push([
        "catalog-proposal.json",
        workspace.proposal.draftId,
      ]);
    }
    if (factIssues.length === 0) {
      artifactDraftIds.push(["facts.json", workspace.facts.draftId]);
    }
    if (sourceIssues.length === 0) {
      artifactDraftIds.push(["sources.json", workspace.sources.draftId]);
    }
    if (reportIssues.length === 0) {
      artifactDraftIds.push(["report.json", workspace.report.draftId]);
    }
    for (const [artifact, draftId] of artifactDraftIds) {
      if (draftId !== workspace.draft.draftId) {
        findings.push(
          hardFinding(
            "draft-id-mismatch",
            `${artifact}/draftId`,
            `Expected ${workspace.draft.draftId}, received ${draftId}`,
          ),
        );
      }
    }

    let checkedEntry: ReferenceEntryManifest | undefined;
    let checkedCatalog: AuthoringCatalogContext | undefined;
    const cacheEvidence: AuthoringReport["cacheEvidence"][number][] = [];
    const candidate = parseCandidateEntry(workspace.files["entry.json"]);
    if (!candidate.ok) {
      findings.push(candidate.finding);
    } else {
      const entryIssues = validateReferenceEntryManifest(candidate.entry);
      findings.push(
        ...schemaFindings("entry-schema", "entry.json", entryIssues),
      );
      if (entryIssues.length === 0) {
        checkedEntry = candidate.entry;
        findings.push(...validateEntryIdentity(workspace, candidate.entry));
        if (
          proposalIssues.length === 0 &&
          (workspace.proposal.entryPath !== workspace.draft.targetPaths.entry ||
            JSON.stringify(workspace.proposal.categories) !==
              JSON.stringify(candidate.entry.categories) ||
            JSON.stringify(workspace.proposal.relatedEntryIds) !==
              JSON.stringify(candidate.entry.relatedEntryIds))
        ) {
          findings.push(
            hardFinding(
              "catalog-proposal-mismatch",
              "catalog-proposal.json",
              "Catalog proposal must match the candidate Entry path, categories, and related Entries",
            ),
          );
        }
        if (factIssues.length === 0 && sourceIssues.length === 0) {
          findings.push(
            ...validateSourceAlignment(
              evidenceWorkspace,
              candidate.entry,
              checkedAt.slice(0, 10),
            ),
          );
        }
        if (context.catalog === undefined) {
          findings.push(
            hardFinding(
              "catalog-unavailable",
              "entry.json",
              "No active Reference catalog context is configured",
            ),
          );
        } else {
          try {
            checkedCatalog = await context.catalog.load();
            findings.push(
              ...evaluateAuthoringGraphGate(
                workspace.draft.target.entryId,
                candidate.entry,
                checkedCatalog,
                "incremental",
              ),
            );
          } catch (error) {
            findings.push(
              hardFinding(
                "catalog-unreadable",
                "entry.json",
                error instanceof Error
                  ? error.message
                  : "Active Reference catalog is unreadable",
              ),
            );
          }
        }
        const content = workspace.files["content.md"];
        if (content !== undefined) {
          if (context.quality === undefined) {
            findings.push(
              hardFinding(
                "quality-validator-unavailable",
                "content.md",
                "No canonical Reference quality validator is configured",
              ),
            );
          } else {
            findings.push(
              ...qualityFindings(
                "content.md",
                await context.quality.validate({
                  entry: candidate.entry,
                  content,
                }),
              ),
            );
          }
        }
        const exampleValidation = await validateExamples(
          workspace,
          candidate.entry,
          context.examples,
          context.cache,
        );
        findings.push(...exampleValidation.findings);
        cacheEvidence.push(...exampleValidation.cacheEvidence);
      }
    }

    const riskOrder = { high: 0, medium: 1, low: 2 } as const;
    findings.sort(
      (left, right) =>
        (left.severity === "hard" ? 0 : 1) -
          (right.severity === "hard" ? 0 : 1) ||
        riskOrder[left.risk] - riskOrder[right.risk] ||
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code),
    );
    const reviewQueue = findings.filter(
      (finding): finding is AuthoringReport["reviewQueue"][number] =>
        finding.severity === "warning",
    );
    const blocked = findings.some(({ severity }) => severity === "hard");
    const nextRevision = workspace.draft.revision + 1;
    const impact =
      checkedEntry === undefined || checkedCatalog === undefined
        ? {
            entryIds: workspace.draft.affectedEntryIds,
            activityIds: [] as readonly string[],
          }
        : analyzeAuthoringImpact(
            workspace.draft.target.entryId,
            checkedEntry,
            checkedCatalog,
          );
    const affectedEntryIds = impact.entryIds;
    const report: AuthoringReport = {
      schemaVersion: 1,
      draftId: workspace.draft.draftId,
      draftRevision: nextRevision,
      inputDigest: authoringInputDigest(workspace.files),
      status: blocked ? "blocked" : "ready",
      affectedEntryIds,
      affectedActivityIds: impact.activityIds,
      findings,
      reviewQueue,
      cacheEvidence,
      ...(workspace.report.generatedSections === undefined
        ? {}
        : { generatedSections: workspace.report.generatedSections }),
    };
    const draft: AuthoringDraftManifest = {
      ...workspace.draft,
      revision: nextRevision,
      state: blocked ? "draft" : "checked",
      affectedEntryIds,
      updatedAt: checkedAt,
    };
    const checkedWorkspace: DraftWorkspace = {
      ...workspace,
      draft,
      report,
      files: {
        ...workspace.files,
        "draft.json": jsonFile(draft),
        "report.json": jsonFile(report),
      },
    };
    const committed = await context.drafts.commitWorkspace({
      draftId: workspace.draft.draftId,
      expectedRevision: workspace.draft.revision,
      expectedFiles: workspace.files,
      workspace: checkedWorkspace,
    });
    if (!committed) {
      return { ok: false, code: "revision_conflict", issues: [] };
    }
    return { ok: true, report, workspace: checkedWorkspace };
  }

  async function publish(
    request: PublishDraftRequest,
  ): Promise<PublishDraftResult> {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId) ||
      !Number.isInteger(request.expectedRevision) ||
      request.expectedRevision < 1
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message: "draftId and expectedRevision are invalid",
            keyword: "request",
          },
        ],
      };
    }
    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(request.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/draft",
            message:
              error instanceof Error ? error.message : "Draft is unreadable",
            keyword: "read",
          },
        ],
      };
    }
    if (workspace === undefined) {
      return { ok: false, code: "draft_not_found", issues: [] };
    }
    let persistedDraft: unknown;
    let persistedReport: unknown;
    try {
      persistedDraft = JSON.parse(workspace.files["draft.json"] ?? "null");
      persistedReport = JSON.parse(workspace.files["report.json"] ?? "null");
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/draft",
            message:
              error instanceof Error
                ? error.message
                : "Draft metadata is unreadable",
            keyword: "parse",
          },
        ],
      };
    }
    const publicationArtifactIssues = [
      ...validateAuthoringDraft(persistedDraft),
      ...validateAuthoringReport(persistedReport),
    ];
    if (
      publicationArtifactIssues.length > 0 ||
      JSON.stringify(persistedDraft) !== JSON.stringify(workspace.draft) ||
      JSON.stringify(persistedReport) !== JSON.stringify(workspace.report)
    ) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: publicationArtifactIssues,
      };
    }
    if (workspace.draft.revision !== request.expectedRevision) {
      return { ok: false, code: "revision_conflict", issues: [] };
    }
    if (
      workspace.draft.state !== "checked" ||
      workspace.report.status !== "ready" ||
      workspace.report.draftRevision !== workspace.draft.revision
    ) {
      return { ok: false, code: "draft_not_ready", issues: [] };
    }
    if (
      workspace.report.inputDigest !== authoringInputDigest(workspace.files)
    ) {
      return { ok: false, code: "draft_changed", issues: [] };
    }
    if (context.publisher === undefined) {
      return {
        ok: false,
        code: "publication_failed",
        issues: [
          {
            path: "/publisher",
            message: "No Reference publication Adapter is configured",
            keyword: "configuration",
          },
        ],
      };
    }
    const candidate = parseCandidateEntry(workspace.files["entry.json"]);
    if (!candidate.ok) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: candidate.finding.path,
            message: candidate.finding.message,
            keyword: candidate.finding.code,
          },
        ],
      };
    }
    const files: AuthoringPublicationCandidate[] = [];
    for (const [localPath, canonicalPath] of [
      ["entry.json", workspace.draft.targetPaths.entry],
      ["content.md", workspace.draft.targetPaths.content],
    ] as const) {
      const content = workspace.files[localPath];
      if (content === undefined) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: localPath,
              message: "Publication source is missing",
              keyword: "required",
            },
          ],
        };
      }
      files.push({ path: canonicalPath, content });
    }
    const examplePrefix = `${workspace.draft.targetPaths.examples}/`;
    for (const example of candidate.entry.examples) {
      const localPath = example.path.startsWith(examplePrefix)
        ? `examples/${example.path.slice(examplePrefix.length)}`
        : "";
      const content = workspace.files[localPath];
      if (localPath === "" || content === undefined) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: example.path,
              message: "Example publication source is missing or unsafe",
              keyword: "required",
            },
          ],
        };
      }
      files.push({ path: example.path, content });
    }
    try {
      const plan = await context.publisher.publish({
        draftId: request.draftId,
        expectedRevision: request.expectedRevision,
        mode: request.mode,
        entryPath: workspace.draft.targetPaths.entry,
        files,
        confirmDraft: async () => {
          try {
            const current = await context.drafts.get(request.draftId);
            return (
              current !== undefined &&
              current.draft.revision === request.expectedRevision &&
              current.draft.state === "checked" &&
              current.report.status === "ready" &&
              current.report.draftRevision === request.expectedRevision &&
              current.report.inputDigest === authoringInputDigest(current.files)
            );
          } catch {
            return false;
          }
        },
      });
      const planIssues = validateAuthoringPublicationPlan(plan);
      if (planIssues.length > 0) {
        return {
          ok: false,
          code: "publication_failed",
          issues: planIssues,
        };
      }
      return { ok: true, applied: request.mode === "apply", plan };
    } catch (error) {
      return {
        ok: false,
        code: "publication_failed",
        issues: [
          {
            path: "/publisher",
            message:
              error instanceof Error ? error.message : "Publication failed",
            keyword: "publish",
          },
        ],
      };
    }
  }

  return {
    prepare,
    check,
    publish,
  };
}
