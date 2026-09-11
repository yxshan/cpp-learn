import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance, InjectOptions } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type {
  AttemptCompletedEvent,
  LearningBootstrapResult,
  JudgeReport,
  LearningPlatform,
  ReferencePlaygroundRunResult,
} from "@cpp-learn/contracts";
import {
  createNativeJudge,
  type ReferencePlaygroundRunRequest,
} from "@cpp-learn/judge";
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

import { createServer } from "./server.ts";
import { createBoundedJudge, createJudgeAdmission } from "./admission.ts";

/** The per-server token and the exact origin the served application uses. */
const sessionToken = "test_session_token";
const authorizedHeaders = {
  host: "127.0.0.1:4173",
  origin: "http://127.0.0.1:4173",
  "x-cpp-learn-token": sessionToken,
};

/**
 * Inject as the served application would: same origin, same token. Explicit
 * headers still win, so tests that probe a bad origin or a bad token keep
 * controlling exactly what they vary.
 */
const authorizedInject =
  (server: FastifyInstance) => (options: InjectOptions) =>
    server.inject({
      ...options,
      headers: { ...authorizedHeaders, ...(options.headers ?? {}) },
    });

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
    const server = createServer({ sessionToken, platform });

    const response = await authorizedInject(server)({
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
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });

    const navigation = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/reference",
    });
    const search = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/reference/search?q=%E5%8A%A8%E6%80%81%E6%95%B0%E7%BB%84&standard=c%2B%2B20",
    });
    const resolution = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/reference/resolve?slug=library%2Fvector",
    });
    const detail = await authorizedInject(server)({
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
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });
    const invalid = await authorizedInject(readyServer)({
      method: "GET",
      url: "/api/v1/reference/search?q=vector&limit=0",
    });
    const missing = await authorizedInject(readyServer)({
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
      sessionToken,
      platform: createUnusedPlatform(),
      reference: unavailable,
    });
    const degraded = await authorizedInject(degradedServer)({
      method: "GET",
      url: "/api/v1/reference",
    });
    const degradedBootstrap = await authorizedInject(degradedServer)({
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
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
    });

    const repeatedSearch = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/reference/search?q=vector&q=span",
    });
    const repeatedSlug = await authorizedInject(server)({
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
  const runId = "ref_run_00000000-0000-4000-8000-000000000001";

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
      sessionToken,
      platform,
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });

    const source = '#include <iostream>\nint main() { std::cout << "4\\n"; }\n';
    const response = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: {
        schemaVersion: 1,
        runId,
        source,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      verdict: "success",
      stdout: "4\n",
    });
    expect(run).toHaveBeenCalledWith({
      runId,
      entryId: "std-vector",
      exampleId: "basic",
      standard: "c++20",
      snapshot: {
        id: `ref_snapshot_${createHash("sha256").update(source).digest("hex").slice(0, 24)}`,
        digest: createHash("sha256").update(source).digest("hex"),
        source,
      },
      stdin: "",
      signal: expect.any(AbortSignal),
    });
    const runnerRequest = run.mock.calls[0]?.[0] as
      ReferencePlaygroundRunRequest | undefined;
    expect(Object.isFrozen(runnerRequest?.snapshot)).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(platform.query).not.toHaveBeenCalled();
    await server.close();
  });

  it("rejects invalid, oversized, missing, and cross-origin runs before execution", async () => {
    const run = vi.fn();
    const server = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });

    const responses = await Promise.all([
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        payload: { schemaVersion: 1, runId, source: "" },
      }),
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        payload: {
          schemaVersion: 1,
          runId,
          source: "x".repeat(64 * 1024 + 1),
        },
      }),
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/missing/runs",
        payload: { schemaVersion: 1, runId, source: "int main() {}\n" },
      }),
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        headers: { origin: "https://attacker.example" },
        payload: { schemaVersion: 1, runId, source: "int main() {}\n" },
      }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      400, 413, 404, 403,
    ]);
    expect(run).not.toHaveBeenCalled();
    await server.close();
  });

  it("applies back-pressure while the bounded native runner is occupied", async () => {
    let releaseRun: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<ReferencePlaygroundRunResult>((resolve) => {
          releaseRun = () =>
            resolve({
              schemaVersion: 1,
              runId: "ref_run_slow",
              entryId: "std-vector",
              exampleId: "basic",
              verdict: "success",
              stdout: "",
              stderr: "",
              stages: [],
              toolchain: {
                compiler: "clang",
                standard: "c++20",
                flags: ["-std=c++20"],
              },
            });
        }),
    );
    const server = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });
    const payload = { schemaVersion: 1, runId, source: "int main() {}\n" };
    const first = authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: {
        ...payload,
        runId: "ref_run_00000000-0000-4000-8000-000000000002",
      },
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    const rejected = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload,
    });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.headers["retry-after"]).toBe("1");
    expect(rejected.json()).toMatchObject({
      error: { code: "playground_busy" },
    });

    releaseRun?.();
    await expect(first).resolves.toMatchObject({ statusCode: 200 });
    await server.close();
  });

  it("cancels an active run through its client-visible ID", async () => {
    const run = vi.fn(
      ({ signal, ...request }: ReferencePlaygroundRunRequest) =>
        new Promise<ReferencePlaygroundRunResult>((resolve) => {
          signal?.addEventListener(
            "abort",
            () =>
              resolve({
                schemaVersion: 1,
                runId: request.runId,
                entryId: request.entryId,
                exampleId: request.exampleId,
                verdict: "cancelled",
                stdout: "",
                stderr: "",
                stages: [],
                toolchain: {
                  compiler: "clang",
                  standard: request.standard,
                  flags: ["-std=c++20"],
                },
              }),
            { once: true },
          );
        }),
    );
    const server = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run },
    });
    const activeRun = authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: { schemaVersion: 1, runId, source: "int main() {}\n" },
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    const conflictingRun = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: { schemaVersion: 1, runId, source: "int main() {}\n" },
    });
    expect(conflictingRun.statusCode).toBe(409);
    expect(conflictingRun.json()).toMatchObject({
      error: { code: "playground_run_id_conflict" },
    });

    const cancellation = await authorizedInject(server)({
      method: "POST",
      url: `/api/v1/reference/runs/${runId}/cancellations`,
      payload: { schemaVersion: 1 },
    });
    expect(cancellation.statusCode).toBe(200);
    expect(cancellation.json()).toEqual({
      schemaVersion: 1,
      runId,
      cancelled: true,
    });
    await expect(activeRun).resolves.toMatchObject({ statusCode: 200 });
    expect((await activeRun).json()).toMatchObject({ verdict: "cancelled" });

    const completedCancellation = await authorizedInject(server)({
      method: "POST",
      url: `/api/v1/reference/runs/${runId}/cancellations`,
      payload: { schemaVersion: 1 },
    });
    expect(completedCancellation.json()).toMatchObject({ cancelled: false });
    await server.close();

    const restartedServer = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run: vi.fn() },
    });
    const afterRestart = await authorizedInject(restartedServer)({
      method: "POST",
      url: `/api/v1/reference/runs/${runId}/cancellations`,
      payload: { schemaVersion: 1 },
    });
    expect(afterRestart.json()).toMatchObject({ cancelled: false });
    await restartedServer.close();
  });

  it("reserves the run identity before asynchronous Reference lookup", async () => {
    const baseReference = createReferenceFixture();
    let releaseReadiness: (() => void) | undefined;
    const readiness = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<typeof baseReference.readiness>>>(
          (resolve) => {
            releaseReadiness = () =>
              void baseReference.readiness().then(resolve);
          },
        ),
    );
    const run = vi.fn(
      ({ signal, ...request }: ReferencePlaygroundRunRequest) =>
        new Promise<ReferencePlaygroundRunResult>((resolve) => {
          const finish = () =>
            resolve({
              schemaVersion: 1,
              runId: request.runId,
              entryId: request.entryId,
              exampleId: request.exampleId,
              verdict: "cancelled",
              stdout: "",
              stderr: "",
              stages: [],
              toolchain: {
                compiler: "clang",
                standard: request.standard,
                flags: ["-std=c++20"],
              },
            });
          if (signal?.aborted) finish();
          else signal?.addEventListener("abort", finish, { once: true });
        }),
    );
    const server = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: { ...baseReference, readiness },
      referencePlayground: { run },
    });
    const activeRun = authorizedInject(server)({
      method: "POST",
      url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
      payload: { schemaVersion: 1, runId, source: "int main() {}\n" },
    });
    await vi.waitFor(() => expect(readiness).toHaveBeenCalledTimes(1));

    const cancellation = await authorizedInject(server)({
      method: "POST",
      url: `/api/v1/reference/runs/${runId}/cancellations`,
      payload: { schemaVersion: 1 },
    });
    expect(cancellation.json()).toMatchObject({ cancelled: true });
    releaseReadiness?.();
    await expect(activeRun).resolves.toMatchObject({ statusCode: 200 });
    expect((await activeRun).json()).toMatchObject({ verdict: "cancelled" });
    await server.close();
  });

  it("rejects invalid and cross-origin cancellation requests", async () => {
    const server = createServer({
      sessionToken,
      platform: createUnusedPlatform(),
      reference: createReferenceFixture(),
      referencePlayground: { run: vi.fn() },
    });
    const responses = await Promise.all([
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/runs/not-a-run/cancellations",
        payload: { schemaVersion: 1 },
      }),
      authorizedInject(server)({
        method: "POST",
        url: `/api/v1/reference/runs/${runId}/cancellations`,
        payload: { schemaVersion: 1, unexpected: true },
      }),
      authorizedInject(server)({
        method: "POST",
        url: `/api/v1/reference/runs/${runId}/cancellations`,
        headers: { origin: "https://attacker.example" },
        payload: { schemaVersion: 1 },
      }),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      400, 400, 403,
    ]);
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
    const server = createServer({ sessionToken, platform, webRoot });

    const response = await authorizedInject(server)({
      method: "GET",
      url: "/",
    });
    const referenceDeepLink = await authorizedInject(server)({
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
    const server = createServer({ sessionToken, platform });

    const response = await authorizedInject(server)({
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
    const server = createServer({ sessionToken, platform });

    const response = await authorizedInject(server)({
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
    const server = createServer({ sessionToken, platform });

    const opened = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/workspaces/first-program",
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toMatchObject({ workspace: { revision: 0 } });

    const saved = await authorizedInject(server)({
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

    const conflict = await authorizedInject(server)({
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

    const rejectedOrigin = await authorizedInject(server)({
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
    const server = createServer({ sessionToken, platform });

    const hint = await authorizedInject(server)({
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
    const reflection = await authorizedInject(server)({
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
    const progress = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/progress",
    });
    const reviews = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/reviews/due",
    });
    const teacherPack = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/teacher-packs",
      payload: {
        schemaVersion: 1,
        commandId: "cmd_pack_http",
        activityId: "source-to-program",
        attemptId: "attempt_http",
      },
    });
    const observation = await authorizedInject(server)({
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

describe("[SEC-F02] one host Judge budget across HTTP entry points", () => {
  it("shares the budget between Activity Run and the Reference Playground", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 1 });
    const started: string[] = [];
    let openGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const report = (request: {
      readonly jobId: string;
      readonly mode: "run" | "grade";
      readonly snapshot: { readonly id: string; readonly digest: string };
    }): JudgeReport => ({
      schemaVersion: 1,
      reportId: `report_${request.jobId}`,
      jobId: request.jobId,
      mode: request.mode,
      activity: { id: "source-to-program", version: 1, judgeVersion: 1 },
      source: {
        snapshotId: request.snapshot.id,
        digest: request.snapshot.digest,
      },
      toolchain: { compiler: "clang", standard: "c++20" },
      verdict: "automated_pass",
      stages: [
        { kind: "compile", outcome: "pass", durationMs: 1 },
        { kind: "test", outcome: "pass", durationMs: 1 },
      ],
      startedAt: "2026-08-23T08:00:00.000Z",
      completedAt: "2026-08-23T08:00:00.002Z",
    });
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
      judge: createBoundedJudge(
        {
          execute: async (request) => {
            started.push(request.jobId);
            await gate;
            return report(request);
          },
        },
        admission,
      ),
      record: {
        append: async (event) => {
          events.push(event);
        },
        list: async () => events,
      },
    });
    const playgroundRun = vi.fn(
      async (request: ReferencePlaygroundRunRequest) => ({
        schemaVersion: 1 as const,
        runId: request.runId,
        entryId: request.entryId,
        exampleId: request.exampleId,
        verdict: "success" as const,
        stdout: "",
        stderr: "",
        stages: [],
        toolchain: {
          compiler: "clang",
          standard: request.standard,
          flags: ["-std=c++20"],
        },
      }),
    );
    const server = createServer({
      sessionToken,
      platform,
      reference: createReferenceFixture(),
      referencePlayground: { run: playgroundRun },
      judgeAdmission: admission,
    });
    const grade = (commandId: string) =>
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/activities/source-to-program/grades",
        payload: { schemaVersion: 1, commandId },
      });
    const playground = (runIdSuffix: string) =>
      authorizedInject(server)({
        method: "POST",
        url: "/api/v1/reference/entries/std-vector/examples/basic/runs",
        payload: {
          schemaVersion: 1,
          runId: `ref_run_00000000-0000-4000-8000-00000000000${runIdSuffix}`,
          source: "int main() {}\n",
        },
      });

    // An Activity Grade takes the only slot.
    const running = grade("cmd_budget_1");
    await vi.waitFor(() => expect(started).toEqual(["job_cmd_budget_1"]));

    // The Playground must not start a second native compilation.
    const busyPlayground = await playground("1");
    expect(busyPlayground.statusCode).toBe(429);
    expect(busyPlayground.headers["retry-after"]).toBe("1");
    expect(busyPlayground.json()).toMatchObject({
      error: { code: "playground_busy" },
    });
    expect(playgroundRun).not.toHaveBeenCalled();

    // The wait queue is bounded: one Grade waits, the next is rejected. Wait for
    // the first to actually join the queue so the two requests cannot race for
    // the single waiting place.
    const queued = grade("cmd_budget_2");
    await vi.waitFor(() => expect(admission.queuedCount).toBe(1));
    const overflow = await grade("cmd_budget_3");
    expect(overflow.statusCode).toBe(429);
    expect(overflow.headers["retry-after"]).toBe("1");
    expect(overflow.json()).toMatchObject({ error: { code: "judge_busy" } });

    // Overload must not blind the server to ordinary traffic.
    const health = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(health.statusCode).toBe(200);
    const dashboard = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboard.statusCode).toBe(200);

    // Releasing the slot drains the queue and returns the budget to normal.
    openGate?.();
    await expect(running).resolves.toMatchObject({ statusCode: 200 });
    await expect(queued).resolves.toMatchObject({ statusCode: 200 });
    expect(started).toEqual(["job_cmd_budget_1", "job_cmd_budget_2"]);
    expect(admission.activeCount).toBe(0);
    expect(admission.queuedCount).toBe(0);

    const acceptedPlayground = await playground("2");
    expect(acceptedPlayground.statusCode).toBe(200);
    expect(playgroundRun).toHaveBeenCalledTimes(1);

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
    const server = createServer({ sessionToken, platform });

    const rejectedOrigin = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      headers: { origin: "https://attacker.example" },
      payload: { schemaVersion: 1, commandId: "cmd_cross_origin_grade" },
    });
    expect(rejectedOrigin.statusCode).toBe(403);

    const graded = await authorizedInject(server)({
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

    const dashboard = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboard.json()).toMatchObject({
      conceptStates: { "compile-link-run": "practiced" },
    });

    const job = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/jobs/job_cmd_grade_http_1",
    });
    expect(job.json()).toMatchObject({
      report: { verdict: "automated_pass" },
    });

    const stream = await authorizedInject(server)({
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
    const server = createServer({ sessionToken, platform });

    const response = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/jobs/job_active/cancellations",
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
    const server = createServer({ sessionToken, platform });

    const crashed = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/activities/crash-profile/grades",
      payload: { schemaVersion: 1, commandId: "cmd_crashed_worker" },
    });
    expect(crashed.statusCode).toBe(200);
    expect(crashed.json()).toMatchObject({
      report: { verdict: "judge_system_error" },
    });
    const dashboardAfterCrash = await authorizedInject(server)({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboardAfterCrash.json()).toMatchObject({ conceptStates: {} });
    await expect(
      authorizedInject(server)({ method: "GET", url: "/api/v1/health" }),
    ).resolves.toMatchObject({ statusCode: 200 });

    const recovered = await authorizedInject(server)({
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

    const firstServer = createServer({
      sessionToken,
      platform: await createPlatform(),
    });
    const graded = await authorizedInject(firstServer)({
      method: "POST",
      url: "/api/v1/activities/source-to-program/grades",
      payload: { schemaVersion: 1, commandId: "cmd_restart_grade" },
    });
    expect(graded.statusCode).toBe(200);
    const jobId = (graded.json() as { jobId: string }).jobId;
    await firstServer.close();

    const restartedServer = createServer({
      sessionToken,
      platform: await createPlatform(),
    });
    const dashboard = await authorizedInject(restartedServer)({
      method: "GET",
      url: "/api/v1/dashboard",
    });
    expect(dashboard.json()).toMatchObject({
      attempts: [{ mode: "grade", jobId, verdict: "automated_pass" }],
      conceptStates: { "compile-link-run": "practiced" },
    });
    const recoveredJob = await authorizedInject(restartedServer)({
      method: "GET",
      url: `/api/v1/jobs/${jobId}`,
    });
    expect(recoveredJob.json()).toMatchObject({
      report: { jobId, verdict: "automated_pass" },
    });
    const replayed = await authorizedInject(restartedServer)({
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
    const server = createServer({ sessionToken, platform, archive });

    const exported = await authorizedInject(server)({
      method: "POST",
      url: "/api/v1/exports",
      payload: { schemaVersion: 1, commandId: "cmd_export_http" },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-disposition"]).toContain("attachment");
    expect(exported.body).not.toContain("privateTests");

    await writeFile(join(workspaceRoot, "main.cpp"), "damaged\n", "utf8");
    const rejected = await authorizedInject(server)({
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
    const restored = await authorizedInject(server)({
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
      sessionToken,
      platform,
      archive: { exportTo: vi.fn(), restoreFrom },
    });

    const response = await authorizedInject(server)({
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

describe("[SEC-F05] mutation authorization", () => {
  /** Exactly what the served application sends: own origin plus the token. */
  const baseHeaders = (token: string): Record<string, string> => ({
    host: "127.0.0.1:4173",
    origin: "http://127.0.0.1:4173",
    "x-cpp-learn-token": token,
  });

  const cancelUrl = "/api/v1/jobs/job_active/cancellations";
  const cancelBody = { schemaVersion: 1, commandId: "cmd_authorized" };

  function createSpyServer(sessionToken = "spy_session_token") {
    const dispatched: unknown[] = [];
    const platform: LearningPlatform = {
      dispatch: vi.fn(async (command: unknown) => {
        dispatched.push(command);
        return {
          schemaVersion: 1,
          commandId: "cmd_authorized",
          jobId: "job_active",
          cancelled: true,
        };
      }) as unknown as LearningPlatform["dispatch"],
      query: vi.fn(async () => ({
        schemaVersion: 1,
        ready: true,
        services: {},
      })) as unknown as LearningPlatform["query"],
      async *events() {},
    };
    return {
      dispatched,
      server: createServer({ platform, sessionToken }),
      sessionToken,
    };
  }

  it("accepts a mutation from the served origin that carries the token", async () => {
    const { dispatched, server, sessionToken } = createSpyServer();
    const response = await server.inject({
      method: "POST",
      url: cancelUrl,
      headers: baseHeaders(sessionToken),
      payload: cancelBody,
    });

    expect(response.statusCode).toBe(200);
    expect(dispatched).toHaveLength(1);
    await server.close();
  });

  it("refuses every request that cannot prove it came from the application", async () => {
    const { dispatched, server, sessionToken } = createSpyServer();
    const base = baseHeaders(sessionToken);
    const cases: readonly {
      readonly name: string;
      readonly headers: Record<string, string>;
      readonly code: string;
    }[] = [
      {
        name: "a missing Origin",
        headers: { host: base["host"]!, "x-cpp-learn-token": sessionToken },
        code: "origin_rejected",
      },
      {
        name: "a null Origin",
        headers: { ...base, origin: "null" },
        code: "origin_rejected",
      },
      {
        name: "another loopback port",
        headers: { ...base, origin: "http://127.0.0.1:3000" },
        code: "origin_rejected",
      },
      {
        name: "another scheme on the same host",
        headers: { ...base, origin: "https://127.0.0.1:4173" },
        code: "origin_rejected",
      },
      {
        name: "a non-loopback Host",
        headers: {
          ...base,
          host: "evil.example",
          origin: "http://evil.example",
        },
        code: "host_rejected",
      },
      {
        name: "a missing token",
        headers: { host: base["host"]!, origin: base["origin"]! },
        code: "token_rejected",
      },
      {
        name: "a wrong token",
        headers: { ...base, "x-cpp-learn-token": "not-the-token" },
        code: "token_rejected",
      },
      {
        name: "a token that only shares a prefix",
        headers: { ...base, "x-cpp-learn-token": sessionToken.slice(0, 8) },
        code: "token_rejected",
      },
      {
        name: "a cross-site initiator",
        headers: { ...base, "sec-fetch-site": "cross-site" },
        code: "cross_site_rejected",
      },
    ];

    for (const probe of cases) {
      const response = await server.inject({
        method: "POST",
        url: cancelUrl,
        headers: probe.headers,
        payload: cancelBody,
      });
      expect(
        {
          name: probe.name,
          status: response.statusCode,
          code: (response.json() as { error?: { code?: string } }).error?.code,
        },
        probe.name,
      ).toEqual({ name: probe.name, status: 403, code: probe.code });
    }

    expect(dispatched).toHaveLength(0);
    await server.close();
  });

  it("keeps reads available without a token", async () => {
    const { server } = createSpyServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it("sets the hardening headers on every reply", async () => {
    const { server } = createSpyServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    });
    const reportOnly = String(
      response.headers["content-security-policy-report-only"],
    );
    expect(reportOnly).toContain("default-src 'self'");
    expect(reportOnly).toContain("object-src 'none'");
    // The enforcing CSP is deliberately absent until the report-only policy has
    // been validated against Monaco's workers and Vite's asset graph.
    expect(response.headers["content-security-policy"]).toBeUndefined();
    await server.close();
  });

  it("publishes the token to the application and only then stops repeating it", async () => {
    const { server, sessionToken } = createSpyServer();
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: { host: "127.0.0.1:4173" },
    });
    const cookie = first.headers["set-cookie"];

    expect(cookie).toContain(`cpp_learn_session=${sessionToken}`);
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    // `HttpOnly` is a flag: its mere presence hides the cookie from
    // `document.cookie`, which would break every mutation in a browser.
    expect(cookie).not.toContain("HttpOnly");

    const second = await server.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: {
        host: "127.0.0.1:4173",
        cookie: `cpp_learn_session=${sessionToken}`,
      },
    });
    expect(second.headers["set-cookie"]).toBeUndefined();

    // A fingerprinted asset response does not need the cookie at all.
    const asset = await server.inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { host: "127.0.0.1:4173" },
    });
    expect(asset.headers["set-cookie"]).toBeUndefined();
    await server.close();
  });
});
