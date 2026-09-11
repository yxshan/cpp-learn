import { describe, expect, it } from "vitest";

import type { AttemptCompletedEvent, JudgeReport } from "@cpp-learn/contracts";

import { createLearningPlatform, evictBeyondBudget } from "./index.js";

const unusedJudge = {
  execute: async (): Promise<never> => {
    throw new Error("Judge is not used by this test");
  },
};
const emptyRecord = {
  append: async (): Promise<void> => undefined,
  list: async (): Promise<readonly AttemptCompletedEvent[]> => [],
};
const unusedSnapshot = {
  snapshot: async () => ({
    id: "snap_none",
    activityId: "none",
    digest: "none",
  }),
  readSnapshot: async () => ({
    id: "snap_none",
    activityId: "none",
    digest: "none",
    files: {},
  }),
};

describe("[T-MODULE-001] LearningPlatform bootstrap query", () => {
  it("reports one shared readiness result to every presentation adapter", async () => {
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "Apple Clang 15" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => undefined,
        getJudge: async () => undefined,
      },
      workspace: {
        open: async () => ({ activityId: "none", revision: 0, files: {} }),
        save: async () => ({ ok: false, code: "invalid_path" }),
        ...unusedSnapshot,
      },
      judge: unusedJudge,
      record: emptyRecord,
    });

    await expect(platform.query({ type: "bootstrap.get" })).resolves.toEqual({
      schemaVersion: 1,
      generatedAt: "2026-08-23T08:00:00.000Z",
      ready: true,
      services: {
        curriculum: { ready: true, activityCount: 1 },
        toolchain: { ready: true, compiler: "Apple Clang 15" },
        record: { ready: true },
      },
    });
    expect(typeof platform.dispatch).toBe("function");
    expect(typeof platform.events).toBe("function");
    const events = [];
    for await (const event of platform.events("job_missing"))
      events.push(event);
    expect(events).toEqual([]);
  });
});

describe("[T-LEARN-001] Activity detail query", () => {
  it("returns versioned curriculum content through the Platform Interface", async () => {
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
          title: "从源代码到可执行程序",
          estimatedMinutes: 35,
          conceptIds: ["compile-link-run"],
          markdown: "# 从源代码到可执行程序\n",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => undefined,
      },
      workspace: {
        open: async () => ({ activityId: "none", revision: 0, files: {} }),
        save: async () => ({ ok: false, code: "invalid_path" }),
        ...unusedSnapshot,
      },
      judge: unusedJudge,
      record: emptyRecord,
    });

    await expect(
      platform.query({
        type: "activity.get",
        activityId: "source-to-program",
      }),
    ).resolves.toEqual({
      schemaVersion: 1,
      activity: {
        id: "source-to-program",
        version: 1,
        kind: "lesson",
        title: "从源代码到可执行程序",
        estimatedMinutes: 35,
        conceptIds: ["compile-link-run"],
        markdown: "# 从源代码到可执行程序\n",
        workspace: { editablePaths: ["main.cpp"] },
      },
    });
  });
});

describe("[T-WORK-003] Workspace query and save command", () => {
  it("returns revisions and idempotently rejects stale overwrites", async () => {
    let saveCalls = 0;
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => undefined,
        getJudge: async () => undefined,
      },
      workspace: {
        open: async (activityId) => ({
          activityId,
          revision: 3,
          files: { "main.cpp": "int main() {}\n" },
        }),
        save: async () => {
          saveCalls += 1;
          return { ok: false, code: "revision_conflict" };
        },
        ...unusedSnapshot,
      },
      judge: unusedJudge,
      record: emptyRecord,
    });

    await expect(
      platform.query({ type: "workspace.get", activityId: "first-program" }),
    ).resolves.toEqual({
      schemaVersion: 1,
      workspace: {
        activityId: "first-program",
        revision: 3,
        files: { "main.cpp": "int main() {}\n" },
      },
    });

    const command = {
      type: "workspace.save" as const,
      commandId: "cmd_save_1",
      activityId: "first-program",
      baseRevision: 2,
      changes: [{ path: "main.cpp", content: "stale\n" }],
    };
    const first = await platform.dispatch(command);
    const replay = await platform.dispatch(command);
    expect(first).toEqual({
      schemaVersion: 1,
      commandId: "cmd_save_1",
      result: { ok: false, code: "revision_conflict" },
    });
    expect(replay).toEqual(first);
    expect(saveCalls).toBe(1);
    await expect(
      platform.dispatch({
        ...command,
        changes: [{ path: "main.cpp", content: "different\n" }],
      }),
    ).rejects.toThrow("Command identifier reused with a different payload");
  });
});

describe("[T-LEARN-002] Run, Grade, and Evidence policy", () => {
  it("keeps Run free of Concept Evidence and derives practiced from a passing Grade", async () => {
    const events: AttemptCompletedEvent[] = [];
    const reportFor = (mode: "run" | "grade", jobId: string): JudgeReport => ({
      schemaVersion: 1 as const,
      reportId: `report_${jobId}`,
      jobId,
      mode,
      activity: { id: "first-program", version: 1, judgeVersion: 1 },
      source: { snapshotId: "snap_source_1", digest: "abc123" },
      toolchain: { compiler: "clang", standard: "c++20" },
      verdict: "automated_pass" as const,
      stages: [
        { kind: "compile" as const, outcome: "pass" as const, durationMs: 10 },
        { kind: "test" as const, outcome: "pass" as const, durationMs: 2 },
      ],
      startedAt: "2026-08-23T08:00:00.000Z",
      completedAt: "2026-08-23T08:00:00.012Z",
    });
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => ({
          id: "first-program",
          version: 1,
          kind: "exercise",
          title: "First program",
          estimatedMinutes: 20,
          conceptIds: ["compile-link-run"],
          markdown: "# First program\n",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => ({
          activityId: "first-program",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "",
          timeoutMs: 2_000,
        }),
      },
      workspace: {
        open: async (activityId) => ({ activityId, revision: 1, files: {} }),
        save: async () => ({ ok: true, revision: 2 }),
        snapshot: async () => ({
          id: "snap_source_1",
          activityId: "first-program",
          digest: "abc123",
        }),
        readSnapshot: async () => ({
          id: "snap_source_1",
          activityId: "first-program",
          digest: "abc123",
          files: { "main.cpp": "int main() {}\n" },
        }),
      },
      judge: {
        execute: async ({ mode, jobId }) => reportFor(mode, jobId),
      },
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });

    await platform.dispatch({
      type: "activity.run",
      commandId: "cmd_run_1",
      activityId: "first-program",
    });
    await expect(
      platform.query({ type: "dashboard.get" }),
    ).resolves.toMatchObject({
      attempts: [{ mode: "run", verdict: "automated_pass" }],
      conceptStates: {},
    });

    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_grade_1",
      activityId: "first-program",
    });
    await expect(
      platform.query({ type: "dashboard.get" }),
    ).resolves.toMatchObject({
      attempts: [
        { mode: "run", verdict: "automated_pass" },
        { mode: "grade", verdict: "automated_pass" },
      ],
      conceptStates: { "compile-link-run": "practiced" },
    });
  });
});

describe("[T-JUDGE-004] running job cancellation", () => {
  it("cancels the active Judge and never promotes cancelled work to Concept Evidence", async () => {
    const events: AttemptCompletedEvent[] = [];
    let judgeStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      judgeStarted = resolve;
    });
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => ({
          id: "cancel-me",
          version: 1,
          kind: "exercise",
          title: "Cancel me",
          estimatedMinutes: 10,
          conceptIds: ["process-control"],
          markdown: "",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => ({
          activityId: "cancel-me",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "",
          timeoutMs: 2_000,
        }),
      },
      workspace: {
        open: async () => ({ activityId: "cancel-me", revision: 1, files: {} }),
        save: async () => ({ ok: true, revision: 2 }),
        snapshot: async () => ({
          id: "snap_cancel",
          activityId: "cancel-me",
          digest: "cancel-digest",
        }),
        readSnapshot: async () => ({
          id: "snap_cancel",
          activityId: "cancel-me",
          digest: "cancel-digest",
          files: { "main.cpp": "int main() {}\n" },
        }),
      },
      judge: {
        execute: async ({ jobId, mode, signal }) => {
          judgeStarted?.();
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
          return {
            schemaVersion: 1,
            reportId: `report_${jobId}`,
            jobId,
            mode,
            activity: { id: "cancel-me", version: 1, judgeVersion: 1 },
            source: { snapshotId: "snap_cancel", digest: "cancel-digest" },
            toolchain: { compiler: "clang", standard: "c++20" },
            verdict: "cancelled",
            stages: [{ kind: "compile", outcome: "fail", durationMs: 1 }],
            startedAt: "2026-08-23T08:00:00.000Z",
            completedAt: "2026-08-23T08:00:00.001Z",
          };
        },
      },
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });

    const grade = platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_cancel_grade",
      activityId: "cancel-me",
    });
    await started;
    await expect(
      platform.dispatch({
        type: "job.cancel",
        commandId: "cmd_cancel_job",
        jobId: "job_cmd_cancel_grade",
      }),
    ).resolves.toEqual({
      schemaVersion: 1,
      commandId: "cmd_cancel_job",
      jobId: "job_cmd_cancel_grade",
      cancelled: true,
    });
    await expect(grade).resolves.toMatchObject({
      report: { verdict: "cancelled" },
    });
    const terminalEvents = [];
    for await (const event of platform.events("job_cmd_cancel_grade")) {
      terminalEvents.push(event.type);
    }
    expect(terminalEvents).toEqual(["judge.queued", "judge.cancelled"]);
    await expect(platform.query({ type: "dashboard.get" })).resolves.toEqual({
      schemaVersion: 1,
      attempts: [expect.objectContaining({ verdict: "cancelled" })],
      conceptStates: {},
    });
  });
});

describe("[SEC-F07] bounded in-process retention", () => {
  it("evicts the least recently inserted entry and protects retained ones", () => {
    const map = new Map<string, number>([
      ["oldest", 1],
      ["middle", 2],
      ["newest", 3],
    ]);

    evictBeyondBudget(map, 2);
    expect([...map.keys()]).toEqual(["middle", "newest"]);

    const protectedMap = new Map<string, number>([
      ["keep", 1],
      ["drop", 2],
      ["newest", 3],
    ]);
    evictBeyondBudget(protectedMap, 2, (key) => key === "keep");
    expect([...protectedMap.keys()]).toEqual(["keep", "newest"]);
  });

  it("leaves a map that already fits its budget alone", () => {
    const map = new Map([["only", 1]]);
    evictBeyondBudget(map, 5);
    expect([...map.keys()]).toEqual(["only"]);
  });

  function createRetentionPlatform(retention: {
    readonly commandReceipts?: number;
    readonly jobEventStreams?: number;
  }) {
    const events: AttemptCompletedEvent[] = [];
    const executed: string[] = [];
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      retention,
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => undefined,
        getJudge: async () => undefined,
      },
      workspace: {
        open: async (activityId) => ({ activityId, revision: 1, files: {} }),
        save: async () => ({ ok: true, revision: 2 }),
        ...unusedSnapshot,
      },
      judge: unusedJudge,
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });
    return { platform, executed, events };
  }

  it("replays a receipt while it is retained", async () => {
    const { platform } = createRetentionPlatform({});
    const first = await platform.dispatch({
      type: "workspace.save",
      commandId: "cmd_replay",
      activityId: "first-program",
      baseRevision: 1,
      changes: [{ path: "main.cpp", content: "int main() {}\n" }],
    });
    const second = await platform.dispatch({
      type: "workspace.save",
      commandId: "cmd_replay",
      activityId: "first-program",
      baseRevision: 1,
      changes: [{ path: "main.cpp", content: "int main() {}\n" }],
    });

    // A replay returns the identical receipt rather than a fresh execution.
    expect(second).toEqual(first);
  });

  it("re-executes a command whose receipt was evicted", async () => {
    const { platform } = createRetentionPlatform({ commandReceipts: 1 });
    const command = (commandId: string) =>
      ({
        type: "workspace.save",
        commandId,
        activityId: "first-program",
        baseRevision: 1,
        changes: [{ path: "main.cpp", content: "int main() {}\n" }],
      }) as const;

    const first = await platform.dispatch(command("cmd_oldest"));
    await platform.dispatch(command("cmd_second"));
    const replayed = await platform.dispatch(command("cmd_oldest"));

    // The receipt is gone, so the command runs again and produces a new result
    // object with the same shape; the durable record is what supplies
    // idempotency for Run/Grade.
    expect(replayed).toEqual(first);
    expect(replayed).not.toBe(first);
  });

  it("keeps the event tail only for the configured number of jobs", async () => {
    const events: AttemptCompletedEvent[] = [];
    const reportFor = (mode: "run" | "grade", jobId: string): JudgeReport => ({
      schemaVersion: 1 as const,
      reportId: `report_${jobId}`,
      jobId,
      mode,
      activity: { id: "first-program", version: 1, judgeVersion: 1 },
      source: { snapshotId: "snap_source_1", digest: "abc123" },
      toolchain: { compiler: "clang", standard: "c++20" },
      verdict: "automated_pass" as const,
      stages: [
        { kind: "compile" as const, outcome: "pass" as const, durationMs: 10 },
      ],
      startedAt: "2026-08-23T08:00:00.000Z",
      completedAt: "2026-08-23T08:00:00.012Z",
    });
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      retention: { jobEventStreams: 1 },
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "clang" }),
        record: async () => ({ ready: true }),
      },
      curriculum: {
        getActivity: async () => ({
          id: "first-program",
          version: 1,
          kind: "exercise",
          title: "First program",
          estimatedMinutes: 20,
          conceptIds: ["compile-link-run"],
          markdown: "# First program\n",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => ({
          activityId: "first-program",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "",
          timeoutMs: 2_000,
        }),
      },
      workspace: {
        open: async (activityId) => ({ activityId, revision: 1, files: {} }),
        save: async () => ({ ok: true, revision: 2 }),
        snapshot: async () => ({
          id: "snap_source_1",
          activityId: "first-program",
          digest: "abc123",
        }),
        readSnapshot: async () => ({
          id: "snap_source_1",
          activityId: "first-program",
          digest: "abc123",
          files: { "main.cpp": "int main() {}\n" },
        }),
      },
      judge: { execute: async ({ mode, jobId }) => reportFor(mode, jobId) },
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });
    const streamOf = async (jobId: string) => {
      const seen: string[] = [];
      for await (const event of platform.events(jobId)) seen.push(event.type);
      return seen;
    };
    const grade = (commandId: string) =>
      platform.dispatch({
        type: "activity.grade",
        commandId,
        activityId: "first-program",
      });

    await grade("cmd_job_1");
    await grade("cmd_job_2");

    await expect(streamOf("job_cmd_job_1")).resolves.toEqual([]);
    await expect(streamOf("job_cmd_job_2")).resolves.toEqual([
      "judge.queued",
      "judge.report.ready",
    ]);
    // The evicted job is still fully answerable, because its report lives in
    // the Learning Record rather than in the in-process cache.
    await expect(
      platform.query({ type: "job.get", jobId: "job_cmd_job_1" }),
    ).resolves.toMatchObject({ report: { jobId: "job_cmd_job_1" } });
  });
});
