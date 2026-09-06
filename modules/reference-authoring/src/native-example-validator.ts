import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CppStandard } from "@cpp-learn/contracts";
import {
  resolveReferenceCompilerStandardFlag,
  runBoundedProcess,
  type BoundedProcessRunner,
} from "@cpp-learn/judge";
import {
  assertReferenceCompilationAccepted,
  resolveReferenceCppCompiler,
} from "@cpp-learn/reference";

import type {
  AuthoringExampleValidator,
  AuthoringValidationIssue,
} from "./index.js";

export interface NativeAuthoringExampleValidatorOptions {
  readonly compiler?: string;
  readonly run?: BoundedProcessRunner;
  readonly standardFlag?: (standard: CppStandard) => Promise<string>;
}

const environment = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" };

function issue(
  keyword: "compiler" | "runtime",
  message: string,
): AuthoringValidationIssue {
  return { path: "/", message, keyword };
}

export function createNativeAuthoringExampleValidator(
  options: NativeAuthoringExampleValidatorOptions = {},
): AuthoringExampleValidator {
  const compiler = options.compiler ?? resolveReferenceCppCompiler();
  const run = options.run ?? runBoundedProcess;
  const standardFlags = new Map<CppStandard, string>();
  const selectStandardFlag = async (standard: CppStandard): Promise<string> => {
    const cached = standardFlags.get(standard);
    if (cached !== undefined) return cached;
    const selected =
      options.standardFlag === undefined
        ? await resolveReferenceCompilerStandardFlag({
            standard,
            probe: async (candidate) => {
              const root = await mkdtemp(
                join(tmpdir(), "cpp-learn-authoring-standard-"),
              );
              try {
                const sourcePath = join(root, "probe.cpp");
                await writeFile(
                  sourcePath,
                  "int main() { return 0; }\n",
                  "utf8",
                );
                const result = await run({
                  executable: compiler,
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

  return {
    async validate(request) {
      const root = await mkdtemp(
        join(tmpdir(), "cpp-learn-authoring-example-"),
      );
      try {
        const sourcePath = join(root, `${request.example.id}.cpp`);
        const outputPath = join(root, "example");
        await writeFile(sourcePath, request.source, "utf8");
        const standardFlag = await selectStandardFlag(request.example.standard);
        const compilation = await run({
          executable: compiler,
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
            identity: `${request.entryId}/${request.example.id}`,
            kind: request.example.kind,
            ...(request.example.expectedDiagnosticCategory === undefined
              ? {}
              : {
                  expectedDiagnosticCategory:
                    request.example.expectedDiagnosticCategory,
                }),
            compilation,
          });
        } catch (error) {
          return [
            issue(
              "compiler",
              error instanceof Error ? error.message : "Compilation failed",
            ),
          ];
        }

        if (request.example.kind !== "run") return [];
        const execution = await run({
          executable: outputPath,
          args: [],
          cwd: root,
          timeoutMs: 2_000,
          maxOutputBytes: 64 * 1024,
          environment: { ...environment, TMPDIR: root },
          ...(request.example.stdin === undefined
            ? {}
            : { stdin: request.example.stdin }),
        });
        if (
          execution.exitCode !== 0 ||
          execution.timedOut ||
          execution.outputLimitExceeded ||
          execution.stdout !== request.example.expectedStdout
        ) {
          return [
            issue(
              "runtime",
              [
                `${request.entryId}/${request.example.id} produced an invalid result`,
                `exitCode=${String(execution.exitCode)}`,
                `timedOut=${String(execution.timedOut)}`,
                `outputLimitExceeded=${String(execution.outputLimitExceeded)}`,
                `stderr=${JSON.stringify(execution.stderr)}`,
                `stdout=${JSON.stringify(execution.stdout)}`,
              ].join("\n"),
            ),
          ];
        }
        return [];
      } catch (error) {
        return [
          issue(
            "compiler",
            error instanceof Error
              ? error.message
              : "Example validation failed",
          ),
        ];
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  };
}
