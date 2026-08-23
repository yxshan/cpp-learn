import { describe, expect, it, vi } from "vitest";

import type { BootstrapResult } from "@cpp-learn/contracts";

import {
  executeActivity,
  getActivity,
  getBootstrap,
  getDashboard,
  getWorkspace,
  saveWorkspace,
} from "./api.js";

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

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/activities/source-to-program",
      "/api/v1/workspaces/source-to-program",
      "/api/v1/workspaces/source-to-program",
      "/api/v1/activities/source-to-program/grades",
      "/api/v1/dashboard",
    ]);
    expect(request.mock.calls[2]?.[1]).toMatchObject({ method: "PATCH" });
    expect(request.mock.calls[3]?.[1]).toMatchObject({ method: "POST" });
  });
});
