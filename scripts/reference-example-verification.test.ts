import { describe, expect, it } from "vitest";

import { assertReferenceCompilationAccepted } from "./reference-example-verification.js";

const expectedFailure = {
  identity: "std-vector/invalid",
  kind: "expected-compile-failure" as const,
  expectedDiagnosticCategory: "invalid operands",
  compilation: {
    exitCode: 1,
    stdout: "",
    stderr: "error: invalid operands to binary expression",
    timedOut: false,
    outputLimitExceeded: false,
  },
};

describe("Reference example compilation acceptance", () => {
  it("accepts an expected diagnostic only when compilation stayed within bounds", () => {
    expect(() =>
      assertReferenceCompilationAccepted(expectedFailure),
    ).not.toThrow();

    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        compilation: { ...expectedFailure.compilation, timedOut: true },
      }),
    ).toThrow("exceeded its execution bounds");
    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        compilation: {
          ...expectedFailure.compilation,
          outputLimitExceeded: true,
        },
      }),
    ).toThrow("exceeded its execution bounds");
  });

  it("rejects unexpected expected-failure outcomes and ordinary compiler errors", () => {
    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        compilation: { ...expectedFailure.compilation, exitCode: 0 },
      }),
    ).toThrow("unexpectedly compiled");
    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        compilation: { ...expectedFailure.compilation, exitCode: null },
      }),
    ).toThrow("terminated abnormally");
    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        expectedDiagnosticCategory: "undeclared identifier",
      }),
    ).toThrow("missed diagnostic category");
    expect(() =>
      assertReferenceCompilationAccepted({
        ...expectedFailure,
        kind: "compile",
      }),
    ).toThrow("failed to compile");
  });
});
