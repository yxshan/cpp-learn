import { authoringInputDigest } from "../digest.ts";
import { jsonFile } from "../draft.ts";
import { PROFILE_DEFINITIONS } from "../profiles.ts";
import {
  authoringReportDigest,
  buildAuthoringRepairPlan,
  validateAuthoringRepairPlan,
} from "../repair.ts";
import {
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringReport,
} from "../validation.ts";

import type {
  AdvanceAuthoringRepairResult,
  AuthoringRepairPlan,
  DraftWorkspace,
  BuildAuthoringGenerationTemplateRequest,
  BuildAuthoringGenerationTemplateResult,
  BuildAuthoringRepairPlanResult,
  ReferenceDraftRepository,
} from "../index.ts";

/**
 * Repair planning and bounded repair attempts.
 *
 * A repair plan is bound to a draft revision and input digest, and it never
 * resets its three-attempt budget by renaming a repair ID. Applying a repair
 * still has to pass the same fact, claim, compilation, revision and receipt
 * checks as any other generated change.
 */
export interface RepairOperationsContext {
  readonly drafts: ReferenceDraftRepository;
  readonly clock: () => Date;
  readonly buildGenerationTemplate: (
    request: BuildAuthoringGenerationTemplateRequest,
  ) => Promise<BuildAuthoringGenerationTemplateResult>;
}

export interface RepairOperations {
  readonly buildRepairPlan: (
    request: unknown,
  ) => Promise<BuildAuthoringRepairPlanResult>;
  readonly advanceRepair: (
    request: unknown,
  ) => Promise<AdvanceAuthoringRepairResult>;
}

export function createRepairOperations(
  context: RepairOperationsContext,
): RepairOperations {
  async function buildRepairPlan(
    request: unknown,
  ): Promise<BuildAuthoringRepairPlanResult> {
    if (
      request === null ||
      typeof request !== "object" ||
      Object.keys(request).some(
        (field) => field !== "draftId" && field !== "repairId",
      ) ||
      !("draftId" in request) ||
      !("repairId" in request) ||
      typeof request.draftId !== "string" ||
      typeof request.repairId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.repairId)
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message: "draftId and repairId must be stable lowercase IDs",
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
            path: "/draftId",
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
      ...validateAuthoringDraft(workspace.draft).map((issue) => ({
        ...issue,
        path: `/draft${issue.path === "/" ? "" : issue.path}`,
      })),
      ...validateAuthoringReport(workspace.report).map((issue) => ({
        ...issue,
        path: `/report${issue.path === "/" ? "" : issue.path}`,
      })),
      ...validateAuthoringFactSheet(workspace.facts).map((issue) => ({
        ...issue,
        path: `/facts${issue.path === "/" ? "" : issue.path}`,
      })),
    ];
    const expectedReportStatus = workspace.report.findings.some(
      ({ severity }) => severity === "hard",
    )
      ? "blocked"
      : "ready";
    if (
      workspace.report.draftId !== workspace.draft.draftId ||
      (workspace.report.status !== "not_checked" &&
        workspace.report.status !== expectedReportStatus)
    ) {
      artifactIssues.push({
        path: "/report/status",
        message:
          "Report identity and status must agree with its draft and hard findings",
        keyword: "report-consistency",
      });
    }
    if (artifactIssues.length > 0) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: artifactIssues,
      };
    }
    if (
      workspace.report.status === "not_checked" ||
      workspace.report.draftRevision !== workspace.draft.revision ||
      workspace.report.inputDigest !== authoringInputDigest(workspace.files)
    ) {
      return {
        ok: false,
        code: "repair_blocked",
        issues: [
          {
            path: "/report",
            message:
              "Repair planning requires a current report produced by the full check gate",
            keyword: "unchecked-baseline",
          },
        ],
      };
    }
    const built = buildAuthoringRepairPlan({
      repairId: request.repairId,
      requiredHeadings: PROFILE_DEFINITIONS[workspace.draft.profile].headings,
      expectedExampleIds: PROFILE_DEFINITIONS[workspace.draft.profile].examples,
      workspace,
    });
    return built.plan === undefined
      ? {
          ok: true,
          status: "no_repairs",
          ignoredFindingDigests: built.ignoredFindingDigests,
        }
      : { ok: true, status: "repairable", plan: built.plan };
  }

  async function advanceRepair(
    request: unknown,
  ): Promise<AdvanceAuthoringRepairResult> {
    const planIssues = validateAuthoringRepairPlan(request);
    if (planIssues.length > 0) {
      return { ok: false, code: "invalid_request", issues: planIssues };
    }
    const plan = request as AuthoringRepairPlan;
    if (plan.attempts.length > 0) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/attempts",
            message:
              "Repair attempt history is module-managed; submit the original immutable plan",
            keyword: "managed-state",
          },
        ],
      };
    }
    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(plan.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/draftId",
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
      workspace.draft.revision !== plan.baseline.draftRevision ||
      workspace.draft.profile !== plan.baseline.profile ||
      authoringInputDigest(workspace.files) !== plan.baseline.inputDigest ||
      workspace.report.inputDigest !== plan.baseline.inputDigest ||
      workspace.report.draftRevision !== plan.baseline.draftRevision ||
      workspace.report.status === "not_checked" ||
      authoringReportDigest(workspace.report) !== plan.baseline.reportDigest
    ) {
      return {
        ok: false,
        code: "repair_blocked",
        issues: [
          {
            path: "/baseline",
            message:
              "Draft, facts, quality profile, or full-check report changed after repair planning",
            keyword: "baseline-changed",
          },
        ],
      };
    }
    const authoritative = buildAuthoringRepairPlan({
      repairId: plan.repairId,
      requiredHeadings: PROFILE_DEFINITIONS[workspace.draft.profile].headings,
      expectedExampleIds: PROFILE_DEFINITIONS[workspace.draft.profile].examples,
      workspace,
    }).plan;
    if (
      authoritative === undefined ||
      authoritative.planDigest !== plan.planDigest
    ) {
      return {
        ok: false,
        code: "repair_blocked",
        issues: [
          {
            path: "/planDigest",
            message:
              "Repair targets no longer match the deterministic full-check findings",
            keyword: "plan-changed",
          },
        ],
      };
    }
    const statePath = `repair/${plan.planDigest}.json`;
    let activePlan = plan;
    const persistedState = workspace.files[statePath];
    if (persistedState !== undefined) {
      let parsedState: unknown;
      try {
        parsedState = JSON.parse(persistedState);
      } catch (error) {
        return {
          ok: false,
          code: "repair_blocked",
          issues: [
            {
              path: `/${statePath}`,
              message:
                error instanceof Error
                  ? error.message
                  : "Repair attempt state is not valid JSON",
              keyword: "parse",
            },
          ],
        };
      }
      const stateIssues = validateAuthoringRepairPlan(parsedState);
      if (
        stateIssues.length > 0 ||
        (parsedState as AuthoringRepairPlan).planDigest !== plan.planDigest
      ) {
        return {
          ok: false,
          code: "repair_blocked",
          issues:
            stateIssues.length > 0
              ? stateIssues.map((issue) => ({
                  ...issue,
                  path: `/${statePath}${issue.path === "/" ? "" : issue.path}`,
                }))
              : [
                  {
                    path: `/${statePath}/planDigest`,
                    message:
                      "Persisted repair state belongs to a different plan",
                    keyword: "plan-changed",
                  },
                ],
        };
      }
      activePlan = parsedState as AuthoringRepairPlan;
    }
    const attemptCount = (targetId: string) =>
      activePlan.attempts.filter((attempt) => attempt.targetId === targetId)
        .length;
    const exhaustedTargetIds = activePlan.targets
      .filter((target) => attemptCount(target.id) >= activePlan.maxAttempts)
      .map(({ id }) => id);
    const nextTarget = activePlan.targets.find(
      (target) => attemptCount(target.id) < activePlan.maxAttempts,
    );
    const progressBase = {
      schemaVersion: 1 as const,
      repairId: plan.repairId,
      draftId: plan.draftId,
      planDigest: plan.planDigest,
      exhaustedTargetIds,
    };
    if (nextTarget === undefined) {
      return {
        ok: true,
        progress: { ...progressBase, status: "exhausted" },
      };
    }
    const templateResult = await context.buildGenerationTemplate(
      nextTarget.kind === "section"
        ? {
            draftId: plan.draftId,
            factGroupIds: nextTarget.factGroupIds,
            kind: "section",
            heading: nextTarget.heading,
          }
        : {
            draftId: plan.draftId,
            factGroupIds: nextTarget.factGroupIds,
            kind: "example",
            exampleId: nextTarget.exampleId,
            exampleKind: nextTarget.exampleKind,
            standard: nextTarget.standard,
          },
    );
    if (!templateResult.ok) return templateResult;
    const attempt = attemptCount(nextTarget.id) + 1;
    const nextState: AuthoringRepairPlan = {
      ...activePlan,
      attempts: [
        ...activePlan.attempts,
        {
          targetId: nextTarget.id,
          attempt,
          outcome: "issued",
          issuedAt: context.clock().toISOString(),
        },
      ],
    };
    const nextWorkspace: DraftWorkspace = {
      ...workspace,
      files: { ...workspace.files, [statePath]: jsonFile(nextState) },
    };
    let committed: boolean;
    try {
      committed = await context.drafts.commitWorkspace({
        draftId: workspace.draft.draftId,
        expectedRevision: workspace.draft.revision,
        expectedFiles: workspace.files,
        workspace: nextWorkspace,
      });
    } catch (error) {
      return {
        ok: false,
        code: "repair_blocked",
        issues: [
          {
            path: `/${statePath}`,
            message:
              error instanceof Error
                ? error.message
                : "Repair attempt state could not be written",
            keyword: "write",
          },
        ],
      };
    }
    if (!committed) {
      return {
        ok: false,
        code: "repair_blocked",
        issues: [
          {
            path: `/${statePath}`,
            message: "Repair attempt state changed concurrently",
            keyword: "attempt-conflict",
          },
        ],
      };
    }
    return {
      ok: true,
      progress: {
        ...progressBase,
        status: "awaiting_generation",
        next: {
          targetId: nextTarget.id,
          attempt,
          maxAttempts: activePlan.maxAttempts,
          findingDigests: nextTarget.findingDigests,
          template: templateResult.template,
        },
      },
    };
  }

  return {
    buildRepairPlan,
    advanceRepair,
  };
}
