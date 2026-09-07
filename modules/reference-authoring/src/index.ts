import { createHash } from "node:crypto";

import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type { ReferenceEntryKind } from "@cpp-learn/contracts";
import type {
  ReferenceEntryManifest,
  ReferenceExampleManifest,
} from "@cpp-learn/reference";
import { validateReferenceEntryManifest } from "@cpp-learn/reference-schema";

import authoringBatchReportSchema from "./authoring-batch-report.schema.json" with { type: "json" };
import authoringCatalogProposalSchema from "./authoring-catalog-proposal.schema.json" with { type: "json" };
import authoringContextPackSchema from "./authoring-context-pack.schema.json" with { type: "json" };
import authoringDraftSchema from "./authoring-draft.schema.json" with { type: "json" };
import authoringFactsSchema from "./authoring-facts.schema.json" with { type: "json" };
import authoringGeneratedReviewSchema from "./authoring-generated-review.schema.json" with { type: "json" };
import authoringGenerationReceiptSchema from "./authoring-generation-receipt.schema.json" with { type: "json" };
import authoringPublicationPlanSchema from "./authoring-publication-plan.schema.json" with { type: "json" };
import authoringReportSchema from "./authoring-report.schema.json" with { type: "json" };
import authoringSourcesSchema from "./authoring-sources.schema.json" with { type: "json" };
import type {
  AuthoringValidationCache,
  AuthoringValidationCacheValue,
} from "./cache.js";
import type {
  AuthoringPublicationCandidate,
  AuthoringPublisher,
} from "./publisher.js";
import {
  authoringGenerationSchema,
  replaceMarkdownSection,
  validateAuthoringSectionGeneration,
  type AuthoringSectionGeneration,
} from "./generation.js";

export const AUTHORING_FACT_KINDS = [
  "selection",
  "signature",
  "availability",
  "parameters",
  "return",
  "ownership",
  "errors",
  "complexity",
  "lifetime_invalidation",
  "thread_safety",
  "scope",
  "direct_include",
  "facility_map",
  "examples",
  "pitfalls",
  "js_comparison",
] as const;

export type AuthoringFactKind = (typeof AUTHORING_FACT_KINDS)[number];
export type AuthoringProfile = "callable" | "entity" | "header" | "navigation";

export interface AuthoringValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface PrepareDraftTarget {
  readonly entryId: string;
  readonly kind: ReferenceEntryKind;
  readonly slug: string;
  readonly title: string;
}

export interface PrepareDraftRequest {
  readonly target: PrepareDraftTarget;
  readonly reuse?: {
    readonly draftId: string;
    readonly factGroupIds: readonly string[];
  };
}

export interface AuthoringDraftManifest {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly revision: number;
  readonly state: "draft" | "ready_for_review" | "checked";
  readonly profile: AuthoringProfile;
  readonly target: PrepareDraftTarget;
  readonly targetPaths: AuthoringTargetPaths;
  readonly affectedEntryIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthoringTargetPaths {
  readonly entry: string;
  readonly content: string;
  readonly examples: string;
  readonly catalog: "catalog.json";
}

export interface AuthoringFactGroup {
  readonly id: string;
  readonly kind: AuthoringFactKind;
  readonly status: "unverified" | "verified" | "not_applicable";
  readonly summary: string;
  readonly sourceIds: readonly string[];
  readonly decision?: string;
  readonly reusedFrom?: AuthoringFactReuse;
}

export interface AuthoringFactReuse {
  readonly draftId: string;
  readonly draftRevision: number;
  readonly groupId: string;
  readonly evidenceDigest: string;
}

export interface AuthoringFactSheet {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly groups: readonly AuthoringFactGroup[];
}

export interface AuthoringSourceLedger {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly sources: readonly AuthoringSourceRecord[];
}

export interface AuthoringSourceRecord {
  readonly id: string;
  readonly kind: "primary" | "secondary" | "vendor";
  readonly title: string;
  readonly url: string;
  readonly verifiedAt: string;
  readonly standardSection?: string;
  readonly notes?: string;
}

export interface BuildAuthoringContextRequest {
  readonly draftId: string;
  readonly factGroupIds: readonly string[];
}

export interface AuthoringContextPack {
  readonly schemaVersion: 2;
  readonly draftId: string;
  readonly draftRevision: number;
  readonly inputDigest: string;
  readonly target: PrepareDraftTarget;
  readonly profile: AuthoringProfile;
  readonly requiredHeadings: readonly string[];
  readonly factGroups: readonly {
    readonly id: string;
    readonly kind: AuthoringFactKind;
    readonly summary: string;
    readonly sourceIds: readonly string[];
    readonly decision?: string;
    readonly reusedFrom?: AuthoringFactReuse;
    readonly evidenceDigest: string;
  }[];
  readonly sources: readonly AuthoringSourceRecord[];
  readonly policy: {
    readonly mode: "verified-facts-only";
    readonly allowedFactGroupIds: readonly string[];
    readonly requirements: readonly string[];
  };
  readonly digest: string;
}

export type BuildAuthoringContextResult =
  | { readonly ok: true; readonly pack: AuthoringContextPack }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "context_blocked";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface AuthoringGeneratedClaim {
  readonly id: string;
  readonly text: string;
  readonly factGroupIds: readonly string[];
}

export interface ReviewGeneratedClaimsRequest {
  readonly context: AuthoringContextPack;
  readonly claims: readonly AuthoringGeneratedClaim[];
}

export interface AuthoringGeneratedReview {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly contextDigest: string;
  readonly status: "accepted" | "requires-review";
  readonly acceptedClaimIds: readonly string[];
  readonly reviewQueue: readonly {
    readonly claimId: string;
    readonly text: string;
    readonly status: "unverified";
    readonly reason: "missing-fact-reference" | "fact-not-allowed";
    readonly factGroupIds: readonly string[];
    readonly unknownFactGroupIds: readonly string[];
  }[];
  readonly digest: string;
}

export type ReviewGeneratedClaimsResult =
  | { readonly ok: true; readonly review: AuthoringGeneratedReview }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "invalid_context"
        | "draft_not_found"
        | "context_changed";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface ApplyGeneratedSectionRequest {
  readonly context: AuthoringContextPack;
  readonly expectedRevision: number;
  readonly generation: AuthoringSectionGeneration;
}

export type ApplyGeneratedSectionResult =
  | {
      readonly ok: true;
      readonly workspace: DraftWorkspace;
      readonly review: AuthoringGeneratedReview;
      readonly receiptPath: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "revision_conflict"
        | "context_changed"
        | "generation_blocked"
        | "write_conflict"
        | "write_failed";
      readonly issues: readonly AuthoringValidationIssue[];
      readonly review?: AuthoringGeneratedReview;
    };

export interface AuthoringCorrectionCounts {
  readonly factual: number;
  readonly example: number;
}

export interface AuthoringBatchTimingObservation {
  readonly authorActiveMinutes: number;
  readonly machineMinutes: number;
  readonly fullGateMinutes: number;
  readonly baselineAuthorActiveMinutes: number;
  readonly baselineEntries: number;
}

export interface AuthoringBatchQualityObservation {
  readonly prePublicationCorrections: AuthoringCorrectionCounts;
  readonly postPublicationCorrections: AuthoringCorrectionCounts;
  readonly baselinePostPublicationCorrections: AuthoringCorrectionCounts;
  readonly highRiskClaimsReviewed: number;
  readonly flakyReruns: number;
}

export interface MeasureAuthoringBatchRequest {
  readonly batchId: string;
  readonly draftIds: readonly string[];
  readonly timing: AuthoringBatchTimingObservation;
  readonly quality: AuthoringBatchQualityObservation;
}

export interface AuthoringBatchReport {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly draftIds: readonly string[];
  readonly drafts: readonly {
    readonly draftId: string;
    readonly draftRevision: number;
    readonly inputDigest: string;
    readonly status: AuthoringReport["status"];
    readonly examples: number;
  }[];
  readonly status: "meets-target" | "needs-attention";
  readonly entries: number;
  readonly readyEntries: number;
  readonly examples: number;
  readonly cache: {
    readonly hits: number;
    readonly misses: number;
    readonly notChecked: number;
    readonly hitRate: number;
  };
  readonly findings: {
    readonly hard: number;
    readonly warning: number;
    readonly highRisk: number;
    readonly hardByCategory: Readonly<Record<string, number>>;
  };
  readonly timing: {
    readonly authorActiveMinutes: number;
    readonly machineMinutes: number;
    readonly fullGateMinutes: number;
    readonly baselineAuthorActiveMinutes: number;
    readonly baselineEntries: number;
    readonly activeMinutesPerEntry: number;
    readonly baselineActiveMinutesPerEntry: number;
  };
  readonly quality: {
    readonly prePublicationCorrections: AuthoringCorrectionCounts;
    readonly postPublicationCorrections: AuthoringCorrectionCounts;
    readonly baselinePostPublicationCorrections: AuthoringCorrectionCounts;
    readonly postPublicationCorrectionRates: AuthoringCorrectionCounts;
    readonly baselinePostPublicationCorrectionRates: AuthoringCorrectionCounts;
    readonly highRiskClaimsReviewed: number;
    readonly flakyReruns: number;
  };
  readonly targets: {
    readonly fiveEntryBatch: boolean;
    readonly activeMinutesWithinTarget: boolean;
    readonly throughputImproved: boolean;
    readonly noFactualDefectRegression: boolean;
    readonly noExampleDefectRegression: boolean;
    readonly noEscapedCorrectionRegression: boolean;
    readonly allHighRiskClaimsReviewed: boolean;
    readonly noFlakyReruns: boolean;
  };
  readonly digest: string;
}

export type MeasureAuthoringBatchResult =
  | { readonly ok: true; readonly report: AuthoringBatchReport }
  | {
      readonly ok: false;
      readonly code: "invalid_request" | "draft_not_found" | "batch_unreadable";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface AuthoringReport {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly draftRevision: number;
  readonly inputDigest: string;
  readonly status: "not_checked" | "blocked" | "ready";
  readonly affectedEntryIds: readonly string[];
  readonly affectedActivityIds: readonly string[];
  readonly findings: readonly {
    readonly severity: "hard" | "warning";
    readonly risk: "high" | "medium" | "low";
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly reviewQueue: readonly {
    readonly severity: "warning";
    readonly risk: "high" | "medium" | "low";
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly cacheEvidence: readonly {
    readonly key: string;
    readonly status: "hit" | "miss" | "not_checked";
  }[];
  readonly generatedSections?: readonly {
    readonly heading: string;
    readonly receiptPath: string;
    readonly contextDigest: string;
    readonly appliedRevision: number;
    readonly reviewStatus: "human-review-required";
  }[];
}

export interface AuthoringGenerationReceipt {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly appliedRevision: number;
  readonly contextDigest: string;
  readonly generation: AuthoringSectionGeneration;
  readonly review: AuthoringGeneratedReview;
  readonly appliedAt: string;
}

export interface AuthoringPublicationPlan {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly mode: "dry_run" | "apply";
  readonly files: readonly {
    readonly path: string;
    readonly digest?: string;
    readonly operation: "create" | "update" | "delete";
    readonly previousDigest?: string;
  }[];
}

export interface DraftWorkspace {
  readonly draft: AuthoringDraftManifest;
  readonly proposal: AuthoringCatalogProposal;
  readonly facts: AuthoringFactSheet;
  readonly sources: AuthoringSourceLedger;
  readonly report: AuthoringReport;
  readonly files: Readonly<Record<string, string>>;
}

export type PrepareDraftResult =
  | {
      readonly ok: true;
      readonly created: boolean;
      readonly workspace: DraftWorkspace;
    }
  | {
      readonly ok: false;
      readonly code: "invalid_request" | "draft_conflict";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface CheckDraftRequest {
  readonly draftId: string;
}

export interface PublishDraftRequest {
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly mode: "dry_run" | "apply";
}

export type PublishDraftResult =
  | {
      readonly ok: true;
      readonly applied: boolean;
      readonly plan: AuthoringPublicationPlan;
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "draft_not_ready"
        | "revision_conflict"
        | "draft_changed"
        | "publication_failed";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export type CheckDraftResult =
  | {
      readonly ok: true;
      readonly report: AuthoringReport;
      readonly workspace: DraftWorkspace;
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "revision_conflict";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface AuthoringCatalogContext {
  readonly entries: readonly {
    readonly id: string;
    readonly slug: string;
    readonly kind: ReferenceEntryKind;
    readonly title: string;
    readonly symbol?: string;
    readonly header?: string;
    readonly categories: readonly string[];
    readonly relatedEntryIds: readonly string[];
  }[];
  readonly entryIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly slugsByEntryId: Readonly<Record<string, string>>;
  readonly redirects: readonly {
    readonly fromSlug: string;
    readonly toEntryId: string;
  }[];
  readonly activityIdsByEntryId?: Readonly<Record<string, readonly string[]>>;
}

export interface AuthoringCatalogContextAdapter {
  load(): Promise<AuthoringCatalogContext>;
}

export interface AuthoringExampleValidationRequest {
  readonly entryId: string;
  readonly example: ReferenceExampleManifest;
  readonly source: string;
}

export interface AuthoringExampleValidator {
  cacheKey?(request: AuthoringExampleValidationRequest): Promise<string>;
  validate(
    request: AuthoringExampleValidationRequest,
  ): Promise<readonly AuthoringValidationIssue[]>;
}

export interface AuthoringContentQualityRequest {
  readonly entry: ReferenceEntryManifest;
  readonly content: string;
}

export interface AuthoringContentQualityValidator {
  validate(
    request: AuthoringContentQualityRequest,
  ): Promise<readonly AuthoringValidationIssue[]>;
}

export interface ReferenceAuthoring {
  applyGeneratedSection(
    request: ApplyGeneratedSectionRequest,
  ): Promise<ApplyGeneratedSectionResult>;
  buildContext(
    request: BuildAuthoringContextRequest,
  ): Promise<BuildAuthoringContextResult>;
  measureBatch(
    request: MeasureAuthoringBatchRequest,
  ): Promise<MeasureAuthoringBatchResult>;
  reviewGeneratedClaims(
    request: ReviewGeneratedClaimsRequest,
  ): Promise<ReviewGeneratedClaimsResult>;
  prepare(request: PrepareDraftRequest): Promise<PrepareDraftResult>;
  check(request: CheckDraftRequest): Promise<CheckDraftResult>;
  publish(request: PublishDraftRequest): Promise<PublishDraftResult>;
}

export interface ReferenceDraftRepository {
  get(draftId: string): Promise<DraftWorkspace | undefined>;
  reserve(workspace: DraftWorkspace): Promise<{
    readonly created: boolean;
    readonly workspace: DraftWorkspace;
  }>;
  commitWorkspace(input: {
    readonly draftId: string;
    readonly expectedRevision: number;
    readonly expectedFiles: Readonly<Record<string, string>>;
    readonly workspace: DraftWorkspace;
  }): Promise<boolean>;
}

export interface ReferenceAuthoringDependencies {
  readonly drafts: ReferenceDraftRepository;
  readonly catalog?: AuthoringCatalogContextAdapter;
  readonly examples?: AuthoringExampleValidator;
  readonly quality?: AuthoringContentQualityValidator;
  readonly cache?: AuthoringValidationCache;
  readonly publisher?: AuthoringPublisher;
  readonly clock?: () => Date;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateBatchReport = ajv.compile(authoringBatchReportSchema);
const validateDraft = ajv.compile(authoringDraftSchema);
const validateCatalogProposal = ajv.compile(authoringCatalogProposalSchema);
const validateContextPack = ajv.compile(authoringContextPackSchema);
const validateFacts = ajv.compile(authoringFactsSchema);
const validateGeneratedReview = ajv.compile(authoringGeneratedReviewSchema);
ajv.addSchema(authoringGenerationSchema);
const validateGenerationReceipt = ajv.compile(authoringGenerationReceiptSchema);
const validateSources = ajv.compile(authoringSourcesSchema);
const validateReport = ajv.compile(authoringReportSchema);
const validatePublicationPlan = ajv.compile(authoringPublicationPlanSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  return error.instancePath || "/";
}

function validationIssues(
  validator: ValidateFunction,
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (validator(value)) return [];
  return (validator.errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword,
  }));
}

export function validateAuthoringDraft(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateDraft, value);
}

export function validateAuthoringBatchReport(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateBatchReport, value);
}

export function validateAuthoringCatalogProposal(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateCatalogProposal, value);
}

export function validateAuthoringContextPack(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateContextPack, value);
}

export function validateAuthoringGeneratedReview(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateGeneratedReview, value);
}

export function validateAuthoringGenerationReceipt(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  const issues = [...validationIssues(validateGenerationReceipt, value)];
  if (issues.length > 0) return issues;
  const receipt = value as AuthoringGenerationReceipt;
  if (
    receipt.generation.draftId !== receipt.draftId ||
    receipt.review.draftId !== receipt.draftId
  ) {
    issues.push({
      path: "/draftId",
      message: "Receipt, generation, and review draft identities must match",
      keyword: "identity",
    });
  }
  if (
    receipt.generation.contextDigest !== receipt.contextDigest ||
    receipt.review.contextDigest !== receipt.contextDigest
  ) {
    issues.push({
      path: "/contextDigest",
      message: "Receipt, generation, and review context digests must match",
      keyword: "digest",
    });
  }
  if (receipt.review.status !== "accepted") {
    issues.push({
      path: "/review/status",
      message: "An applied generation receipt must contain an accepted review",
      keyword: "const",
    });
  }
  return issues;
}

export function validateAuthoringFactSheet(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateFacts, value);
}

export function validateAuthoringSourceLedger(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateSources, value);
}

export function validateAuthoringReport(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateReport, value);
}

export function validateAuthoringPublicationPlan(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validatePublicationPlan, value);
}

const PROFILE_BY_KIND: Readonly<Record<ReferenceEntryKind, AuthoringProfile>> =
  {
    landing: "navigation",
    header: "header",
    type: "entity",
    object: "entity",
    function: "callable",
    member: "callable",
    concept: "entity",
    guide: "navigation",
  };

interface AuthoringProfileDefinition {
  readonly factKinds: readonly AuthoringFactKind[];
  readonly headings: readonly string[];
  readonly examples: readonly ("minimal" | "realistic")[];
}

export interface AuthoringCatalogProposal {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly entryPath: string;
  readonly categories: readonly string[];
  readonly relatedEntryIds: readonly string[];
  readonly affectedRedirects: readonly {
    readonly fromSlug: string;
    readonly toEntryId: string;
  }[];
}

const PROFILE_DEFINITIONS: Readonly<
  Record<AuthoringProfile, AuthoringProfileDefinition>
> = {
  callable: {
    factKinds: [
      "selection",
      "signature",
      "availability",
      "parameters",
      "return",
      "errors",
      "complexity",
      "lifetime_invalidation",
      "thread_safety",
      "examples",
      "pitfalls",
      "js_comparison",
    ],
    headings: [
      "快速信息",
      "什么时候使用",
      "声明与重载",
      "参数与前置条件",
      "返回值",
      "复杂度",
      "异常与错误",
      "生命周期与失效",
      "线程安全",
      "示例",
      "常见误区",
      "与 JavaScript 对照",
      "相关条目",
      "来源",
    ],
    examples: ["minimal", "realistic"],
  },
  entity: {
    factKinds: [
      "selection",
      "signature",
      "availability",
      "ownership",
      "errors",
      "complexity",
      "lifetime_invalidation",
      "thread_safety",
      "examples",
      "pitfalls",
      "js_comparison",
    ],
    headings: [
      "快速信息",
      "什么时候使用",
      "类型与所有权",
      "复杂度",
      "异常与错误",
      "生命周期与失效",
      "线程安全",
      "示例",
      "常见误区",
      "与 JavaScript 对照",
      "相关条目",
      "来源",
    ],
    examples: ["minimal", "realistic"],
  },
  header: {
    factKinds: [
      "scope",
      "availability",
      "direct_include",
      "facility_map",
      "examples",
      "pitfalls",
    ],
    headings: [
      "快速信息",
      "何时直接包含",
      "设施地图",
      "标准版本边界",
      "示例",
      "常见误区",
      "相关条目",
      "来源",
    ],
    examples: ["minimal"],
  },
  navigation: {
    factKinds: ["scope", "selection", "availability", "pitfalls"],
    headings: ["适用范围", "如何选择", "核心条目", "常见误区", "来源"],
    examples: ["minimal"],
  },
};

function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const GENERATED_DRAFT_FILES = new Set([
  "report.json",
  "preview.html",
  "publication-plan.json",
]);

function digestibleAuthoringContent(path: string, content: string): string {
  if (path !== "draft.json") return content;
  try {
    const draft = JSON.parse(content) as AuthoringDraftManifest;
    return JSON.stringify({
      schemaVersion: draft.schemaVersion,
      draftId: draft.draftId,
      profile: draft.profile,
      target: draft.target,
      targetPaths: draft.targetPaths,
      createdAt: draft.createdAt,
    });
  } catch {
    return content;
  }
}

export function authoringInputDigest(
  files: Readonly<Record<string, string>>,
): string {
  const hash = createHash("sha256");
  for (const path of Object.keys(files)
    .filter((candidate) => !GENERATED_DRAFT_FILES.has(candidate))
    .sort()) {
    const content = digestibleAuthoringContent(path, files[path]!);
    hash.update(`${path.length}:${path}${Buffer.byteLength(content)}:`);
    hash.update(content);
  }
  return hash.digest("hex");
}

function contentTemplate(title: string, profile: AuthoringProfile): string {
  return [
    `# ${title}`,
    "",
    "TODO：用一句话说明它解决的问题和不适用的场景。",
    ...PROFILE_DEFINITIONS[profile].headings.flatMap((heading) => [
      "",
      `## ${heading}`,
      "",
      "TODO",
    ]),
    "",
  ].join("\n");
}

function exampleTemplate(label: "minimal" | "realistic"): string {
  return [
    "#include <iostream>",
    "",
    "int main() {",
    `  // TODO: ${label} deterministic example`,
    "  return 0;",
    "}",
    "",
  ].join("\n");
}

function targetPaths(target: PrepareDraftTarget): AuthoringTargetPaths {
  const root = `entries/${target.entryId}`;
  return {
    entry: `${root}/entry.json`,
    content: `${root}/content.md`,
    examples: `${root}/examples`,
    catalog: "catalog.json",
  };
}

function createDraftManifest(
  target: PrepareDraftTarget,
  profile: AuthoringProfile,
  now: string,
  affectedEntryIds: readonly string[] = [target.entryId],
): AuthoringDraftManifest {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    revision: 1,
    state: "draft",
    profile,
    target,
    targetPaths: targetPaths(target),
    affectedEntryIds,
    createdAt: now,
    updatedAt: now,
  };
}

function candidateEntry(
  target: PrepareDraftTarget,
  proposal: AuthoringCatalogProposal,
) {
  return {
    schemaVersion: 2,
    id: target.entryId,
    version: 1,
    slug: target.slug,
    kind: target.kind,
    title: target.title,
    summary: "TODO",
    aliases: [],
    categories: proposal.categories,
    relatedEntryIds: proposal.relatedEntryIds,
    content: { format: "markdown", path: targetPaths(target).content },
    examples: [],
    sources: [],
    verifiedAt: null,
  };
}

function createDraftWorkspace(
  draft: AuthoringDraftManifest,
  proposal: AuthoringCatalogProposal,
): DraftWorkspace {
  const { profile, target } = draft;
  const facts: AuthoringFactSheet = {
    schemaVersion: 1,
    draftId: target.entryId,
    groups: PROFILE_DEFINITIONS[profile].factKinds.map((kind) => ({
      id: kind.replaceAll("_", "-"),
      kind,
      status: "unverified",
      summary: "",
      sourceIds: [],
    })),
  };
  const sources: AuthoringSourceLedger = {
    schemaVersion: 1,
    draftId: target.entryId,
    sources: [],
  };
  const files: Record<string, string> = {
    "draft.json": jsonFile(draft),
    "facts.json": jsonFile(facts),
    "sources.json": jsonFile(sources),
    "catalog-proposal.json": jsonFile(proposal),
    "entry.json": jsonFile(candidateEntry(target, proposal)),
    "content.md": contentTemplate(target.title, profile),
  };
  for (const label of PROFILE_DEFINITIONS[profile].examples) {
    files[`examples/${label}.cpp`] = exampleTemplate(label);
  }
  const report: AuthoringReport = {
    schemaVersion: 1,
    draftId: target.entryId,
    draftRevision: 1,
    inputDigest: authoringInputDigest(files),
    status: "not_checked",
    affectedEntryIds: draft.affectedEntryIds,
    affectedActivityIds: [],
    findings: [],
    reviewQueue: [],
    cacheEvidence: [],
  };
  files["report.json"] = jsonFile(report);
  return { draft, proposal, facts, sources, report, files };
}

function emptyCatalogProposal(
  target: PrepareDraftTarget,
): AuthoringCatalogProposal {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [],
    relatedEntryIds: [],
    affectedRedirects: [],
  };
}

function catalogProposal(
  target: PrepareDraftTarget,
  catalog: AuthoringCatalogContext,
): AuthoringCatalogProposal {
  const ownerSymbol = target.title.includes("::")
    ? target.title.slice(0, target.title.lastIndexOf("::"))
    : undefined;
  const parentSlug = target.slug.includes("/")
    ? target.slug.slice(0, target.slug.lastIndexOf("/"))
    : undefined;
  const directlyRelated = catalog.entries.filter(
    (entry) =>
      entry.slug === parentSlug ||
      entry.symbol === ownerSymbol ||
      entry.title === ownerSymbol,
  );
  const owningHeaders = new Set(
    directlyRelated
      .map(({ header }) => header)
      .filter((header): header is string => header !== undefined),
  );
  const headerEntries = catalog.entries.filter(
    (entry) =>
      entry.kind === "header" &&
      (owningHeaders.has(entry.title) ||
        (entry.symbol !== undefined && owningHeaders.has(entry.symbol))),
  );
  const relatedEntries = [...directlyRelated, ...headerEntries].filter(
    (entry, index, entries) =>
      entry.id !== target.entryId &&
      entries.findIndex(({ id }) => id === entry.id) === index,
  );
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [
      ...new Set(relatedEntries.flatMap(({ categories }) => [...categories])),
    ],
    relatedEntryIds: relatedEntries.map(({ id }) => id),
    affectedRedirects: catalog.redirects.filter(
      ({ toEntryId }) =>
        toEntryId === target.entryId ||
        relatedEntries.some(({ id }) => id === toEntryId),
    ),
  };
}

function cloneWorkspace(workspace: DraftWorkspace): DraftWorkspace {
  return structuredClone(workspace);
}

function sameFiles(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftPaths = Object.keys(left);
  const rightPaths = Object.keys(right);
  return (
    leftPaths.length === rightPaths.length &&
    leftPaths.every((path) => left[path] === right[path])
  );
}

export function createInMemoryReferenceDraftRepository(
  initial: readonly DraftWorkspace[] = [],
): ReferenceDraftRepository {
  const drafts = new Map(
    initial.map((workspace) => [
      workspace.draft.draftId,
      cloneWorkspace(workspace),
    ]),
  );
  return {
    async get(draftId) {
      const workspace = drafts.get(draftId);
      return workspace ? cloneWorkspace(workspace) : undefined;
    },
    async reserve(workspace) {
      const draftId = workspace.draft.draftId;
      const existing = drafts.get(draftId);
      if (existing) {
        return { created: false, workspace: cloneWorkspace(existing) };
      }
      const reserved = cloneWorkspace(workspace);
      drafts.set(draftId, reserved);
      return { created: true, workspace: cloneWorkspace(reserved) };
    },
    async commitWorkspace({
      draftId,
      expectedRevision,
      expectedFiles,
      workspace,
    }) {
      const existing = drafts.get(draftId);
      if (
        existing === undefined ||
        existing.draft.revision !== expectedRevision ||
        !sameFiles(existing.files, expectedFiles)
      ) {
        return false;
      }
      drafts.set(draftId, cloneWorkspace(workspace));
      return true;
    },
  };
}

function sameTarget(left: PrepareDraftTarget, right: PrepareDraftTarget) {
  return (
    left.entryId === right.entryId &&
    left.kind === right.kind &&
    left.slug === right.slug &&
    left.title === right.title
  );
}

export type AuthoringFinding = AuthoringReport["findings"][number];

function hardFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"] = "high",
): AuthoringFinding {
  return { severity: "hard", risk, code, path, message };
}

function warningFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"],
): AuthoringFinding {
  return { severity: "warning", risk, code, path, message };
}

function qualityRisk(path: string): AuthoringFinding["risk"] {
  if (/complexity|errors|lifetime|interface|parameters|returns/u.test(path)) {
    return "high";
  }
  if (/selection|examples|mistakes|javascript/u.test(path)) return "medium";
  return "low";
}

function qualityFindings(
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

function schemaFindings(
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

function validateGenerationArtifacts(
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
    }
  }
  return findings;
}

function validateGeneratedSectionReview(
  report: AuthoringReport,
): AuthoringFinding[] {
  return (report.generatedSections ?? []).map((section, index) =>
    hardFinding(
      "generated-content-review-required",
      `report.json/generatedSections/${index}/reviewStatus`,
      `Generated section ${section.heading} requires explicit human review before publication`,
    ),
  );
}

function parseCandidateEntry(
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

function validateFactCoverage(workspace: DraftWorkspace): AuthoringFinding[] {
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

const NORMATIVE_FACT_KINDS = new Set<AuthoringFactKind>([
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

function hasPrimaryWorkingDraftEvidence(
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

function validateSourceAlignment(
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

function validateContentProfile(workspace: DraftWorkspace): AuthoringFinding[] {
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

function validateEntryIdentity(
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

async function validateExamples(
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

export function authoringFactEvidenceDigest(
  group: AuthoringFactGroup,
  sources: readonly AuthoringSourceRecord[],
): string {
  const selectedSources = group.sourceIds
    .map((sourceId) => sources.find(({ id }) => id === sourceId))
    .filter((source): source is AuthoringSourceRecord => source !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: group.kind,
        summary: group.summary,
        sourceIds: [...group.sourceIds].sort(),
        ...(group.decision === undefined ? {} : { decision: group.decision }),
        sources: selectedSources,
      }),
    )
    .digest("hex");
}

async function validateFactReuse(
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

async function materializeWorkspaceEvidence(
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

function contextPackDigest(pack: Omit<AuthoringContextPack, "digest">): string {
  return createHash("sha256").update(JSON.stringify(pack)).digest("hex");
}

function hardFindingCategory(code: string): string {
  if (/^(?:catalog|slug|related|category)/u.test(code)) return "catalog";
  if (/^(?:fact|source)/u.test(code)) return "evidence";
  if (/^(?:example)/u.test(code)) return "examples";
  if (/^(?:content)/u.test(code)) return "content";
  if (/(?:schema|json|missing|draft-id-mismatch)/u.test(code)) {
    return "artifacts";
  }
  return "other";
}

function correctionRates(
  counts: AuthoringCorrectionCounts,
  entries: number,
): AuthoringCorrectionCounts {
  return {
    factual: counts.factual / entries,
    example: counts.example / entries,
  };
}

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

export function createReferenceAuthoring(
  dependencies: ReferenceAuthoringDependencies,
): ReferenceAuthoring {
  const clock = dependencies.clock ?? (() => new Date());
  const authoring: ReferenceAuthoring = {
    async applyGeneratedSection(request) {
      const contextIssues = validateAuthoringContextPack(request.context);
      const generationIssues = validateAuthoringSectionGeneration(
        request.generation,
      );
      if (
        contextIssues.length > 0 ||
        generationIssues.length > 0 ||
        !Number.isInteger(request.expectedRevision) ||
        request.expectedRevision < 1 ||
        request.generation.draftId !== request.context.draftId ||
        request.generation.contextDigest !== request.context.digest
      ) {
        return {
          ok: false,
          code: "invalid_request",
          issues:
            contextIssues.length > 0
              ? contextIssues.map((issue) => ({
                  ...issue,
                  path: `/context${issue.path === "/" ? "" : issue.path}`,
                }))
              : generationIssues.length > 0
                ? generationIssues.map((issue) => ({
                    ...issue,
                    path: `/generation${issue.path === "/" ? "" : issue.path}`,
                  }))
                : [
                    {
                      path: "/generation",
                      message:
                        "Generation identity, context digest, and positive expected revision must match the supplied context",
                      keyword: "request",
                    },
                  ],
        };
      }
      const reviewed = await authoring.reviewGeneratedClaims({
        context: request.context,
        claims: request.generation.section.claims,
      });
      if (!reviewed.ok) {
        return {
          ok: false,
          code:
            reviewed.code === "draft_not_found"
              ? "draft_not_found"
              : "context_changed",
          issues: reviewed.issues,
        };
      }
      if (reviewed.review.status === "requires-review") {
        return {
          ok: false,
          code: "generation_blocked",
          issues: reviewed.review.reviewQueue.map((item, index) => ({
            path: `/generation/section/claims/${index}`,
            message: `Generated claim ${item.claimId} requires review: ${item.reason}`,
            keyword: item.reason,
          })),
          review: reviewed.review,
        };
      }
      let workspace: DraftWorkspace | undefined;
      try {
        workspace = await dependencies.drafts.get(request.context.draftId);
      } catch (error) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: "/context/draftId",
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
      if (
        workspace.draft.revision !== request.expectedRevision ||
        request.context.draftRevision !== request.expectedRevision
      ) {
        return { ok: false, code: "revision_conflict", issues: [] };
      }
      if (
        authoringInputDigest(workspace.files) !== request.context.inputDigest
      ) {
        return {
          ok: false,
          code: "context_changed",
          issues: [
            {
              path: "/context/inputDigest",
              message:
                "The draft authoring input changed after the context pack was reviewed",
              keyword: "digest",
            },
          ],
        };
      }
      if (
        !PROFILE_DEFINITIONS[workspace.draft.profile].headings.includes(
          request.generation.section.heading,
        )
      ) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/generation/section/heading",
              message: `Heading is not part of the ${workspace.draft.profile} authoring profile`,
              keyword: "enum",
            },
          ],
        };
      }
      const currentContent = workspace.files["content.md"];
      if (currentContent === undefined) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: "/content.md",
              message: "Draft content is missing",
              keyword: "required",
            },
          ],
        };
      }
      const replacement = replaceMarkdownSection(
        currentContent,
        request.generation.section.heading,
        request.generation.section.markdown,
      );
      if (!replacement.ok) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/generation/section/markdown",
              message: replacement.message,
              keyword: "markdown-section",
            },
          ],
        };
      }
      const nextRevision = workspace.draft.revision + 1;
      const draft: AuthoringDraftManifest = {
        ...workspace.draft,
        revision: nextRevision,
        state: "draft",
        updatedAt: clock().toISOString(),
      };
      const receiptPath = `generation/revision-${nextRevision}.json`;
      const receipt: AuthoringGenerationReceipt = {
        schemaVersion: 1,
        draftId: draft.draftId,
        appliedRevision: nextRevision,
        contextDigest: request.context.digest,
        generation: request.generation,
        review: reviewed.review,
        appliedAt: draft.updatedAt,
      };
      const receiptIssues = validateAuthoringGenerationReceipt(receipt);
      if (receiptIssues.length > 0) {
        return {
          ok: false,
          code: "invalid_request",
          issues: receiptIssues.map((issue) => ({
            ...issue,
            path: `/receipt${issue.path === "/" ? "" : issue.path}`,
          })),
        };
      }
      const files = {
        ...workspace.files,
        "content.md": replacement.content,
        "draft.json": jsonFile(draft),
        [receiptPath]: jsonFile(receipt),
      };
      const report: AuthoringReport = {
        ...workspace.report,
        draftRevision: nextRevision,
        inputDigest: authoringInputDigest(files),
        status: "not_checked",
        findings: [],
        reviewQueue: [],
        cacheEvidence: [],
        generatedSections: [
          ...(workspace.report.generatedSections ?? []),
          {
            heading: request.generation.section.heading,
            receiptPath,
            contextDigest: request.context.digest,
            appliedRevision: nextRevision,
            reviewStatus: "human-review-required",
          },
        ],
      };
      const nextWorkspace: DraftWorkspace = {
        ...workspace,
        draft,
        report,
        files: { ...files, "report.json": jsonFile(report) },
      };
      let committed: boolean;
      try {
        committed = await dependencies.drafts.commitWorkspace({
          draftId: draft.draftId,
          expectedRevision: request.expectedRevision,
          expectedFiles: workspace.files,
          workspace: nextWorkspace,
        });
      } catch (error) {
        return {
          ok: false,
          code: "write_failed",
          issues: [
            {
              path: "/draft",
              message:
                error instanceof Error
                  ? error.message
                  : "Generated section could not be committed",
              keyword: "write",
            },
          ],
        };
      }
      if (!committed) {
        return { ok: false, code: "write_conflict", issues: [] };
      }
      return {
        ok: true,
        workspace: nextWorkspace,
        review: reviewed.review,
        receiptPath,
      };
    },
    async measureBatch(request) {
      const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
      const durationValues = [
        request.timing.authorActiveMinutes,
        request.timing.machineMinutes,
        request.timing.fullGateMinutes,
        request.timing.baselineAuthorActiveMinutes,
      ];
      const countValues = [
        request.quality.prePublicationCorrections.factual,
        request.quality.prePublicationCorrections.example,
        request.quality.postPublicationCorrections.factual,
        request.quality.postPublicationCorrections.example,
        request.quality.baselinePostPublicationCorrections.factual,
        request.quality.baselinePostPublicationCorrections.example,
        request.quality.highRiskClaimsReviewed,
        request.quality.flakyReruns,
      ];
      if (
        !stableId.test(request.batchId) ||
        request.draftIds.length < 1 ||
        request.draftIds.length > 5 ||
        new Set(request.draftIds).size !== request.draftIds.length ||
        request.draftIds.some((id) => !stableId.test(id)) ||
        durationValues.some((value) => !Number.isFinite(value) || value < 0) ||
        countValues.some((value) => !Number.isInteger(value) || value < 0) ||
        !Number.isInteger(request.timing.baselineEntries) ||
        request.timing.baselineEntries < 1
      ) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/",
              message:
                "Batch identity, one to five unique drafts, non-negative timings, and integer counters are required",
              keyword: "request",
            },
          ],
        };
      }
      const workspaces: DraftWorkspace[] = [];
      for (const [index, draftId] of request.draftIds.entries()) {
        let workspace: DraftWorkspace | undefined;
        try {
          workspace = await dependencies.drafts.get(draftId);
        } catch (error) {
          return {
            ok: false,
            code: "batch_unreadable",
            issues: [
              {
                path: `/draftIds/${index}`,
                message:
                  error instanceof Error
                    ? error.message
                    : "Draft is unreadable",
                keyword: "read",
              },
            ],
          };
        }
        if (workspace === undefined) {
          return {
            ok: false,
            code: "draft_not_found",
            issues: [
              {
                path: `/draftIds/${index}`,
                message: `Draft is missing: ${draftId}`,
                keyword: "required",
              },
            ],
          };
        }
        const artifactIssues = [
          ...validateAuthoringDraft(workspace.draft),
          ...validateAuthoringCatalogProposal(workspace.proposal),
          ...validateAuthoringFactSheet(workspace.facts),
          ...validateAuthoringSourceLedger(workspace.sources),
          ...validateAuthoringReport(workspace.report),
        ];
        const artifactDraftIds = [
          workspace.draft.draftId,
          workspace.proposal.draftId,
          workspace.facts.draftId,
          workspace.sources.draftId,
          workspace.report.draftId,
        ];
        if (
          artifactIssues.length > 0 ||
          artifactDraftIds.some((candidate) => candidate !== draftId)
        ) {
          return {
            ok: false,
            code: "batch_unreadable",
            issues:
              artifactIssues.length > 0
                ? artifactIssues.map((issue) => ({
                    ...issue,
                    path: `/draftIds/${index}${issue.path}`,
                  }))
                : [
                    {
                      path: `/draftIds/${index}`,
                      message: `Batch member artifacts must all belong to ${draftId}`,
                      keyword: "draft-id-mismatch",
                    },
                  ],
          };
        }
        workspaces.push(workspace);
      }
      let examples = 0;
      const examplesByDraft = new Map<string, number>();
      try {
        for (const workspace of workspaces) {
          const entry = JSON.parse(workspace.files["entry.json"] ?? "null") as {
            examples?: unknown;
          } | null;
          if (entry === null || !Array.isArray(entry.examples)) {
            throw new Error(
              `Draft ${workspace.draft.draftId} has no valid Entry examples list`,
            );
          }
          examples += entry.examples.length;
          examplesByDraft.set(workspace.draft.draftId, entry.examples.length);
        }
      } catch (error) {
        return {
          ok: false,
          code: "batch_unreadable",
          issues: [
            {
              path: "/draftIds",
              message:
                error instanceof Error
                  ? error.message
                  : "Batch Entry manifests are unreadable",
              keyword: "parse",
            },
          ],
        };
      }
      const cacheEvidence = workspaces.flatMap(
        ({ report }) => report.cacheEvidence,
      );
      const hits = cacheEvidence.filter(
        ({ status }) => status === "hit",
      ).length;
      const misses = cacheEvidence.filter(
        ({ status }) => status === "miss",
      ).length;
      const notChecked = cacheEvidence.length - hits - misses;
      const checkedCacheRecords = hits + misses;
      const findings = workspaces.flatMap(({ report }) => report.findings);
      const hardFindings = findings.filter(
        ({ severity }) => severity === "hard",
      );
      const hardByCategory = Object.fromEntries(
        [...new Set(hardFindings.map(({ code }) => hardFindingCategory(code)))]
          .sort()
          .map((category) => [
            category,
            hardFindings.filter(
              ({ code }) => hardFindingCategory(code) === category,
            ).length,
          ]),
      );
      const readyEntries = workspaces.filter(
        (workspace) =>
          workspace.draft.draftId === workspace.proposal.draftId &&
          workspace.draft.draftId === workspace.facts.draftId &&
          workspace.draft.draftId === workspace.sources.draftId &&
          workspace.draft.draftId === workspace.report.draftId &&
          workspace.draft.state === "checked" &&
          workspace.report.status === "ready" &&
          workspace.report.draftRevision === workspace.draft.revision &&
          workspace.report.inputDigest ===
            authoringInputDigest(workspace.files),
      ).length;
      const postPublicationCorrectionRates = correctionRates(
        request.quality.postPublicationCorrections,
        workspaces.length,
      );
      const baselinePostPublicationCorrectionRates = correctionRates(
        request.quality.baselinePostPublicationCorrections,
        request.timing.baselineEntries,
      );
      const activeMinutesPerEntry =
        request.timing.authorActiveMinutes / workspaces.length;
      const baselineActiveMinutesPerEntry =
        request.timing.baselineAuthorActiveMinutes /
        request.timing.baselineEntries;
      const noFactualDefectRegression =
        postPublicationCorrectionRates.factual <=
        baselinePostPublicationCorrectionRates.factual;
      const noExampleDefectRegression =
        postPublicationCorrectionRates.example <=
        baselinePostPublicationCorrectionRates.example;
      const targets = {
        fiveEntryBatch:
          workspaces.length === 5 && readyEntries === workspaces.length,
        activeMinutesWithinTarget:
          request.timing.authorActiveMinutes >= 60 &&
          request.timing.authorActiveMinutes <= 90,
        throughputImproved:
          activeMinutesPerEntry < baselineActiveMinutesPerEntry,
        noFactualDefectRegression,
        noExampleDefectRegression,
        noEscapedCorrectionRegression:
          noFactualDefectRegression && noExampleDefectRegression,
        allHighRiskClaimsReviewed:
          request.quality.highRiskClaimsReviewed >=
          findings.filter(({ risk }) => risk === "high").length,
        noFlakyReruns: request.quality.flakyReruns === 0,
      };
      const reportWithoutDigest: Omit<AuthoringBatchReport, "digest"> = {
        schemaVersion: 1,
        batchId: request.batchId,
        draftIds: [...request.draftIds],
        drafts: workspaces.map((workspace) => ({
          draftId: workspace.draft.draftId,
          draftRevision: workspace.draft.revision,
          inputDigest: authoringInputDigest(workspace.files),
          status: workspace.report.status,
          examples: examplesByDraft.get(workspace.draft.draftId) ?? 0,
        })),
        status: Object.values(targets).every(Boolean)
          ? "meets-target"
          : "needs-attention",
        entries: workspaces.length,
        readyEntries,
        examples,
        cache: {
          hits,
          misses,
          notChecked,
          hitRate: checkedCacheRecords === 0 ? 0 : hits / checkedCacheRecords,
        },
        findings: {
          hard: hardFindings.length,
          warning: findings.filter(({ severity }) => severity === "warning")
            .length,
          highRisk: findings.filter(({ risk }) => risk === "high").length,
          hardByCategory,
        },
        timing: {
          ...request.timing,
          activeMinutesPerEntry,
          baselineActiveMinutesPerEntry,
        },
        quality: {
          ...request.quality,
          postPublicationCorrectionRates,
          baselinePostPublicationCorrectionRates,
        },
        targets,
      };
      const report: AuthoringBatchReport = {
        ...reportWithoutDigest,
        digest: createHash("sha256")
          .update(JSON.stringify(reportWithoutDigest))
          .digest("hex"),
      };
      const reportIssues = validateAuthoringBatchReport(report);
      if (reportIssues.length > 0) {
        return {
          ok: false,
          code: "batch_unreadable",
          issues: reportIssues,
        };
      }
      return { ok: true, report };
    },
    async reviewGeneratedClaims(request) {
      const contextIssues = validateAuthoringContextPack(request.context);
      const { digest: suppliedDigest, ...contextWithoutDigest } =
        request.context;
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
        workspace = await dependencies.drafts.get(request.context.draftId);
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
      const rebuiltContext = await authoring.buildContext({
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
    },
    async buildContext(request) {
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId) ||
        request.factGroupIds.length === 0 ||
        new Set(request.factGroupIds).size !== request.factGroupIds.length ||
        request.factGroupIds.some(
          (id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id),
        )
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
        workspace = await dependencies.drafts.get(request.draftId);
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
            dependencies.drafts,
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
          dependencies.drafts,
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
    },
    async prepare(request) {
      const profile = PROFILE_BY_KIND[request.target.kind];
      const now = clock().toISOString();
      let proposal = emptyCatalogProposal(request.target);
      if (dependencies.catalog !== undefined) {
        let catalog: AuthoringCatalogContext;
        try {
          catalog = await dependencies.catalog.load();
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
            dependencies.drafts,
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
      const reservation = await dependencies.drafts.reserve(workspace);
      if (!reservation.created) {
        if (!sameTarget(reservation.workspace.draft.target, request.target)) {
          return {
            ok: false,
            code: "draft_conflict",
            issues: [
              {
                path: "/target",
                message:
                  "Draft identity is already reserved for another target",
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
    },
    async check(request) {
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
        workspace = await dependencies.drafts.get(request.draftId);
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
      const checkedAt = clock().toISOString();
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
      const proposalIssues = validateAuthoringCatalogProposal(
        workspace.proposal,
      );
      let evidenceWorkspace = workspace;
      const reuseFindings: AuthoringFinding[] = [];
      if (
        factIssues.length === 0 &&
        sourceIssues.length === 0 &&
        proposalIssues.length === 0
      ) {
        try {
          const reuseIssues = await validateFactReuse(
            workspace,
            dependencies.drafts,
          );
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
              dependencies.drafts,
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
        ...validateGeneratedSectionReview(workspace.report),
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
            (workspace.proposal.entryPath !==
              workspace.draft.targetPaths.entry ||
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
          if (dependencies.catalog === undefined) {
            findings.push(
              hardFinding(
                "catalog-unavailable",
                "entry.json",
                "No active Reference catalog context is configured",
              ),
            );
          } else {
            try {
              checkedCatalog = await dependencies.catalog.load();
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
            if (dependencies.quality === undefined) {
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
                  await dependencies.quality.validate({
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
            dependencies.examples,
            dependencies.cache,
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
      const committed = await dependencies.drafts.commitWorkspace({
        draftId: workspace.draft.draftId,
        expectedRevision: workspace.draft.revision,
        expectedFiles: workspace.files,
        workspace: checkedWorkspace,
      });
      if (!committed) {
        return { ok: false, code: "revision_conflict", issues: [] };
      }
      return { ok: true, report, workspace: checkedWorkspace };
    },
    async publish(request) {
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
        workspace = await dependencies.drafts.get(request.draftId);
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
      if (dependencies.publisher === undefined) {
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
        const plan = await dependencies.publisher.publish({
          draftId: request.draftId,
          expectedRevision: request.expectedRevision,
          mode: request.mode,
          entryPath: workspace.draft.targetPaths.entry,
          files,
          confirmDraft: async () => {
            try {
              const current = await dependencies.drafts.get(request.draftId);
              return (
                current !== undefined &&
                current.draft.revision === request.expectedRevision &&
                current.draft.state === "checked" &&
                current.report.status === "ready" &&
                current.report.draftRevision === request.expectedRevision &&
                current.report.inputDigest ===
                  authoringInputDigest(current.files)
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
    },
  };
  return authoring;
}

export {
  authoringBatchReportSchema,
  authoringGenerationSchema,
  authoringGenerationReceiptSchema,
  authoringDraftSchema,
  authoringContextPackSchema,
  authoringFactsSchema,
  authoringGeneratedReviewSchema,
  authoringPublicationPlanSchema,
  authoringReportSchema,
  authoringSourcesSchema,
};

export type {
  AuthoringGenerationClaim,
  AuthoringSectionGeneration,
} from "./generation.js";

export {
  createFilesystemReferenceDraftRepository,
  type FilesystemReferenceDraftRepositoryOptions,
} from "./filesystem.js";
export {
  createFilesystemAuthoringValidationCache,
  createInMemoryAuthoringValidationCache,
  type AuthoringValidationCache,
  type AuthoringValidationCacheValue,
  type FilesystemAuthoringValidationCacheOptions,
} from "./cache.js";
export {
  createFilesystemAuthoringPublisher,
  type AuthoringPublicationCandidate,
  type AuthoringPublishAdapterRequest,
  type AuthoringPublisher,
  type FilesystemAuthoringPublisherOptions,
} from "./publisher.js";
export {
  createFilesystemAuthoringCatalogContext,
  type FilesystemAuthoringCatalogContextOptions,
} from "./catalog-context.js";
export {
  createNativeAuthoringExampleValidator,
  type NativeAuthoringExampleValidatorOptions,
} from "./native-example-validator.js";
