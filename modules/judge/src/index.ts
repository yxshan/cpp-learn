import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import {
  SCHEMA_VERSION,
  type ActivityDetail,
  type ExecutionMode,
  type JudgeDiagnostic,
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
  readonly stdin?: string;
  readonly signal?: AbortSignal;
}

export interface BoundedProcessResult extends ProcessResult {
  readonly timedOut: boolean;
  readonly outputLimitExceeded: boolean;
  readonly cancelled?: boolean;
}

export type BoundedProcessRunner = (
  request: BoundedProcessRequest,
) => Promise<BoundedProcessResult>;

export interface NativeToolchainProbeDependencies {
  readonly execute: ProcessExecutor;
  readonly compiler?: string;
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
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let cancelled = false;
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
    const cancel = (): void => {
      cancelled = true;
      killProcessGroup();
    };
    request.signal?.addEventListener("abort", cancel, { once: true });
    if (request.signal?.aborted) cancel();
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
    child.stdin.on("error", () => undefined);
    child.stdin.end(request.stdin ?? "");
    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessGroup();
    }, request.timeoutMs);
    timeout.unref();
    child.once("error", (error) => {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        outputLimitExceeded,
        cancelled,
      });
    });
  });

export function createNativeToolchainProbe(
  dependencies: NativeToolchainProbeDependencies,
): () => Promise<ToolchainReadiness> {
  return async () => {
    try {
      const result = await dependencies.execute(
        dependencies.compiler ?? "clang++",
        ["--version"],
      );
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
  readonly signal?: AbortSignal;
}

export interface Judge {
  execute(request: JudgeExecutionRequest): Promise<JudgeReport>;
}

export interface NativeJudgeDependencies {
  readonly run?: BoundedProcessRunner;
  readonly clock?: () => Date;
  readonly monotonicClock?: () => number;
  readonly compiler?: string;
  readonly compilerFingerprint?: string;
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
  kind: JudgeReportStage["kind"],
  outcome: "pass" | "fail" | "system_error",
  durationMs: number,
  result?: ProcessResult,
  details: {
    readonly testName?: string;
    readonly feedback?: string;
    readonly diagnostics?: readonly JudgeDiagnostic[];
  } = {},
): JudgeReportStage {
  return {
    kind,
    outcome,
    durationMs: Math.max(0, durationMs),
    ...(result?.stdout ? { stdout: result.stdout } : {}),
    ...(result?.stderr ? { stderr: result.stderr } : {}),
    ...(details.testName ? { testName: details.testName } : {}),
    ...(details.feedback ? { feedback: details.feedback } : {}),
    ...(details.diagnostics && details.diagnostics.length > 0
      ? { diagnostics: details.diagnostics }
      : {}),
  };
}

function compilerDiagnostics(stderr: string): readonly JudgeDiagnostic[] {
  return stderr.split(/\r?\n/).flatMap((line) => {
    const match =
      /^(.+):(\d+):(\d+):\s+(?:fatal\s+)?(?:error|warning):\s+(.+)$/.exec(line);
    if (!match) return [];
    return [
      {
        category: "compiler" as const,
        file: match[1] ?? "",
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[4] ?? line,
      },
    ];
  });
}

function sanitizerDiagnostics(stderr: string): readonly JudgeDiagnostic[] {
  const message = stderr
    .split(/\r?\n/)
    .find(
      (line) => line.includes("Sanitizer") || line.includes("runtime error:"),
    );
  return message ? [{ category: "sanitizer", message }] : [];
}

export function createNativeJudge(
  dependencies: NativeJudgeDependencies = {},
): Judge {
  const run = dependencies.run ?? runBoundedProcess;
  const clock = dependencies.clock ?? (() => new Date());
  const monotonicClock = dependencies.monotonicClock ?? (() => Date.now());
  const compiler = dependencies.compiler ?? "/usr/bin/clang++";
  const compilerFingerprint = dependencies.compilerFingerprint ?? compiler;
  const maxOutputBytes = dependencies.maxOutputBytes ?? 64 * 1024;

  return {
    async execute(request) {
      const startedAt = clock().toISOString();
      const stages: JudgeReportStage[] = [];
      let verdict: JudgeReport["verdict"];
      let activeStageKind: JudgeReportStage["kind"] = "compile";
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
        const cancellation = request.signal
          ? { signal: request.signal }
          : ({} as const);
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
          ...cancellation,
        });
        const compileDuration = monotonicClock() - compileStarted;
        if (compile.cancelled) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "cancelled";
        } else if (compile.outputLimitExceeded) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "output_limit";
        } else if (compile.timedOut) {
          stages.push(reportStage("compile", "fail", compileDuration, compile));
          verdict = "timeout";
        } else if (compile.exitCode !== 0) {
          stages.push(
            reportStage("compile", "fail", compileDuration, compile, {
              diagnostics: compilerDiagnostics(compile.stderr),
            }),
          );
          verdict = "compile_error";
        } else {
          stages.push(reportStage("compile", "pass", compileDuration, compile));
          const publicTests = request.spec.publicTests ?? [
            {
              name: "expected output",
              stdin: "",
              expectedStdout: request.spec.expectedStdout,
            },
          ];
          verdict = "automated_pass";
          for (const publicTest of publicTests) {
            const kind = request.spec.publicTests ? "public_test" : "test";
            activeStageKind = kind;
            const testStarted = monotonicClock();
            const test = await run({
              executable: executablePath,
              args: [],
              cwd: executionRoot,
              timeoutMs: request.spec.timeoutMs,
              maxOutputBytes,
              environment,
              stdin: publicTest.stdin,
              ...cancellation,
            });
            const testDuration = monotonicClock() - testStarted;
            const details = request.spec.publicTests
              ? { testName: publicTest.name }
              : {};
            if (test.cancelled) {
              stages.push(
                reportStage(kind, "fail", testDuration, test, details),
              );
              verdict = "cancelled";
            } else if (test.outputLimitExceeded) {
              stages.push(
                reportStage(kind, "fail", testDuration, test, details),
              );
              verdict = "output_limit";
            } else if (test.timedOut) {
              stages.push(
                reportStage(kind, "fail", testDuration, test, details),
              );
              verdict = "timeout";
            } else if (test.exitCode !== 0) {
              stages.push(
                reportStage(kind, "fail", testDuration, test, details),
              );
              verdict = "runtime_error";
            } else if (test.stdout !== publicTest.expectedStdout) {
              stages.push(
                reportStage(kind, "fail", testDuration, test, details),
              );
              verdict = "public_failure";
            } else {
              stages.push(
                reportStage(kind, "pass", testDuration, test, details),
              );
            }
            if (verdict !== "automated_pass") break;
          }

          if (
            verdict === "automated_pass" &&
            request.mode === "grade" &&
            request.spec.privateTests
          ) {
            for (const privateTest of request.spec.privateTests) {
              activeStageKind = "private_test";
              const testStarted = monotonicClock();
              const test = await run({
                executable: executablePath,
                args: [],
                cwd: executionRoot,
                timeoutMs: request.spec.timeoutMs,
                maxOutputBytes,
                environment,
                stdin: privateTest.stdin,
                ...cancellation,
              });
              const testDuration = monotonicClock() - testStarted;
              const passed =
                !test.cancelled &&
                !test.outputLimitExceeded &&
                !test.timedOut &&
                test.exitCode === 0 &&
                test.stdout === privateTest.expectedStdout;
              stages.push(
                reportStage(
                  "private_test",
                  passed ? "pass" : "fail",
                  testDuration,
                  undefined,
                  {
                    testName: privateTest.name,
                    ...(passed
                      ? {}
                      : { feedback: privateTest.failureCategory }),
                  },
                ),
              );
              if (!passed) {
                verdict = test.cancelled
                  ? "cancelled"
                  : test.timedOut
                    ? "timeout"
                    : test.outputLimitExceeded
                      ? "output_limit"
                      : "private_failure";
                break;
              }
            }
          }

          if (
            verdict === "automated_pass" &&
            request.mode === "grade" &&
            request.spec.sanitizers
          ) {
            for (const sanitizer of request.spec.sanitizers) {
              const kind = sanitizer === "address" ? "asan" : "ubsan";
              activeStageKind = kind;
              const sanitizerStarted = monotonicClock();
              const sanitizerExecutable = join(
                executionRoot,
                `program-${sanitizer}`,
              );
              const sanitizerCompile = await run({
                executable: compiler,
                args: [
                  "-std=c++20",
                  "-Wall",
                  "-Wextra",
                  "-Wpedantic",
                  `-fsanitize=${sanitizer}`,
                  "-fno-omit-frame-pointer",
                  ...sources,
                  "-o",
                  sanitizerExecutable,
                ],
                cwd: executionRoot,
                timeoutMs: request.spec.timeoutMs,
                maxOutputBytes,
                environment,
                ...cancellation,
              });
              if (sanitizerCompile.cancelled) {
                stages.push(
                  reportStage(
                    kind,
                    "fail",
                    monotonicClock() - sanitizerStarted,
                    sanitizerCompile,
                  ),
                );
                verdict = "cancelled";
                break;
              }
              if (
                sanitizerCompile.exitCode !== 0 ||
                sanitizerCompile.timedOut ||
                sanitizerCompile.outputLimitExceeded
              ) {
                stages.push(
                  reportStage(
                    kind,
                    "system_error",
                    monotonicClock() - sanitizerStarted,
                    sanitizerCompile,
                    {
                      diagnostics: compilerDiagnostics(sanitizerCompile.stderr),
                    },
                  ),
                );
                verdict = "judge_system_error";
                break;
              }
              const sanitizerTest = await run({
                executable: sanitizerExecutable,
                args: [],
                cwd: executionRoot,
                timeoutMs: request.spec.timeoutMs,
                maxOutputBytes,
                environment,
                stdin: publicTests[0]?.stdin ?? "",
                ...cancellation,
              });
              const diagnostics = sanitizerDiagnostics(sanitizerTest.stderr);
              const passed =
                !sanitizerTest.cancelled &&
                !sanitizerTest.timedOut &&
                !sanitizerTest.outputLimitExceeded &&
                sanitizerTest.exitCode === 0 &&
                diagnostics.length === 0;
              stages.push(
                reportStage(
                  kind,
                  passed ? "pass" : "fail",
                  monotonicClock() - sanitizerStarted,
                  sanitizerTest,
                  { diagnostics },
                ),
              );
              if (!passed) {
                verdict = sanitizerTest.cancelled
                  ? "cancelled"
                  : sanitizerTest.timedOut
                    ? "timeout"
                    : sanitizerTest.outputLimitExceeded
                      ? "output_limit"
                      : "sanitizer_failure";
                break;
              }
            }
          }
        }
      } catch {
        verdict = "judge_system_error";
        stages.push(
          reportStage(activeStageKind, "system_error", 0, {
            exitCode: null,
            stdout: "",
            stderr: "Judge worker failed",
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
        toolchain: { compiler: compilerFingerprint, standard: "c++20" },
        buildFlags: ["-std=c++20", "-Wall", "-Wextra", "-Wpedantic"],
        verdict,
        stages,
        startedAt,
        completedAt: clock().toISOString(),
      };
    },
  };
}
