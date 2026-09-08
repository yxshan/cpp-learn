import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

import type { CppStandard } from "@cpp-learn/contracts";

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
  if (!targetMatches) return false;
  const allowedFacts = new Set(step.factGroupIds);
  return generationClaims(generation).every((claim) =>
    claim.factGroupIds.every((factId) => allowedFacts.has(factId)),
  );
}

export { authoringRunSchema };
