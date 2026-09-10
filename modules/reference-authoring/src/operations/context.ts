import { createHash } from "node:crypto";

import { CPP_STANDARDS } from "@cpp-learn/contracts";

import { authoringInputDigest } from "../digest.ts";
import { authoringFactEvidenceDigest } from "../fact-evidence.ts";
import {
  contextPackDigest,
  hasPrimaryWorkingDraftEvidence,
  materializeWorkspaceEvidence,
  NORMATIVE_FACT_KINDS,
  validateFactReuse,
} from "../gates.ts";
import { PROFILE_DEFINITIONS } from "../profiles.ts";
import {
  validateAuthoringContextPack,
  validateAuthoringGeneratedReview,
  validateAuthoringGenerationBundleTemplate,
} from "../validation.ts";
import type { ReferenceDraftRepository } from "../index.ts";

import {
  validateAuthoringCatalogProposal,
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringSourceLedger,
} from "../validation.ts";

import type {
  BuildAuthoringContextRequest,
  BuildAuthoringContextResult,
  BuildAuthoringGenerationTemplateRequest,
  BuildAuthoringGenerationTemplateResult,
  AuthoringContextPack,
  AuthoringFactGroup,
  AuthoringGeneratedReview,
  AuthoringGenerationBundleTemplate,
  AuthoringGenerationDraft,
  AuthoringValidationIssue,
  DraftWorkspace,
  ReviewGeneratedClaimsRequest,
  ReviewGeneratedClaimsResult,
} from "../index.ts";

/**
 * Authoring context and generation templates.
 *
 * A context pack is the only thing generation is allowed to see: the fact sheet,
 * the profile's required headings, the source allowlist, and the policy. Both
 * template building and claim review rebuild that context from the draft so a
 * stale or widened pack can never be used to justify generated prose.
 */
export interface ContextOperationsContext {
  readonly drafts: ReferenceDraftRepository;
}

export interface ContextOperations {
  readonly buildContext: (
    request: BuildAuthoringContextRequest,
  ) => Promise<BuildAuthoringContextResult>;
  readonly buildGenerationTemplate: (
    request: BuildAuthoringGenerationTemplateRequest,
  ) => Promise<BuildAuthoringGenerationTemplateResult>;
  readonly reviewGeneratedClaims: (
    request: ReviewGeneratedClaimsRequest,
  ) => Promise<ReviewGeneratedClaimsResult>;
}

export function createContextOperations(
  context: ContextOperationsContext,
): ContextOperations {
  async function buildContext(
    request: BuildAuthoringContextRequest,
  ): Promise<BuildAuthoringContextResult> {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId) ||
      request.factGroupIds.length === 0 ||
      new Set(request.factGroupIds).size !== request.factGroupIds.length ||
      request.factGroupIds.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id))
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message: "draftId and unique factGroupIds are required",
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
    const artifactIssues = [
      ...validateAuthoringDraft(workspace.draft),
      ...validateAuthoringCatalogProposal(workspace.proposal),
      ...validateAuthoringFactSheet(workspace.facts),
      ...validateAuthoringSourceLedger(workspace.sources),
    ];
    for (const [path, draftId] of [
      ["/draft/draftId", workspace.draft.draftId],
      ["/proposal/draftId", workspace.proposal.draftId],
      ["/facts/draftId", workspace.facts.draftId],
      ["/sources/draftId", workspace.sources.draftId],
    ] as const) {
      if (draftId !== request.draftId) {
        artifactIssues.push({
          path,
          message: `Expected ${request.draftId}, received ${draftId}`,
          keyword: "draft-id-mismatch",
        });
      }
    }
    if (artifactIssues.length > 0) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: artifactIssues,
      };
    }
    let selectedGroups: AuthoringFactGroup[] = [];
    const contextIssues: AuthoringValidationIssue[] = [];
    for (const [index, groupId] of request.factGroupIds.entries()) {
      const group = workspace.facts.groups.find(({ id }) => id === groupId);
      if (group?.status !== "verified") {
        contextIssues.push({
          path: `/factGroupIds/${index}`,
          message: `Fact group ${groupId} is missing or not verified`,
          keyword: "fact-not-verified",
        });
        continue;
      }
      selectedGroups.push(group);
    }
    try {
      contextIssues.push(
        ...(await validateFactReuse(
          workspace,
          context.drafts,
          new Set(request.factGroupIds),
        )),
      );
    } catch (error) {
      contextIssues.push({
        path: "/factGroupIds",
        message:
          error instanceof Error
            ? error.message
            : "Reusable fact source draft is unreadable",
        keyword: "fact-reuse-source-unreadable",
      });
    }
    if (contextIssues.length > 0) {
      return {
        ok: false,
        code: "context_blocked",
        issues: contextIssues,
      };
    }
    let evidenceWorkspace: DraftWorkspace;
    try {
      evidenceWorkspace = await materializeWorkspaceEvidence(
        workspace,
        context.drafts,
        new Set(request.factGroupIds),
      );
    } catch (error) {
      return {
        ok: false,
        code: "context_blocked",
        issues: [
          {
            path: "/factGroupIds",
            message:
              error instanceof Error
                ? error.message
                : "Reusable fact evidence is unreadable",
            keyword: "fact-reuse-source-unreadable",
          },
        ],
      };
    }
    selectedGroups = request.factGroupIds.map((groupId) =>
      evidenceWorkspace.facts.groups.find(({ id }) => id === groupId)!,
    );
    for (const [index, group] of selectedGroups.entries()) {
      if (
        group.summary.length === 0 ||
        group.sourceIds.length === 0 ||
        group.sourceIds.some(
          (sourceId) =>
            !evidenceWorkspace.sources.sources.some(
              ({ id }) => id === sourceId,
            ),
        )
      ) {
        contextIssues.push({
          path: `/factGroupIds/${index}`,
          message: `Fact group ${group.id} has incomplete source evidence`,
          keyword: "fact-evidence-incomplete",
        });
      } else if (
        NORMATIVE_FACT_KINDS.has(group.kind) &&
        !hasPrimaryWorkingDraftEvidence(
          group,
          evidenceWorkspace.sources.sources,
        )
      ) {
        contextIssues.push({
          path: `/factGroupIds/${index}`,
          message: `Normative fact group ${group.id} requires primary Working Draft evidence`,
          keyword: "fact-primary-source-missing",
        });
      }
    }
    if (contextIssues.length > 0) {
      return { ok: false, code: "context_blocked", issues: contextIssues };
    }
    const sourceIds = new Set(
      selectedGroups.flatMap(({ sourceIds }) => [...sourceIds]),
    );
    const sources = evidenceWorkspace.sources.sources.filter(({ id }) =>
      sourceIds.has(id),
    );
    const packWithoutDigest: Omit<AuthoringContextPack, "digest"> = {
      schemaVersion: 2,
      draftId: workspace.draft.draftId,
      draftRevision: workspace.draft.revision,
      inputDigest: authoringInputDigest(workspace.files),
      target: workspace.draft.target,
      profile: workspace.draft.profile,
      requiredHeadings: PROFILE_DEFINITIONS[workspace.draft.profile].headings,
      factGroups: selectedGroups.map((group) => ({
        id: group.id,
        kind: group.kind,
        summary: group.summary,
        sourceIds: group.sourceIds,
        ...(group.decision === undefined ? {} : { decision: group.decision }),
        ...(group.reusedFrom === undefined
          ? {}
          : { reusedFrom: group.reusedFrom }),
        evidenceDigest: authoringFactEvidenceDigest(group, sources),
      })),
      sources,
      policy: {
        mode: "verified-facts-only",
        allowedFactGroupIds: [...request.factGroupIds],
        requirements: [
          "每条实质性事实必须引用一个或多个 allowedFactGroupIds。",
          "不得引入上下文包之外的签名、版本、复杂度、错误或生命周期断言。",
          "来源文本仅用于核对事实，不得复制来源措辞。",
        ],
      },
    };
    const pack: AuthoringContextPack = {
      ...packWithoutDigest,
      digest: contextPackDigest(packWithoutDigest),
    };
    const packIssues = validateAuthoringContextPack(pack);
    if (packIssues.length > 0) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: packIssues,
      };
    }
    return { ok: true, pack };
  }

  async function buildGenerationTemplate(
    request: BuildAuthoringGenerationTemplateRequest,
  ): Promise<BuildAuthoringGenerationTemplateResult> {
    const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
    const kindIsValid = ["section", "summary", "example"].includes(
      request.kind,
    );
    const exampleKindIsValid =
      request.exampleKind === undefined ||
      ["compile", "run", "expected-compile-failure"].includes(
        request.exampleKind,
      );
    const standardIsValid =
      request.standard === undefined ||
      CPP_STANDARDS.some((standard) => standard === request.standard);
    if (
      !kindIsValid ||
      (request.kind === "section" &&
        (request.heading === undefined ||
          request.heading.trim().length === 0)) ||
      (request.kind === "example" &&
        (request.exampleId === undefined ||
          !stableId.test(request.exampleId))) ||
      !exampleKindIsValid ||
      !standardIsValid
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message:
              "Template kind and its required heading or example ID must be valid",
            keyword: "request",
          },
        ],
      };
    }
    const contextResult = await buildContext({
      draftId: request.draftId,
      factGroupIds: request.factGroupIds,
    });
    if (!contextResult.ok) return contextResult;
    const context = contextResult.pack;
    if (
      request.kind === "section" &&
      !context.requiredHeadings.includes(request.heading)
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/heading",
            message: `Heading is not part of the ${context.profile} authoring profile`,
            keyword: "enum",
          },
        ],
      };
    }
    const generation: AuthoringGenerationDraft =
      request.kind === "section"
        ? {
            schemaVersion: 1,
            draftId: context.draftId,
            contextDigest: context.digest,
            section: {
              heading: request.heading,
              markdown: "",
              claims: [],
            },
          }
        : request.kind === "summary"
          ? {
              schemaVersion: 1,
              draftId: context.draftId,
              contextDigest: context.digest,
              summary: { text: "", claims: [] },
            }
          : {
              schemaVersion: 1,
              draftId: context.draftId,
              contextDigest: context.digest,
              example: {
                id: request.exampleId,
                kind: request.exampleKind ?? "run",
                standard: request.standard ?? "c++20",
                ...(request.exampleKind === "compile"
                  ? {}
                  : request.exampleKind === "expected-compile-failure"
                    ? { expectedDiagnosticCategory: "" }
                    : { expectedStdout: "" }),
                source: "",
                claims: [],
              },
            };
    const template: AuthoringGenerationBundleTemplate = {
      template: {
        schemaVersion: 1,
        status: "incomplete",
        kind: request.kind,
        requiredActions: ["write-content", "declare-claims", "mark-ready"],
      },
      context,
      expectedRevision: context.draftRevision,
      generation,
    };
    const issues = validateAuthoringGenerationBundleTemplate(template);
    if (issues.length > 0) {
      return { ok: false, code: "invalid_request", issues };
    }
    return { ok: true, template };
  }

  async function reviewGeneratedClaims(
    request: ReviewGeneratedClaimsRequest,
  ): Promise<ReviewGeneratedClaimsResult> {
    const contextIssues = validateAuthoringContextPack(request.context);
    const { digest: suppliedDigest, ...contextWithoutDigest } = request.context;
    if (
      contextIssues.length > 0 ||
      contextPackDigest(contextWithoutDigest) !== suppliedDigest
    ) {
      return {
        ok: false,
        code: "invalid_context",
        issues:
          contextIssues.length > 0
            ? contextIssues
            : [
                {
                  path: "/context/digest",
                  message: "Context digest does not match its contents",
                  keyword: "digest",
                },
              ],
      };
    }
    const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
    const claimIds = request.claims.map(({ id }) => id);
    if (
      request.claims.length === 0 ||
      new Set(claimIds).size !== claimIds.length ||
      request.claims.some(
        (claim) =>
          !stableId.test(claim.id) ||
          claim.text.trim().length === 0 ||
          new Set(claim.factGroupIds).size !== claim.factGroupIds.length ||
          claim.factGroupIds.some((id) => !stableId.test(id)),
      )
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/claims",
            message:
              "At least one uniquely identified non-empty generated claim is required",
            keyword: "request",
          },
        ],
      };
    }
    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(request.context.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "context_changed",
        issues: [
          {
            path: "/context/draftId",
            message:
              error instanceof Error
                ? error.message
                : "Context draft is unreadable",
            keyword: "read",
          },
        ],
      };
    }
    if (workspace === undefined) {
      return { ok: false, code: "draft_not_found", issues: [] };
    }
    if (
      workspace.draft.draftId !== request.context.draftId ||
      workspace.draft.revision !== request.context.draftRevision ||
      authoringInputDigest(workspace.files) !== request.context.inputDigest
    ) {
      return {
        ok: false,
        code: "context_changed",
        issues: [
          {
            path: "/context",
            message:
              "The draft revision or authoring input changed after the context pack was built",
            keyword: "revision",
          },
        ],
      };
    }
    const rebuiltContext = await buildContext({
      draftId: request.context.draftId,
      factGroupIds: request.context.policy.allowedFactGroupIds,
    });
    if (
      !rebuiltContext.ok ||
      rebuiltContext.pack.digest !== request.context.digest
    ) {
      return {
        ok: false,
        code: "context_changed",
        issues: [
          {
            path: "/context/digest",
            message:
              "The supplied context no longer matches an authoritative context rebuilt from the current draft",
            keyword: "digest",
          },
        ],
      };
    }
    const allowedIds = new Set(request.context.policy.allowedFactGroupIds);
    const acceptedClaimIds: string[] = [];
    const reviewQueue: AuthoringGeneratedReview["reviewQueue"][number][] = [];
    for (const claim of request.claims) {
      const unknownFactGroupIds = claim.factGroupIds.filter(
        (id) => !allowedIds.has(id),
      );
      if (claim.factGroupIds.length > 0 && unknownFactGroupIds.length === 0) {
        acceptedClaimIds.push(claim.id);
        continue;
      }
      reviewQueue.push({
        claimId: claim.id,
        text: claim.text,
        status: "unverified",
        reason:
          claim.factGroupIds.length === 0
            ? "missing-fact-reference"
            : "fact-not-allowed",
        factGroupIds: [...claim.factGroupIds],
        unknownFactGroupIds,
      });
    }
    const reviewWithoutDigest: Omit<AuthoringGeneratedReview, "digest"> = {
      schemaVersion: 1,
      draftId: request.context.draftId,
      contextDigest: request.context.digest,
      status: reviewQueue.length === 0 ? "accepted" : "requires-review",
      acceptedClaimIds,
      reviewQueue,
    };
    const review: AuthoringGeneratedReview = {
      ...reviewWithoutDigest,
      digest: createHash("sha256")
        .update(JSON.stringify(reviewWithoutDigest))
        .digest("hex"),
    };
    const reviewIssues = validateAuthoringGeneratedReview(review);
    if (reviewIssues.length > 0) {
      return {
        ok: false,
        code: "invalid_context",
        issues: reviewIssues,
      };
    }
    return { ok: true, review };
  }

  return { buildContext, buildGenerationTemplate, reviewGeneratedClaims };
}
