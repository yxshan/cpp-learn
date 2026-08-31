import type { CppStandard } from "@cpp-learn/contracts";
import type { BoundedProcessResult } from "@cpp-learn/judge";

const compilerStandardFlags: Readonly<Record<CppStandard, string>> = {
  "c++98": "c++98",
  "c++03": "c++03",
  "c++11": "c++11",
  "c++14": "c++14",
  "c++17": "c++17",
  "c++20": "c++20",
  "c++23": "c++2b",
  "c++26-draft": "c++2c",
};

export function referenceCompilerStandardFlag(standard: CppStandard): string {
  return compilerStandardFlags[standard];
}

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
