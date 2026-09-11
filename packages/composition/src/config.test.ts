import { describe, expect, it } from "vitest";

import {
  resolveJudgeAdmissionOptions,
  resolveServerAddress,
  resolveServerStoragePaths,
} from "./config.ts";

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

describe("[SEC-F02] host Judge budget configuration", () => {
  it("defaults to one concurrent Judge operation with a short wait queue", () => {
    expect(resolveJudgeAdmissionOptions({})).toEqual({
      maxConcurrent: 1,
      maxQueued: 4,
    });
  });

  it("accepts an explicit budget, including a queue-less one", () => {
    expect(
      resolveJudgeAdmissionOptions({
        CPP_LEARN_JUDGE_MAX_CONCURRENT: "2",
        CPP_LEARN_JUDGE_MAX_QUEUED: "0",
      }),
    ).toEqual({ maxConcurrent: 2, maxQueued: 0 });
  });

  it("refuses a budget that would remove the bound", () => {
    expect(() =>
      resolveJudgeAdmissionOptions({ CPP_LEARN_JUDGE_MAX_CONCURRENT: "0" }),
    ).toThrow("CPP_LEARN_JUDGE_MAX_CONCURRENT must be an integer");
    expect(() =>
      resolveJudgeAdmissionOptions({ CPP_LEARN_JUDGE_MAX_QUEUED: "-1" }),
    ).toThrow("CPP_LEARN_JUDGE_MAX_QUEUED must be an integer");
    expect(() =>
      resolveJudgeAdmissionOptions({ CPP_LEARN_JUDGE_MAX_CONCURRENT: "many" }),
    ).toThrow("CPP_LEARN_JUDGE_MAX_CONCURRENT must be an integer");
    expect(() =>
      resolveJudgeAdmissionOptions({ CPP_LEARN_JUDGE_MAX_QUEUED: "1.5" }),
    ).toThrow("CPP_LEARN_JUDGE_MAX_QUEUED must be an integer");
  });
});
