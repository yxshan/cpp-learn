import { describe, expect, it, vi } from "vitest";

import {
  createNativeJudge,
  createNativeToolchainProbe,
  createToolchainCheckStage,
  type JudgeStage,
} from "./index.js";

import type { JudgeReport } from "@cpp-learn/contracts";

describe("[T-COMPAT-001] Native Judge toolchain probe", () => {
  it("reports the compiler identity from an argument-array process call", async () => {
    const execute = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "Apple clang version 15.0.0\nTarget: arm64-apple-darwin\n",
      stderr: "",
    });
    const probe = createNativeToolchainProbe({ execute });

    await expect(probe()).resolves.toEqual({
      ready: true,
      compiler: "Apple clang version 15.0.0",
    });
    expect(execute).toHaveBeenCalledWith("clang++", ["--version"]);
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
      }),
    );
  });

  it("reports compiler diagnostics without running the program", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "main.cpp:1: error: expected ';'",
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
      }),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
