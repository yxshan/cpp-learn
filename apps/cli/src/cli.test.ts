import { describe, expect, it, vi } from "vitest";

import type {
  AttemptCompletedEvent,
  BootstrapResult,
  DashboardResult,
  JudgeReport,
  LearningPlatform,
} from "@cpp-learn/contracts";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import { createServer } from "@cpp-learn/server";
import { createInMemoryWorkspace } from "@cpp-learn/workspace";

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
  it("selects the next Activity through the shared Platform", async () => {
    const next = {
      schemaVersion: 1 as const,
      activity: {
        id: "source-to-program",
        version: 1,
        kind: "lesson" as const,
        title: "First program",
        estimatedMinutes: 20,
        conceptIds: [],
        markdown: "# First program\n",
        workspace: { editablePaths: ["main.cpp"] },
      },
    };
    const platform = {
      query: vi.fn().mockResolvedValue(next),
      dispatch: vi.fn(),
      async *events() {},
    } as unknown as LearningPlatform;
    const stdout = vi.fn();

    await expect(
      runCli({
        argv: ["next", "--minutes", "30", "--json"],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    expect(platform.query).toHaveBeenCalledWith({
      type: "activity.next",
      minutes: 30,
    });
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(next)}\n`);
  });

  it("exposes Review Queue, progress, hints, and reflections through shared commands", async () => {
    const platform = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ schemaVersion: 1, reviews: [] })
        .mockResolvedValueOnce({ schemaVersion: 1, concepts: [] }),
      dispatch: vi
        .fn()
        .mockResolvedValueOnce({
          schemaVersion: 1,
          commandId: "generated",
          hint: {
            id: "locate-entry",
            title: "Entry",
            kind: "nudge",
            content: "Start at main.",
          },
          assistance: "assisted",
        })
        .mockResolvedValueOnce({
          schemaVersion: 1,
          commandId: "generated",
          accepted: true,
        }),
      async *events() {},
    } as unknown as LearningPlatform;
    const stdout = vi.fn();

    await expect(
      runCli({
        argv: ["reviews", "--json"],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    await expect(
      runCli({
        argv: ["progress", "--json"],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    await expect(
      runCli({
        argv: [
          "hint",
          "--activity",
          "source-to-program",
          "--attempt",
          "attempt_cli",
          "--hint",
          "locate-entry",
          "--json",
        ],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    await expect(
      runCli({
        argv: [
          "reflect",
          "--activity",
          "source-to-program",
          "--attempt",
          "attempt_cli",
          "--prompt",
          "compile-versus-run",
          "--answer",
          "Build then run.",
        ],
        platform,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);

    expect(platform.query).toHaveBeenNthCalledWith(1, {
      type: "reviews.get",
      dueOnly: false,
    });
    expect(platform.query).toHaveBeenNthCalledWith(2, { type: "progress.get" });
    expect(platform.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hint.reveal",
        attemptId: "attempt_cli",
        hintId: "locate-entry",
      }),
    );
    expect(platform.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reflection.submit" }),
    );
  });

  it("uses documented exit codes for invalid timeboxes and no fitting Activity", async () => {
    const platform = {
      query: vi.fn().mockResolvedValue({ schemaVersion: 1, activity: null }),
      dispatch: vi.fn(),
      async *events() {},
    } as unknown as LearningPlatform;
    const stderr = vi.fn();

    await expect(
      runCli({
        argv: ["next", "--minutes", "invalid"],
        platform,
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(2);
    await expect(
      runCli({
        argv: ["next", "--minutes", "5"],
        platform,
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(1);
    expect(platform.query).toHaveBeenCalledWith({
      type: "activity.next",
      minutes: 5,
    });
  });

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
    ).resolves.toBe(0);
    expect(platform.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "activity.grade",
        activityId: "source-to-program",
      }),
    );
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });
});

describe("[T-DATA-001] CLI export and restore", () => {
  it("requires explicit paths and delegates local backup operations", async () => {
    const archive = {
      exportTo: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        createdAt: "2026-08-23T10:00:00.000Z",
        fileCount: 3,
      }),
      restoreFrom: vi
        .fn()
        .mockResolvedValue({ schemaVersion: 1, restoredFiles: 3 }),
    };
    const platform = {
      query: vi.fn(),
      dispatch: vi.fn(),
      async *events() {},
    } as unknown as LearningPlatform;
    const stdout = vi.fn();

    await expect(
      runCli({
        argv: ["export", "--output", "/tmp/cpp-learn-backup.json", "--json"],
        platform,
        archive,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    await expect(
      runCli({
        argv: ["restore", "--input", "/tmp/cpp-learn-backup.json", "--json"],
        platform,
        archive,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);

    expect(archive.exportTo).toHaveBeenCalledWith("/tmp/cpp-learn-backup.json");
    expect(archive.restoreFrom).toHaveBeenCalledWith(
      "/tmp/cpp-learn-backup.json",
    );
    expect(stdout).toHaveBeenCalledWith(
      `${JSON.stringify({ schemaVersion: 1, restoredFiles: 3 })}\n`,
    );
  });
});

describe("[T-CONTRACT-001] Web/CLI Judge equivalence", () => {
  it("returns the same verdict for the same immutable Source Snapshot", async () => {
    const attempts: AttemptCompletedEvent[] = [];
    const workspace = createInMemoryWorkspace([
      {
        activityId: "source-to-program",
        editablePaths: ["main.cpp"],
        starterFiles: { "main.cpp": "int main() {}\n" },
      },
    ]);
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => ({
          id: "source-to-program",
          version: 1,
          kind: "lesson",
          title: "First program",
          estimatedMinutes: 20,
          conceptIds: ["compile-link-run"],
          markdown: "# First program\n",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => ({
          activityId: "source-to-program",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "",
          timeoutMs: 2_000,
        }),
      },
      workspace,
      judge: {
        execute: async ({ jobId, mode, snapshot }): Promise<JudgeReport> => ({
          schemaVersion: 1,
          reportId: `report_${jobId}`,
          jobId,
          mode,
          activity: {
            id: "source-to-program",
            version: 1,
            judgeVersion: 1,
          },
          source: { snapshotId: snapshot.id, digest: snapshot.digest },
          toolchain: { compiler: "clang", standard: "c++20" },
          verdict: "automated_pass",
          stages: [],
          startedAt: "2026-08-23T08:00:00.000Z",
          completedAt: "2026-08-23T08:00:00.001Z",
        }),
      },
      record: {
        append: async (event) => {
          attempts.push(event);
        },
        list: async () => attempts,
      },
    });
    const server = createServer({ platform });
    const webResponse = await server.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      payload: { schemaVersion: 1, commandId: "cmd_web_equivalence" },
    });
    const webResult = webResponse.json() as {
      snapshotId: string;
      report: JudgeReport;
    };
    let cliOutput = "";
    await runCli({
      argv: ["check", "--activity", "source-to-program", "--json"],
      platform,
      stdout: (text) => {
        cliOutput += text;
      },
      stderr: vi.fn(),
    });
    const cliResult = JSON.parse(cliOutput) as {
      snapshotId: string;
      report: JudgeReport;
    };

    expect(cliResult.snapshotId).toBe(webResult.snapshotId);
    expect(cliResult.report.verdict).toBe(webResult.report.verdict);
    expect(cliResult.report.source.digest).toBe(webResult.report.source.digest);
    await server.close();
  });
});
