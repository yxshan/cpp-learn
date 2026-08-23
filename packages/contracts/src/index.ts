import Ajv from "ajv";
import addFormats from "ajv-formats";

import bootstrapResultSchema from "./bootstrap-result.schema.json" with { type: "json" };

export const SCHEMA_VERSION = 1 as const;

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

export interface BootstrapResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly ready: boolean;
  readonly services: {
    readonly curriculum: CurriculumReadiness;
    readonly toolchain: ToolchainReadiness;
    readonly record: RecordReadiness;
  };
}

export interface ActivityDetail {
  readonly id: string;
  readonly version: number;
  readonly kind: "lesson" | "exercise" | "review" | "project-milestone";
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly conceptIds: readonly string[];
  readonly markdown: string;
  readonly workspace: {
    readonly editablePaths: readonly string[];
  };
}

export interface ActivityResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly activity: ActivityDetail | null;
}

export interface WorkspaceView {
  readonly activityId: string;
  readonly revision: number;
  readonly files: Readonly<Record<string, string>>;
}

export interface WorkspaceResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly workspace: WorkspaceView;
}

export type ExecutionMode = "run" | "grade";
export interface JudgeSpec {
  readonly activityId: string;
  readonly activityVersion: number;
  readonly judgeVersion: number;
  readonly expectedStdout: string;
  readonly timeoutMs: number;
}

export type JudgeVerdict =
  | "compile_error"
  | "runtime_error"
  | "public_failure"
  | "timeout"
  | "output_limit"
  | "automated_pass"
  | "judge_system_error";

export interface JudgeReportStage {
  readonly kind: "compile" | "test";
  readonly outcome: "pass" | "fail" | "system_error";
  readonly durationMs: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface JudgeReport {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly reportId: string;
  readonly jobId: string;
  readonly mode: ExecutionMode;
  readonly activity: {
    readonly id: string;
    readonly version: number;
    readonly judgeVersion: number;
  };
  readonly source: { readonly snapshotId: string; readonly digest: string };
  readonly toolchain: { readonly compiler: string; readonly standard: "c++20" };
  readonly verdict: JudgeVerdict;
  readonly stages: readonly JudgeReportStage[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface AttemptCompletedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "attempt.completed";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly activityId: string;
  readonly conceptIds: readonly string[];
  readonly mode: ExecutionMode;
  readonly report: JudgeReport;
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
  readonly conceptStates: Readonly<
    Record<
      string,
      "unseen" | "introduced" | "practiced" | "demonstrated" | "retained"
    >
  >;
}

export interface JobResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly report: JudgeReport | null;
}

export type LearningQuery =
  | { readonly type: "bootstrap.get" }
  | { readonly type: "activity.get"; readonly activityId: string }
  | { readonly type: "workspace.get"; readonly activityId: string }
  | { readonly type: "dashboard.get" }
  | { readonly type: "job.get"; readonly jobId: string };
export type QueryResult =
  | BootstrapResult
  | ActivityResult
  | WorkspaceResult
  | DashboardResult
  | JobResult;
export type QueryResultFor<Q extends LearningQuery> = Q extends {
  readonly type: "bootstrap.get";
}
  ? BootstrapResult
  : Q extends { readonly type: "activity.get" }
    ? ActivityResult
    : Q extends { readonly type: "workspace.get" }
      ? WorkspaceResult
      : Q extends { readonly type: "dashboard.get" }
        ? DashboardResult
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
}

export interface ActivityExecutionCommandResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly commandId: string;
  readonly jobId: string;
  readonly snapshotId: string;
  readonly status: "completed";
  readonly report: JudgeReport;
}

export type LearningCommand = WorkspaceSaveCommand | ActivityExecutionCommand;
export type CommandResult =
  WorkspaceSaveCommandResult | ActivityExecutionCommandResult;
export type CommandResultFor<C extends LearningCommand> =
  C extends WorkspaceSaveCommand
    ? WorkspaceSaveCommandResult
    : C extends ActivityExecutionCommand
      ? ActivityExecutionCommandResult
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
