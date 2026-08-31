import { describe, expect, it } from "vitest";

import {
  assertReferenceCompilationAccepted,
  referenceCompilerStandardFlagCandidates,
  resolveReferenceCompilerStandardFlag,
} from "./reference-example-verification.js";

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
  it("probes canonical standard flags before compiler draft aliases", async () => {
    expect(referenceCompilerStandardFlagCandidates("c++20")).toEqual(["c++20"]);
    expect(referenceCompilerStandardFlagCandidates("c++23")).toEqual([
      "c++23",
      "c++2b",
    ]);

    const attempts: string[] = [];
    await expect(
      resolveReferenceCompilerStandardFlag({
        standard: "c++23",
        probe: async (candidate) => {
          attempts.push(candidate);
          return candidate === "c++2b";
        },
      }),
    ).resolves.toBe("c++2b");
    expect(attempts).toEqual(["c++23", "c++2b"]);
  });

  it("reports a standard that has no compiler-supported spelling", async () => {
    await expect(
      resolveReferenceCompilerStandardFlag({
        standard: "c++26-draft",
        probe: async () => false,
      }),
    ).rejects.toThrow("does not support c++26-draft");
  });

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
