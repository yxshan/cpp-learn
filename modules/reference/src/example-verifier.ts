import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CppStandard } from "@cpp-learn/contracts";
import {
  resolveReferenceCompilerStandardFlag,
  runBoundedProcess,
  type BoundedProcessResult,
  type BoundedProcessRunner,
} from "@cpp-learn/judge";

import type { ReferenceExampleManifest } from "./index.js";

export interface ReferenceCompilationCheck {
  readonly identity: string;
  readonly kind: "compile" | "run" | "expected-compile-failure";
  readonly expectedDiagnosticCategory?: string;
  readonly compilation: BoundedProcessResult;
}

export function assertReferenceCompilationAccepted(
  check: ReferenceCompilationCheck,
): void {
  const { compilation, identity } = check;
  if (compilation.timedOut || compilation.outputLimitExceeded) {
    throw new Error(`${identity} compilation exceeded its execution bounds`);
  }
  if (check.kind === "expected-compile-failure") {
    if (compilation.exitCode === null) {
      throw new Error(`${identity} compiler terminated abnormally`);
    }
    if (compilation.exitCode === 0) {
      throw new Error(`${identity} unexpectedly compiled`);
    }
    if (
      check.expectedDiagnosticCategory !== undefined &&
      !compilation.stderr
        .toLocaleLowerCase("en-US")
        .includes(check.expectedDiagnosticCategory.toLocaleLowerCase("en-US"))
    ) {
      throw new Error(
        `${identity} missed diagnostic category ${check.expectedDiagnosticCategory}`,
      );
    }
    return;
  }
  if (compilation.exitCode !== 0) {
    throw new Error(`${identity} failed to compile:\n${compilation.stderr}`);
  }
}

export class ReferenceExampleVerificationError extends Error {
  readonly phase: "compiler" | "runtime";

  constructor(
    phase: "compiler" | "runtime",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ReferenceExampleVerificationError";
    this.phase = phase;
  }
}

export interface ReferenceExampleVerificationRequest {
  readonly identity: string;
  readonly example: ReferenceExampleManifest;
  readonly source: string;
}

export interface ReferenceExampleVerifierOptions {
  readonly compiler: string;
  readonly run?: BoundedProcessRunner;
  readonly standardFlag?: (standard: CppStandard) => Promise<string>;
}

const environment = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" };

export function createReferenceCompilerStandardFlagResolver(
  options: ReferenceExampleVerifierOptions,
): (standard: CppStandard) => Promise<string> {
  const run = options.run ?? runBoundedProcess;
  const standardFlags = new Map<CppStandard, string>();
  return async (standard) => {
    const cached = standardFlags.get(standard);
    if (cached !== undefined) return cached;
    const selected =
      options.standardFlag === undefined
        ? await resolveReferenceCompilerStandardFlag({
            standard,
            probe: async (candidate) => {
              const root = await mkdtemp(
                join(tmpdir(), "cpp-learn-reference-standard-"),
              );
              try {
                const sourcePath = join(root, "probe.cpp");
                await writeFile(
                  sourcePath,
                  "int main() { return 0; }\n",
                  "utf8",
                );
                const result = await run({
                  executable: options.compiler,
                  args: [`-std=${candidate}`, "-fsyntax-only", sourcePath],
                  cwd: root,
                  timeoutMs: 10_000,
                  maxOutputBytes: 64 * 1024,
                  environment: { ...environment, TMPDIR: root },
                });
                return (
                  result.exitCode === 0 &&
                  !result.timedOut &&
                  !result.outputLimitExceeded
                );
              } finally {
                await rm(root, { recursive: true, force: true });
              }
            },
          })
        : await options.standardFlag(standard);
    standardFlags.set(standard, selected);
    return selected;
  };
}

export function createReferenceExampleVerifier(
  options: ReferenceExampleVerifierOptions,
): (request: ReferenceExampleVerificationRequest) => Promise<void> {
  const run = options.run ?? runBoundedProcess;
  const standardFlagFor = createReferenceCompilerStandardFlagResolver(options);

  return async ({ identity, example, source }) => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-reference-example-"));
    try {
      const sourcePath = join(root, `${example.id}.cpp`);
      const outputPath = join(root, "example");
      await writeFile(sourcePath, source, "utf8");
      const standardFlag = await standardFlagFor(example.standard);
      const compilation = await run({
        executable: options.compiler,
        args: [
          `-std=${standardFlag}`,
          "-Wall",
          "-Wextra",
          "-Wpedantic",
          "-Werror",
          sourcePath,
          "-o",
          outputPath,
        ],
        cwd: root,
        timeoutMs: 10_000,
        maxOutputBytes: 64 * 1024,
        environment: { ...environment, TMPDIR: root },
      });
      try {
        assertReferenceCompilationAccepted({
          identity,
          kind: example.kind,
          ...(example.expectedDiagnosticCategory === undefined
            ? {}
            : {
                expectedDiagnosticCategory: example.expectedDiagnosticCategory,
              }),
          compilation,
        });
      } catch (error) {
        throw new ReferenceExampleVerificationError(
          "compiler",
          error instanceof Error ? error.message : "Compilation failed",
          { cause: error },
        );
      }

      if (example.kind !== "run") return;
      const execution = await run({
        executable: outputPath,
        args: [],
        cwd: root,
        timeoutMs: 2_000,
        maxOutputBytes: 64 * 1024,
        environment: { ...environment, TMPDIR: root },
        ...(example.stdin === undefined ? {} : { stdin: example.stdin }),
      });
      if (
        execution.exitCode !== 0 ||
        execution.timedOut ||
        execution.outputLimitExceeded ||
        execution.stdout !== example.expectedStdout
      ) {
        throw new ReferenceExampleVerificationError(
          "runtime",
          [
            `${identity} produced an invalid result`,
            `exitCode=${String(execution.exitCode)}`,
            `timedOut=${String(execution.timedOut)}`,
            `outputLimitExceeded=${String(execution.outputLimitExceeded)}`,
            `stderr=${JSON.stringify(execution.stderr)}`,
            `stdout=${JSON.stringify(execution.stdout)}`,
          ].join("\n"),
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };
}
