import { describe, expect, it, vi } from "vitest";

import type { BootstrapResult, LearningPlatform } from "@cpp-learn/contracts";

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
