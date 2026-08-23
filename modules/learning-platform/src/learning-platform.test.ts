import { describe, expect, it } from "vitest";

import type { AttemptCompletedEvent, JudgeReport } from "@cpp-learn/contracts";

import { createLearningPlatform } from "./index.js";

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
