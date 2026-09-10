import { describe, expect, it } from "vitest";

import { resolveServerAddress, resolveServerStoragePaths } from "./config.ts";

describe("[T-SEC-001] local server address", () => {
  it("rejects a non-loopback binding", () => {
    expect(() =>
      resolveServerAddress({
        CPP_LEARN_HOST: "0.0.0.0",
        CPP_LEARN_PORT: "4173",
      }),
    ).toThrow("Server host must be a loopback address");
  });

  it("uses a loopback safe default", () => {
    expect(resolveServerAddress({})).toEqual({ host: "127.0.0.1", port: 4173 });
  });
});

describe("[T-E2E-006] server storage isolation", () => {
  it("uses explicitly configured data and Workspace roots", () => {
    expect(
      resolveServerStoragePaths({
        CPP_LEARN_DATA_ROOT: "/tmp/cpp-learn-e2e/data",
        CPP_LEARN_WORKSPACE_ROOT: "/tmp/cpp-learn-e2e/workspaces",
      }),
    ).toEqual({
      dataRoot: "/tmp/cpp-learn-e2e/data",
      workspaceRoot: "/tmp/cpp-learn-e2e/workspaces",
    });
  });

  it("keeps production defaults when no override is configured", () => {
    expect(resolveServerStoragePaths({})).toEqual({});
  });
});
