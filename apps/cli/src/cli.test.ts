import { describe, expect, it, vi } from "vitest";

import type {
  BootstrapResult,
  DashboardResult,
  LearningPlatform,
} from "@cpp-learn/contracts";

import { runCli } from "./cli.js";

const bootstrap: BootstrapResult = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T08:00:00.000Z",
  ready: false,
  services: {
    curriculum: { ready: true, activityCount: 1 },
    toolchain: { ready: false, issues: ["clang++ is unavailable"] },
    record: { ready: true },
  },
};

describe("[T-CONTRACT-001] CLI doctor Adapter", () => {
  it("writes exactly one shared versioned result in JSON mode", async () => {
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No commands in this fixture");
      },
      async *events() {},
      query: vi.fn().mockResolvedValue(bootstrap),
    };
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runCli({
      argv: ["doctor", "--json"],
      platform,
      stdout,
      stderr,
    });

    expect(exitCode).toBe(3);
    expect(stdout).toHaveBeenCalledOnce();
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(bootstrap)}\n`);
    expect(stderr).not.toHaveBeenCalled();
  });
});

describe("[T-CLI-001] status and check", () => {
  it("prints the shared dashboard result in JSON mode", async () => {
    const dashboard: DashboardResult = {
      schemaVersion: 1,
      attempts: [],
      conceptStates: {},
    };
    const platform = {
      query: vi.fn().mockResolvedValue(dashboard),
      dispatch: vi.fn(),
      async *events() {},
    } as unknown as LearningPlatform;
    const stdout = vi.fn();

    await expect(
      runCli({
        argv: ["status", "--json"],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(dashboard)}\n`);
    expect(platform.query).toHaveBeenCalledWith({ type: "dashboard.get" });
  });

  it("grades the requested activity and returns a failing exit code for a failed verdict", async () => {
    const result = {
      schemaVersion: 1 as const,
      commandId: "generated",
      jobId: "job_1",
      snapshotId: "snap_1",
      status: "completed" as const,
      report: {
        schemaVersion: 1 as const,
        reportId: "report_1",
        jobId: "job_1",
        mode: "grade" as const,
        activity: { id: "source-to-program", version: 1, judgeVersion: 1 },
        source: { snapshotId: "snap_1", digest: "abc" },
        toolchain: { compiler: "clang", standard: "c++20" as const },
        verdict: "public_failure" as const,
        stages: [],
        startedAt: "2026-08-23T08:00:00.000Z",
        completedAt: "2026-08-23T08:00:00.001Z",
      },
    };
    const platform = {
      query: vi.fn(),
      dispatch: vi.fn().mockResolvedValue(result),
      async *events() {},
    } as unknown as LearningPlatform;
    const stdout = vi.fn();

    await expect(
      runCli({
        argv: ["check", "--activity", "source-to-program", "--json"],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(4);
    expect(platform.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "activity.grade",
        activityId: "source-to-program",
      }),
    );
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });
});
