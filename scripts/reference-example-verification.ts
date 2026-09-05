import type { BoundedProcessResult } from "@cpp-learn/judge";

export {
  referenceCompilerStandardFlagCandidates,
  resolveReferenceCompilerStandardFlag,
} from "@cpp-learn/judge";

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
