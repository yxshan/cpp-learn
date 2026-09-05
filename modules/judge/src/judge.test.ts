import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  createNativeJudge,
  createNativeToolchainProbe,
  createToolchainCheckStage,
  resolveNativeCppCompiler,
  runBoundedProcess,
  type JudgeStage,
} from "./index.js";

import type { JudgeReport } from "@cpp-learn/contracts";

const verdictFixtureRoot = fileURLToPath(
  new URL("../fixtures/verdicts/", import.meta.url),
);

describe("[T-COMPAT-001] Native Judge toolchain probe", () => {
  it("honors an explicit compiler before probing known modern installations", () => {
    const exists = vi.fn(() => true);

    expect(resolveNativeCppCompiler("/custom/clang++", exists)).toBe(
      "/custom/clang++",
    );
    expect(exists).not.toHaveBeenCalled();
  });

  it("selects an installed modern LLVM and otherwise keeps the system fallback", () => {
    expect(
      resolveNativeCppCompiler(undefined, (path) =>
        path.startsWith("/usr/local/"),
      ),
    ).toBe("/usr/local/opt/llvm/bin/clang++");
    expect(resolveNativeCppCompiler(undefined, () => false)).toBe(
      "/usr/bin/clang++",
    );
  });

  it("reports the compiler identity from an argument-array process call", async () => {
    const execute = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "Apple clang version 15.0.0\nTarget: arm64-apple-darwin\n",
      stderr: "",
    });
    const probe = createNativeToolchainProbe({
      execute,
      compiler: "/usr/bin/clang++",
    });

    await expect(probe()).resolves.toEqual({
      ready: true,
      compiler: "Apple clang version 15.0.0",
    });
    expect(execute).toHaveBeenCalledWith("/usr/bin/clang++", ["--version"]);
  });
});

describe("[T-SEC-002] bounded process isolation", () => {
  it("terminates the dedicated learner process group on timeout", async () => {
    const result = await runBoundedProcess({
      executable: "/bin/sh",
      args: ["-c", "sleep 10 & echo $!; wait"],
      cwd: "/tmp",
      timeoutMs: 50,
      maxOutputBytes: 1_024,
      environment: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
    });
    const descendantPid = Number(result.stdout.trim());
    expect(result.timedOut).toBe(true);
    expect(Number.isInteger(descendantPid)).toBe(true);

    let descendantExists = true;
    for (let attempt = 0; attempt < 20 && descendantExists; attempt += 1) {
      try {
        process.kill(descendantPid, 0);
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch {
        descendantExists = false;
      }
    }
    if (descendantExists) process.kill(descendantPid, "SIGKILL");
    expect(descendantExists).toBe(false);
  });

  it("terminates the learner process group when the job is cancelled", async () => {
    const controller = new AbortController();
    const execution = runBoundedProcess({
      executable: "/bin/sh",
      args: ["-c", "sleep 10"],
      cwd: "/tmp",
      timeoutMs: 5_000,
      maxOutputBytes: 1_024,
      environment: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      signal: controller.signal,
    });
    controller.abort();

    await expect(execution).resolves.toMatchObject({
      cancelled: true,
      timedOut: false,
      outputLimitExceeded: false,
    });
  });
});

describe("[T-MODULE-001] JudgeStage Interface", () => {
  it("turns toolchain readiness into a timed preparation-stage result", async () => {
    const stage: JudgeStage = createToolchainCheckStage({
      clock: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(112),
      probe: vi.fn().mockResolvedValue({ ready: true, compiler: "clang" }),
    });

    await expect(
      stage.execute({ jobId: "job_1", snapshotId: "snap_1" }),
    ).resolves.toEqual({ kind: "prepare", outcome: "pass", durationMs: 12 });
  });
});

describe("[T-JUDGE-001] immutable snapshot execution", () => {
  it("compiles with C++20 and grades exact public output", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "Hello, C++!\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    let now = 100;
    const judge = createNativeJudge({
      run,
      clock: () =>
        new Date(`2026-08-23T08:00:00.${String(now++).padStart(3, "0")}Z`),
      monotonicClock: () => now++,
      compiler: "clang++",
    });

    const report: JudgeReport = await judge.execute({
      jobId: "job_1",
      mode: "grade",
      activity: {
        id: "source-to-program",
        version: 1,
        kind: "lesson",
        title: "First program",
        estimatedMinutes: 20,
        conceptIds: ["compile-link-run"],
        markdown: "# First program\n",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "source-to-program",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "Hello, C++!\n",
        timeoutMs: 2_000,
      },
      snapshot: {
        id: "snap_1",
        activityId: "source-to-program",
        digest: "abc123",
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    expect(report).toMatchObject({
      verdict: "automated_pass",
      activity: { judgeVersion: 1 },
      source: { snapshotId: "snap_1", digest: "abc123" },
      toolchain: { compiler: "clang++", standard: "c++20" },
    });
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        executable: "clang++",
        args: expect.arrayContaining(["-std=c++20", "-Wall", "-Wextra"]),
        environment: {
          PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
          LANG: "C",
          LC_ALL: "C",
          HOME: expect.stringContaining("cpp-learn-judge-"),
          TMPDIR: expect.stringContaining("cpp-learn-judge-"),
        },
      }),
    );
  });

  it("reports compiler diagnostics without running the program", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "main.cpp:1:4: error: expected ';'",
      timedOut: false,
      outputLimitExceeded: false,
    });
    const judge = createNativeJudge({ run });
    const report = await judge.execute({
      jobId: "job_compile_error",
      mode: "run",
      activity: {
        id: "source-to-program",
        version: 1,
        kind: "lesson",
        title: "First program",
        estimatedMinutes: 20,
        conceptIds: [],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "source-to-program",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "ok\n",
        timeoutMs: 2_000,
      },
      snapshot: {
        id: "snap_bad",
        activityId: "source-to-program",
        digest: "bad",
        files: { "main.cpp": "int main( {\n" },
      },
    });

    expect(report.verdict).toBe("compile_error");
    expect(report.stages).toEqual([
      expect.objectContaining({
        kind: "compile",
        outcome: "fail",
        stderr: expect.stringContaining("expected ';'"),
        diagnostics: [
          {
            category: "compiler",
            file: "main.cpp",
            line: 1,
            column: 4,
            message: "expected ';'",
          },
        ],
      }),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("[T-JUDGE-003] Stage 2 Judge profiles", () => {
  const activity = {
    id: "verdict-profile",
    version: 1,
    kind: "exercise" as const,
    title: "Verdict profile",
    estimatedMinutes: 10,
    conceptIds: [],
    markdown: "",
    workspace: { editablePaths: ["main.cpp"] },
  };
  const spec = {
    activityId: "verdict-profile",
    activityVersion: 1,
    judgeVersion: 1,
    expectedStdout: "ok\n",
    timeoutMs: 2_000,
  };
  const snapshot = {
    id: "snap_verdict",
    activityId: "verdict-profile",
    digest: "verdict-digest",
    files: { "main.cpp": "int main() {}\n" },
  };

  it.each([
    {
      name: "runtime exit",
      result: {
        exitCode: 9,
        stdout: "",
        stderr: "runtime failed",
        timedOut: false,
        outputLimitExceeded: false,
      },
      verdict: "runtime_error",
    },
    {
      name: "wrong public output",
      result: {
        exitCode: 0,
        stdout: "wrong\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      },
      verdict: "public_failure",
    },
    {
      name: "wall timeout",
      result: {
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: true,
        outputLimitExceeded: false,
      },
      verdict: "timeout",
    },
    {
      name: "output byte limit",
      result: {
        exitCode: null,
        stdout: "too much",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: true,
      },
      verdict: "output_limit",
    },
  ])("classifies $name as $verdict", async ({ result, verdict }) => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce(result);
    const report = await createNativeJudge({ run }).execute({
      jobId: `job_${verdict}`,
      mode: "grade",
      activity,
      spec,
      snapshot,
    });

    expect(report.verdict).toBe(verdict);
  });

  it("compiles every snapshot source and redacts a failing private test", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "public-ok\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "secret-actual-value\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    const judge = createNativeJudge({ run, compiler: "clang++" });

    const report = await judge.execute({
      jobId: "job_private_failure",
      mode: "grade",
      activity: {
        id: "multi-file-profile",
        version: 2,
        kind: "exercise",
        title: "Multi-file profile",
        estimatedMinutes: 30,
        conceptIds: [],
        markdown: "",
        workspace: { editablePaths: ["main.cpp", "helper.cpp"] },
      },
      spec: {
        activityId: "multi-file-profile",
        activityVersion: 2,
        judgeVersion: 3,
        expectedStdout: "public-ok\n",
        timeoutMs: 2_000,
        publicTests: [
          {
            name: "visible example",
            stdin: "public-input\n",
            expectedStdout: "public-ok\n",
          },
        ],
        privateTests: [
          {
            name: "hidden ownership case",
            stdin: "secret-input-value\n",
            expectedStdout: "secret-expected-value\n",
            failureCategory: "ownership invariant",
          },
        ],
        sanitizers: [],
      },
      snapshot: {
        id: "snap_multi",
        activityId: "multi-file-profile",
        digest: "multi-digest",
        files: {
          "main.cpp": "int main() {}\n",
          "helper.cpp": "int helper() { return 1; }\n",
        },
      },
    });

    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        args: expect.arrayContaining(["helper.cpp", "main.cpp"]),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stdin: "public-input\n" }),
    );
    expect(report).toMatchObject({
      verdict: "private_failure",
      stages: [
        { kind: "compile", outcome: "pass" },
        { kind: "public_test", outcome: "pass", testName: "visible example" },
        {
          kind: "private_test",
          outcome: "fail",
          feedback: "ownership invariant",
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("secret-input-value");
    expect(JSON.stringify(report)).not.toContain("secret-expected-value");
    expect(JSON.stringify(report)).not.toContain("secret-actual-value");
  });

  it.each([
    {
      sanitizer: "address" as const,
      kind: "asan" as const,
      stderr: "ERROR: AddressSanitizer: heap-use-after-free on address 0x123\n",
      finding: "heap-use-after-free",
    },
    {
      sanitizer: "undefined" as const,
      kind: "ubsan" as const,
      stderr: "main.cpp:4:7: runtime error: signed integer overflow\n",
      finding: "signed integer overflow",
    },
  ])(
    "classifies $kind findings with structured diagnostics",
    async ({ sanitizer, kind, stderr, finding }) => {
      const run = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "ok\n",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        })
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr,
          timedOut: false,
          outputLimitExceeded: false,
        });
      const judge = createNativeJudge({ run, compiler: "clang++" });
      const report = await judge.execute({
        jobId: "job_asan",
        mode: "grade",
        activity: {
          id: "memory-profile",
          version: 1,
          kind: "exercise",
          title: "Memory profile",
          estimatedMinutes: 30,
          conceptIds: [],
          markdown: "",
          workspace: { editablePaths: ["main.cpp"] },
        },
        spec: {
          activityId: "memory-profile",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "ok\n",
          timeoutMs: 2_000,
          sanitizers: [sanitizer],
        },
        snapshot: {
          id: "snap_asan",
          activityId: "memory-profile",
          digest: "asan-digest",
          files: { "main.cpp": "int main() {}\n" },
        },
      });

      expect(run).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          args: expect.arrayContaining([
            `-fsanitize=${sanitizer}`,
            "-fno-omit-frame-pointer",
          ]),
        }),
      );
      expect(report).toMatchObject({
        verdict: "sanitizer_failure",
        stages: [
          { kind: "compile", outcome: "pass" },
          { kind: "test", outcome: "pass" },
          {
            kind,
            outcome: "fail",
            diagnostics: [
              {
                category: "sanitizer",
                message: expect.stringContaining(finding),
              },
            ],
          },
        ],
      });
    },
  );

  it("propagates cancellation to the active stage and returns a terminal report", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
      cancelled: true,
    });
    const controller = new AbortController();
    const judge = createNativeJudge({ run });
    controller.abort();

    const report = await judge.execute({
      jobId: "job_cancelled",
      mode: "grade",
      signal: controller.signal,
      activity: {
        id: "cancelled-profile",
        version: 1,
        kind: "exercise",
        title: "Cancelled profile",
        estimatedMinutes: 10,
        conceptIds: [],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "cancelled-profile",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "",
        timeoutMs: 2_000,
      },
      snapshot: {
        id: "snap_cancelled",
        activityId: "cancelled-profile",
        digest: "cancelled-digest",
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(report).toMatchObject({
      verdict: "cancelled",
      stages: [{ kind: "compile", outcome: "fail" }],
    });
  });

  it("isolates a process-runner crash and remains usable for the next job", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("worker channel closed"))
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "ok\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    const judge = createNativeJudge({ run });

    await expect(
      judge.execute({
        jobId: "job_crashed",
        mode: "grade",
        activity,
        spec,
        snapshot,
      }),
    ).resolves.toMatchObject({
      verdict: "judge_system_error",
      stages: [
        {
          outcome: "system_error",
          stderr: "Judge worker failed",
        },
      ],
    });
    await expect(
      judge.execute({
        jobId: "job_after_crash",
        mode: "grade",
        activity,
        spec,
        snapshot,
      }),
    ).resolves.toMatchObject({ verdict: "automated_pass" });
  });

  it("redacts private values when the runner throws during a private test", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "ok\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockRejectedValueOnce(
        new Error("worker failed while writing secret-input-value"),
      );
    const report = await createNativeJudge({ run }).execute({
      jobId: "job_private_exception",
      mode: "grade",
      activity,
      spec: {
        ...spec,
        privateTests: [
          {
            name: "hidden case",
            stdin: "secret-input-value",
            expectedStdout: "secret-output-value",
            failureCategory: "hidden invariant",
          },
        ],
      },
      snapshot,
    });

    expect(report).toMatchObject({
      verdict: "judge_system_error",
      stages: [
        { kind: "compile", outcome: "pass" },
        { kind: "test", outcome: "pass" },
        {
          kind: "private_test",
          outcome: "system_error",
          stderr: "Judge worker failed",
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("secret-input-value");
    expect(JSON.stringify(report)).not.toContain("secret-output-value");
  });
});

describe("[T-JUDGE-006] deterministic generated properties", () => {
  it("records a reproducible seed and counterexample for a failed generated case", async () => {
    const executeOnce = async (jobId: string) => {
      const run = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "ok\n",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "wrong\n",
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        });
      const report = await createNativeJudge({ run }).execute({
        jobId,
        mode: "grade",
        activity: {
          id: "sort-property",
          version: 1,
          kind: "exercise",
          title: "Sort property",
          estimatedMinutes: 30,
          conceptIds: ["algorithm-properties"],
          markdown: "",
          workspace: { editablePaths: ["main.cpp"] },
        },
        spec: {
          activityId: "sort-property",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "ok\n",
          timeoutMs: 2_000,
          propertyTests: [
            {
              name: "sorted permutation",
              seed: 20_260_823,
              cases: 3,
              generator: {
                kind: "integer-vector",
                minLength: 3,
                maxLength: 6,
                minValue: -20,
                maxValue: 20,
              },
              oracle: "sort-ascending",
              failureCategory: "output must be a sorted permutation",
            },
          ],
        },
        snapshot: {
          id: "snap_sort_property",
          activityId: "sort-property",
          digest: "sort-property-digest",
          files: { "main.cpp": "int main() {}\n" },
        },
      });
      return { report, generatedStdin: run.mock.calls[2]?.[0].stdin };
    };

    const first = await executeOnce("job_property_first");
    const replay = await executeOnce("job_property_replay");

    expect(first.report).toMatchObject({
      verdict: "property_failure",
      seeds: [20_260_823],
      stages: [
        { kind: "compile", outcome: "pass" },
        { kind: "test", outcome: "pass" },
        {
          kind: "property_test",
          outcome: "fail",
          testName: "sorted permutation",
          feedback: "output must be a sorted permutation",
          seed: 20_260_823,
          caseIndex: 0,
          counterexample: expect.any(String),
        },
      ],
    });
    expect(replay.generatedStdin).toBe(first.generatedStdin);
    expect(replay.report.stages[2]?.counterexample).toBe(
      first.report.stages[2]?.counterexample,
    );
  });
});

describe("[T-JUDGE-007] same-machine relative performance", () => {
  it("fails only on the median scaled-to-baseline growth ratio", async () => {
    let now = 0;
    const run = vi.fn(async (request: { readonly stdin?: string }) => {
      now +=
        request.stdin === "scaled\n"
          ? 100
          : request.stdin === "base\n"
            ? 10
            : 1;
      return {
        exitCode: 0,
        stdout:
          request.stdin === "public\n"
            ? "ok\n"
            : request.stdin === "base\n"
              ? "base-ok\n"
              : "scaled-ok\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      };
    });
    const report = await createNativeJudge({
      run,
      monotonicClock: () => now,
    }).execute({
      jobId: "job_relative_performance",
      mode: "grade",
      activity: {
        id: "complexity-growth",
        version: 1,
        kind: "exercise",
        title: "Complexity growth",
        estimatedMinutes: 30,
        conceptIds: ["algorithm-complexity"],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "complexity-growth",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "ok\n",
        timeoutMs: 2_000,
        publicTests: [
          { name: "public", stdin: "public\n", expectedStdout: "ok\n" },
        ],
        performanceCheck: {
          name: "doubling growth",
          baselineStdin: "base\n",
          baselineExpectedStdout: "base-ok\n",
          scaledStdin: "scaled\n",
          scaledExpectedStdout: "scaled-ok\n",
          repetitions: 3,
          maxMedianRatio: 3,
          failureCategory: "runtime grows too quickly when input doubles",
        },
      },
      snapshot: {
        id: "snap_relative_performance",
        activityId: "complexity-growth",
        digest: "relative-performance-digest",
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    expect(report).toMatchObject({
      verdict: "performance_failure",
      stages: [
        { kind: "compile", outcome: "pass" },
        { kind: "public_test", outcome: "pass" },
        {
          kind: "performance",
          outcome: "fail",
          testName: "doubling growth",
          feedback: "runtime grows too quickly when input doubles",
          baselineDurationMs: 10,
          scaledDurationMs: 100,
          ratio: 10,
        },
      ],
    });
  });

  it("rejects a fast program whose scaled-input result is wrong", async () => {
    let now = 0;
    const run = vi.fn(async (request: { readonly stdin?: string }) => {
      now += 1;
      return {
        exitCode: 0,
        stdout: request.stdin === "public\n" ? "ok\n" : "wrong\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      };
    });
    const report = await createNativeJudge({
      run,
      monotonicClock: () => now,
    }).execute({
      jobId: "job_fast_but_wrong",
      mode: "grade",
      activity: {
        id: "complexity-correctness",
        version: 1,
        kind: "exercise",
        title: "Complexity correctness",
        estimatedMinutes: 30,
        conceptIds: ["algorithm-complexity"],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "complexity-correctness",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "ok\n",
        timeoutMs: 2_000,
        publicTests: [
          { name: "public", stdin: "public\n", expectedStdout: "ok\n" },
        ],
        performanceCheck: {
          name: "correct growth",
          baselineStdin: "base\n",
          baselineExpectedStdout: "base-ok\n",
          scaledStdin: "scaled\n",
          scaledExpectedStdout: "scaled-ok\n",
          repetitions: 3,
          maxMedianRatio: 3,
          failureCategory: "scaled execution must remain correct",
        },
      },
      snapshot: {
        id: "snap_fast_but_wrong",
        activityId: "complexity-correctness",
        digest: "fast-but-wrong-digest",
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    expect(report).toMatchObject({
      verdict: "performance_failure",
      stages: [
        { kind: "compile", outcome: "pass" },
        { kind: "public_test", outcome: "pass" },
        {
          kind: "performance",
          outcome: "fail",
          feedback: "scaled execution must remain correct",
        },
      ],
    });
  });
});

describe("[T-JUDGE-008] declarative CMake and CTest profile", () => {
  it("configures a clean build, builds the named target, and runs CTest before Grade tests", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "ok\n",
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
    });
    const inspectTool = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "cmake version 4.1.0\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "ctest version 4.1.0\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "v22.23.2\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "git version 2.51.0\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout:
          "web-frontend sha256=abc123 vite=8.2.2 react=19.2.8 react-dom=19.2.8\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    const report = await createNativeJudge({
      run,
      cmake: "cmake",
      ctest: "ctest",
      nodeRuntime: "/runtime/node",
      gitRuntime: "/runtime/git",
      webFrontendHarness: "/runtime/verify-react-project.mjs",
      inspectTool,
    }).execute({
      jobId: "job_cmake_ctest",
      mode: "grade",
      activity: {
        id: "cmake-project",
        version: 1,
        kind: "project-milestone",
        title: "CMake project",
        estimatedMinutes: 45,
        conceptIds: ["cmake-ctest"],
        markdown: "",
        workspace: {
          editablePaths: ["CMakeLists.txt", "main.cpp", "test.cpp"],
        },
      },
      spec: {
        activityId: "cmake-project",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "ok\n",
        timeoutMs: 5_000,
        buildProfile: {
          kind: "cmake",
          target: "app",
          testTarget: "app-tests",
          ctest: true,
          runtimeTools: ["node", "git", "web-frontend"],
        },
      },
      snapshot: {
        id: "snap_cmake_ctest",
        activityId: "cmake-project",
        digest: "cmake-ctest-digest",
        files: {
          "CMakeLists.txt": "cmake_minimum_required(VERSION 3.20)\n",
          "main.cpp": "int main() {}\n",
          "test.cpp": "int main() {}\n",
        },
      },
    });

    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        executable: "cmake",
        args: [
          "-S",
          ".",
          "-B",
          "build",
          "-DCMAKE_BUILD_TYPE=Release",
          "-DCPP_LEARN_NODE=/runtime/node",
          "-DCPP_LEARN_GIT=/runtime/git",
          "-DCPP_LEARN_WEB_FRONTEND=/runtime/verify-react-project.mjs",
        ],
      }),
    );
    expect(inspectTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        executable: "cmake",
        args: ["--version"],
        timeoutMs: 2_000,
        maxOutputBytes: 16 * 1024,
      }),
    );
    expect(inspectTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        executable: "ctest",
        args: ["--version"],
        timeoutMs: 2_000,
        maxOutputBytes: 16 * 1024,
      }),
    );
    expect(inspectTool).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        executable: "/runtime/node",
        args: ["--version"],
      }),
    );
    expect(inspectTool).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        executable: "/runtime/git",
        args: ["--version"],
      }),
    );
    expect(inspectTool).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        executable: "/runtime/node",
        args: ["/runtime/verify-react-project.mjs", "--fingerprint"],
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        executable: "cmake",
        args: ["--build", "build", "--target", "app", "app-tests"],
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        executable: "ctest",
        args: ["--test-dir", "build", "--output-on-failure"],
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        executable: expect.stringMatching(/build\/app$/),
      }),
    );
    expect(report).toMatchObject({
      verdict: "automated_pass",
      toolchain: {
        buildSystem: "cmake/ctest",
        cmake: "cmake version 4.1.0",
        ctest: "ctest version 4.1.0",
        node: "v22.23.2",
        git: "git version 2.51.0",
        webFrontend:
          "web-frontend sha256=abc123 vite=8.2.2 react=19.2.8 react-dom=19.2.8",
      },
      stages: [
        { kind: "configure", outcome: "pass" },
        { kind: "build", outcome: "pass" },
        { kind: "ctest", outcome: "pass" },
        { kind: "test", outcome: "pass" },
      ],
    });
  });

  it.each([
    {
      failureName: "missing",
      failure: {
        exitCode: 127,
        stdout: "",
        stderr: "git unavailable",
        timedOut: false,
        outputLimitExceeded: false,
      },
    },
    {
      failureName: "timed out",
      failure: {
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: true,
        outputLimitExceeded: false,
      },
    },
  ])(
    "[T-JUDGE-009] classifies a $failureName runtime-tool inspection as a system error before configure",
    async ({ failure, failureName }) => {
      const run = vi.fn();
      const available = (stdout: string) => ({
        exitCode: 0,
        stdout,
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
      const inspectTool = vi
        .fn()
        .mockResolvedValueOnce(available("cmake version 4.1.0\n"))
        .mockResolvedValueOnce(available("ctest version 4.1.0\n"))
        .mockResolvedValueOnce(failure);

      const report = await createNativeJudge({
        run,
        inspectTool,
        gitRuntime: "/runtime/git",
      }).execute({
        jobId: `job_${failureName.replaceAll(" ", "_")}_git`,
        mode: "grade",
        activity: {
          id: "git-project",
          version: 1,
          kind: "project-milestone",
          title: "Git project",
          estimatedMinutes: 20,
          conceptIds: ["git-diagnostics"],
          markdown: "",
          workspace: { editablePaths: ["CMakeLists.txt", "main.cpp"] },
        },
        spec: {
          activityId: "git-project",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "ok\n",
          timeoutMs: 2_000,
          buildProfile: {
            kind: "cmake",
            target: "app",
            testTarget: "tests",
            ctest: true,
            runtimeTools: ["git"],
          },
        },
        snapshot: {
          id: `snap_${failureName.replaceAll(" ", "_")}_git`,
          activityId: "git-project",
          digest: `${failureName}-git-digest`,
          files: {
            "CMakeLists.txt": "cmake_minimum_required(VERSION 3.20)\n",
            "main.cpp": "int main() {}\n",
          },
        },
      });

      expect(report).toMatchObject({
        verdict: "judge_system_error",
        toolchain: {
          buildSystem: "cmake/ctest",
          cmake: "cmake version 4.1.0",
          ctest: "ctest version 4.1.0",
        },
        stages: [{ kind: "configure", outcome: "system_error" }],
      });
      expect(inspectTool).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          executable: "/runtime/git",
          args: ["--version"],
        }),
      );
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("preserves cancellation while inspecting build-tool versions", async () => {
    const run = vi.fn();
    const cancelledInspection = {
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
      cancelled: true,
    };
    const report = await createNativeJudge({
      run,
      inspectTool: vi.fn().mockResolvedValue(cancelledInspection),
    }).execute({
      jobId: "job_cancelled_tool_inspection",
      mode: "grade",
      activity: {
        id: "cancelled-cmake",
        version: 1,
        kind: "exercise",
        title: "Cancelled CMake",
        estimatedMinutes: 20,
        conceptIds: ["cmake"],
        markdown: "",
        workspace: { editablePaths: ["CMakeLists.txt", "main.cpp"] },
      },
      spec: {
        activityId: "cancelled-cmake",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "",
        timeoutMs: 2_000,
        buildProfile: {
          kind: "cmake",
          target: "app",
          testTarget: "tests",
          ctest: true,
        },
      },
      snapshot: {
        id: "snap_cancelled_cmake",
        activityId: "cancelled-cmake",
        digest: "cancelled-cmake-digest",
        files: {
          "CMakeLists.txt": "cmake_minimum_required(VERSION 3.20)\n",
          "main.cpp": "int main() {}\n",
        },
      },
    });

    expect(report).toMatchObject({
      verdict: "cancelled",
      stages: [{ kind: "configure", outcome: "fail" }],
    });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("[T-SYSTEM-001] system-lab resource lifecycle", () => {
  it("removes the per-Grade root after learner processes complete", async () => {
    let executionRoot = "";
    const run = vi.fn(async (request: { readonly cwd: string }) => {
      executionRoot = request.cwd;
      return {
        exitCode: 0,
        stdout: request.cwd.includes("cpp-learn-judge-") ? "ok\n" : "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      };
    });
    await createNativeJudge({ run }).execute({
      jobId: "job_system_cleanup",
      mode: "grade",
      activity: {
        id: "system-cleanup",
        version: 1,
        kind: "exercise",
        title: "System cleanup",
        estimatedMinutes: 20,
        conceptIds: ["system-resources"],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "system-cleanup",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "ok\n",
        timeoutMs: 2_000,
      },
      snapshot: {
        id: "snap_system_cleanup",
        activityId: "system-cleanup",
        digest: "system-cleanup-digest",
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    expect(executionRoot).toContain("cpp-learn-judge-");
    await expect(stat(executionRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("[T-JUDGE-005] real Clang verdict golden fixtures", () => {
  it.each([
    {
      file: "pass.cpp",
      verdict: "automated_pass",
      expectedStdout: "ok\n",
    },
    {
      file: "compile-error.cpp",
      verdict: "compile_error",
      expectedStdout: "",
    },
    {
      file: "runtime-error.cpp",
      verdict: "runtime_error",
      expectedStdout: "",
    },
    {
      file: "public-failure.cpp",
      verdict: "public_failure",
      expectedStdout: "ok\n",
    },
    {
      file: "timeout.cpp",
      verdict: "timeout",
      expectedStdout: "",
      timeoutMs: 1_000,
    },
    {
      file: "output-limit.cpp",
      verdict: "output_limit",
      expectedStdout: "",
      maxOutputBytes: 256,
    },
    {
      file: "pass.cpp",
      verdict: "private_failure",
      expectedStdout: "ok\n",
      privateExpectedStdout: "hidden answer\n",
    },
    {
      file: "asan.cpp",
      verdict: "sanitizer_failure",
      expectedStdout: "ok\n",
      sanitizer: "address" as const,
    },
    {
      file: "ubsan.cpp",
      verdict: "sanitizer_failure",
      expectedStdout: "ok\n",
      sanitizer: "undefined" as const,
    },
  ])("classifies $file as $verdict", async (fixture) => {
    const source = await readFile(
      `${verdictFixtureRoot}${fixture.file}`,
      "utf8",
    );
    const judge = createNativeJudge({
      compiler: "/usr/bin/clang++",
      compilerFingerprint: "reference Apple Clang",
      maxOutputBytes: fixture.maxOutputBytes ?? 64 * 1024,
    });
    const report = await judge.execute({
      jobId: `job_golden_${fixture.file.replace(/\W/g, "_")}_${fixture.verdict}`,
      mode: "grade",
      activity: {
        id: "golden-fixture",
        version: 1,
        kind: "exercise",
        title: "Golden fixture",
        estimatedMinutes: 5,
        conceptIds: [],
        markdown: "",
        workspace: { editablePaths: ["main.cpp"] },
      },
      spec: {
        activityId: "golden-fixture",
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: fixture.expectedStdout,
        timeoutMs: fixture.timeoutMs ?? 2_000,
        ...(fixture.privateExpectedStdout
          ? {
              privateTests: [
                {
                  name: "hidden golden case",
                  stdin: "",
                  expectedStdout: fixture.privateExpectedStdout,
                  failureCategory: "hidden invariant",
                },
              ],
            }
          : {}),
        ...(fixture.sanitizer ? { sanitizers: [fixture.sanitizer] } : {}),
      },
      snapshot: {
        id: `snap_${fixture.file}`,
        activityId: "golden-fixture",
        digest: `digest_${fixture.file}`,
        files: { "main.cpp": source },
      },
    });

    expect(report.verdict).toBe(fixture.verdict);
    expect(report.toolchain.compiler).toBe("reference Apple Clang");
  });
});
