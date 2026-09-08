import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

import authoringBatchRunSchema from "./authoring-batch-run.schema.json" with { type: "json" };
import {
  authoringRunPlanDigest,
  authoringRunSchema,
  validateAuthoringRunPlan,
  type AuthoringRunPlan,
} from "./run.js";
import type {
  AdvanceAuthoringRunResult,
  AuthoringRunProgress,
  AuthoringValidationIssue,
} from "./index.js";

export interface AuthoringBatchMemberPlan {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly run: AuthoringRunPlan;
}

export interface AuthoringBatchPlan {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly members: readonly AuthoringBatchMemberPlan[];
}

interface AuthoringBatchMemberProgressBase {
  readonly id: string;
  readonly draftId: string;
  readonly runId: string;
}

export type AuthoringBatchMemberProgress =
  | (AuthoringBatchMemberProgressBase & {
      readonly status: "complete";
      readonly run: AuthoringRunProgress & { readonly status: "complete" };
    })
  | (AuthoringBatchMemberProgressBase & {
      readonly status: "awaiting_generation";
      readonly run: AuthoringRunProgress & {
        readonly status: "awaiting_generation";
      };
    })
  | (AuthoringBatchMemberProgressBase & {
      readonly status: "awaiting_dependency";
      readonly dependencyIds: readonly string[];
    })
  | (AuthoringBatchMemberProgressBase & {
      readonly status: "blocked";
      readonly code: Exclude<
        AdvanceAuthoringRunResult,
        { readonly ok: true }
      >["code"];
      readonly issues: readonly AuthoringValidationIssue[];
    });

export interface AuthoringBatchProgress {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly planDigest: string;
  readonly status: "awaiting_generation" | "blocked" | "complete";
  readonly members: readonly AuthoringBatchMemberProgress[];
}

export type AdvanceAuthoringBatchResult =
  | { readonly ok: true; readonly progress: AuthoringBatchProgress }
  | {
      readonly ok: false;
      readonly code: "invalid_request";
      readonly issues: readonly AuthoringValidationIssue[];
    };

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(authoringRunSchema);
const validateBatch = ajv.compile<AuthoringBatchPlan>(authoringBatchRunSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${String(error.params["additionalProperty"])}`;
  }
  return error.instancePath || "/";
}

export function validateAuthoringBatchPlan(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (!validateBatch(value)) {
    return (validateBatch.errors ?? []).map((error) => ({
      path: issuePath(error),
      message: error.message ?? "invalid value",
      keyword: error.keyword,
    }));
  }
  const plan = value;
  const issues: AuthoringValidationIssue[] = [];
  const memberIndexById = new Map<string, number>();
  const draftIds = new Set<string>();
  const runIds = new Set<string>();
  for (const [index, member] of plan.members.entries()) {
    issues.push(
      ...validateAuthoringRunPlan(member.run).map((issue) => ({
        ...issue,
        path: `/members/${index}/run${issue.path === "/" ? "" : issue.path}`,
      })),
    );
    if (memberIndexById.has(member.id)) {
      issues.push({
        path: `/members/${index}/id`,
        message: `Batch member ID ${member.id} is duplicated`,
        keyword: "unique-member",
      });
    } else {
      memberIndexById.set(member.id, index);
    }
    if (draftIds.has(member.run.draftId)) {
      issues.push({
        path: `/members/${index}/run/draftId`,
        message: `Draft ${member.run.draftId} is targeted more than once`,
        keyword: "unique-draft",
      });
    }
    draftIds.add(member.run.draftId);
    if (runIds.has(member.run.runId)) {
      issues.push({
        path: `/members/${index}/run/runId`,
        message: `Run ID ${member.run.runId} is duplicated in the batch`,
        keyword: "unique-run",
      });
    }
    runIds.add(member.run.runId);
  }
  for (const [index, member] of plan.members.entries()) {
    for (const [dependencyIndex, dependencyId] of member.dependsOn.entries()) {
      if (dependencyId === member.id) {
        issues.push({
          path: `/members/${index}/dependsOn/${dependencyIndex}`,
          message: "A batch member cannot depend on itself",
          keyword: "self-dependency",
        });
      } else if (!memberIndexById.has(dependencyId)) {
        issues.push({
          path: `/members/${index}/dependsOn/${dependencyIndex}`,
          message: `Dependency ${dependencyId} is not a batch member`,
          keyword: "dependency-not-found",
        });
      }
    }
  }
  if (issues.length > 0) return issues;

  const membersById = new Map(
    plan.members.map((member) => [member.id, member]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visitsCycle(memberId: string): boolean {
    if (visiting.has(memberId)) return true;
    if (visited.has(memberId)) return false;
    visiting.add(memberId);
    const cyclic = membersById
      .get(memberId)!
      .dependsOn.some((dependencyId) => visitsCycle(dependencyId));
    visiting.delete(memberId);
    visited.add(memberId);
    return cyclic;
  }
  if (plan.members.some(({ id }) => visitsCycle(id))) {
    issues.push({
      path: "/members",
      message: "Batch dependencies must form an acyclic graph",
      keyword: "cycle",
    });
  }
  return issues;
}

export function authoringBatchPlanDigest(plan: AuthoringBatchPlan): string {
  const normalized = {
    schemaVersion: plan.schemaVersion,
    batchId: plan.batchId,
    members: plan.members.map((member) => ({
      id: member.id,
      dependsOn: member.dependsOn,
      runDigest: authoringRunPlanDigest(member.run),
    })),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function advanceAuthoringBatch(
  request: unknown,
  advanceRun: (plan: AuthoringRunPlan) => Promise<AdvanceAuthoringRunResult>,
): Promise<AdvanceAuthoringBatchResult> {
  const issues = validateAuthoringBatchPlan(request);
  if (issues.length > 0) {
    return { ok: false, code: "invalid_request", issues };
  }
  const plan = request as AuthoringBatchPlan;
  const progressById = new Map<string, AuthoringBatchMemberProgress>();
  const pending = new Set(plan.members.map(({ id }) => id));

  while (pending.size > 0) {
    let advanced = false;
    for (const member of plan.members) {
      if (!pending.has(member.id)) continue;
      if (member.dependsOn.some((id) => !progressById.has(id))) continue;
      const base = {
        id: member.id,
        draftId: member.run.draftId,
        runId: member.run.runId,
      };
      const dependencyIds = member.dependsOn.filter(
        (id) => progressById.get(id)?.status !== "complete",
      );
      if (dependencyIds.length > 0) {
        progressById.set(member.id, {
          ...base,
          status: "awaiting_dependency",
          dependencyIds,
        });
      } else {
        const result = await advanceRun(member.run);
        if (!result.ok) {
          progressById.set(member.id, {
            ...base,
            status: "blocked",
            code: result.code,
            issues: result.issues,
          });
        } else if (result.progress.status === "complete") {
          progressById.set(member.id, {
            ...base,
            status: "complete",
            run: result.progress,
          });
        } else {
          progressById.set(member.id, {
            ...base,
            status: "awaiting_generation",
            run: result.progress,
          });
        }
      }
      pending.delete(member.id);
      advanced = true;
    }
    if (!advanced) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/members",
            message: "Batch dependencies must form an acyclic graph",
            keyword: "cycle",
          },
        ],
      };
    }
  }

  const members = plan.members.map(({ id }) => progressById.get(id)!);
  return {
    ok: true,
    progress: {
      schemaVersion: 1,
      batchId: plan.batchId,
      planDigest: authoringBatchPlanDigest(plan),
      status: members.some(({ status }) => status === "blocked")
        ? "blocked"
        : members.every(({ status }) => status === "complete")
          ? "complete"
          : "awaiting_generation",
      members,
    },
  };
}

export { authoringBatchRunSchema };
