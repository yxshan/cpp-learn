import { describe, expect, it, vi } from "vitest";

import type { BootstrapResult, LearningPlatform } from "@cpp-learn/contracts";

import { runCli } from "./cli.js";

const bootstrap: BootstrapResult = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T08:00:00.000Z",
  ready: false,
  services: {
    curriculum: { ready: true, activityCount: 1 },
    toolchain: { ready: false, issues: ["clang++ is unavailable"] },
    record: { ready: true }
  }
};

describe("[T-CONTRACT-001] CLI doctor Adapter", () => {
  it("writes exactly one shared versioned result in JSON mode", async () => {
    const platform: LearningPlatform = {
      query: vi.fn().mockResolvedValue(bootstrap)
    };
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runCli({
      argv: ["doctor", "--json"],
      platform,
      stdout,
      stderr
    });

    expect(exitCode).toBe(3);
    expect(stdout).toHaveBeenCalledOnce();
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(bootstrap)}\n`);
    expect(stderr).not.toHaveBeenCalled();
  });
});
