import { createHash } from "node:crypto";

import type { CppStandard } from "@cpp-learn/contracts";
import {
  createBoundedProcessEnvironment,
  runBoundedProcess,
  type BoundedProcessRunner,
} from "@cpp-learn/judge";
import {
  createReferenceCompilerStandardFlagResolver,
  createReferenceExampleVerifier,
  ReferenceExampleVerificationError,
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
  const standardFlag = createReferenceCompilerStandardFlagResolver({
    compiler,
    run,
    ...(options.standardFlag === undefined
      ? {}
      : { standardFlag: options.standardFlag }),
  });
  const verify = createReferenceExampleVerifier({
    compiler,
    run,
    standardFlag,
  });
  let compilerFingerprint: Promise<string> | undefined;

  const fingerprintCompiler = (): Promise<string> => {
    compilerFingerprint ??= run({
      executable: compiler,
      args: ["--version"],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      maxOutputBytes: 64 * 1024,
      environment: createBoundedProcessEnvironment(process.cwd()),
    }).then((result) => {
      if (
        result.exitCode !== 0 ||
        result.timedOut ||
        result.outputLimitExceeded
      ) {
        throw new Error("Compiler fingerprint probe failed");
      }
      return createHash("sha256")
        .update(
          JSON.stringify({
            compiler,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            timedOut: result.timedOut,
            outputLimitExceeded: result.outputLimitExceeded,
          }),
        )
        .digest("hex");
    });
    return compilerFingerprint;
  };

  return {
    async cacheKey(request) {
      const selectedStandardFlag = await standardFlag(request.example.standard);
      return createHash("sha256")
        .update(
          JSON.stringify({
            compilerFingerprint: await fingerprintCompiler(),
            selectedStandardFlag,
            warningProfileVersion: "reference-werror-v1",
            runnerVersion: "bounded-process-v1",
            sourceDigest: createHash("sha256")
              .update(request.source)
              .digest("hex"),
            kind: request.example.kind,
            stdin: request.example.stdin ?? null,
            expectedStdout: request.example.expectedStdout ?? null,
            expectedDiagnosticCategory:
              request.example.expectedDiagnosticCategory ?? null,
          }),
        )
        .digest("hex");
    },
    async validate(request) {
      try {
        await verify({
          identity: `${request.entryId}/${request.example.id}`,
          example: request.example,
          source: request.source,
        });
        return [];
      } catch (error) {
        return [
          issue(
            error instanceof ReferenceExampleVerificationError
              ? error.phase
              : "compiler",
            error instanceof Error
              ? error.message
              : "Example validation failed",
          ),
        ];
      }
    },
  };
}
