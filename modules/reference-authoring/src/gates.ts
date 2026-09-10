import { createHash } from "node:crypto";

import type { ReferenceEntryManifest } from "@cpp-learn/reference";

import type {
  AuthoringValidationCache,
  AuthoringValidationCacheValue,
} from "./cache.ts";
import { authoringFactEvidenceDigest } from "./fact-evidence.ts";
import { authoringGenerationKind } from "./generation.ts";
import { authoringInputDigest } from "./digest.ts";
import { PROFILE_DEFINITIONS } from "./profiles.ts";
import { validateAuthoringGenerationReceipt } from "./validation.ts";

import type {
  AuthoringCatalogContext,
  AuthoringContextPack,
  AuthoringCorrectionCounts,
  AuthoringExampleValidator,
  AuthoringFactGroup,
  AuthoringFactKind,
  AuthoringGenerationReceipt,
  AuthoringReport,
  AuthoringSourceRecord,
  AuthoringValidationIssue,
  DraftWorkspace,
  PrepareDraftTarget,
  ReferenceDraftRepository,
} from "./index.ts";

/**
 * Entry review.
 *
 * These gates decide whether a draft may be published: generation artifacts,
 * generated-content review, candidate manifest parsing, fact coverage, source
 * alignment, content profile, Entry identity, graph impact, compiled examples,
 * reused-fact evidence, and freshness materialisation. They are pure with
 * respect to the facade — every input arrives as a parameter — so they can be
 * read and tested without constructing an authoring instance.
 */

export function sameTarget(
  left: PrepareDraftTarget,
  right: PrepareDraftTarget,
) {
  return (
    left.entryId === right.entryId &&
    left.kind === right.kind &&
    left.slug === right.slug &&
    left.title === right.title
  );
}

export type AuthoringFinding = AuthoringReport["findings"][number];

export function hardFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"] = "high",
): AuthoringFinding {
  return { severity: "hard", risk, code, path, message };
}

export function warningFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"],
): AuthoringFinding {
  return { severity: "warning", risk, code, path, message };
}

export function qualityRisk(path: string): AuthoringFinding["risk"] {
  if (/complexity|errors|lifetime|interface|parameters|returns/u.test(path)) {
    return "high";
  }
  if (/selection|examples|mistakes|javascript/u.test(path)) return "medium";
  return "low";
}

export function qualityFindings(
  artifactPath: string,
  issues: readonly AuthoringValidationIssue[],
): AuthoringFinding[] {
  return issues.map((issue) =>
    warningFinding(
      "content-quality",
      `${artifactPath}${issue.path === "/" ? "" : issue.path}`,
      issue.message,
      qualityRisk(issue.path),
    ),
  );
}

export function schemaFindings(
  code: string,
  artifactPath: string,
  issues: readonly AuthoringValidationIssue[],
): AuthoringFinding[] {
  return issues.map((issue) =>
    hardFinding(
      code,
      `${artifactPath}${issue.path === "/" ? "" : issue.path}`,
      issue.message,
    ),
  );
}

export function validateGenerationArtifacts(
  workspace: DraftWorkspace,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  for (const path of Object.keys(workspace.files)
    .filter((candidate) =>
      /^generation\/revision-[1-9][0-9]*\.json$/u.test(candidate),
    )
    .sort()) {
    let receipt: unknown;
    try {
      receipt = JSON.parse(workspace.files[path]!);
    } catch (error) {
      findings.push(
        hardFinding(
          "generation-receipt-schema",
          path,
          error instanceof Error ? error.message : "Receipt is not valid JSON",
        ),
      );
      continue;
    }
    const receiptIssues = validateAuthoringGenerationReceipt(receipt);
    findings.push(
      ...schemaFindings("generation-receipt-schema", path, receiptIssues),
    );
    if (receiptIssues.length > 0) continue;
    const validated = receipt as AuthoringGenerationReceipt;
    const pathRevision = Number(
      path.match(/revision-([1-9][0-9]*)\.json$/u)?.[1],
    );
    if (
      validated.draftId !== workspace.draft.draftId ||
      validated.appliedRevision !== pathRevision
    ) {
      findings.push(
        hardFinding(
          "generation-receipt-identity",
          path,
          "Receipt path, applied revision, and draft identity must agree",
        ),
      );
      continue;
    }
    const generatedKind = authoringGenerationKind(validated.generation);
    findings.push(
      hardFinding(
        "generated-content-review-required",
        `${path}/review/status`,
        `Generated ${generatedKind} requires explicit human review before publication`,
      ),
    );
  }
  return findings;
}

export function validateGeneratedContentReview(
  report: AuthoringReport,
): AuthoringFinding[] {
  return [
    ...(report.generatedSections ?? []).map((section, index) =>
      hardFinding(
        "generated-content-review-required",
        `report.json/generatedSections/${index}/reviewStatus`,
        `Generated section ${section.heading} requires explicit human review before publication`,
      ),
    ),
  ];
}

export function parseCandidateEntry(
  source: string | undefined,
):
  | { readonly ok: true; readonly entry: ReferenceEntryManifest }
  | { readonly ok: false; readonly finding: AuthoringFinding } {
  if (source === undefined) {
    return {
      ok: false,
      finding: hardFinding(
        "entry-missing",
        "entry.json",
        "Candidate Entry manifest is missing",
      ),
    };
  }
  try {
    return {
      ok: true,
      entry: JSON.parse(source) as ReferenceEntryManifest,
    };
  } catch (error) {
    return {
      ok: false,
      finding: hardFinding(
        "entry-json",
        "entry.json",
        error instanceof Error ? error.message : "Entry JSON is invalid",
      ),
    };
  }
}

export function validateFactCoverage(
  workspace: DraftWorkspace,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const requiredKinds = PROFILE_DEFINITIONS[workspace.draft.profile].factKinds;
  const groupsByKind = new Map(
    workspace.facts.groups.map((group) => [group.kind, group]),
  );
  const sourceIds = new Set(
    workspace.sources.sources.map((source) => source.id),
  );
  if (sourceIds.size !== workspace.sources.sources.length) {
    findings.push(
      hardFinding(
        "source-id-duplicate",
        "sources.json/sources",
        "Source IDs must be unique",
      ),
    );
  }
  const groupKinds = new Set<AuthoringFactKind>();
  for (const group of workspace.facts.groups) {
    if (groupKinds.has(group.kind)) {
      findings.push(
        hardFinding(
          "fact-kind-duplicate",
          `facts.json/groups/${group.id}/kind`,
          `Fact kind ${group.kind} must appear at most once`,
        ),
      );
    }
    groupKinds.add(group.kind);
  }

  for (const kind of requiredKinds) {
    const group = groupsByKind.get(kind);
    if (group === undefined) {
      findings.push(
        hardFinding(
          "fact-missing",
          "facts.json/groups",
          `Required fact group ${kind} is missing`,
        ),
      );
      continue;
    }
    if (group.status === "unverified") {
      findings.push(
        hardFinding(
          "fact-unverified",
          `facts.json/groups/${group.id}`,
          `Fact group ${kind} has not been reviewed`,
        ),
      );
    }
    for (const sourceId of group.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        findings.push(
          hardFinding(
            "fact-source-missing",
            `facts.json/groups/${group.id}/sourceIds`,
            `Fact group ${kind} references missing source ${sourceId}`,
          ),
        );
      }
    }
  }
  return findings;
}

export const NORMATIVE_FACT_KINDS = new Set<AuthoringFactKind>([
  "signature",
  "availability",
  "parameters",
  "return",
  "ownership",
  "errors",
  "complexity",
  "lifetime_invalidation",
  "thread_safety",
  "direct_include",
  "facility_map",
]);

export function hasPrimaryWorkingDraftEvidence(
  group: AuthoringFactGroup,
  sources: readonly AuthoringSourceRecord[],
): boolean {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  return group.sourceIds.some((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (source?.kind !== "primary" || source.standardSection === undefined) {
      return false;
    }
    try {
      const url = new URL(source.url);
      return url.hostname === "eel.is" && url.pathname.startsWith("/c++draft");
    } catch {
      return false;
    }
  });
}

export function validateSourceAlignment(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  today: string,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const usedSourceIds = new Set(
    workspace.facts.groups.flatMap((group) => [...group.sourceIds]),
  );
  const publishedSourceUrls = new Set(
    entry.sources.map((source) => source.url),
  );
  const publishedSourcesByUrl = new Map(
    entry.sources.map((source) => [source.url, source]),
  );
  if (entry.verifiedAt > today) {
    findings.push(
      hardFinding(
        "entry-verification-future",
        "entry.json/verifiedAt",
        `Verification date cannot be later than ${today}`,
      ),
    );
  }
  for (const source of workspace.sources.sources) {
    let hostname = "";
    try {
      hostname = new URL(source.url).hostname;
    } catch {
      // URL shape is handled by the source Schema before this validator runs.
    }
    if (
      (hostname === "cppreference.com" ||
        hostname.endsWith(".cppreference.com")) &&
      source.kind !== "secondary"
    ) {
      findings.push(
        hardFinding(
          "source-classification",
          `sources.json/sources/${source.id}/kind`,
          "cppreference must be classified as a secondary source",
        ),
      );
    }
    if (!usedSourceIds.has(source.id)) continue;
    if (!publishedSourceUrls.has(source.url)) {
      findings.push(
        hardFinding(
          "source-not-published",
          `sources.json/sources/${source.id}`,
          `Used source ${source.id} is missing from entry.json sources`,
        ),
      );
    } else {
      const published = publishedSourcesByUrl.get(source.url);
      if (published?.kind !== source.kind) {
        findings.push(
          hardFinding(
            "source-kind-mismatch",
            `entry.json/sources/${source.id}`,
            `Published source kind must remain ${source.kind}`,
          ),
        );
      }
    }
    if (source.verifiedAt > today) {
      findings.push(
        hardFinding(
          "source-verification-future",
          `sources.json/sources/${source.id}/verifiedAt`,
          `Verification date cannot be later than ${today}`,
        ),
      );
    }
    if (source.verifiedAt < entry.verifiedAt) {
      findings.push(
        hardFinding(
          "source-verification-stale",
          `sources.json/sources/${source.id}/verifiedAt`,
          `Source evidence predates Entry verification ${entry.verifiedAt}`,
        ),
      );
    }
  }
  for (const group of workspace.facts.groups) {
    if (group.status !== "verified" || !NORMATIVE_FACT_KINDS.has(group.kind)) {
      continue;
    }
    if (!hasPrimaryWorkingDraftEvidence(group, workspace.sources.sources)) {
      findings.push(
        hardFinding(
          "fact-normative-source-missing",
          `facts.json/groups/${group.id}/sourceIds`,
          `Normative fact ${group.kind} requires a cited Working Draft clause`,
        ),
      );
    }
  }
  return findings;
}

export function validateContentProfile(
  workspace: DraftWorkspace,
): AuthoringFinding[] {
  const content = workspace.files["content.md"];
  if (content === undefined) {
    return [
      hardFinding(
        "content-missing",
        "content.md",
        "Candidate Markdown content is missing",
      ),
    ];
  }
  const findings: AuthoringFinding[] = [];
  if (/\bTODO\b/u.test(content)) {
    findings.push(
      hardFinding(
        "content-placeholder",
        "content.md",
        "Candidate Markdown still contains TODO placeholders",
        "medium",
      ),
    );
  }
  for (const heading of PROFILE_DEFINITIONS[workspace.draft.profile].headings) {
    if (!content.includes(`## ${heading}`)) {
      findings.push(
        hardFinding(
          "content-section-missing",
          "content.md",
          `Required section ${heading} is missing`,
          "medium",
        ),
      );
    }
  }
  return findings;
}

export function validateEntryIdentity(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const target = workspace.draft.target;
  for (const [field, actual, expected] of [
    ["id", entry.id, target.entryId],
    ["kind", entry.kind, target.kind],
    ["slug", entry.slug, target.slug],
    ["title", entry.title, target.title],
  ] as const) {
    if (actual !== expected) {
      findings.push(
        hardFinding(
          "entry-target-mismatch",
          `entry.json/${field}`,
          `Expected ${expected}, received ${actual}`,
        ),
      );
    }
  }
  if (entry.content.path !== workspace.draft.targetPaths.content) {
    findings.push(
      hardFinding(
        "entry-path-mismatch",
        "entry.json/content/path",
        `Expected ${workspace.draft.targetPaths.content}`,
      ),
    );
  }
  return findings;
}

export function evaluateAuthoringGraphGate(
  targetEntryId: string,
  entry: ReferenceEntryManifest,
  catalog: AuthoringCatalogContext,
  scope: "incremental" | "full",
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const effectiveEntries = [
    ...catalog.entries.filter(({ id }) => id !== targetEntryId),
    entry,
  ];
  const entryIds = new Set(effectiveEntries.map(({ id }) => id));
  const categoryIds = new Set(catalog.categoryIds);
  const affected = new Set(
    analyzeAuthoringImpact(targetEntryId, entry, catalog).entryIds,
  );
  const selectedEntries =
    scope === "full"
      ? effectiveEntries
      : effectiveEntries.filter(({ id }) => affected.has(id));
  const pathFor = (entryId: string, field: string): string =>
    entryId === targetEntryId
      ? `entry.json/${field}`
      : `catalog/entries/${entryId}/${field}`;
  for (const candidate of selectedEntries) {
    for (const relatedId of candidate.relatedEntryIds) {
      if (entryIds.has(relatedId)) continue;
      findings.push(
        hardFinding(
          "related-entry-missing",
          pathFor(candidate.id, "relatedEntryIds"),
          `Related Entry ${relatedId} referenced by ${candidate.id} is not in the active catalog`,
          "medium",
        ),
      );
    }
    for (const categoryId of candidate.categories) {
      if (categoryIds.has(categoryId)) continue;
      findings.push(
        hardFinding(
          "category-missing",
          pathFor(candidate.id, "categories"),
          `Category ${categoryId} referenced by ${candidate.id} is not in the active catalog`,
          "medium",
        ),
      );
    }
    const owner = effectiveEntries.find(
      ({ id, slug }) => id !== candidate.id && slug === candidate.slug,
    );
    if (owner !== undefined) {
      findings.push(
        hardFinding(
          "slug-conflict",
          pathFor(candidate.id, "slug"),
          `Slug is already owned by ${owner.id}`,
        ),
      );
    }
    const redirect = catalog.redirects.find(
      ({ fromSlug }) => fromSlug === candidate.slug,
    );
    if (redirect !== undefined) {
      findings.push(
        hardFinding(
          "redirect-slug-conflict",
          pathFor(candidate.id, "slug"),
          `Slug is preserved as a historical redirect to ${redirect.toEntryId}`,
        ),
      );
    }
  }
  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code),
  );
}

export function analyzeAuthoringImpact(
  targetEntryId: string,
  entry: ReferenceEntryManifest,
  catalog: AuthoringCatalogContext,
): {
  readonly entryIds: readonly string[];
  readonly activityIds: readonly string[];
} {
  const entryIds = new Set<string>([targetEntryId, ...entry.relatedEntryIds]);
  for (const candidate of catalog.entries) {
    if (
      candidate.relatedEntryIds.includes(targetEntryId) ||
      candidate.relatedEntryIds.some((id) => entry.relatedEntryIds.includes(id))
    ) {
      entryIds.add(candidate.id);
    }
  }
  for (const categoryId of entry.categories) {
    if (catalog.entryIds.includes(categoryId)) entryIds.add(categoryId);
  }
  for (const redirect of catalog.redirects) {
    if (
      redirect.toEntryId === targetEntryId ||
      entryIds.has(redirect.toEntryId)
    ) {
      entryIds.add(redirect.toEntryId);
    }
  }
  const activityIds = new Set<string>();
  for (const entryId of entryIds) {
    for (const activityId of catalog.activityIdsByEntryId?.[entryId] ?? []) {
      activityIds.add(activityId);
    }
  }
  return { entryIds: [...entryIds], activityIds: [...activityIds].sort() };
}

export async function validateExamples(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  validator: AuthoringExampleValidator | undefined,
  cache: AuthoringValidationCache | undefined,
): Promise<{
  readonly findings: AuthoringFinding[];
  readonly cacheEvidence: AuthoringReport["cacheEvidence"];
}> {
  const findings: AuthoringFinding[] = [];
  const cacheEvidence: AuthoringReport["cacheEvidence"][number][] = [];
  const expectedCount =
    PROFILE_DEFINITIONS[workspace.draft.profile].examples.length;
  if (entry.examples.length < expectedCount) {
    findings.push(
      hardFinding(
        "examples-missing",
        "entry.json/examples",
        `Profile requires at least ${expectedCount} example(s)`,
        "medium",
      ),
    );
  }
  for (const example of entry.examples) {
    const prefix = `${workspace.draft.targetPaths.examples}/`;
    if (!example.path.startsWith(prefix)) {
      findings.push(
        hardFinding(
          "example-path-mismatch",
          `entry.json/examples/${example.id}/path`,
          `Example path must be under ${workspace.draft.targetPaths.examples}`,
        ),
      );
      continue;
    }
    const localPath = `examples/${example.path.slice(prefix.length)}`;
    const source = workspace.files[localPath];
    if (source === undefined) {
      findings.push(
        hardFinding(
          "example-source-missing",
          localPath,
          `Example source ${localPath} is missing`,
        ),
      );
      continue;
    }
    if (validator === undefined) {
      findings.push(
        hardFinding(
          "example-validator-unavailable",
          localPath,
          "No example validator is configured",
        ),
      );
      continue;
    }
    const request = {
      entryId: entry.id,
      example,
      source,
    };
    let cacheKey: string | undefined;
    let cached: AuthoringValidationCacheValue | undefined;
    try {
      cacheKey =
        cache === undefined || validator.cacheKey === undefined
          ? undefined
          : await validator.cacheKey(request);
      cached =
        cacheKey === undefined || cache === undefined
          ? undefined
          : await cache.get(cacheKey);
    } catch {
      cacheKey = undefined;
      cached = undefined;
    }
    let issues: readonly AuthoringValidationIssue[];
    if (cached !== undefined) {
      issues = cached.issues;
      cacheEvidence.push({ key: cacheKey!, status: "hit" });
    } else {
      issues = await validator.validate(request);
      if (cacheKey !== undefined && cache !== undefined) {
        try {
          await cache.put(cacheKey, { schemaVersion: 1, issues });
        } catch {
          // The cache is disposable; a successful validation remains authoritative.
        }
        cacheEvidence.push({ key: cacheKey, status: "miss" });
      } else {
        cacheEvidence.push({
          key: `${entry.id}/${example.id}`,
          status: "not_checked",
        });
      }
    }
    findings.push(...schemaFindings("example-invalid", localPath, issues));
  }
  return { findings, cacheEvidence };
}

export async function validateFactReuse(
  workspace: DraftWorkspace,
  repository: ReferenceDraftRepository,
  selectedGroupIds?: ReadonlySet<string>,
): Promise<AuthoringValidationIssue[]> {
  const issues: AuthoringValidationIssue[] = [];
  for (const [index, group] of workspace.facts.groups.entries()) {
    if (
      group.reusedFrom === undefined ||
      (selectedGroupIds !== undefined && !selectedGroupIds.has(group.id))
    ) {
      continue;
    }
    const path = `/groups/${index}/reusedFrom`;
    const reference = group.reusedFrom;
    if (!workspace.proposal.relatedEntryIds.includes(reference.draftId)) {
      issues.push({
        path: `${path}/draftId`,
        message: `Reusable facts must come from a related draft: ${reference.draftId}`,
        keyword: "fact-reuse-unrelated",
      });
      continue;
    }
    const sourceWorkspace = await repository.get(reference.draftId);
    if (sourceWorkspace === undefined) {
      issues.push({
        path: `${path}/draftId`,
        message: `Reusable fact source draft is missing: ${reference.draftId}`,
        keyword: "fact-reuse-source-missing",
      });
      continue;
    }
    if (
      sourceWorkspace.draft.revision !== reference.draftRevision ||
      sourceWorkspace.draft.state !== "checked" ||
      sourceWorkspace.report.status !== "ready" ||
      sourceWorkspace.report.draftRevision !== reference.draftRevision ||
      sourceWorkspace.report.inputDigest !==
        authoringInputDigest(sourceWorkspace.files)
    ) {
      issues.push({
        path: `${path}/draftRevision`,
        message:
          "Reusable fact source is no longer the referenced ready revision",
        keyword: "fact-reuse-revision-stale",
      });
      continue;
    }
    const sourceGroup = sourceWorkspace.facts.groups.find(
      ({ id }) => id === reference.groupId,
    );
    if (sourceGroup?.status !== "verified") {
      issues.push({
        path: `${path}/groupId`,
        message: "Reusable fact source group is missing or not verified",
        keyword: "fact-reuse-source-unverified",
      });
      continue;
    }
    const sourceDigest = authoringFactEvidenceDigest(
      sourceGroup,
      sourceWorkspace.sources.sources,
    );
    if (sourceDigest !== reference.evidenceDigest) {
      issues.push({
        path: `${path}/evidenceDigest`,
        message: "Reusable fact evidence digest no longer matches its source",
        keyword: "fact-reuse-digest-mismatch",
      });
      continue;
    }
    if (
      group.summary !== "" ||
      group.sourceIds.length !== 0 ||
      group.decision !== undefined
    ) {
      issues.push({
        path,
        message:
          "A reused fact must remain a reference and must not copy source prose or evidence into the target draft",
        keyword: "fact-reuse-content-copied",
      });
    }
  }
  return issues;
}

export async function materializeWorkspaceEvidence(
  workspace: DraftWorkspace,
  repository: ReferenceDraftRepository,
  selectedGroupIds?: ReadonlySet<string>,
): Promise<DraftWorkspace> {
  const groups: AuthoringFactGroup[] = [];
  const sourcesById = new Map(
    workspace.sources.sources.map((source) => [source.id, source]),
  );
  for (const group of workspace.facts.groups) {
    if (
      group.reusedFrom === undefined ||
      (selectedGroupIds !== undefined && !selectedGroupIds.has(group.id))
    ) {
      groups.push(group);
      continue;
    }
    const sourceWorkspace = await repository.get(group.reusedFrom.draftId);
    const sourceGroup = sourceWorkspace?.facts.groups.find(
      ({ id }) => id === group.reusedFrom!.groupId,
    );
    if (sourceWorkspace === undefined || sourceGroup === undefined) {
      throw new Error(`Reusable fact source is missing for ${group.id}`);
    }
    for (const sourceId of sourceGroup.sourceIds) {
      const source = sourceWorkspace.sources.sources.find(
        ({ id }) => id === sourceId,
      );
      if (source === undefined) {
        throw new Error(`Reusable source evidence is missing: ${sourceId}`);
      }
      sourcesById.set(source.id, source);
    }
    groups.push({
      ...sourceGroup,
      id: group.id,
      reusedFrom: group.reusedFrom,
    });
  }
  return {
    ...workspace,
    facts: { ...workspace.facts, groups },
    sources: {
      ...workspace.sources,
      sources: [...sourcesById.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    },
  };
}

export function contextPackDigest(
  pack: Omit<AuthoringContextPack, "digest">,
): string {
  return createHash("sha256").update(JSON.stringify(pack)).digest("hex");
}

export function hardFindingCategory(code: string): string {
  if (/^(?:catalog|slug|related|category)/u.test(code)) return "catalog";
  if (/^(?:fact|source)/u.test(code)) return "evidence";
  if (/^(?:example)/u.test(code)) return "examples";
  if (/^(?:content)/u.test(code)) return "content";
  if (/(?:schema|json|missing|draft-id-mismatch)/u.test(code)) {
    return "artifacts";
  }
  return "other";
}

export function correctionRates(
  counts: AuthoringCorrectionCounts,
  entries: number,
): AuthoringCorrectionCounts {
  return {
    factual: counts.factual / entries,
    example: counts.example / entries,
  };
}
