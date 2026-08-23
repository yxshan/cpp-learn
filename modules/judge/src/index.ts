import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import {
  SCHEMA_VERSION,
  type ActivityDetail,
  type ExecutionMode,
  type JudgeReport,
  type JudgeReportStage,
  type JudgeSpec,
  type ToolchainReadiness,
} from "@cpp-learn/contracts";

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessExecutor = (
  executable: string,
  args: readonly string[],
) => Promise<ProcessResult>;

export interface BoundedProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly environment: Readonly<Record<string, string>>;
}

export interface BoundedProcessResult extends ProcessResult {
  readonly timedOut: boolean;
  readonly outputLimitExceeded: boolean;
}

export type BoundedProcessRunner = (
  request: BoundedProcessRequest,
) => Promise<BoundedProcessResult>;

export interface NativeToolchainProbeDependencies {
  readonly execute: ProcessExecutor;
}

export type JudgeStageKind = "prepare" | "compile" | "test" | "analyze";

export interface JudgeStageContext {
  readonly jobId: string;
  readonly snapshotId: string;
}

export interface JudgeStageResult {
  readonly kind: JudgeStageKind;
  readonly outcome: "pass" | "fail" | "system_error";
  readonly durationMs: number;
}

export interface JudgeStage {
  readonly kind: JudgeStageKind;
  execute(context: JudgeStageContext): Promise<JudgeStageResult>;
}

export interface ToolchainCheckStageDependencies {
  readonly clock: () => number;
  readonly probe: () => Promise<ToolchainReadiness>;
}

export function createToolchainCheckStage(
  dependencies: ToolchainCheckStageDependencies,
): JudgeStage {
  return {
    kind: "prepare",
    async execute() {
      const startedAt = dependencies.clock();
      const readiness = await dependencies.probe();
      const durationMs = Math.max(0, dependencies.clock() - startedAt);
      return {
        kind: "prepare",
        outcome: readiness.ready ? "pass" : "system_error",
        durationMs,
      };
    },
  };
}

export const executeProcess: ProcessExecutor = async (executable, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });

export const runBoundedProcess: BoundedProcessRunner = async (request) =>
  new Promise((resolve, reject) => {
    const child = spawn(request.executable, [...request.args], {
      cwd: request.cwd,
      detached: true,
      env: request.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    const killProcessGroup = (): void => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
          return;
        } catch {
          // Fall back to the direct child on platforms without process groups.
        }
      }
      child.kill("SIGKILL");
    };
    const stopForOutputLimit = (chunk: Buffer, target: Buffer[]): void => {
      if (outputLimitExceeded) return;
      const remaining = Math.max(0, request.maxOutputBytes - outputBytes);
      if (remaining > 0) target.push(chunk.subarray(0, remaining));
      outputBytes += chunk.length;
      if (outputBytes > request.maxOutputBytes) {
        outputLimitExceeded = true;
        killProcessGroup();
      }
    };
    child.stdout.on("data", (chunk: Buffer) =>
      stopForOutputLimit(chunk, stdout),
    );
    child.stderr.on("data", (chunk: Buffer) =>
      stopForOutputLimit(chunk, stderr),
    );
    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessGroup();
    }, request.timeoutMs);
    timeout.unref();
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        outputLimitExceeded,
      });
    });
  });

export function createNativeToolchainProbe(
  dependencies: NativeToolchainProbeDependencies,
): () => Promise<ToolchainReadiness> {
  return async () => {
    try {
      const result = await dependencies.execute("clang++", ["--version"]);
      const compiler = result.stdout.split(/\r?\n/, 1)[0]?.trim();
      if (result.exitCode !== 0 || !compiler) {
        return {
          ready: false,
          issues: ["clang++ did not return a usable version"],
        };
      }
      return { ready: true, compiler };
    } catch {
      return { ready: false, issues: ["clang++ is unavailable"] };
    }
  };
}

export interface JudgeExecutionRequest {
  readonly jobId: string;
  readonly mode: ExecutionMode;
  readonly activity: ActivityDetail;
  readonly spec: JudgeSpec;
  readonly snapshot: {
    readonly id: string;
    readonly activityId: string;
    readonly digest: string;
    readonly files: Readonly<Record<string, string>>;
  };
}

export interface Judge {
  execute(request: JudgeExecutionRequest): Promise<JudgeReport>;
}

export interface NativeJudgeDependencies {
  readonly run?: BoundedProcessRunner;
  readonly clock?: () => Date;
  readonly monotonicClock?: () => number;
  readonly compiler?: string;
  readonly maxOutputBytes?: number;
}

function isSafeSnapshotPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !isAbsolute(path) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function reportStage(
  kind: "compile" | "test",
  outcome: "pass" | "fail" | "system_error",
  durationMs: number,
  result?: ProcessResult,
): JudgeReportStage {
  return {
    kind,
    outcome,
    durationMs: Math.max(0, durationMs),
    ...(result?.stdout ? { stdout: result.stdout } : {}),
    ...(result?.stderr ? { stderr: result.stderr } : {}),
  };
}

export function createNativeJudge(
  dependencies: NativeJudgeDependencies = {},
): Judge {
  const run = dependencies.run ?? runBoundedProcess;
  const clock = dependencies.clock ?? (() => new Date());
  const monotonicClock = dependencies.monotonicClock ?? (() => Date.now());
  const compiler = dependencies.compiler ?? "/usr/bin/clang++";
  const maxOutputBytes = dependencies.maxOutputBytes ?? 64 * 1024;

  return {
    async execute(request) {
      const startedAt = clock().toISOString();
      const stages: JudgeReportStage[] = [];
      let verdict: JudgeReport["verdict"] = "judge_system_error";
      let executionRoot: string | undefined;
      try {
        if (
          request.activity.id !== request.spec.activityId ||
          request.activity.version !== request.spec.activityVersion ||
          request.snapshot.activityId !== request.activity.id
        ) {
          throw new Error("Judge request versions do not match");
        }
        executionRoot = await mkdtemp(join(tmpdir(), "cpp-learn-judge-"));
        for (const [path, content] of Object.entries(request.snapshot.files)) {
          if (!isSafeSnapshotPath(path)) {
            throw new Error(`Unsafe snapshot path: ${path}`);
          }
          const destination = join(executionRoot, path);
          await mkdir(dirname(destination), { recursive: true });
          await writeFile(destination, content, "utf8");
        }
        const sources = Object.keys(request.snapshot.files)
          .filter((path) => path.endsWith(".cpp"))
          .sort();
        if (sources.length === 0)
          throw new Error("Snapshot has no C++ source files");
        const executablePath = join(executionRoot, "program");
        const environment = {
          PATH: "/usr/bin:/bin",
          LANG: "C",
          LC_ALL: "C",
          TMPDIR: executionRoot,
        };
        const compileStarted = monotonicClock();
        const compile = await run({
          executable: compiler,
          args: [
            "-std=c++20",
            "-Wall",
            "-Wextra",
            "-Wpedantic",
            ...sources,
            "-o",
            executablePath,
          ],
          cwd: executionRoot,
          timeoutMs: request.spec.timeoutMs,
          maxOutputBytes,
          environment,
        });
        const compileDuration = monotonicClock() - compileStarted;
        if (compile.outputLimitExceeded) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "output_limit";
        } else if (compile.timedOut) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "timeout";
        } else if (compile.exitCode !== 0) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "compile_error";
        } else {
          stages.push(reportStage("compile", "pass", compileDuration, compile));
          const testStarted = monotonicClock();
          const test = await run({
            executable: executablePath,
            args: [],
            cwd: executionRoot,
            timeoutMs: request.spec.timeoutMs,
            maxOutputBytes,
            environment,
          });
          const testDuration = monotonicClock() - testStarted;
          if (test.outputLimitExceeded) {
            stages.push(reportStage("test", "fail", testDuration, test));
            verdict = "output_limit";
          } else if (test.timedOut) {
            stages.push(reportStage("test", "fail", testDuration, test));
            verdict = "timeout";
          } else if (test.exitCode !== 0) {
            stages.push(reportStage("test", "fail", testDuration, test));
            verdict = "runtime_error";
          } else if (test.stdout !== request.spec.expectedStdout) {
            stages.push(reportStage("test", "fail", testDuration, test));
            verdict = "public_failure";
          } else {
            stages.push(reportStage("test", "pass", testDuration, test));
            verdict = "automated_pass";
          }
        }
      } catch (error) {
        stages.push(
          reportStage("compile", "system_error", 0, {
            exitCode: null,
            stdout: "",
            stderr: error instanceof Error ? error.message : "Judge failed",
          }),
        );
      } finally {
        if (executionRoot) {
          await rm(executionRoot, { recursive: true, force: true });
        }
      }

      return {
        schemaVersion: SCHEMA_VERSION,
        reportId: `report_${request.jobId}`,
        jobId: request.jobId,
        mode: request.mode,
        activity: {
          id: request.activity.id,
          version: request.activity.version,
          judgeVersion: request.spec.judgeVersion,
        },
        source: {
          snapshotId: request.snapshot.id,
          digest: request.snapshot.digest,
        },
        toolchain: { compiler, standard: "c++20" },
        verdict,
        stages,
        startedAt,
        completedAt: clock().toISOString(),
      };
    },
  };
}
