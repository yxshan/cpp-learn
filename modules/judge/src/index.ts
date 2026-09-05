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
  type CppStandard,
  type ReferencePlaygroundRunResult,
  type ReferencePlaygroundVerdict,
  type ToolchainReadiness,
} from "@cpp-learn/contracts";

export const DEFAULT_NATIVE_CPP_COMPILER = "/usr/bin/clang++";

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
  readonly cmake?: string;
  readonly ctest?: string;
  readonly nodeRuntime?: string;
  readonly gitRuntime?: string;
  readonly webFrontendHarness?: string;
  readonly inspectTool?: BoundedProcessRunner;
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
    readonly seed?: number;
    readonly caseIndex?: number;
    readonly counterexample?: string;
    readonly baselineDurationMs?: number;
    readonly scaledDurationMs?: number;
    readonly ratio?: number;
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
    ...(details.seed !== undefined ? { seed: details.seed } : {}),
    ...(details.caseIndex !== undefined
      ? { caseIndex: details.caseIndex }
      : {}),
    ...(details.counterexample !== undefined
      ? { counterexample: details.counterexample }
      : {}),
    ...(details.baselineDurationMs !== undefined
      ? { baselineDurationMs: details.baselineDurationMs }
      : {}),
    ...(details.scaledDurationMs !== undefined
      ? { scaledDurationMs: details.scaledDurationMs }
      : {}),
    ...(details.ratio !== undefined ? { ratio: details.ratio } : {}),
    ...(details.diagnostics && details.diagnostics.length > 0
      ? { diagnostics: details.diagnostics }
      : {}),
  };
}

function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInteger(random: () => number, minimum: number, maximum: number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function generatePropertyCase(
  property: NonNullable<JudgeSpec["propertyTests"]>[number],
  random: () => number,
): { readonly stdin: string; readonly expectedStdout: string } {
  const { generator } = property;
  const length = randomInteger(
    random,
    generator.minLength,
    generator.maxLength,
  );
  const values = Array.from({ length }, () =>
    randomInteger(random, generator.minValue, generator.maxValue),
  );
  return {
    stdin: `${length}\n${values.join(" ")}\n`,
    expectedStdout: `${[...values].sort((left, right) => left - right).join(" ")}\n`,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
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

function failedProcessVerdict(
  result: BoundedProcessResult,
  fallback: JudgeReport["verdict"],
): JudgeReport["verdict"] | undefined {
  return result.cancelled
    ? "cancelled"
    : result.outputLimitExceeded
      ? "output_limit"
      : result.timedOut
        ? "timeout"
        : result.exitCode !== 0
          ? fallback
          : undefined;
}

function failedToolInspectionVerdict(
  result: BoundedProcessResult,
): "cancelled" | "judge_system_error" | undefined {
  if (result.cancelled) return "cancelled";
  return result.outputLimitExceeded || result.timedOut || result.exitCode !== 0
    ? "judge_system_error"
    : undefined;
}

export interface ReferencePlaygroundRunRequest {
  readonly runId: string;
  readonly entryId: string;
  readonly exampleId: string;
  readonly standard: CppStandard;
  readonly source: string;
  readonly stdin: string;
  readonly signal?: AbortSignal;
}

export interface ReferencePlayground {
  run(
    request: ReferencePlaygroundRunRequest,
  ): Promise<ReferencePlaygroundRunResult>;
}

export interface NativeReferencePlaygroundDependencies {
  readonly run?: BoundedProcessRunner;
  readonly compiler?: string;
  readonly compilerFingerprint?: string;
  readonly monotonicClock?: () => number;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly createExecutionRoot?: () => Promise<string>;
  readonly removeExecutionRoot?: (root: string) => Promise<void>;
  readonly writeSource?: (path: string, source: string) => Promise<void>;
}

const compilerStandardFlagCandidates: Readonly<
  Record<CppStandard, readonly string[]>
> = {
  "c++98": ["c++98"],
  "c++03": ["c++03"],
  "c++11": ["c++11"],
  "c++14": ["c++14"],
  "c++17": ["c++17"],
  "c++20": ["c++20"],
  "c++23": ["c++23", "c++2b"],
  "c++26-draft": ["c++26", "c++2c"],
};

export function referenceCompilerStandardFlagCandidates(
  standard: CppStandard,
): readonly string[] {
  return compilerStandardFlagCandidates[standard];
}

export async function resolveReferenceCompilerStandardFlag(options: {
  readonly standard: CppStandard;
  readonly probe: (candidate: string) => Promise<boolean>;
}): Promise<string> {
  for (const candidate of referenceCompilerStandardFlagCandidates(
    options.standard,
  )) {
    if (await options.probe(candidate)) return candidate;
  }
  throw new Error(`compiler does not support ${options.standard}`);
}

function playgroundFailureVerdict(
  result: BoundedProcessResult,
  fallback: "compile_error" | "runtime_error",
): ReferencePlaygroundVerdict | undefined {
  return result.cancelled
    ? "cancelled"
    : result.outputLimitExceeded
      ? "output_limit"
      : result.timedOut
        ? "timeout"
        : result.exitCode !== 0
          ? fallback
          : undefined;
}

function compilerRejectedStandardFlag(
  result: BoundedProcessResult,
  standardFlag: string,
): boolean {
  const diagnostic = result.stderr.toLocaleLowerCase("en-US");
  return (
    diagnostic.includes(`-std=${standardFlag}`.toLocaleLowerCase("en-US")) &&
    /(unknown|unrecognized|unsupported|not supported|invalid value)/.test(
      diagnostic,
    )
  );
}

function combinePlaygroundOutput(first: string, second: string): string {
  if (!first) return second;
  if (!second) return first;
  return `${first}${first.endsWith("\n") ? "" : "\n"}${second}`;
}

export function createNativeReferencePlayground(
  dependencies: NativeReferencePlaygroundDependencies = {},
): ReferencePlayground {
  const run = dependencies.run ?? runBoundedProcess;
  const compiler = dependencies.compiler ?? DEFAULT_NATIVE_CPP_COMPILER;
  const compilerFingerprint = dependencies.compilerFingerprint ?? compiler;
  const monotonicClock = dependencies.monotonicClock ?? (() => Date.now());
  const timeoutMs = dependencies.timeoutMs ?? 5_000;
  const maxOutputBytes = dependencies.maxOutputBytes ?? 64 * 1024;
  const createExecutionRoot =
    dependencies.createExecutionRoot ??
    (() => mkdtemp(join(tmpdir(), "cpp-learn-reference-")));
  const removeExecutionRoot =
    dependencies.removeExecutionRoot ??
    ((root) => rm(root, { recursive: true, force: true }));
  const writeSource =
    dependencies.writeSource ??
    ((path, source) => writeFile(path, source, "utf8"));

  return {
    async run(request) {
      const standardFlagCandidates = referenceCompilerStandardFlagCandidates(
        request.standard,
      );
      let flags = [
        `-std=${standardFlagCandidates[0]}`,
        "-Wall",
        "-Wextra",
        "-Wpedantic",
      ];
      const cancellation = request.signal
        ? { signal: request.signal }
        : ({} as const);
      const stages: ReferencePlaygroundRunResult["stages"][number][] = [];
      let root: string | undefined;
      let result: ReferencePlaygroundRunResult;
      try {
        root = await createExecutionRoot();
        const sourcePath = join(root, "main.cpp");
        const executablePath = join(root, "program");
        const environment = {
          PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
          LANG: "C",
          LC_ALL: "C",
          HOME: root,
          TMPDIR: root,
        };
        await writeSource(sourcePath, request.source);
        const compileStarted = monotonicClock();
        let compiled: BoundedProcessResult | undefined;
        for (const [index, standardFlag] of standardFlagCandidates.entries()) {
          flags = [`-std=${standardFlag}`, "-Wall", "-Wextra", "-Wpedantic"];
          compiled = await run({
            executable: compiler,
            args: [...flags, "main.cpp", "-o", executablePath],
            cwd: root,
            timeoutMs,
            maxOutputBytes,
            environment,
            ...cancellation,
          });
          const compileVerdict = playgroundFailureVerdict(
            compiled,
            "compile_error",
          );
          const hasFallback = index < standardFlagCandidates.length - 1;
          if (
            compileVerdict !== "compile_error" ||
            !hasFallback ||
            !compilerRejectedStandardFlag(compiled, standardFlag)
          ) {
            break;
          }
        }
        if (compiled === undefined) {
          throw new Error(
            `No compiler flag is declared for ${request.standard}`,
          );
        }
        const compileVerdict = playgroundFailureVerdict(
          compiled,
          "compile_error",
        );
        stages.push({
          kind: "compile",
          outcome: compileVerdict ? "fail" : "pass",
          durationMs: Math.max(0, monotonicClock() - compileStarted),
          stdout: compiled.stdout,
          stderr: compiled.stderr,
          ...(compileVerdict === "compile_error"
            ? { diagnostics: compilerDiagnostics(compiled.stderr) }
            : {}),
        });
        if (compileVerdict) {
          result = {
            schemaVersion: SCHEMA_VERSION,
            runId: request.runId,
            entryId: request.entryId,
            exampleId: request.exampleId,
            verdict: compileVerdict,
            stdout: compiled.stdout,
            stderr: compiled.stderr,
            stages,
            toolchain: {
              compiler: compilerFingerprint,
              standard: request.standard,
              flags,
            },
          };
        } else {
          const runStarted = monotonicClock();
          const executed = await run({
            executable: executablePath,
            args: [],
            cwd: root,
            timeoutMs,
            maxOutputBytes,
            environment,
            stdin: request.stdin,
            ...cancellation,
          });
          const runVerdict = playgroundFailureVerdict(
            executed,
            "runtime_error",
          );
          stages.push({
            kind: "run",
            outcome: runVerdict ? "fail" : "pass",
            durationMs: Math.max(0, monotonicClock() - runStarted),
            stdout: executed.stdout,
            stderr: executed.stderr,
          });
          result = {
            schemaVersion: SCHEMA_VERSION,
            runId: request.runId,
            entryId: request.entryId,
            exampleId: request.exampleId,
            verdict: runVerdict ?? "success",
            stdout: executed.stdout,
            stderr: combinePlaygroundOutput(compiled.stderr, executed.stderr),
            stages,
            toolchain: {
              compiler: compilerFingerprint,
              standard: request.standard,
              flags,
            },
          };
        }
      } catch (error) {
        result = {
          schemaVersion: SCHEMA_VERSION,
          runId: request.runId,
          entryId: request.entryId,
          exampleId: request.exampleId,
          verdict: "system_error",
          stdout: "",
          stderr: error instanceof Error ? error.message : "Playground failed",
          stages,
          toolchain: {
            compiler: compilerFingerprint,
            standard: request.standard,
            flags,
          },
        };
      }
      if (root !== undefined) {
        try {
          await removeExecutionRoot(root);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Playground cleanup failed";
          result = {
            ...result,
            verdict: "system_error",
            stderr: combinePlaygroundOutput(
              result.stderr,
              `Temporary-root cleanup failed: ${message}`,
            ),
          };
        }
      }
      return result;
    },
  };
}

export function createNativeJudge(
  dependencies: NativeJudgeDependencies = {},
): Judge {
  const run = dependencies.run ?? runBoundedProcess;
  const clock = dependencies.clock ?? (() => new Date());
  const monotonicClock = dependencies.monotonicClock ?? (() => Date.now());
  const compiler = dependencies.compiler ?? DEFAULT_NATIVE_CPP_COMPILER;
  const compilerFingerprint = dependencies.compilerFingerprint ?? compiler;
  const cmake = dependencies.cmake ?? "cmake";
  const ctest = dependencies.ctest ?? "ctest";
  const nodeRuntime = dependencies.nodeRuntime ?? process.execPath;
  const gitRuntime = dependencies.gitRuntime ?? "/usr/bin/git";
  const webFrontendHarness =
    dependencies.webFrontendHarness ??
    join(process.cwd(), "scripts", "verify-react-project.mjs");
  const inspectTool = dependencies.inspectTool ?? run;
  const maxOutputBytes = dependencies.maxOutputBytes ?? 64 * 1024;

  return {
    async execute(request) {
      const startedAt = clock().toISOString();
      const stages: JudgeReportStage[] = [];
      let verdict: JudgeReport["verdict"] = "judge_system_error";
      let activeStageKind: JudgeReportStage["kind"] = "compile";
      let executionRoot: string | undefined;
      let cmakeFingerprint: string | undefined;
      let ctestFingerprint: string | undefined;
      let nodeFingerprint: string | undefined;
      let gitFingerprint: string | undefined;
      let webFrontendFingerprint: string | undefined;
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
        let executablePath = join(executionRoot, "program");
        const environment = {
          PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
          LANG: "C",
          LC_ALL: "C",
          HOME: executionRoot,
          TMPDIR: executionRoot,
        };
        const cancellation = request.signal
          ? { signal: request.signal }
          : ({} as const);
        let buildToolsReady = true;
        if (request.spec.buildProfile?.kind === "cmake") {
          activeStageKind = "configure";
          const inspectionStarted = monotonicClock();
          const inspectionRequest = {
            cwd: executionRoot,
            timeoutMs: Math.min(request.spec.timeoutMs, 2_000),
            maxOutputBytes: Math.min(maxOutputBytes, 16 * 1024),
            environment,
            ...cancellation,
          };
          const runtimeTools =
            request.spec.buildProfile.runtimeTools ?? ([] as const);
          const needsNode =
            runtimeTools.includes("node") ||
            runtimeTools.includes("web-frontend");
          const cmakeInspection = inspectTool({
            ...inspectionRequest,
            executable: cmake,
            args: ["--version"],
          });
          const ctestInspection = inspectTool({
            ...inspectionRequest,
            executable: ctest,
            args: ["--version"],
          });
          const runtimeInspections = [
            ...(needsNode
              ? [
                  inspectTool({
                    ...inspectionRequest,
                    executable: nodeRuntime,
                    args: ["--version"],
                  }).then((result) => ({ kind: "node" as const, result })),
                ]
              : []),
            ...(runtimeTools.includes("git")
              ? [
                  inspectTool({
                    ...inspectionRequest,
                    executable: gitRuntime,
                    args: ["--version"],
                  }).then((result) => ({ kind: "git" as const, result })),
                ]
              : []),
            ...(runtimeTools.includes("web-frontend")
              ? [
                  inspectTool({
                    ...inspectionRequest,
                    executable: nodeRuntime,
                    args: [webFrontendHarness, "--fingerprint"],
                  }).then((result) => ({
                    kind: "web-frontend" as const,
                    result,
                  })),
                ]
              : []),
          ];
          const [cmakeVersion, ctestVersion, inspectedRuntimeTools] =
            await Promise.all([
              cmakeInspection,
              ctestInspection,
              Promise.all(runtimeInspections),
            ]);
          cmakeFingerprint = cmakeVersion.stdout.split(/\r?\n/, 1)[0]?.trim();
          ctestFingerprint = ctestVersion.stdout.split(/\r?\n/, 1)[0]?.trim();
          for (const inspection of inspectedRuntimeTools) {
            const fingerprint = inspection.result.stdout
              .split(/\r?\n/, 1)[0]
              ?.trim();
            if (inspection.kind === "node") nodeFingerprint = fingerprint;
            if (inspection.kind === "git") gitFingerprint = fingerprint;
            if (inspection.kind === "web-frontend")
              webFrontendFingerprint = fingerprint;
          }
          const runtimeInspectionFailure = inspectedRuntimeTools
            .map(({ result }) => failedToolInspectionVerdict(result))
            .find((failure) => failure !== undefined);
          const missingRuntimeFingerprint = inspectedRuntimeTools.some(
            ({ result }) => !result.stdout.split(/\r?\n/, 1)[0]?.trim(),
          );
          const inspectionFailure =
            failedToolInspectionVerdict(cmakeVersion) ??
            failedToolInspectionVerdict(ctestVersion) ??
            runtimeInspectionFailure ??
            (!cmakeFingerprint || !ctestFingerprint
              ? "judge_system_error"
              : missingRuntimeFingerprint
                ? "judge_system_error"
                : undefined);
          if (inspectionFailure) {
            verdict = inspectionFailure;
            buildToolsReady = false;
            stages.push(
              reportStage(
                "configure",
                inspectionFailure === "judge_system_error"
                  ? "system_error"
                  : "fail",
                monotonicClock() - inspectionStarted,
                undefined,
                { feedback: "Declared toolchain inspection failed." },
              ),
            );
          }
        }
        let buildPassed = false;
        if (!buildToolsReady) {
          // The bounded inspection stage already recorded the blocking verdict.
        } else if (request.spec.buildProfile?.kind === "cmake") {
          activeStageKind = "configure";
          const configureStarted = monotonicClock();
          const configure = await run({
            executable: cmake,
            args: [
              "-S",
              ".",
              "-B",
              "build",
              "-DCMAKE_BUILD_TYPE=Release",
              ...(request.spec.buildProfile.runtimeTools?.includes("node")
                ? [`-DCPP_LEARN_NODE=${nodeRuntime}`]
                : []),
              ...(request.spec.buildProfile.runtimeTools?.includes("git")
                ? [`-DCPP_LEARN_GIT=${gitRuntime}`]
                : []),
              ...(request.spec.buildProfile.runtimeTools?.includes(
                "web-frontend",
              )
                ? [`-DCPP_LEARN_WEB_FRONTEND=${webFrontendHarness}`]
                : []),
            ],
            cwd: executionRoot,
            timeoutMs: request.spec.timeoutMs,
            maxOutputBytes,
            environment,
            ...cancellation,
          });
          const configureFailure = failedProcessVerdict(
            configure,
            "compile_error",
          );
          stages.push(
            reportStage(
              "configure",
              configureFailure ? "fail" : "pass",
              monotonicClock() - configureStarted,
              configure,
            ),
          );
          if (configureFailure) {
            verdict = configureFailure;
          } else {
            activeStageKind = "build";
            const buildStarted = monotonicClock();
            const build = await run({
              executable: cmake,
              args: [
                "--build",
                "build",
                "--target",
                request.spec.buildProfile.target,
                request.spec.buildProfile.testTarget,
              ],
              cwd: executionRoot,
              timeoutMs: request.spec.timeoutMs,
              maxOutputBytes,
              environment,
              ...cancellation,
            });
            const buildFailure = failedProcessVerdict(build, "compile_error");
            stages.push(
              reportStage(
                "build",
                buildFailure ? "fail" : "pass",
                monotonicClock() - buildStarted,
                build,
              ),
            );
            if (buildFailure) {
              verdict = buildFailure;
            } else if (
              request.mode === "grade" &&
              request.spec.buildProfile.ctest
            ) {
              activeStageKind = "ctest";
              const ctestStarted = monotonicClock();
              const tested = await run({
                executable: ctest,
                args: ["--test-dir", "build", "--output-on-failure"],
                cwd: executionRoot,
                timeoutMs: request.spec.timeoutMs,
                maxOutputBytes,
                environment,
                ...cancellation,
              });
              const ctestFailure = failedProcessVerdict(
                tested,
                "public_failure",
              );
              stages.push(
                reportStage(
                  "ctest",
                  ctestFailure ? "fail" : "pass",
                  monotonicClock() - ctestStarted,
                  tested,
                ),
              );
              if (ctestFailure) verdict = ctestFailure;
              else buildPassed = true;
            } else {
              buildPassed = true;
            }
            executablePath = join(
              executionRoot,
              "build",
              request.spec.buildProfile.target,
            );
          }
        } else {
          activeStageKind = "compile";
          const direct =
            request.spec.buildProfile?.kind === "direct"
              ? request.spec.buildProfile
              : undefined;
          const compileStarted = monotonicClock();
          const compile = await run({
            executable: compiler,
            args: [
              "-std=c++20",
              "-Wall",
              "-Wextra",
              "-Wpedantic",
              ...(direct?.threadSupport ? ["-pthread"] : []),
              ...sources,
              ...(direct?.libraries ?? []).map((library) => `-l${library}`),
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
          const compileFailure = failedProcessVerdict(compile, "compile_error");
          stages.push(
            reportStage(
              "compile",
              compileFailure ? "fail" : "pass",
              compileDuration,
              compile,
              compile.exitCode === 0
                ? {}
                : { diagnostics: compilerDiagnostics(compile.stderr) },
            ),
          );
          if (compileFailure) verdict = compileFailure;
          else buildPassed = true;
        }
        if (buildPassed) {
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
            request.spec.propertyTests
          ) {
            for (const property of request.spec.propertyTests) {
              activeStageKind = "property_test";
              const propertyStarted = monotonicClock();
              const random = deterministicRandom(property.seed);
              let propertyPassed = true;
              for (
                let caseIndex = 0;
                caseIndex < property.cases;
                caseIndex += 1
              ) {
                const generated = generatePropertyCase(property, random);
                const test = await run({
                  executable: executablePath,
                  args: [],
                  cwd: executionRoot,
                  timeoutMs: request.spec.timeoutMs,
                  maxOutputBytes,
                  environment,
                  stdin: generated.stdin,
                  ...cancellation,
                });
                const passed =
                  !test.cancelled &&
                  !test.outputLimitExceeded &&
                  !test.timedOut &&
                  test.exitCode === 0 &&
                  test.stdout === generated.expectedStdout;
                if (!passed) {
                  propertyPassed = false;
                  stages.push(
                    reportStage(
                      "property_test",
                      "fail",
                      monotonicClock() - propertyStarted,
                      undefined,
                      {
                        testName: property.name,
                        feedback: property.failureCategory,
                        seed: property.seed,
                        caseIndex,
                        counterexample: generated.stdin,
                      },
                    ),
                  );
                  verdict = test.cancelled
                    ? "cancelled"
                    : test.timedOut
                      ? "timeout"
                      : test.outputLimitExceeded
                        ? "output_limit"
                        : test.exitCode !== 0
                          ? "runtime_error"
                          : "property_failure";
                  break;
                }
              }
              if (propertyPassed) {
                stages.push(
                  reportStage(
                    "property_test",
                    "pass",
                    monotonicClock() - propertyStarted,
                    undefined,
                    { testName: property.name, seed: property.seed },
                  ),
                );
              }
              if (verdict !== "automated_pass") break;
            }
          }

          if (
            verdict === "automated_pass" &&
            request.mode === "grade" &&
            request.spec.performanceCheck
          ) {
            activeStageKind = "performance";
            const performance = request.spec.performanceCheck;
            const baselineDurations: number[] = [];
            const scaledDurations: number[] = [];
            let processFailure:
              | "cancelled"
              | "timeout"
              | "output_limit"
              | "runtime_error"
              | undefined;
            let outputMismatch = false;
            for (
              let repetition = 0;
              repetition < performance.repetitions;
              repetition += 1
            ) {
              for (const [input, expectedStdout, durations] of [
                [
                  performance.baselineStdin,
                  performance.baselineExpectedStdout,
                  baselineDurations,
                ],
                [
                  performance.scaledStdin,
                  performance.scaledExpectedStdout,
                  scaledDurations,
                ],
              ] as const) {
                const runStarted = monotonicClock();
                const result = await run({
                  executable: executablePath,
                  args: [],
                  cwd: executionRoot,
                  timeoutMs: request.spec.timeoutMs,
                  maxOutputBytes,
                  environment,
                  stdin: input,
                  ...cancellation,
                });
                durations.push(Math.max(0, monotonicClock() - runStarted));
                processFailure = result.cancelled
                  ? "cancelled"
                  : result.timedOut
                    ? "timeout"
                    : result.outputLimitExceeded
                      ? "output_limit"
                      : result.exitCode !== 0
                        ? "runtime_error"
                        : undefined;
                outputMismatch = result.stdout !== expectedStdout;
                if (processFailure || outputMismatch) break;
              }
              if (processFailure || outputMismatch) break;
            }
            const baselineDurationMs = median(baselineDurations);
            const scaledDurationMs = median(scaledDurations);
            const ratio = scaledDurationMs / Math.max(1, baselineDurationMs);
            const passed =
              processFailure === undefined &&
              !outputMismatch &&
              ratio <= performance.maxMedianRatio;
            stages.push(
              reportStage(
                "performance",
                passed ? "pass" : "fail",
                baselineDurations.reduce((total, value) => total + value, 0) +
                  scaledDurations.reduce((total, value) => total + value, 0),
                undefined,
                {
                  testName: performance.name,
                  ...(passed ? {} : { feedback: performance.failureCategory }),
                  baselineDurationMs,
                  scaledDurationMs,
                  ratio,
                },
              ),
            );
            if (!passed) {
              verdict = processFailure ?? "performance_failure";
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
        toolchain: {
          compiler: compilerFingerprint,
          standard: "c++20",
          ...(request.spec.buildProfile?.kind === "cmake"
            ? {
                buildSystem: "cmake/ctest" as const,
                ...(cmakeFingerprint && ctestFingerprint
                  ? { cmake: cmakeFingerprint, ctest: ctestFingerprint }
                  : {}),
                ...(nodeFingerprint ? { node: nodeFingerprint } : {}),
                ...(gitFingerprint ? { git: gitFingerprint } : {}),
                ...(webFrontendFingerprint
                  ? { webFrontend: webFrontendFingerprint }
                  : {}),
              }
            : {}),
        },
        buildFlags:
          request.spec.buildProfile?.kind === "cmake"
            ? ["CMAKE_BUILD_TYPE=Release"]
            : [
                "-std=c++20",
                "-Wall",
                "-Wextra",
                "-Wpedantic",
                ...(request.spec.buildProfile?.kind === "direct" &&
                request.spec.buildProfile.threadSupport
                  ? ["-pthread"]
                  : []),
                ...(request.spec.buildProfile?.kind === "direct"
                  ? (request.spec.buildProfile.libraries ?? []).map(
                      (library) => `-l${library}`,
                    )
                  : []),
              ],
        ...(request.spec.propertyTests
          ? { seeds: request.spec.propertyTests.map((test) => test.seed) }
          : {}),
        verdict,
        stages,
        startedAt,
        completedAt: clock().toISOString(),
      };
    },
  };
}
