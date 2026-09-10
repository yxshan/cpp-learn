import {
  type CppStandard,
  type ReferenceEntryKind,
} from "@cpp-learn/contracts";
import type {
  ReferenceEntryManifest,
  ReferenceExampleManifest,
} from "@cpp-learn/reference";

import authoringBatchReportSchema from "./authoring-batch-report.schema.json" with { type: "json" };
import authoringContextPackSchema from "./authoring-context-pack.schema.json" with { type: "json" };
import authoringDraftSchema from "./authoring-draft.schema.json" with { type: "json" };
import authoringExampleGenerationSchema from "./authoring-example-generation.schema.json" with { type: "json" };
import authoringExampleGenerationReceiptSchema from "./authoring-example-generation-receipt.schema.json" with { type: "json" };
import authoringFactsSchema from "./authoring-facts.schema.json" with { type: "json" };
import authoringGeneratedReviewSchema from "./authoring-generated-review.schema.json" with { type: "json" };
import authoringGenerationReceiptSchema from "./authoring-generation-receipt.schema.json" with { type: "json" };
import authoringPublicationPlanSchema from "./authoring-publication-plan.schema.json" with { type: "json" };
import authoringReportSchema from "./authoring-report.schema.json" with { type: "json" };
import authoringSourcesSchema from "./authoring-sources.schema.json" with { type: "json" };
import authoringSummaryGenerationSchema from "./authoring-summary-generation.schema.json" with { type: "json" };
import type { AuthoringValidationCache } from "./cache.js";
import { type AdvanceAuthoringBatchResult } from "./batch.js";
import type { AuthoringPublisher } from "./publisher.js";
import {
  authoringGenerationSchema,
  type AuthoringExampleGeneration,
  type AuthoringGenerationClaim,
  type AuthoringSectionGeneration,
  type AuthoringSummaryGeneration,
} from "./generation.js";
import { type AuthoringGenerationOrchestration } from "./run.js";
import { type ProposeSourceFactsResult } from "./research.js";
import { authoringRepairSchema, type AuthoringRepairPlan } from "./repair.js";

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

export type AuthoringGenerationTemplateKind = "section" | "summary" | "example";

export type BuildAuthoringGenerationTemplateRequest =
  BuildAuthoringContextRequest &
    (
      | {
          readonly kind: "section";
          readonly heading: string;
          readonly exampleId?: never;
          readonly exampleKind?: never;
          readonly standard?: never;
        }
      | {
          readonly kind: "summary";
          readonly heading?: never;
          readonly exampleId?: never;
          readonly exampleKind?: never;
          readonly standard?: never;
        }
      | {
          readonly kind: "example";
          readonly heading?: never;
          readonly exampleId: string;
          readonly exampleKind?: "compile" | "run" | "expected-compile-failure";
          readonly standard?: CppStandard;
        }
    );

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

export interface AuthoringGenerationTemplateMetadata {
  readonly schemaVersion: 1;
  readonly status: "incomplete" | "ready";
  readonly kind: AuthoringGenerationTemplateKind;
  readonly requiredActions: readonly (
    "write-content" | "declare-claims" | "mark-ready"
  )[];
}

export type AuthoringGenerationDraft =
  | (Omit<AuthoringSectionGeneration, "section"> & {
      readonly section: Omit<
        AuthoringSectionGeneration["section"],
        "claims"
      > & {
        readonly claims: readonly AuthoringGenerationClaim[];
      };
    })
  | (Omit<AuthoringSummaryGeneration, "summary"> & {
      readonly summary: Omit<
        AuthoringSummaryGeneration["summary"],
        "claims"
      > & {
        readonly claims: readonly AuthoringGenerationClaim[];
      };
    })
  | (Omit<AuthoringExampleGeneration, "example"> & {
      readonly example: Omit<
        AuthoringExampleGeneration["example"],
        "claims"
      > & {
        readonly claims: readonly AuthoringGenerationClaim[];
      };
    });

export interface AuthoringGenerationBundleTemplate {
  readonly template: AuthoringGenerationTemplateMetadata;
  readonly orchestration?: AuthoringGenerationOrchestration;
  readonly context: AuthoringContextPack;
  readonly expectedRevision: number;
  readonly generation: AuthoringGenerationDraft;
}

export type BuildAuthoringGenerationTemplateResult =
  | { readonly ok: true; readonly template: AuthoringGenerationBundleTemplate }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "context_blocked";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export type ApplyGenerationBundleResult =
  | ApplyGeneratedSectionResult
  | ApplyGeneratedSummaryResult
  | ApplyGeneratedExampleResult;

export type BuildAuthoringRepairPlanResult =
  | {
      readonly ok: true;
      readonly status: "repairable";
      readonly plan: AuthoringRepairPlan;
    }
  | {
      readonly ok: true;
      readonly status: "no_repairs";
      readonly ignoredFindingDigests: readonly string[];
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "repair_blocked";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export type AdvanceAuthoringRepairResult =
  | {
      readonly ok: true;
      readonly progress: {
        readonly schemaVersion: 1;
        readonly repairId: string;
        readonly draftId: string;
        readonly planDigest: string;
        readonly status: "awaiting_generation" | "exhausted";
        readonly exhaustedTargetIds: readonly string[];
        readonly next?: {
          readonly targetId: string;
          readonly attempt: number;
          readonly maxAttempts: number;
          readonly findingDigests: readonly string[];
          readonly template: AuthoringGenerationBundleTemplate;
        };
      };
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "context_blocked"
        | "repair_blocked";
      readonly issues: readonly AuthoringValidationIssue[];
    };

interface AuthoringRunProgressBase {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly draftId: string;
  readonly planDigest: string;
  readonly currentRevision: number;
  readonly completedStepIds: readonly string[];
  readonly pendingStepIds: readonly string[];
}

export type AuthoringRunProgress = AuthoringRunProgressBase &
  (
    | {
        readonly status: "awaiting_generation";
        readonly next: {
          readonly stepId: string;
          readonly template: AuthoringGenerationBundleTemplate;
        };
      }
    | { readonly status: "complete"; readonly next?: never }
  );

export type AdvanceAuthoringRunResult =
  | { readonly ok: true; readonly progress: AuthoringRunProgress }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "context_blocked"
        | "run_blocked";
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
  readonly orchestration?: AuthoringGenerationOrchestration;
}

export interface ApplyGeneratedContentSuccess {
  readonly ok: true;
  readonly workspace: DraftWorkspace;
  readonly review: AuthoringGeneratedReview;
  readonly receiptPath: string;
}

export interface ApplyGeneratedContentFailure<Code extends string> {
  readonly ok: false;
  readonly code: Code;
  readonly issues: readonly AuthoringValidationIssue[];
  readonly review?: AuthoringGeneratedReview;
}

export type ApplyGeneratedContentFailureCode =
  | "invalid_request"
  | "draft_not_found"
  | "draft_unreadable"
  | "revision_conflict"
  | "context_changed"
  | "generation_blocked"
  | "write_conflict"
  | "write_failed";

export type ApplyGeneratedSectionResult =
  | ApplyGeneratedContentSuccess
  | ApplyGeneratedContentFailure<ApplyGeneratedContentFailureCode>;

export interface ApplyGeneratedSummaryRequest {
  readonly context: AuthoringContextPack;
  readonly expectedRevision: number;
  readonly generation: AuthoringSummaryGeneration;
  readonly orchestration?: AuthoringGenerationOrchestration;
}

export type ApplyGeneratedSummaryResult = ApplyGeneratedSectionResult;

export interface ApplyGeneratedExampleRequest {
  readonly context: AuthoringContextPack;
  readonly expectedRevision: number;
  readonly generation: AuthoringExampleGeneration;
  readonly orchestration?: AuthoringGenerationOrchestration;
}

export type ApplyGeneratedExampleResult =
  | ApplyGeneratedContentSuccess
  | ApplyGeneratedContentFailure<
      | ApplyGeneratedContentFailureCode
      | "example_invalid"
      | "example_validation_failed"
      | "example_validator_unavailable"
    >;

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

interface AuthoringGenerationReceiptBase {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly appliedRevision: number;
  readonly contextDigest: string;
  readonly orchestration?: AuthoringGenerationOrchestration;
  readonly review: AuthoringGeneratedReview;
  readonly appliedAt: string;
}

export interface AuthoringSectionGenerationReceipt extends AuthoringGenerationReceiptBase {
  readonly generation: AuthoringSectionGeneration;
}

export interface AuthoringSummaryGenerationReceipt extends AuthoringGenerationReceiptBase {
  readonly generation: AuthoringSummaryGeneration;
}

export interface AuthoringExampleGenerationReceipt extends AuthoringGenerationReceiptBase {
  readonly generation: AuthoringExampleGeneration;
}

export type AuthoringGenerationReceipt =
  | AuthoringExampleGenerationReceipt
  | AuthoringSectionGenerationReceipt
  | AuthoringSummaryGenerationReceipt;

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
  advanceRepair(request: unknown): Promise<AdvanceAuthoringRepairResult>;
  advanceBatch(request: unknown): Promise<AdvanceAuthoringBatchResult>;
  advanceRun(request: unknown): Promise<AdvanceAuthoringRunResult>;
  proposeSourceFacts(request: unknown): Promise<ProposeSourceFactsResult>;
  applyGenerationBundle(request: unknown): Promise<ApplyGenerationBundleResult>;
  applyGeneratedExample(
    request: ApplyGeneratedExampleRequest,
  ): Promise<ApplyGeneratedExampleResult>;
  applyGeneratedSummary(
    request: ApplyGeneratedSummaryRequest,
  ): Promise<ApplyGeneratedSummaryResult>;
  applyGeneratedSection(
    request: ApplyGeneratedSectionRequest,
  ): Promise<ApplyGeneratedSectionResult>;
  buildContext(
    request: BuildAuthoringContextRequest,
  ): Promise<BuildAuthoringContextResult>;
  buildRepairPlan(request: unknown): Promise<BuildAuthoringRepairPlanResult>;
  buildGenerationTemplate(
    request: BuildAuthoringGenerationTemplateRequest,
  ): Promise<BuildAuthoringGenerationTemplateResult>;
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

import {
  validateAuthoringDraft,
  validateAuthoringBatchReport,
  validateAuthoringGenerationBundleTemplate,
  validateAuthoringCatalogProposal,
  validateAuthoringContextPack,
  validateAuthoringGeneratedReview,
  validateAuthoringGenerationReceipt,
  validateAuthoringFactSheet,
  validateAuthoringSourceLedger,
  validateAuthoringReport,
  validateAuthoringPublicationPlan,
} from "./validation.ts";
import { createContextOperations } from "./operations/context.ts";
import { createRepairOperations } from "./operations/repair.ts";
import { createResearchMeasureOperations } from "./operations/research-measure.ts";
import { createDraftLifecycleOperations } from "./operations/draft-lifecycle.ts";
import { createGenerationApplyOperations } from "./operations/generation-apply.ts";
import { createRunBatchOperations } from "./operations/run-batch.ts";

export {
  validateAuthoringDraft,
  validateAuthoringBatchReport,
  validateAuthoringGenerationBundleTemplate,
  validateAuthoringCatalogProposal,
  validateAuthoringContextPack,
  validateAuthoringGeneratedReview,
  validateAuthoringGenerationReceipt,
  validateAuthoringFactSheet,
  validateAuthoringSourceLedger,
  validateAuthoringReport,
  validateAuthoringPublicationPlan,
};

import { authoringInputDigest } from "./digest.ts";

export { authoringInputDigest };

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

export { createInMemoryReferenceDraftRepository } from "./draft.ts";

export { analyzeAuthoringImpact, evaluateAuthoringGraphGate } from "./gates.ts";

export type { AuthoringFinding } from "./gates.ts";

export function createReferenceAuthoring(
  dependencies: ReferenceAuthoringDependencies,
): ReferenceAuthoring {
  const clock = dependencies.clock ?? (() => new Date());

  const generationApply = createGenerationApplyOperations({
    drafts: dependencies.drafts,
    examples: dependencies.examples,
    cache: dependencies.cache,
    clock,
    reviewGeneratedClaims: (request) =>
      authoring.reviewGeneratedClaims(request),
  });

  const contextOps = createContextOperations({ drafts: dependencies.drafts });

  const runBatchOps = createRunBatchOperations({
    drafts: dependencies.drafts,
    buildGenerationTemplate: contextOps.buildGenerationTemplate,
  });

  const repairOps = createRepairOperations({
    drafts: dependencies.drafts,
    clock,
    buildGenerationTemplate: contextOps.buildGenerationTemplate,
  });

  const researchMeasureOps = createResearchMeasureOperations({
    drafts: dependencies.drafts,
  });

  const draftLifecycleOps = createDraftLifecycleOperations({
    drafts: dependencies.drafts,
    catalog: dependencies.catalog,
    cache: dependencies.cache,
    examples: dependencies.examples,
    quality: dependencies.quality,
    publisher: dependencies.publisher,
    clock,
  });

  const authoring: ReferenceAuthoring = {
    ...draftLifecycleOps,
    ...researchMeasureOps,
    ...repairOps,
    ...runBatchOps,
    ...contextOps,
    ...generationApply,
  };
  return authoring;
}

export {
  authoringRepairSchema,
  authoringBatchReportSchema,
  authoringExampleGenerationSchema,
  authoringExampleGenerationReceiptSchema,
  authoringGenerationSchema,
  authoringGenerationReceiptSchema,
  authoringDraftSchema,
  authoringContextPackSchema,
  authoringFactsSchema,
  authoringGeneratedReviewSchema,
  authoringPublicationPlanSchema,
  authoringReportSchema,
  authoringSourcesSchema,
  authoringSummaryGenerationSchema,
};

export type {
  AuthoringExampleGeneration,
  AuthoringGenerationClaim,
  AuthoringSectionGeneration,
  AuthoringSummaryGeneration,
} from "./generation.js";
export { authoringGenerationKind } from "./generation.js";
export {
  authoringBatchPlanDigest,
  authoringBatchRunSchema,
  validateAuthoringBatchPlan,
  type AdvanceAuthoringBatchResult,
  type AuthoringBatchMemberPlan,
  type AuthoringBatchMemberProgress,
  type AuthoringBatchPlan,
  type AuthoringBatchProgress,
} from "./batch.js";
export {
  AUTHORING_NORMATIVE_FACT_KINDS,
  authoringResearchProposalSchema,
  authoringResearchRequestSchema,
  buildAuthoringResearchProposal,
  type AuthoringResearchProposal,
  type AuthoringResearchRequest,
  type ProposeSourceFactsResult,
  validateAuthoringResearchProposal,
  validateAuthoringResearchRequest,
  validateAuthoringResearchWorkspace,
} from "./research.js";
export { authoringFactEvidenceDigest } from "./fact-evidence.js";
export {
  AUTHORING_REPAIR_MAX_ATTEMPTS,
  authoringFindingDigest,
  authoringRepairPlanDigest,
  authoringReportDigest,
  validateAuthoringRepairPlan,
  type AuthoringRepairAttempt,
  type AuthoringRepairPlan,
  type AuthoringRepairTarget,
} from "./repair.js";
export {
  authoringGenerationOrchestrationSchema,
  authoringRunSchema,
  validateAuthoringRunPlan,
  type AuthoringGenerationOrchestration,
  type AuthoringRunStep,
} from "./run.js";

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
