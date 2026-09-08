import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

import type { CppStandard } from "@cpp-learn/contracts";

import authoringGenerationOrchestrationSchema from "./authoring-generation-orchestration.schema.json" with { type: "json" };
import authoringRunSchema from "./authoring-run.schema.json" with { type: "json" };
import {
  authoringGenerationKind,
  type AuthoringGeneration,
  type AuthoringGenerationClaim,
} from "./generation.js";

interface AuthoringRunStepBase {
  readonly id: string;
  readonly factGroupIds: readonly string[];
}

export type AuthoringRunStep =
  | (AuthoringRunStepBase & { readonly kind: "summary" })
  | (AuthoringRunStepBase & {
      readonly kind: "section";
      readonly heading: string;
    })
  | (AuthoringRunStepBase & {
      readonly kind: "example";
      readonly exampleId: string;
      readonly exampleKind?: "compile" | "run" | "expected-compile-failure";
      readonly standard?: CppStandard;
    });

export interface AuthoringRunPlan {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly draftId: string;
  readonly steps: readonly AuthoringRunStep[];
}

export interface AuthoringGenerationOrchestration {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly planDigest: string;
  readonly stepId: string;
  readonly factGroupIds: readonly string[];
}

export interface AuthoringRunValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateRun = ajv.compile<AuthoringRunPlan>(authoringRunSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${String(error.params["additionalProperty"])}`;
  }
  return error.instancePath || "/";
}

export function validateAuthoringRunPlan(
  value: unknown,
): readonly AuthoringRunValidationIssue[] {
  if (!validateRun(value)) {
    return (validateRun.errors ?? []).map((error) => ({
      path: issuePath(error),
      message: error.message ?? "invalid value",
      keyword: error.keyword,
    }));
  }
  const plan = value;
  const issues: AuthoringRunValidationIssue[] = [];
  const seenStepIds = new Set<string>();
  const seenTargets = new Set<string>();
  for (const [index, step] of plan.steps.entries()) {
    if (seenStepIds.has(step.id)) {
      issues.push({
        path: `/steps/${index}/id`,
        message: `Run step ID ${step.id} is duplicated`,
        keyword: "unique",
      });
    }
    seenStepIds.add(step.id);
    const target = authoringRunStepTarget(step);
    if (seenTargets.has(target)) {
      issues.push({
        path: `/steps/${index}`,
        message: `Run target ${target} is duplicated`,
        keyword: "unique-target",
      });
    }
    seenTargets.add(target);
  }
  return issues;
}

export function authoringRunStepTarget(step: AuthoringRunStep): string {
  if (step.kind === "summary") return "summary";
  if (step.kind === "section") return `section:${step.heading}`;
  return `example:${step.exampleId}`;
}

export function authoringRunPlanDigest(plan: AuthoringRunPlan): string {
  const normalized = {
    schemaVersion: plan.schemaVersion,
    runId: plan.runId,
    draftId: plan.draftId,
    steps: plan.steps.map((step) =>
      step.kind === "summary"
        ? {
            id: step.id,
            kind: step.kind,
            factGroupIds: step.factGroupIds,
          }
        : step.kind === "section"
          ? {
              id: step.id,
              kind: step.kind,
              heading: step.heading,
              factGroupIds: step.factGroupIds,
            }
          : {
              id: step.id,
              kind: step.kind,
              exampleId: step.exampleId,
              ...(step.exampleKind === undefined
                ? {}
                : { exampleKind: step.exampleKind }),
              ...(step.standard === undefined
                ? {}
                : { standard: step.standard }),
              factGroupIds: step.factGroupIds,
            },
    ),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function sameFactGroupAllowlist(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

export function createAuthoringGenerationOrchestration(
  plan: AuthoringRunPlan,
  step: AuthoringRunStep,
): AuthoringGenerationOrchestration {
  return {
    schemaVersion: 1,
    runId: plan.runId,
    planDigest: authoringRunPlanDigest(plan),
    stepId: step.id,
    factGroupIds: step.factGroupIds,
  };
}

function generationClaims(
  generation: AuthoringGeneration,
): readonly AuthoringGenerationClaim[] {
  const kind = authoringGenerationKind(generation);
  if (kind === "summary" && "summary" in generation) {
    return generation.summary.claims;
  }
  if (kind === "section" && "section" in generation) {
    return generation.section.claims;
  }
  if (kind === "example" && "example" in generation) {
    return generation.example.claims;
  }
  return [];
}

export function generationCompletesAuthoringRunStep(
  step: AuthoringRunStep,
  generation: AuthoringGeneration,
  orchestration: AuthoringGenerationOrchestration,
): boolean {
  const generationKind = authoringGenerationKind(generation);
  const targetMatches =
    (step.kind === "summary" && generationKind === "summary") ||
    (step.kind === "section" &&
      generationKind === "section" &&
      "section" in generation &&
      generation.section.heading === step.heading) ||
    (step.kind === "example" &&
      generationKind === "example" &&
      "example" in generation &&
      generation.example.id === step.exampleId &&
      generation.example.kind === (step.exampleKind ?? "run") &&
      generation.example.standard === (step.standard ?? "c++20"));
  if (
    !targetMatches ||
    !sameFactGroupAllowlist(step.factGroupIds, orchestration.factGroupIds)
  ) {
    return false;
  }
  const allowedFacts = new Set(step.factGroupIds);
  return generationClaims(generation).every((claim) =>
    claim.factGroupIds.every((factId) => allowedFacts.has(factId)),
  );
}

interface AuthoringRunReceipt {
  readonly draftId: string;
  readonly appliedRevision: number;
  readonly orchestration?: AuthoringGenerationOrchestration;
  readonly generation: AuthoringGeneration;
}

export type InspectAuthoringRunResult =
  | {
      readonly ok: true;
      readonly planDigest: string;
      readonly currentRevision: number;
      readonly completedStepIds: readonly string[];
      readonly pendingSteps: readonly AuthoringRunStep[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly AuthoringRunValidationIssue[];
    };

export function inspectAuthoringRun(
  plan: AuthoringRunPlan,
  workspace: {
    readonly draft: { readonly revision: number };
    readonly files: Readonly<Record<string, string>>;
  },
  validateReceipt: (value: unknown) => readonly AuthoringRunValidationIssue[],
): InspectAuthoringRunResult {
  const planDigest = authoringRunPlanDigest(plan);
  const receiptIssues: AuthoringRunValidationIssue[] = [];
  const receipts: AuthoringRunReceipt[] = [];
  for (const path of Object.keys(workspace.files)
    .filter((candidate) =>
      /^generation\/revision-[1-9][0-9]*\.json$/u.test(candidate),
    )
    .sort()) {
    let receipt: unknown;
    try {
      receipt = JSON.parse(workspace.files[path]!);
    } catch (error) {
      receiptIssues.push({
        path: `/${path}`,
        message:
          error instanceof Error
            ? error.message
            : "Generation Receipt is not valid JSON",
        keyword: "parse",
      });
      continue;
    }
    const issues = validateReceipt(receipt);
    if (issues.length > 0) {
      receiptIssues.push(
        ...issues.map((issue) => ({
          ...issue,
          path: `/${path}${issue.path === "/" ? "" : issue.path}`,
        })),
      );
      continue;
    }
    const validated = receipt as AuthoringRunReceipt;
    const pathRevision = Number(
      path.match(/revision-([1-9][0-9]*)\.json$/u)?.[1],
    );
    if (
      validated.draftId !== plan.draftId ||
      validated.appliedRevision !== pathRevision ||
      validated.appliedRevision > workspace.draft.revision
    ) {
      receiptIssues.push({
        path: `/${path}`,
        message:
          "Receipt path, revision, and draft identity must match the run draft",
        keyword: "identity",
      });
      continue;
    }
    receipts.push(validated);
  }
  if (receiptIssues.length > 0) return { ok: false, issues: receiptIssues };

  const changedPlanReceipt = receipts.find(
    (receipt) =>
      receipt.orchestration?.runId === plan.runId &&
      receipt.orchestration.planDigest !== planDigest,
  );
  if (changedPlanReceipt !== undefined) {
    return {
      ok: false,
      issues: [
        {
          path: "/runId",
          message: "Run ID is already associated with a different plan digest",
          keyword: "plan-changed",
        },
      ],
    };
  }

  const stepsById = new Map(plan.steps.map((step) => [step.id, step]));
  const runReceipts = receipts.filter(
    (
      receipt,
    ): receipt is AuthoringRunReceipt & {
      readonly orchestration: AuthoringGenerationOrchestration;
    } =>
      receipt.orchestration?.runId === plan.runId &&
      receipt.orchestration.planDigest === planDigest,
  );
  for (const receipt of runReceipts) {
    const step = stepsById.get(receipt.orchestration.stepId);
    if (step === undefined) {
      return {
        ok: false,
        issues: [
          {
            path: "/steps",
            message: `Receipt references unknown run step ${receipt.orchestration.stepId}`,
            keyword: "unknown-step",
          },
        ],
      };
    }
    if (
      !generationCompletesAuthoringRunStep(
        step,
        receipt.generation,
        receipt.orchestration,
      )
    ) {
      return {
        ok: false,
        issues: [
          {
            path: `/steps/${step.id}`,
            message:
              "Generation Receipt does not match the planned step contract",
            keyword: "step-contract-mismatch",
          },
        ],
      };
    }
  }

  const completed = new Set(
    runReceipts.map((receipt) => receipt.orchestration.stepId),
  );
  return {
    ok: true,
    planDigest,
    currentRevision: workspace.draft.revision,
    completedStepIds: plan.steps
      .filter((step) => completed.has(step.id))
      .map(({ id }) => id),
    pendingSteps: plan.steps.filter((step) => !completed.has(step.id)),
  };
}

export { authoringGenerationOrchestrationSchema, authoringRunSchema };
