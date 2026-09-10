import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import authoringBatchReportSchema from "./authoring-batch-report.schema.json" with { type: "json" };
import authoringCatalogProposalSchema from "./authoring-catalog-proposal.schema.json" with { type: "json" };
import authoringContextPackSchema from "./authoring-context-pack.schema.json" with { type: "json" };
import authoringDraftSchema from "./authoring-draft.schema.json" with { type: "json" };
import authoringExampleGenerationReceiptSchema from "./authoring-example-generation-receipt.schema.json" with { type: "json" };
import authoringFactsSchema from "./authoring-facts.schema.json" with { type: "json" };
import authoringGeneratedReviewSchema from "./authoring-generated-review.schema.json" with { type: "json" };
import authoringGenerationBundleTemplateSchema from "./authoring-generation-bundle-template.schema.json" with { type: "json" };
import authoringGenerationReceiptSchema from "./authoring-generation-receipt.schema.json" with { type: "json" };
import authoringPublicationPlanSchema from "./authoring-publication-plan.schema.json" with { type: "json" };
import authoringReportSchema from "./authoring-report.schema.json" with { type: "json" };
import authoringSourcesSchema from "./authoring-sources.schema.json" with { type: "json" };
import authoringSummaryGenerationReceiptSchema from "./authoring-summary-generation-receipt.schema.json" with { type: "json" };

import {
  authoringGenerationKind,
  authoringExampleGenerationSchema,
  authoringGenerationSchema,
  authoringSummaryGenerationSchema,
} from "./generation.ts";
import {
  authoringGenerationOrchestrationSchema,
  sameFactGroupAllowlist,
} from "./run.ts";

import type {
  AuthoringGenerationBundleTemplate,
  AuthoringGenerationReceipt,
  AuthoringValidationIssue,
} from "./index.ts";

/**
 * Artifact Schema validation for the authoring pipeline.
 *
 * Every generated artifact — draft, context pack, receipt, repair plan,
 * publication plan, batch report — is validated through the schema published
 * alongside it, so the on-disk contract and the runtime check cannot drift.
 */

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateBatchReport = ajv.compile(authoringBatchReportSchema);
const validateDraft = ajv.compile(authoringDraftSchema);
const validateCatalogProposal = ajv.compile(authoringCatalogProposalSchema);
const validateContextPack = ajv.compile(authoringContextPackSchema);
ajv.addSchema(authoringGenerationOrchestrationSchema);
const validateGenerationBundleTemplate = ajv.compile(
  authoringGenerationBundleTemplateSchema,
);
const validateFacts = ajv.compile(authoringFactsSchema);
const validateGeneratedReview = ajv.compile(authoringGeneratedReviewSchema);
ajv.addSchema(authoringExampleGenerationSchema);
ajv.addSchema(authoringGenerationSchema);
ajv.addSchema(authoringSummaryGenerationSchema);
const validateSectionGenerationReceipt = ajv.compile(
  authoringGenerationReceiptSchema,
);
const validateSummaryGenerationReceipt = ajv.compile(
  authoringSummaryGenerationReceiptSchema,
);
const validateExampleGenerationReceipt = ajv.compile(
  authoringExampleGenerationReceiptSchema,
);
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

export function validateAuthoringGenerationBundleTemplate(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  const issues = [...validationIssues(validateGenerationBundleTemplate, value)];
  if (issues.length > 0) return issues;
  const template = value as AuthoringGenerationBundleTemplate;
  const generationKind = authoringGenerationKind(template.generation);
  if (generationKind !== template.template.kind) {
    issues.push({
      path: "/template/kind",
      message: "Template kind must match the generated content member",
      keyword: "kind-mismatch",
    });
  }
  if (
    template.expectedRevision !== template.context.draftRevision ||
    template.generation.draftId !== template.context.draftId ||
    template.generation.contextDigest !== template.context.digest
  ) {
    issues.push({
      path: "/generation",
      message: "Template generation identity must match its context",
      keyword: "context-mismatch",
    });
  }
  if (
    template.orchestration !== undefined &&
    !sameFactGroupAllowlist(
      template.orchestration.factGroupIds,
      template.context.policy.allowedFactGroupIds,
    )
  ) {
    issues.push({
      path: "/orchestration/factGroupIds",
      message: "Run step fact allowlist must match the template context",
      keyword: "fact-context-mismatch",
    });
  }
  return issues;
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
  const generation =
    value !== null && typeof value === "object" && "generation" in value
      ? (value as { readonly generation?: unknown }).generation
      : undefined;
  const generationKind = authoringGenerationKind(generation);
  const issues = [
    ...validationIssues(
      generationKind === "example"
        ? validateExampleGenerationReceipt
        : generationKind === "summary"
          ? validateSummaryGenerationReceipt
          : validateSectionGenerationReceipt,
      value,
    ),
  ];
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
