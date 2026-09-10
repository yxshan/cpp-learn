import type { SCHEMA_VERSION } from "./index.ts";

/**
 * Judge transport contracts
 *
 * Verdicts, stage reports, and the structured Judge Report that learning events and commands both carry.
 */

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
