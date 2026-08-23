import { describe, expect, it, vi } from "vitest";

import type { BootstrapResult } from "@cpp-learn/contracts";

import { getBootstrap } from "./api.js";

const bootstrap: BootstrapResult = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T08:00:00.000Z",
  ready: true,
  services: {
    curriculum: { ready: true, activityCount: 1 },
    toolchain: { ready: true, compiler: "Apple Clang 15" },
    record: { ready: true }
  }
};

describe("[T-CONTRACT-001] Web bootstrap Adapter", () => {
  it("loads the shared bootstrap DTO from the versioned API", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(bootstrap), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(getBootstrap(request)).resolves.toEqual(bootstrap);
    expect(request).toHaveBeenCalledWith("/api/v1/bootstrap", {
      headers: { accept: "application/json" }
    });
  });
});
