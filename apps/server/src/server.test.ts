import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  AttemptCompletedEvent,
  LearningBootstrapResult,
  JudgeReport,
  LearningPlatform,
} from "@cpp-learn/contracts";
import { createNativeJudge } from "@cpp-learn/judge";
import {
  createJsonlLearningRecord,
  createLocalDataArchive,
} from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import {
  createInMemoryReferenceCatalog,
  type ReferenceEntryManifest,
} from "@cpp-learn/reference";
import {
  createFilesystemWorkspace,
  createInMemoryWorkspace,
} from "@cpp-learn/workspace";

import { createServer } from "./server.js";

const bootstrap: LearningBootstrapResult = {
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

function createReferenceFixture() {
  const vector: ReferenceEntryManifest = {
    schemaVersion: 2,
    id: "std-vector",
    version: 1,
    slug: "standard-library/containers/vector",
    kind: "type",
    title: "std::vector",
    summary: "连续存储的动态数组容器。",
    symbol: "std::vector",
    header: "<vector>",
    namespace: "std",
    since: "c++98",
    aliases: ["动态数组", "vector"],
    categories: ["containers"],
    relatedEntryIds: [],
    content: { format: "markdown", path: "entries/std-vector/content.md" },
    examples: [
      {
        id: "basic",
        path: "entries/std-vector/basic.cpp",
        kind: "run",
        standard: "c++20",
        expectedStdout: "3\n",
      },
    ],
    sources: [
      {
        kind: "primary",
        title: "C++ working draft",
        url: "https://eel.is/c++draft/vector",
      },
    ],
    verifiedAt: "2026-08-25",
  };
  return createInMemoryReferenceCatalog({
    catalog: {
      schemaVersion: 1,
      version: 1,
      entries: ["entries/std-vector/entry.json"],
      categories: [{ id: "containers", title: "容器", order: 10 }],
      redirects: [{ fromSlug: "library/vector", toEntryId: "std-vector" }],
    },
    entries: [vector],
    files: {
      "entries/std-vector/content.md": "# std::vector\n",
      "entries/std-vector/basic.cpp":
        '#include <iostream>\nint main() { std::cout << "3\\n"; }\n',
    },
  });
}

function createUnusedPlatform(): LearningPlatform {
  return {
    async dispatch() {
      throw new Error("No commands in this fixture");
    },
    async *events() {},
    query: vi.fn().mockResolvedValue(bootstrap),
  } as unknown as LearningPlatform;
}

describe("[T-CONTRACT-001] HTTP bootstrap Adapter", () => {
  it("augments the shared LearningPlatform result with Reference readiness", async () => {
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
    expect(response.json()).toEqual({
      ...bootstrap,
      services: {
        ...bootstrap.services,
        reference: {
          ready: false,
          issueCodes: ["catalog_missing"],
        },
      },
    });
    expect(platform.query).toHaveBeenCalledWith({ type: "bootstrap.get" });
    await server.close();
  });
});

describe("[T-REF-005] HTTP Reference Adapter", () => {
  it("serves navigation, search, slug resolution, and Entry detail through shared DTOs", async () => {
    const server = createServer({
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });

    const navigation = await server.inject({
      method: "GET",
      url: "/api/v1/reference",
    });
    const search = await server.inject({
      method: "GET",
      url: "/api/v1/reference/search?q=%E5%8A%A8%E6%80%81%E6%95%B0%E7%BB%84&standard=c%2B%2B20",
    });
    const resolution = await server.inject({
      method: "GET",
      url: "/api/v1/reference/resolve?slug=library%2Fvector",
    });
    const detail = await server.inject({
      method: "GET",
      url: "/api/v1/reference/entries/std-vector",
    });

    expect(navigation.statusCode).toBe(200);
    expect(navigation.json()).toMatchObject({
      schemaVersion: 2,
      categories: [{ id: "containers", entryIds: ["std-vector"] }],
    });
    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject({
      schemaVersion: 2,
      results: [{ id: "std-vector" }],
    });
    expect(resolution.json()).toEqual({
      schemaVersion: 2,
      entryId: "std-vector",
      canonicalSlug: "standard-library/containers/vector",
      redirected: true,
    });
    expect(detail.json()).toMatchObject({
      schemaVersion: 2,
      id: "std-vector",
      content: "# std::vector\n",
    });
    expect(detail.body).not.toContain("entries/std-vector");
    await server.close();
  });

  it("returns deterministic validation, not-found, and degraded responses", async () => {
    const readyServer = createServer({
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });
    const invalid = await readyServer.inject({
      method: "GET",
      url: "/api/v1/reference/search?q=vector&limit=0",
    });
    const missing = await readyServer.inject({
      method: "GET",
      url: "/api/v1/reference/entries/missing-entry",
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({
      error: { code: "validation_error" },
    });
    expect(missing.statusCode).toBe(404);
    await readyServer.close();

    const unavailable = createInMemoryReferenceCatalog({
      catalog: {
        schemaVersion: 1,
        version: 1,
        entries: ["entries/missing/entry.json"],
        categories: [{ id: "library", title: "标准库", order: 1 }],
        redirects: [],
      },
      entries: [],
      files: {},
    });
    const degradedServer = createServer({
      platform: createUnusedPlatform(),
      reference: unavailable,
    });
    const degraded = await degradedServer.inject({
      method: "GET",
      url: "/api/v1/reference",
    });
    const degradedBootstrap = await degradedServer.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
    });

    expect(degraded.statusCode).toBe(503);
    expect(degraded.json()).toEqual({
      schemaVersion: 1,
      error: { code: "reference_unavailable" },
      readiness: {
        ready: false,
        issueCodes: ["catalog_invalid"],
      },
    });
    expect(degradedBootstrap.json()).toMatchObject({
      ready: true,
      services: {
        reference: {
          ready: false,
          issueCodes: ["catalog_invalid"],
        },
      },
    });
    await degradedServer.close();
  });

  it("rejects repeated scalar search and slug parameters with 400", async () => {
    const server = createServer({
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });

    const repeatedSearch = await server.inject({
      method: "GET",
      url: "/api/v1/reference/search?q=vector&q=span",
    });
    const repeatedSlug = await server.inject({
      method: "GET",
      url: "/api/v1/reference/resolve?slug=library%2Fvector&slug=old%2Fvector",
    });

    expect(repeatedSearch.statusCode).toBe(400);
    expect(repeatedSearch.json()).toMatchObject({
      error: { code: "validation_error" },
    });
    expect(repeatedSlug.statusCode).toBe(400);
    expect(repeatedSlug.json()).toMatchObject({
      error: { code: "validation_error" },
    });
    await server.close();
  });
});

describe("[T-REF-009] HTTP Reference Playground Adapter", () => {
  it("runs a published example without dispatching a learning command", async () => {
    const platform = createUnusedPlatform();
    const dispatch = vi.spyOn(platform, "dispatch");
    const run = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      runId: "ref_run_test",
      entryId: "std-vector",
      exampleId: "basic",
      verdict: "success",
      stdout: "4\n",
      stderr: "",
      stages: [],
      toolchain: {
        compiler: "Apple Clang 15",
        standard: "c++20",
        flags: ["-std=c++20"],
      },
    });
    const server = createServer({
      platform,
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: {
        schemaVersion: 1,
        source: '#include <iostream>\nint main() { std::cout << "4\\n"; }\n',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      verdict: "success",
      stdout: "4\n",
    });
    expect(run).toHaveBeenCalledWith({
      runId: expect.stringMatching(/^ref_run_/),
      entryId: "std-vector",
      exampleId: "basic",
      standard: "c++20",
      source: expect.stringContaining('std::cout << "4\\n"'),
      stdin: "",
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(platform.query).not.toHaveBeenCalled();
    await server.close();
  });

  it("rejects invalid, oversized, missing, and cross-origin runs before execution", async () => {
    const run = vi.fn();
    const server = createServer({
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });

    const responses = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        payload: { schemaVersion: 1, source: "" },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        payload: { schemaVersion: 1, source: "x".repeat(64 * 1024 + 1) },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/missing/runs",
        payload: { schemaVersion: 1, source: "int main() {}\n" },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        headers: { origin: "https://attacker.example" },
        payload: { schemaVersion: 1, source: "int main() {}\n" },
      }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      400, 413, 404, 403,
    ]);
    expect(run).not.toHaveBeenCalled();
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
    const referenceDeepLink = await server.inject({
      method: "GET",
      url: "/reference/standard-library/containers/vector?q=vector#complexity",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("C++ Learn");
    expect(referenceDeepLink.statusCode).toBe(200);
    expect(referenceDeepLink.body).toContain("C++ Learn");
    await server.close();
    await rm(webRoot, { recursive: true, force: true });
  });
});

describe("[T-CONTRACT-002] HTTP Activity Adapter", () => {
  it("lists Track Activities without lesson bodies or reference solutions", async () => {
    const result = {
      schemaVersion: 1 as const,
      activities: [
        {
          id: "source-to-program",
          version: 1,
          kind: "lesson" as const,
          title: "从源代码到可执行程序",
          estimatedMinutes: 35,
          conceptIds: ["compile-link-run"],
          prerequisiteIds: [],
        },
      ],
    };
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No commands in this fixture");
      },
      async *events() {},
      query: vi.fn().mockResolvedValue(result),
    };
    const server = createServer({ platform });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/activities",
    });

    expect(response.json()).toEqual(result);
    expect(response.body).not.toContain("referenceFiles");
    expect(platform.query).toHaveBeenCalledWith({ type: "activities.list" });
    await server.close();
  });

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

    const rejectedOrigin = await server.inject({
      method: "PATCH",
      url: "/api/v1/workspaces/first-program",
      headers: { origin: "https://attacker.example" },
      payload: {
        schemaVersion: 1,
        commandId: "cmd_cross_origin",
        baseRevision: 1,
        changes: [{ path: "main.cpp", content: "attacker\n" }],
      },
    });
    expect(rejectedOrigin.statusCode).toBe(403);
    expect(rejectedOrigin.json()).toMatchObject({
      error: { code: "origin_rejected" },
    });
    await server.close();
  });
});

describe("[T-CONTRACT-005] HTTP learning-loop Adapters", () => {
  it("maps hints, reflections, progress, Review Queue, and Teacher collaboration", async () => {
    const dispatch = vi
      .fn()
      .mockResolvedValue({ schemaVersion: 1, accepted: true });
    const query = vi.fn().mockResolvedValue({ schemaVersion: 1, reviews: [] });
    const platform = {
      dispatch,
      query,
      async *events() {},
    } as unknown as LearningPlatform;
    const server = createServer({ platform });

    const hint = await server.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/hints",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_hint_http",
        attemptId: "attempt_http",
        hintId: "locate-entry",
        confirmFullSolution: false,
      },
    });
    const reflection = await server.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/reflections",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_reflection_http",
        attemptId: "attempt_http",
        answers: [
          { promptId: "compile-versus-run", answer: "Build then run." },
        ],
      },
    });
    const progress = await server.inject({
      method: "GET",
      url: "/api/v1/progress",
    });
    const reviews = await server.inject({
      method: "GET",
      url: "/api/v1/reviews/due",
    });
    const teacherPack = await server.inject({
      method: "POST",
      url: "/api/v1/teacher-packs",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_pack_http",
        activityId: "source-to-program",
        attemptId: "attempt_http",
      },
    });
    const observation = await server.inject({
      method: "POST",
      url: "/api/v1/teacher-observations",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_observation_http",
        observationId: "observation_http",
        activityId: "source-to-program",
        attemptId: "attempt_http",
        rubricId: "compile-run-explanation",
        outcome: "pass",
        summary: "The explanation distinguishes the two stages.",
      },
    });

    for (const response of [
      hint,
      reflection,
      progress,
      reviews,
      teacherPack,
      observation,
    ]) {
      expect(response.statusCode).toBe(200);
    }
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hint.reveal",
        attemptId: "attempt_http",
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reflection.submit" }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "teacher-pack.create" }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "teacher-observation.submit" }),
    );
    expect(query).toHaveBeenCalledWith({ type: "progress.get" });
    expect(query).toHaveBeenCalledWith({ type: "reviews.get", dueOnly: true });
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

    const rejectedOrigin = await server.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      headers: { origin: "https://attacker.example" },
      payload: { schemaVersion: 1, commandId: "cmd_cross_origin_grade" },
    });
    expect(rejectedOrigin.statusCode).toBe(403);

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

  it("maps a loopback cancellation request to the shared command contract", async () => {
    const dispatched: unknown[] = [];
    const platform: LearningPlatform = {
      dispatch: (async (command: unknown) => {
        dispatched.push(command);
        return {
          schemaVersion: 1,
          commandId: "cmd_cancel_http",
          jobId: "job_active",
          cancelled: true,
        };
      }) as LearningPlatform["dispatch"],
      async *events() {},
      query: vi.fn(),
    };
    const server = createServer({ platform });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/jobs/job_active/cancellations",
      headers: { origin: "http://127.0.0.1:3000" },
      payload: { schemaVersion: 1, commandId: "cmd_cancel_http" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schemaVersion: 1,
      commandId: "cmd_cancel_http",
      jobId: "job_active",
      cancelled: true,
    });
    expect(dispatched).toEqual([
      {
        type: "job.cancel",
        commandId: "cmd_cancel_http",
        jobId: "job_active",
      },
    ]);
    await server.close();
  });

  it("keeps serving after a Judge runner crash without creating false Evidence", async () => {
    const events: AttemptCompletedEvent[] = [];
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
    const workspace = createInMemoryWorkspace([
      {
        activityId: "crash-profile",
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
          id: "crash-profile",
          version: 1,
          kind: "exercise",
          title: "Crash profile",
          estimatedMinutes: 10,
          conceptIds: ["worker-isolation"],
          markdown: "",
          workspace: { editablePaths: ["main.cpp"] },
        }),
        getJudge: async () => ({
          activityId: "crash-profile",
          activityVersion: 1,
          judgeVersion: 1,
          expectedStdout: "ok\n",
          timeoutMs: 2_000,
        }),
      },
      workspace,
      judge: createNativeJudge({ run }),
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });
    const server = createServer({ platform });

    const crashed = await server.inject({
      method: "POST",
      url: "/api/v1/activities/crash-profile/grades",
      payload: { schemaVersion: 1, commandId: "cmd_crashed_worker" },
    });
    expect(crashed.statusCode).toBe(200);
    expect(crashed.json()).toMatchObject({
      report: { verdict: "judge_system_error" },
    });
    const dashboardAfterCrash = await server.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboardAfterCrash.json()).toMatchObject({ conceptStates: {} });
    await expect(
      server.inject({ method: "GET", url: "/api/v1/health" }),
    ).resolves.toMatchObject({ statusCode: 200 });

    const recovered = await server.inject({
      method: "POST",
      url: "/api/v1/activities/crash-profile/grades",
      payload: { schemaVersion: 1, commandId: "cmd_recovered_worker" },
    });
    expect(recovered.json()).toMatchObject({
      report: { verdict: "automated_pass" },
    });
    await server.close();
  });
});

describe("[T-RECORD-001] Grade recovery through a server restart", () => {
  it("recreates Platform Adapters and restores dashboard and Job Report history", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-restart-"));
    const eventsRoot = join(root, "events");
    const workspaceRoot = join(root, "workspaces");
    let judgeExecutions = 0;
    const createPlatform = async () => {
      const events = createJsonlLearningRecord({ dataRoot: eventsRoot });
      await events.initialize();
      const workspace = createFilesystemWorkspace({
        workspaceRoot,
        activities: [
          {
            activityId: "source-to-program",
            editablePaths: ["main.cpp"],
            starterFiles: { "main.cpp": "int main() {}\n" },
          },
        ],
      });
      return createLearningPlatform({
        clock: () => new Date("2026-08-23T08:00:00.000Z"),
        probes: {
          curriculum: async () => ({ ready: true, activityCount: 1 }),
          toolchain: async () => ({ ready: true, compiler: "clang" }),
          record: () => events.readiness(),
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
          execute: async ({ jobId, mode, snapshot }): Promise<JudgeReport> => {
            judgeExecutions += 1;
            return {
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
            };
          },
        },
        record: events,
      });
    };

    const firstServer = createServer({ platform: await createPlatform() });
    const graded = await firstServer.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      payload: { schemaVersion: 1, commandId: "cmd_restart_grade" },
    });
    expect(graded.statusCode).toBe(200);
    const jobId = (graded.json() as { jobId: string }).jobId;
    await firstServer.close();

    const restartedServer = createServer({ platform: await createPlatform() });
    const dashboard = await restartedServer.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboard.json()).toMatchObject({
      attempts: [{ mode: "grade", jobId, verdict: "automated_pass" }],
      conceptStates: { "compile-link-run": "practiced" },
    });
    const recoveredJob = await restartedServer.inject({
      method: "GET",
      url: `/api/v1/jobs/${jobId}`,
    });
    expect(recoveredJob.json()).toMatchObject({
      report: { jobId, verdict: "automated_pass" },
    });
    const replayed = await restartedServer.inject({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      payload: { schemaVersion: 1, commandId: "cmd_restart_grade" },
    });
    expect(replayed.json()).toMatchObject({
      jobId,
      report: { jobId, verdict: "automated_pass" },
    });
    expect(judgeExecutions).toBe(1);
    await restartedServer.close();
    await rm(root, { recursive: true, force: true });
  });
});

describe("[T-DATA-002] HTTP backup and restore Adapters", () => {
  it("exports only scoped local data and requires explicit restore confirmation", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-http-backup-"));
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    await writeFile(join(root, "placeholder"), "", "utf8");
    const record = createJsonlLearningRecord({ dataRoot });
    await record.initialize();
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(join(workspaceRoot, "main.cpp"), "original\n", "utf8");
    const archive = createLocalDataArchive({ dataRoot, workspaceRoot });
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No learning commands in this fixture");
      },
      async *events() {},
      query: vi.fn(),
    };
    const server = createServer({ platform, archive });

    const exported = await server.inject({
      method: "POST",
      url: "/api/v1/exports",
      payload: { schemaVersion: 1, commandId: "cmd_export_http" },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-disposition"]).toContain("attachment");
    expect(exported.body).not.toContain("privateTests");

    await writeFile(join(workspaceRoot, "main.cpp"), "damaged\n", "utf8");
    const rejected = await server.inject({
      method: "POST",
      url: "/api/v1/restores",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_restore_rejected",
        confirm: false,
        archive: exported.json(),
      },
    });
    expect(rejected.statusCode).toBe(400);
    const restored = await server.inject({
      method: "POST",
      url: "/api/v1/restores",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_restore_http",
        confirm: true,
        archive: exported.json(),
      },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({
      restoredFiles: expect.any(Number),
    });
    await expect(
      readFile(join(workspaceRoot, "main.cpp"), "utf8"),
    ).resolves.toBe("original\n");
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it("accepts a valid restore request larger than Fastify's 1 MiB default", async () => {
    const platform: LearningPlatform = {
      async dispatch() {
        throw new Error("No learning commands in this fixture");
      },
      async *events() {},
      query: vi.fn(),
    };
    const restoreFrom = vi
      .fn()
      .mockResolvedValue({ schemaVersion: 1, restoredFiles: 1 });
    const server = createServer({
      platform,
      archive: { exportTo: vi.fn(), restoreFrom },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/restores",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_large_restore",
        confirm: true,
        archive: { schemaVersion: 1, payload: "x".repeat(1_100_000) },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(restoreFrom).toHaveBeenCalledOnce();
    await server.close();
  });
});
