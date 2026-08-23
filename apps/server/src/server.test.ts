import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  AttemptCompletedEvent,
  BootstrapResult,
  JudgeReport,
  LearningPlatform,
} from "@cpp-learn/contracts";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import { createInMemoryWorkspace } from "@cpp-learn/workspace";

import { createServer } from "./server.js";

const bootstrap: BootstrapResult = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T08:00:00.000Z",
  ready: true,
  services: {
    curriculum: { ready: true, activityCount: 1 },
    toolchain: { ready: true, compiler: "Apple Clang 15" },
    record: { ready: true },
  },
};

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

describe("[T-CONTRACT-001] HTTP bootstrap Adapter", () => {
  it("returns the shared LearningPlatform query result unchanged", async () => {
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No commands in this fixture");
      },
      async *events() {},
      query: vi.fn().mockResolvedValue(bootstrap),
    };
    const server = createServer({ platform });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(bootstrap);
    expect(platform.query).toHaveBeenCalledWith({ type: "bootstrap.get" });
    await server.close();
  });
});

describe("[T-OPS-001] integrated Web hosting", () => {
  it("serves the built Web entry point when a Web root is configured", async () => {
    const webRoot = await mkdtemp(join(tmpdir(), "cpp-learn-web-"));
    await writeFile(join(webRoot, "index.html"), "<h1>C++ Learn</h1>", "utf8");
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No commands in this fixture");
      },
      async *events() {},
      query: vi.fn().mockResolvedValue(bootstrap),
    };
    const server = createServer({ platform, webRoot });

    const response = await server.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("C++ Learn");
    await server.close();
    await rm(webRoot, { recursive: true, force: true });
  });
});

describe("[T-CONTRACT-002] HTTP Activity Adapter", () => {
  it("maps a versioned Activity query without exposing curriculum files", async () => {
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
          markdown: "# lesson\n",
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
    const server = createServer({ platform });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/activities/source-to-program",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      activity: {
        id: "source-to-program",
        markdown: "# lesson\n",
        workspace: { editablePaths: ["main.cpp"] },
      },
    });
    await server.close();
  });
});

describe("[T-CONTRACT-003] HTTP Workspace Adapter", () => {
  it("maps revision-aware saves and conflicts", async () => {
    const workspace = createInMemoryWorkspace([
      {
        activityId: "first-program",
        editablePaths: ["main.cpp"],
        starterFiles: { "main.cpp": "starter\n" },
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
        getActivity: async () => undefined,
        getJudge: async () => undefined,
      },
      workspace,
      judge: unusedJudge,
      record: emptyRecord,
    });
    const server = createServer({ platform });

    const opened = await server.inject({
      method: "GET",
      url: "/api/v1/workspaces/first-program",
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toMatchObject({ workspace: { revision: 0 } });

    const saved = await server.inject({
      method: "PATCH",
      url: "/api/v1/workspaces/first-program",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_save_1",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "saved\n" }],
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ result: { ok: true, revision: 1 } });

    const conflict = await server.inject({
      method: "PATCH",
      url: "/api/v1/workspaces/first-program",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_save_2",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "stale\n" }],
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      result: { ok: false, code: "revision_conflict" },
    });
    await server.close();
  });
});

describe("[T-CONTRACT-004] HTTP execution and progress Adapters", () => {
  it("grades a snapshot, exposes its report, dashboard evidence, and SSE events", async () => {
    const events: AttemptCompletedEvent[] = [];
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
          stages: [
            { kind: "compile", outcome: "pass", durationMs: 1 },
            { kind: "test", outcome: "pass", durationMs: 1 },
          ],
          startedAt: "2026-08-23T08:00:00.000Z",
          completedAt: "2026-08-23T08:00:00.002Z",
        }),
      },
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });
    const server = createServer({ platform });

    const graded = await server.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      payload: { schemaVersion: 1, commandId: "cmd_grade_http_1" },
    });
    expect(graded.statusCode).toBe(200);
    expect(graded.json()).toMatchObject({
      jobId: "job_cmd_grade_http_1",
      status: "completed",
      report: { verdict: "automated_pass" },
    });

    const dashboard = await server.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboard.json()).toMatchObject({
      conceptStates: { "compile-link-run": "practiced" },
    });

    const job = await server.inject({
      method: "GET",
      url: "/api/v1/jobs/job_cmd_grade_http_1",
    });
    expect(job.json()).toMatchObject({
      report: { verdict: "automated_pass" },
    });

    const stream = await server.inject({
      method: "GET",
      url: "/api/v1/jobs/job_cmd_grade_http_1/events",
    });
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(stream.body).toContain('"type":"judge.queued"');
    expect(stream.body).toContain('"type":"judge.report.ready"');
    await server.close();
  });
});
