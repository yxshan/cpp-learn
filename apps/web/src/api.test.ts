import { describe, expect, it, vi } from "vitest";

import type { BootstrapResult } from "@cpp-learn/contracts";

import {
  cancelJob,
  executeActivity,
  exportBackup,
  getActivities,
  getActivity,
  getBootstrap,
  getDashboard,
  getProgress,
  getReferenceEntry,
  getReferenceNavigation,
  resolveReferenceSlug,
  searchReference,
  getReviews,
  getWorkspace,
  revealHint,
  saveWorkspace,
  restoreBackup,
  submitReflection,
} from "./api.js";

const bootstrap: BootstrapResult = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T08:00:00.000Z",
  ready: true,
  services: {
    curriculum: { ready: true, activityCount: 1 },
    toolchain: { ready: true, compiler: "Apple Clang 15" },
    record: { ready: true },
    reference: {
      ready: true,
      catalogVersion: 1,
      entryCount: 5,
      activationDurationMs: 12,
    },
  },
};

describe("[T-CONTRACT-001] Web bootstrap Adapter", () => {
  it("loads the shared bootstrap DTO from the versioned API", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(bootstrap), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(getBootstrap(request)).resolves.toEqual(bootstrap);
    expect(request).toHaveBeenCalledWith("/api/v1/bootstrap", {
      headers: { accept: "application/json" },
    });
  });

  it("rejects a versioned payload that does not satisfy the transport schema", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: 1, ready: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(getBootstrap(request)).rejects.toThrow(
      "Bootstrap response violates the transport contract",
    );
  });

  it("rejects a public bootstrap response that omits Reference readiness", async () => {
    const services = {
      curriculum: bootstrap.services.curriculum,
      toolchain: bootstrap.services.toolchain,
      record: bootstrap.services.record,
    };
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...bootstrap, services }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(getBootstrap(request)).rejects.toThrow(
      "Bootstrap response violates the transport contract",
    );
  });

  it("rejects successful Reference readiness without activation metrics", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...bootstrap,
          services: {
            ...bootstrap.services,
            reference: { ready: true },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(getBootstrap(request)).rejects.toThrow(
      "Bootstrap response violates the transport contract",
    );
  });

  it("rejects Reference readiness that mixes success and failure fields", async () => {
    const contradictoryStates = [
      {
        ready: true,
        catalogVersion: 1,
        entryCount: 5,
        activationDurationMs: 12,
        issueCodes: ["catalog_invalid"],
      },
      {
        ready: false,
        issueCodes: ["catalog_invalid"],
        catalogVersion: 1,
        entryCount: 5,
        activationDurationMs: 12,
      },
    ];

    for (const reference of contradictoryStates) {
      const request = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...bootstrap,
            services: { ...bootstrap.services, reference },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

      await expect(getBootstrap(request)).rejects.toThrow(
        "Bootstrap response violates the transport contract",
      );
    }
  });

  it("rejects a bootstrap timestamp without an ISO 8601 timezone", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...bootstrap, generatedAt: "yesterday" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(getBootstrap(request)).rejects.toThrow(
      "Bootstrap response violates the transport contract",
    );
  });

  it("rejects an impossible date that only resembles ISO 8601", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...bootstrap,
          generatedAt: "2026-99-99T99:99:99+99:99",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(getBootstrap(request)).rejects.toThrow(
      "Bootstrap response violates the transport contract",
    );
  });
});

describe("[T-CONTENT-006] Web Activity Catalog Adapter", () => {
  it("loads the versioned Track catalog", async () => {
    const payload = {
      schemaVersion: 1,
      activities: [
        {
          id: "source-to-program",
          version: 1,
          kind: "lesson",
          title: "从源代码到可执行程序",
          estimatedMinutes: 35,
          conceptIds: ["compile-link-run"],
          prerequisiteIds: [],
        },
      ],
    };
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

    await expect(getActivities(request)).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledWith("/api/v1/activities", {
      headers: { accept: "application/json" },
    });
  });
});

describe("[T-WEB-003] assistance and progress API Adapter", () => {
  it("carries one Attempt ID through hints, reflections, Grade, and progress queries", async () => {
    const request = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ schemaVersion: 1, accepted: true }), {
          status: 200,
        }),
    );

    await revealHint(
      "source-to-program",
      {
        commandId: "hint_1",
        attemptId: "attempt_1",
        hintId: "locate-entry",
        confirmFullSolution: false,
      },
      request,
    );
    await submitReflection(
      "source-to-program",
      {
        commandId: "reflection_1",
        attemptId: "attempt_1",
        answers: [
          { promptId: "compile-versus-run", answer: "Build then run." },
        ],
      },
      request,
    );
    await executeActivity(
      "source-to-program",
      "grade",
      "grade_1",
      "attempt_1",
      request,
    );
    await getProgress(request);
    await getReviews(false, request);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/activities/source-to-program/hints",
      "/api/v1/activities/source-to-program/reflections",
      "/api/v1/activities/source-to-program/grades",
      "/api/v1/progress",
      "/api/v1/reviews/due?all=true",
    ]);
    expect(JSON.parse(String(request.mock.calls[2]?.[1]?.body))).toMatchObject({
      attemptId: "attempt_1",
    });
  });
});

describe("[T-DATA-002] Web backup Adapter", () => {
  it("uses explicit versioned export and confirmed restore requests", async () => {
    const document = {
      schemaVersion: 1,
      createdAt: "2026-08-23T10:00:00.000Z",
      files: [],
      configuration: {},
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(document), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ schemaVersion: 1, restoredFiles: 0 }), {
          status: 200,
        }),
      );

    await expect(exportBackup("export_1", request)).resolves.toEqual(document);
    await expect(
      restoreBackup(document, "restore_1", request),
    ).resolves.toEqual({ schemaVersion: 1, restoredFiles: 0 });
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/exports",
      "/api/v1/restores",
    ]);
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toMatchObject({
      schemaVersion: 1,
      commandId: "restore_1",
      confirm: true,
      archive: document,
    });
  });
});

describe("[T-WEB-001] learning-flow API Adapter", () => {
  it("uses versioned endpoints for lesson, workspace, save, Grade, and dashboard", async () => {
    const responses = [
      { schemaVersion: 1, activity: { id: "source-to-program" } },
      {
        schemaVersion: 1,
        workspace: {
          activityId: "source-to-program",
          revision: 0,
          files: { "main.cpp": "starter\n" },
        },
      },
      {
        schemaVersion: 1,
        commandId: "save_1",
        result: { ok: true, revision: 1 },
      },
      {
        schemaVersion: 1,
        commandId: "grade_1",
        jobId: "job_1",
        snapshotId: "snap_1",
        status: "completed",
        report: { verdict: "automated_pass" },
      },
      { schemaVersion: 1, attempts: [], conceptStates: {} },
      {
        schemaVersion: 1,
        commandId: "cancel_1",
        jobId: "job_1",
        cancelled: true,
      },
    ];
    const request = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await getActivity("source-to-program", request);
    await getWorkspace("source-to-program", request);
    await saveWorkspace(
      "source-to-program",
      { commandId: "save_1", baseRevision: 0, changes: [] },
      request,
    );
    await executeActivity("source-to-program", "grade", "grade_1", request);
    await getDashboard(request);
    await cancelJob("job_1", "cancel_1", request);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/activities/source-to-program",
      "/api/v1/workspaces/source-to-program",
      "/api/v1/workspaces/source-to-program",
      "/api/v1/activities/source-to-program/grades",
      "/api/v1/dashboard",
      "/api/v1/jobs/job_1/cancellations",
    ]);
    expect(request.mock.calls[2]?.[1]).toMatchObject({ method: "PATCH" });
    expect(request.mock.calls[3]?.[1]).toMatchObject({ method: "POST" });
    expect(request.mock.calls[5]?.[1]).toMatchObject({ method: "POST" });
  });
});

describe("[T-REF-006] Reference API Adapter", () => {
  it("loads navigation, bounded search, slug resolution, and Entry detail", async () => {
    const responses = [
      {
        schemaVersion: 1,
        catalogVersion: 1,
        categories: [],
        supportedStandards: [],
      },
      {
        schemaVersion: 1,
        catalogVersion: 1,
        query: { text: "vector" },
        total: 0,
        results: [],
      },
      {
        schemaVersion: 1,
        entryId: "std-vector",
        canonicalSlug: "standard-library/containers/vector",
        redirected: true,
      },
      {
        schemaVersion: 1,
        catalogVersion: 1,
        id: "std-vector",
        slug: "standard-library/containers/vector",
      },
    ];
    const request = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await getReferenceNavigation(request);
    await searchReference(
      { text: "vector", standard: "c++20", limit: 12 },
      request,
    );
    await resolveReferenceSlug("containers/vector", request);
    await getReferenceEntry("std-vector", request);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/reference",
      "/api/v1/reference/search?q=vector&standard=c%2B%2B20&limit=12",
      "/api/v1/reference/resolve?slug=containers%2Fvector",
      "/api/v1/reference/entries/std-vector",
    ]);
  });

  it("exposes the Reference HTTP status for degraded and missing views", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 404 }));

    await expect(getReferenceNavigation(request)).rejects.toMatchObject({
      status: 503,
    });
    await expect(getReferenceEntry("missing", request)).rejects.toMatchObject({
      status: 404,
    });
  });
});
