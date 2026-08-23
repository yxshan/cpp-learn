import { describe, expect, it, vi } from "vitest";

import {
  createNativeToolchainProbe,
  createToolchainCheckStage,
  type JudgeStage,
} from "./index.js";

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
