import { describe, expect, it } from "vitest";

import type { BoundedProcessRequest } from "@cpp-learn/judge";

import { createReferenceExampleVerifier } from "./example-verifier.ts";

describe("[T-SEC-002] reference example execution environment", () => {
  it("keeps HOME and TMPDIR inside the disposable root", async () => {
    const requests: BoundedProcessRequest[] = [];
    const verify = createReferenceExampleVerifier({
      compiler: "clang++",
      standardFlag: async () => "c++20",
      run: async (request) => {
        requests.push(request);
        return {
          exitCode: 0,
          stdout: request.executable === "clang++" ? "" : "3\n",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        };
      },
    });

    await verify({
      identity: "std-vector#basic",
      source: "int main() {}\n",
      example: {
        id: "basic",
        path: "entries/std-vector/basic.cpp",
        kind: "run",
        standard: "c++20",
        expectedStdout: "3\n",
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);
    for (const request of requests) {
      // The child receives exactly this environment, so an unset HOME would make
      // the compiler fall back to the learner's real home directory.
      expect(request.environment["HOME"]).toBe(request.cwd);
      expect(request.environment["TMPDIR"]).toBe(request.cwd);
      expect(Object.keys(request.environment).sort()).toEqual([
        "HOME",
        "LANG",
        "LC_ALL",
        "PATH",
        "TMPDIR",
      ]);
    }
  });
});
