import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createJsonlRecordProbe, initializeJsonlRecord } from "./index.js";
import { createJsonlLearningRecord } from "./index.js";

import type { AttemptCompletedEvent } from "@cpp-learn/contracts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("[T-MODULE-001] JSONL Learning Record lifecycle", () => {
  it("initializes an empty append-only event log during composition", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);

    await initializeJsonlRecord({ dataRoot: root });
    await expect(readFile(join(root, "events.jsonl"), "utf8")).resolves.toBe(
      "",
    );
  });

  it("does not create persistent state when a readiness query probes a missing root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(parent);
    const missingRoot = join(parent, "missing");
    const probe = createJsonlRecordProbe({ dataRoot: missingRoot });

    await expect(probe()).resolves.toEqual({
      ready: false,
      issues: ["Learning record is not initialized or writable"],
    });
    await expect(stat(missingRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("[T-RECORD-001] append-only attempt history", () => {
  it("restores a completed Grade after the process is recreated", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const event: AttemptCompletedEvent = {
      schemaVersion: 1,
      eventId: "evt_grade_1",
      type: "attempt.completed",
      occurredAt: "2026-08-23T08:00:00.012Z",
      commandId: "cmd_grade_1",
      activityId: "source-to-program",
      conceptIds: ["compile-link-run"],
      mode: "grade",
      report: {
        schemaVersion: 1,
        reportId: "report_job_1",
        jobId: "job_1",
        mode: "grade",
        activity: {
          id: "source-to-program",
          version: 1,
          judgeVersion: 1,
        },
        source: { snapshotId: "snap_1", digest: "abc123" },
        toolchain: { compiler: "clang", standard: "c++20" },
        verdict: "automated_pass",
        stages: [
          { kind: "compile", outcome: "pass", durationMs: 10 },
          { kind: "test", outcome: "pass", durationMs: 2 },
        ],
        startedAt: "2026-08-23T08:00:00.000Z",
        completedAt: "2026-08-23T08:00:00.012Z",
      },
    };

    const firstProcess = createJsonlLearningRecord({ dataRoot: root });
    await firstProcess.initialize();
    await firstProcess.append(event);

    const restartedProcess = createJsonlLearningRecord({ dataRoot: root });
    await restartedProcess.initialize();
    await expect(restartedProcess.list()).resolves.toEqual([event]);
  });
});
