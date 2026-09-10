import { advanceAuthoringBatch } from "../batch.ts";
import {
  createAuthoringGenerationOrchestration,
  inspectAuthoringRun,
  validateAuthoringRunPlan,
  type AuthoringRunPlan,
} from "../run.ts";
import { validateAuthoringGenerationReceipt } from "../validation.ts";

import type {
  AdvanceAuthoringBatchResult,
  AdvanceAuthoringRunResult,
  BuildAuthoringGenerationTemplateRequest,
  AuthoringGenerationBundleTemplate,
  BuildAuthoringGenerationTemplateResult,
  DraftWorkspace,
  ReferenceDraftRepository,
} from "../index.ts";

/**
 * Generation run and batch progression.
 *
 * One run drives one draft; a batch drives up to five runs through a dependency
 * graph. Both hand each step to `buildGenerationTemplate`, so a run can only ever
 * propose work the current context pack already authorizes.
 */
export interface RunBatchOperationsContext {
  readonly drafts: ReferenceDraftRepository;
  readonly buildGenerationTemplate: (
    request: BuildAuthoringGenerationTemplateRequest,
  ) => Promise<BuildAuthoringGenerationTemplateResult>;
}

export interface RunBatchOperations {
  readonly advanceRun: (request: unknown) => Promise<AdvanceAuthoringRunResult>;
  readonly advanceBatch: (
    request: unknown,
  ) => Promise<AdvanceAuthoringBatchResult>;
}

export function createRunBatchOperations(
  context: RunBatchOperationsContext,
): RunBatchOperations {
  async function advanceRun(
    request: unknown,
  ): Promise<AdvanceAuthoringRunResult> {
    const planIssues = validateAuthoringRunPlan(request);
    if (planIssues.length > 0) {
      return { ok: false, code: "invalid_request", issues: planIssues };
    }
    const plan = request as AuthoringRunPlan;
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
    const inspection = inspectAuthoringRun(
      plan,
      workspace,
      validateAuthoringGenerationReceipt,
    );
    if (!inspection.ok) {
      return { ok: false, code: "run_blocked", issues: inspection.issues };
    }
    const progressBase = {
      schemaVersion: 1 as const,
      runId: plan.runId,
      draftId: plan.draftId,
      planDigest: inspection.planDigest,
      currentRevision: inspection.currentRevision,
      completedStepIds: inspection.completedStepIds,
      pendingStepIds: inspection.pendingSteps.map(({ id }) => id),
    };
    const nextStep = inspection.pendingSteps[0];
    if (nextStep === undefined) {
      return {
        ok: true,
        progress: { ...progressBase, status: "complete" },
      };
    }
    const templateResult = await context.buildGenerationTemplate(
      nextStep.kind === "summary"
        ? {
            draftId: plan.draftId,
            factGroupIds: nextStep.factGroupIds,
            kind: "summary",
          }
        : nextStep.kind === "section"
          ? {
              draftId: plan.draftId,
              factGroupIds: nextStep.factGroupIds,
              kind: "section",
              heading: nextStep.heading,
            }
          : {
              draftId: plan.draftId,
              factGroupIds: nextStep.factGroupIds,
              kind: "example",
              exampleId: nextStep.exampleId,
              ...(nextStep.exampleKind === undefined
                ? {}
                : { exampleKind: nextStep.exampleKind }),
              ...(nextStep.standard === undefined
                ? {}
                : { standard: nextStep.standard }),
            },
    );
    if (!templateResult.ok) return templateResult;
    const template: AuthoringGenerationBundleTemplate = {
      ...templateResult.template,
      orchestration: createAuthoringGenerationOrchestration(plan, nextStep),
    };
    return {
      ok: true,
      progress: {
        ...progressBase,
        status: "awaiting_generation",
        currentRevision: template.expectedRevision,
        next: { stepId: nextStep.id, template },
      },
    };
  }

  async function advanceBatch(
    request: unknown,
  ): Promise<AdvanceAuthoringBatchResult> {
    return advanceAuthoringBatch(request, (plan) => advanceRun(plan));
  }

  return { advanceRun, advanceBatch };
}
