import Ajv from "ajv";
import addFormats from "ajv-formats";

import bootstrapResultSchema from "./bootstrap-result.schema.json" with { type: "json" };

export const SCHEMA_VERSION = 1 as const;

import type { ReferenceReadiness } from "./reference.ts";
import type {
  ExecutionMode,
  JudgeDiagnostic,
  JudgeReport,
  JudgeVerdict,
} from "./judge.ts";
import type {
  AttemptCompletedEvent,
  EvidenceRecordedEvent,
  HintRevealedEvent,
  ReflectionSubmittedEvent,
} from "./events.ts";

export * from "./reference.ts";
export * from "./judge.ts";
export * from "./events.ts";
export const REFERENCE_SCHEMA_VERSION = 2 as const;

export interface CurriculumReadiness {
  readonly ready: boolean;
  readonly activityCount: number;
  readonly issues?: readonly string[];
}

export interface ToolchainReadiness {
  readonly ready: boolean;
  readonly compiler?: string;
  readonly issues?: readonly string[];
}

export interface RecordReadiness {
  readonly ready: boolean;
  readonly issues?: readonly string[];
}

interface BootstrapServices {
  readonly curriculum: CurriculumReadiness;
  readonly toolchain: ToolchainReadiness;
  readonly record: RecordReadiness;
}

interface BootstrapEnvelope<Services extends BootstrapServices> {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly ready: boolean;
  readonly services: Services;
}

export type LearningBootstrapResult = BootstrapEnvelope<BootstrapServices>;

export type BootstrapResult = BootstrapEnvelope<
  BootstrapServices & {
    readonly reference: ReferenceReadiness;
  }
>;

export interface ActivityDetail {
  readonly id: string;
  readonly version: number;
  readonly kind: "lesson" | "exercise" | "review" | "project-milestone";
  readonly title: string;
  readonly project?: ActivityProjectSummary;
  readonly estimatedMinutes: number;
  readonly conceptIds: readonly string[];
  readonly prerequisiteIds?: readonly string[];
  readonly referenceIds?: readonly string[];
  readonly objectives?: readonly string[];
  readonly victoryConditions?: readonly string[];
  readonly sources?: readonly ActivitySource[];
  readonly interactiveBlocks?: readonly InteractiveLessonBlock[];
  readonly printFallback?: string;
  readonly markdown: string;
  readonly workspace: {
    readonly editablePaths: readonly string[];
  };
  readonly learning?: ActivityLearningSummary;
}

export interface ActivityProjectSummary {
  readonly id: string;
  readonly title: string;
  readonly milestone: number;
  readonly milestoneCount: number;
  readonly portfolioOutcome: string;
}

export interface ActivitySource {
  readonly kind: "primary" | "reference";
  readonly title: string;
  readonly url: string;
}

export interface InteractiveLessonBlock {
  readonly id: string;
  readonly type:
    | "code-compare"
    | "memory-visualization"
    | "lifetime-timeline"
    | "container-visualization"
    | "algorithm-trace"
    | "network-flow"
    | "quiz"
    | "exercise"
    | "reflection";
  readonly fallback: string;
}

export type HintKind = "nudge" | "concept" | "solution";

export interface HintSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: HintKind;
}

export interface ReflectionPrompt {
  readonly id: string;
  readonly prompt: string;
  readonly required: boolean;
}

export interface ActivityLearningSummary {
  readonly hints: readonly HintSummary[];
  readonly reflections: readonly ReflectionPrompt[];
  readonly reviewIds: readonly string[];
  readonly reviewOf?: string;
}

export type ConceptState =
  "unseen" | "introduced" | "practiced" | "demonstrated" | "retained";
export type AttemptIndependence =
  "independent" | "assisted" | "solution_exposed";

export interface ActivityResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly activity: ActivityDetail | null;
}

export interface ActivitiesResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly activities: readonly {
    readonly id: string;
    readonly version: number;
    readonly kind: ActivityDetail["kind"];
    readonly title: string;
    readonly project?: ActivityProjectSummary;
    readonly estimatedMinutes: number;
    readonly conceptIds: readonly string[];
    readonly prerequisiteIds: readonly string[];
  }[];
}

export interface WorkspaceView {
  readonly activityId: string;
  readonly revision: number;
  readonly files: Readonly<Record<string, string>>;
  readonly starterFiles: Readonly<Record<string, string>>;
}

export interface WorkspaceResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly workspace: WorkspaceView;
}

export interface DashboardResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly attempts: readonly {
    readonly activityId: string;
    readonly mode: ExecutionMode;
    readonly verdict: JudgeVerdict;
    readonly jobId: string;
    readonly completedAt: string;
  }[];
  readonly conceptStates: Readonly<Record<string, ConceptState>>;
  readonly dueReviewCount?: number;
}

export interface ProgressResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly concepts: readonly {
    readonly conceptId: string;
    readonly state: ConceptState;
    readonly explanation: string;
    readonly supportingEvidenceIds: readonly string[];
    readonly evidence?: readonly {
      readonly evidenceId: string;
      readonly activityId: string;
      readonly occurredAt: string;
      readonly source: EvidenceRecordedEvent["source"];
      readonly outcome: EvidenceRecordedEvent["outcome"];
      readonly independence: AttemptIndependence;
    }[];
    readonly nextReviewAt?: string;
  }[];
}

export interface ReviewsResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly reviews: readonly {
    readonly activityId: string;
    readonly conceptId: string;
    readonly dueAt: string;
    readonly intervalDays: number;
    readonly reason: string;
    readonly status: "scheduled" | "due";
  }[];
}

export interface AttemptResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly attempt: {
    readonly attemptId: string;
    readonly activityId: string;
    readonly independence: AttemptIndependence;
    readonly completed?: AttemptCompletedEvent;
    readonly hints: readonly HintRevealedEvent[];
    readonly reflections: readonly ReflectionSubmittedEvent[];
    readonly evidence: readonly EvidenceRecordedEvent[];
  } | null;
}

export interface JobResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly report: JudgeReport | null;
}

export type LearningQuery =
  | { readonly type: "bootstrap.get" }
  | { readonly type: "activities.list" }
  | { readonly type: "activity.get"; readonly activityId: string }
  | { readonly type: "activity.next"; readonly minutes?: number }
  | { readonly type: "workspace.get"; readonly activityId: string }
  | { readonly type: "dashboard.get" }
  | { readonly type: "progress.get" }
  | { readonly type: "reviews.get"; readonly dueOnly?: boolean }
  | { readonly type: "concept.get"; readonly conceptId: string }
  | { readonly type: "attempt.get"; readonly attemptId: string }
  | { readonly type: "job.get"; readonly jobId: string };
export type QueryResult =
  | LearningBootstrapResult
  | ActivitiesResult
  | ActivityResult
  | WorkspaceResult
  | DashboardResult
  | ProgressResult
  | ReviewsResult
  | AttemptResult
  | JobResult;
export type QueryResultFor<Q extends LearningQuery> = Q extends {
  readonly type: "bootstrap.get";
}
  ? LearningBootstrapResult
  : Q extends { readonly type: "activities.list" }
    ? ActivitiesResult
    : Q extends { readonly type: "activity.get" }
      ? ActivityResult
      : Q extends { readonly type: "activity.next" }
        ? ActivityResult
        : Q extends { readonly type: "workspace.get" }
          ? WorkspaceResult
          : Q extends { readonly type: "dashboard.get" }
            ? DashboardResult
            : Q extends { readonly type: "progress.get" }
              ? ProgressResult
              : Q extends { readonly type: "reviews.get" }
                ? ReviewsResult
                : Q extends { readonly type: "concept.get" }
                  ? ProgressResult
                  : Q extends { readonly type: "attempt.get" }
                    ? AttemptResult
                    : Q extends { readonly type: "job.get" }
                      ? JobResult
                      : never;

export interface WorkspaceSaveCommand {
  readonly type: "workspace.save";
  readonly commandId: string;
  readonly activityId: string;
  readonly baseRevision: number;
  readonly changes: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

export type WorkspaceSaveResult =
  | { readonly ok: true; readonly revision: number }
  | {
      readonly ok: false;
      readonly code: "revision_conflict" | "invalid_path";
    };

export interface WorkspaceSaveCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly result: WorkspaceSaveResult;
}

export interface ActivityExecutionCommand {
  readonly type: "activity.run" | "activity.grade";
  readonly commandId: string;
  readonly activityId: string;
  readonly attemptId?: string;
}

export interface ActivityExecutionCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly jobId: string;
  readonly snapshotId: string;
  readonly status: "completed";
  readonly report: JudgeReport;
  readonly learningOutcome?: "recorded" | "pending_teacher_review";
}

export interface JobCancelCommand {
  readonly type: "job.cancel";
  readonly commandId: string;
  readonly jobId: string;
}

export interface JobCancelCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly jobId: string;
  readonly cancelled: boolean;
}

export interface HintRevealCommand {
  readonly type: "hint.reveal";
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly hintId: string;
  readonly confirmFullSolution: boolean;
}

export interface HintRevealCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly hint: {
    readonly id: string;
    readonly title: string;
    readonly kind: HintKind;
    readonly content: string;
  };
  readonly assistance: AttemptIndependence;
}

export interface ReflectionSubmitCommand {
  readonly type: "reflection.submit";
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly answers: readonly {
    readonly promptId: string;
    readonly answer: string;
  }[];
}

export interface ReflectionSubmitCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly accepted: true;
}

export interface TeacherPackCreateCommand {
  readonly type: "teacher-pack.create";
  readonly commandId: string;
  readonly activityId: string;
  readonly attemptId?: string;
}

export interface TeacherPackCreateCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly pack: {
    readonly activity: {
      readonly id: string;
      readonly version: number;
      readonly title: string;
      readonly markdown: string;
      readonly reflections: readonly ReflectionPrompt[];
      readonly teacherRubric: { readonly id: string; readonly prompt: string };
    };
    readonly learnerDiff: readonly {
      readonly path: string;
      readonly starter: string;
      readonly current: string;
    }[];
    readonly publicDiagnostics: readonly JudgeDiagnostic[];
    readonly recentAttempts: readonly {
      readonly attemptId?: string;
      readonly mode: ExecutionMode;
      readonly verdict: JudgeVerdict;
      readonly completedAt: string;
    }[];
    readonly concepts: readonly {
      readonly conceptId: string;
      readonly state: ConceptState;
      readonly explanation: string;
    }[];
  };
}

export interface TeacherObservationSubmitCommand {
  readonly type: "teacher-observation.submit";
  readonly commandId: string;
  readonly observationId: string;
  readonly activityId: string;
  readonly attemptId: string;
  readonly rubricId: string;
  readonly outcome: "pass" | "revise";
  readonly summary: string;
}

export interface TeacherObservationSubmitCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly observationId: string;
  readonly accepted: boolean;
  readonly reason?: string;
}

export type LearningCommand =
  | WorkspaceSaveCommand
  | ActivityExecutionCommand
  | JobCancelCommand
  | HintRevealCommand
  | ReflectionSubmitCommand
  | TeacherPackCreateCommand
  | TeacherObservationSubmitCommand;
export type CommandResult =
  | WorkspaceSaveCommandResult
  | ActivityExecutionCommandResult
  | JobCancelCommandResult
  | HintRevealCommandResult
  | ReflectionSubmitCommandResult
  | TeacherPackCreateCommandResult
  | TeacherObservationSubmitCommandResult;
export type CommandResultFor<C extends LearningCommand> =
  C extends WorkspaceSaveCommand
    ? WorkspaceSaveCommandResult
    : C extends ActivityExecutionCommand
      ? ActivityExecutionCommandResult
      : C extends JobCancelCommand
        ? JobCancelCommandResult
        : C extends HintRevealCommand
          ? HintRevealCommandResult
          : C extends ReflectionSubmitCommand
            ? ReflectionSubmitCommandResult
            : C extends TeacherPackCreateCommand
              ? TeacherPackCreateCommandResult
              : C extends TeacherObservationSubmitCommand
                ? TeacherObservationSubmitCommandResult
                : never;
export type JobId = string;

export interface PlatformEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly jobId: JobId;
  readonly sequence: number;
  readonly type: string;
}

export interface LearningPlatform {
  dispatch<C extends LearningCommand>(command: C): Promise<CommandResultFor<C>>;
  query<Q extends LearningQuery>(query: Q): Promise<QueryResultFor<Q>>;
  events(jobId: JobId): AsyncIterable<PlatformEvent>;
}

const ajv = new Ajv({
  allErrors: true,
  strict: true,
});
addFormats(ajv);
const validateBootstrapResult = ajv.compile(bootstrapResultSchema);

export function parseBootstrapResult(value: unknown): BootstrapResult {
  if (!validateBootstrapResult(value)) {
    throw new Error("Bootstrap response violates the transport contract");
  }
  return value as unknown as BootstrapResult;
}

export { bootstrapResultSchema };
