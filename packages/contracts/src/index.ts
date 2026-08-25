import Ajv from "ajv";
import addFormats from "ajv-formats";

import bootstrapResultSchema from "./bootstrap-result.schema.json" with { type: "json" };

export const SCHEMA_VERSION = 1 as const;
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

export const REFERENCE_ENTRY_KINDS = [
  "landing",
  "header",
  "type",
  "object",
  "function",
  "member",
  "concept",
  "guide",
] as const;
export type ReferenceEntryKind = (typeof REFERENCE_ENTRY_KINDS)[number];

export const CPP_STANDARDS = [
  "c++98",
  "c++03",
  "c++11",
  "c++14",
  "c++17",
  "c++20",
  "c++23",
  "c++26-draft",
] as const;
export type CppStandard = (typeof CPP_STANDARDS)[number];

export const REFERENCE_VERIFICATIONS = [
  "verified",
  "unsupported",
  "not-checked",
] as const;
export type ReferenceVerification = (typeof REFERENCE_VERIFICATIONS)[number];

export interface ReferenceSource {
  readonly kind: "primary" | "secondary" | "vendor";
  readonly title: string;
  readonly url: string;
  readonly standardSection?: string;
  readonly reusedMaterial?: {
    readonly license: string;
    readonly attribution: string;
    readonly modifications: string;
  };
}

export interface ReferenceExampleView {
  readonly id: string;
  readonly kind: "compile" | "run" | "expected-compile-failure";
  readonly standard: CppStandard;
  readonly source: string;
  readonly digest: string;
  readonly verification: ReferenceVerification;
  readonly stdin?: string;
  readonly expectedStdout?: string;
  readonly expectedDiagnosticCategory?: string;
}

export interface ReferenceEntryDetail {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly id: string;
  readonly version: number;
  readonly slug: string;
  readonly kind: ReferenceEntryKind;
  readonly title: string;
  readonly summary: string;
  readonly symbol?: string;
  readonly header?: string;
  readonly namespace?: string;
  readonly since?: CppStandard;
  readonly deprecatedSince?: CppStandard;
  readonly removedSince?: CppStandard;
  readonly aliases: readonly string[];
  readonly categories: readonly string[];
  readonly relatedEntryIds: readonly string[];
  readonly content: string;
  readonly examples: readonly ReferenceExampleView[];
  readonly sources: readonly ReferenceSource[];
  readonly verifiedAt: string;
  readonly relatedActivityIds: readonly string[];
}

export interface ReferenceSearchQuery {
  readonly text: string;
  readonly kind?: ReferenceEntryKind;
  readonly category?: string;
  readonly standard?: CppStandard;
  readonly verified?: ReferenceVerification;
  readonly limit?: number;
}

export type ReferenceMatchField =
  | "id"
  | "symbol"
  | "header"
  | "alias"
  | "title"
  | "heading"
  | "category"
  | "body";

export interface ReferenceSearchItem {
  readonly id: string;
  readonly slug: string;
  readonly kind: ReferenceEntryKind;
  readonly title: string;
  readonly summary: string;
  readonly symbol?: string;
  readonly header?: string;
  readonly since?: CppStandard;
  readonly deprecatedSince?: CppStandard;
  readonly verification: ReferenceVerification;
  readonly matchedBy: readonly ReferenceMatchField[];
}

export interface ReferenceSearchResult {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly query: ReferenceSearchQuery;
  readonly total: number;
  readonly results: readonly ReferenceSearchItem[];
}

export interface ReferenceSlugResolution {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly entryId: string;
  readonly canonicalSlug: string;
  readonly redirected: boolean;
}

export interface ReferenceNavigation {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
    readonly parentId?: string;
    readonly order: number;
    readonly entryIds: readonly string[];
  }[];
  readonly supportedStandards: readonly CppStandard[];
}

export type ReferenceReadinessIssueCode =
  "catalog_missing" | "catalog_invalid" | "integration_invalid";

export type ReferenceReadiness =
  | {
      readonly ready: true;
      readonly catalogVersion: number;
      readonly entryCount: number;
      readonly activationDurationMs: number;
    }
  | {
      readonly ready: false;
      readonly issueCodes: readonly ReferenceReadinessIssueCode[];
    };

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

export type ExecutionMode = "run" | "grade";
export interface PublicJudgeTest {
  readonly name: string;
  readonly stdin: string;
  readonly expectedStdout: string;
}

export interface PrivateJudgeTest extends PublicJudgeTest {
  readonly failureCategory: string;
}

export interface GeneratedPropertyTest {
  readonly name: string;
  readonly seed: number;
  readonly cases: number;
  readonly generator: {
    readonly kind: "integer-vector";
    readonly minLength: number;
    readonly maxLength: number;
    readonly minValue: number;
    readonly maxValue: number;
  };
  readonly oracle: "sort-ascending";
  readonly failureCategory: string;
}

export interface RelativePerformanceCheck {
  readonly name: string;
  readonly baselineStdin: string;
  readonly baselineExpectedStdout: string;
  readonly scaledStdin: string;
  readonly scaledExpectedStdout: string;
  readonly repetitions: number;
  readonly maxMedianRatio: number;
  readonly failureCategory: string;
}

export type JudgeBuildProfile =
  | {
      readonly kind: "direct";
      readonly threadSupport?: boolean;
      readonly libraries?: readonly "sqlite3"[];
    }
  | {
      readonly kind: "cmake";
      readonly target: string;
      readonly testTarget: string;
      readonly ctest: boolean;
      readonly runtimeTools?: readonly ("git" | "node" | "web-frontend")[];
    };

export interface JudgeSpec {
  readonly activityId: string;
  readonly activityVersion: number;
  readonly judgeVersion: number;
  readonly expectedStdout: string;
  readonly timeoutMs: number;
  readonly publicTests?: readonly PublicJudgeTest[];
  readonly privateTests?: readonly PrivateJudgeTest[];
  readonly propertyTests?: readonly GeneratedPropertyTest[];
  readonly performanceCheck?: RelativePerformanceCheck;
  readonly buildProfile?: JudgeBuildProfile;
  readonly sanitizers?: readonly ("address" | "undefined")[];
}

export type JudgeVerdict =
  | "compile_error"
  | "runtime_error"
  | "public_failure"
  | "timeout"
  | "output_limit"
  | "private_failure"
  | "property_failure"
  | "performance_failure"
  | "sanitizer_failure"
  | "cancelled"
  | "automated_pass"
  | "judge_system_error";

export interface JudgeReportStage {
  readonly kind:
    | "compile"
    | "configure"
    | "build"
    | "ctest"
    | "test"
    | "public_test"
    | "private_test"
    | "property_test"
    | "performance"
    | "asan"
    | "ubsan";
  readonly outcome: "pass" | "fail" | "system_error";
  readonly durationMs: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly testName?: string;
  readonly feedback?: string;
  readonly seed?: number;
  readonly caseIndex?: number;
  readonly counterexample?: string;
  readonly baselineDurationMs?: number;
  readonly scaledDurationMs?: number;
  readonly ratio?: number;
  readonly diagnostics?: readonly JudgeDiagnostic[];
}

export interface JudgeDiagnostic {
  readonly category: "compiler" | "sanitizer" | "runtime";
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
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
  readonly toolchain: {
    readonly compiler: string;
    readonly standard: "c++20";
    readonly buildSystem?: "cmake/ctest";
    readonly cmake?: string;
    readonly ctest?: string;
    readonly node?: string;
    readonly git?: string;
    readonly webFrontend?: string;
  };
  readonly buildFlags?: readonly string[];
  readonly seeds?: readonly number[];
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
  readonly attemptId?: string;
  readonly independence?: AttemptIndependence;
  readonly hintsUsed?: number;
  readonly fullSolutionExposed?: boolean;
  readonly report: JudgeReport;
}

export interface RecoveryPerformedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "recovery.performed";
  readonly occurredAt: string;
  readonly quarantinedFile: string;
  readonly invalidBytes: number;
}

export interface HintRevealedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "hint.revealed";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly hintId: string;
  readonly order: number;
  readonly fullSolutionExposed: boolean;
}

export interface ReflectionSubmittedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "reflection.submitted";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly answers: readonly {
    readonly promptId: string;
    readonly answer: string;
  }[];
}

export interface EvidenceRecordedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "evidence.recorded";
  readonly occurredAt: string;
  readonly evidenceId: string;
  readonly conceptId: string;
  readonly activityId: string;
  readonly attemptId: string;
  readonly source: "automated_grade" | "review" | "teacher_observation";
  readonly outcome: "pass" | "fail";
  readonly independence: AttemptIndependence;
  readonly supportingEventIds: readonly string[];
}

export interface ConceptStateChangedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "concept.state.changed";
  readonly occurredAt: string;
  readonly conceptId: string;
  readonly previousState: ConceptState;
  readonly nextState: ConceptState;
  readonly evidenceIds: readonly string[];
  readonly explanation: string;
}

export interface ReviewScheduledEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "review.scheduled";
  readonly occurredAt: string;
  readonly reviewId: string;
  readonly conceptId: string;
  readonly sourceActivityId: string;
  readonly dueAt: string;
  readonly intervalDays: number;
  readonly reason: string;
}

export interface ReviewCompletedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "review.completed";
  readonly occurredAt: string;
  readonly reviewId: string;
  readonly conceptId: string;
  readonly attemptId: string;
  readonly evidenceId: string;
}

export interface TeacherObservationEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type:
    "teacher.observation.accepted" | "teacher.observation.rejected";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly observationId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly rubricId: string;
  readonly outcome: "pass" | "revise";
  readonly summary: string;
  readonly reason?: string;
}

export type LearningRecordEvent =
  | AttemptCompletedEvent
  | RecoveryPerformedEvent
  | HintRevealedEvent
  | ReflectionSubmittedEvent
  | EvidenceRecordedEvent
  | ConceptStateChangedEvent
  | ReviewScheduledEvent
  | ReviewCompletedEvent
  | TeacherObservationEvent;

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
