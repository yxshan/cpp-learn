import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createJsonlLearningRecord,
  createJsonlRecordProbe,
  createLocalDataArchive,
  initializeJsonlRecord,
} from "./index.js";

import type { AttemptCompletedEvent } from "@cpp-learn/contracts";

const temporaryRoots: string[] = [];

function completedGrade(eventId = "evt_grade_1"): AttemptCompletedEvent {
  return {
    schemaVersion: 1,
    eventId,
    type: "attempt.completed",
    occurredAt: "2026-08-23T08:00:00.012Z",
    commandId: `cmd_${eventId}`,
    activityId: "source-to-program",
    conceptIds: ["compile-link-run"],
    mode: "grade",
    report: {
      schemaVersion: 1,
      reportId: `report_${eventId}`,
      jobId: `job_${eventId}`,
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
}

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
    const event = completedGrade();

    const firstProcess = createJsonlLearningRecord({ dataRoot: root });
    await firstProcess.initialize();
    await firstProcess.append(event);

    const restartedProcess = createJsonlLearningRecord({ dataRoot: root });
    await restartedProcess.initialize();
    await expect(restartedProcess.list()).resolves.toEqual([event]);
  });

  it("quarantines an interrupted tail and records the recovery before serving history", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const event = completedGrade();
    const firstProcess = createJsonlLearningRecord({ dataRoot: root });
    await firstProcess.initialize();
    await firstProcess.append(event);
    await appendFile(join(root, "events.jsonl"), '{"partial":', "utf8");

    const restartedProcess = createJsonlLearningRecord({
      dataRoot: root,
      clock: () => new Date("2026-08-23T09:00:00.000Z"),
    });
    await restartedProcess.initialize();

    await expect(restartedProcess.list()).resolves.toEqual([event]);
    await expect(restartedProcess.events()).resolves.toEqual([
      event,
      expect.objectContaining({
        type: "recovery.performed",
        occurredAt: "2026-08-23T09:00:00.000Z",
        invalidBytes: 11,
      }),
    ]);
    expect(await readdir(root)).toContainEqual(
      expect.stringMatching(/^quarantine-[a-f0-9]{12}\.jsonl$/),
    );
  });

  it("deduplicates event IDs and rebuilds an equivalent SQLite projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const event = completedGrade("evt_deduplicated");
    const record = createJsonlLearningRecord({ dataRoot: root });
    await record.initialize();
    await record.append(event);
    await record.append(event);

    const before = await record.projection();
    const rebuilt = await record.rebuild();

    expect(await record.list()).toEqual([event]);
    expect(before).toEqual({
      attempts: [event],
      conceptStates: { "compile-link-run": "practiced" },
    });
    expect(rebuilt).toEqual(before);
    expect(await record.projection()).toEqual(before);
    await expect(stat(join(root, "projections.sqlite"))).resolves.toMatchObject(
      { isFile: expect.any(Function) },
    );
    const lines = (await readFile(join(root, "events.jsonl"), "utf8"))
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
  });

  it("rejects a duplicate event ID whose payload conflicts", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const record = createJsonlLearningRecord({ dataRoot: root });
    await record.initialize();
    const first = completedGrade("evt_conflict");
    await record.append(first);

    await expect(
      record.append({ ...first, occurredAt: "2026-08-23T11:00:00.000Z" }),
    ).rejects.toThrow("Conflicting event identifier: evt_conflict");
    await expect(record.list()).resolves.toEqual([first]);
  });
});

describe("[T-DATA-001] explicit local backup and restore", () => {
  it("round-trips learning data and Workspaces through a checksummed archive", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-backup-"));
    temporaryRoots.push(root);
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    const outputPath = join(root, "backup.json");
    const record = createJsonlLearningRecord({ dataRoot });
    await record.initialize();
    await record.append(completedGrade("evt_backup"));
    await mkdir(join(workspaceRoot, "source-to-program"), { recursive: true });
    await writeFile(
      join(workspaceRoot, "source-to-program", "main.cpp"),
      "int main() { return 0; }\n",
      "utf8",
    );
    const archive = createLocalDataArchive({
      dataRoot,
      workspaceRoot,
      clock: () => new Date("2026-08-23T10:00:00.000Z"),
    });

    const exported = await archive.exportTo(outputPath);
    await writeFile(join(dataRoot, "events.jsonl"), "damaged", "utf8");
    await writeFile(
      join(workspaceRoot, "source-to-program", "main.cpp"),
      "damaged\n",
      "utf8",
    );
    const restored = await archive.restoreFrom(outputPath);

    expect(exported).toMatchObject({
      schemaVersion: 1,
      createdAt: "2026-08-23T10:00:00.000Z",
      fileCount: expect.any(Number),
    });
    expect(restored).toEqual({
      schemaVersion: 1,
      restoredFiles: exported.fileCount,
    });
    expect(
      await readFile(
        join(workspaceRoot, "source-to-program", "main.cpp"),
        "utf8",
      ),
    ).toBe("int main() { return 0; }\n");
    const restarted = createJsonlLearningRecord({ dataRoot });
    await restarted.initialize();
    await expect(restarted.list()).resolves.toEqual([
      completedGrade("evt_backup"),
    ]);
  });

  it("rejects a tampered archive before replacing local files", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-backup-"));
    temporaryRoots.push(root);
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    const outputPath = join(root, "backup.json");
    await mkdir(dataRoot, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(join(dataRoot, "events.jsonl"), "original\n", "utf8");
    const archive = createLocalDataArchive({ dataRoot, workspaceRoot });
    await archive.exportTo(outputPath);
    const serialized = JSON.parse(await readFile(outputPath, "utf8")) as {
      files: { content: string }[];
    };
    if (serialized.files[0]) serialized.files[0].content = "dGFtcGVyZWQ=";
    await writeFile(outputPath, JSON.stringify(serialized), "utf8");

    await expect(archive.restoreFrom(outputPath)).rejects.toThrow(
      "Archive checksum mismatch",
    );
    await expect(
      readFile(join(dataRoot, "events.jsonl"), "utf8"),
    ).resolves.toBe("original\n");
  });

  it("accepts an event-only archive and rebuilds its disposable projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-backup-"));
    temporaryRoots.push(root);
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    const outputPath = join(root, "backup.json");
    const record = createJsonlLearningRecord({ dataRoot });
    await record.initialize();
    await record.append(completedGrade("evt_event_only"));
    const archive = createLocalDataArchive({ dataRoot, workspaceRoot });
    await archive.exportTo(outputPath);
    const document = JSON.parse(await readFile(outputPath, "utf8")) as {
      schemaVersion: 1;
      createdAt: string;
      configuration: Record<string, unknown>;
      manifestChecksum: string;
      files: {
        area: "data" | "workspaces";
        path: string;
        content: string;
        checksum: string;
      }[];
    };
    document.files = document.files.filter(
      (file) => !(file.area === "data" && file.path === "projections.sqlite"),
    );
    document.manifestChecksum = createHash("sha256")
      .update(
        JSON.stringify({
          schemaVersion: document.schemaVersion,
          createdAt: document.createdAt,
          files: document.files,
          configuration: document.configuration,
        }),
      )
      .digest("hex");
    await writeFile(outputPath, JSON.stringify(document), "utf8");

    await expect(archive.restoreFrom(outputPath)).resolves.toMatchObject({
      schemaVersion: 1,
    });
    await expect(
      stat(join(dataRoot, "projections.sqlite")),
    ).resolves.toBeDefined();
    const restarted = createJsonlLearningRecord({ dataRoot });
    await restarted.initialize();
    await expect(restarted.list()).resolves.toEqual([
      completedGrade("evt_event_only"),
    ]);
  });

  it("rejects incomplete or schema-invalid archives before activating either root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-backup-"));
    temporaryRoots.push(root);
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    const outputPath = join(root, "backup.json");
    const record = createJsonlLearningRecord({ dataRoot });
    await record.initialize();
    await record.append(completedGrade("evt_schema_guard"));
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(join(workspaceRoot, "main.cpp"), "preserved\n", "utf8");
    const archive = createLocalDataArchive({ dataRoot, workspaceRoot });
    await archive.exportTo(outputPath);

    const invalid = JSON.parse(await readFile(outputPath, "utf8")) as {
      schemaVersion: 1;
      createdAt: string;
      configuration: Record<string, unknown>;
      manifestChecksum: string;
      files: {
        area: "data" | "workspaces";
        path: string;
        content: string;
        checksum: string;
      }[];
    };
    const eventFile = invalid.files.find(
      (file) => file.area === "data" && file.path === "events.jsonl",
    );
    expect(eventFile).toBeDefined();
    const sourceEvent = completedGrade("evt_malformed");
    const malformedEvent = {
      ...sourceEvent,
      report: {
        ...sourceEvent.report,
        stages: [
          {
            ...sourceEvent.report.stages[0],
            diagnostics: "invalid nested diagnostics",
          },
        ],
      },
    };
    const malformedEnvelope = `${JSON.stringify({
      schemaVersion: 1,
      event: malformedEvent,
      checksum: createHash("sha256")
        .update(JSON.stringify(malformedEvent))
        .digest("hex"),
    })}\n`;
    if (eventFile) {
      const bytes = Buffer.from(malformedEnvelope);
      eventFile.content = bytes.toString("base64");
      eventFile.checksum = createHash("sha256").update(bytes).digest("hex");
    }
    const manifest = {
      schemaVersion: invalid.schemaVersion,
      createdAt: invalid.createdAt,
      files: invalid.files,
      configuration: invalid.configuration,
    };
    invalid.manifestChecksum = createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex");
    await writeFile(outputPath, JSON.stringify(invalid), "utf8");

    await expect(archive.restoreFrom(outputPath)).rejects.toThrow(
      "Corrupt learning record",
    );
    await expect(
      readFile(join(workspaceRoot, "main.cpp"), "utf8"),
    ).resolves.toBe("preserved\n");
    await expect(record.list()).resolves.toEqual([
      completedGrade("evt_schema_guard"),
    ]);

    await archive.exportTo(outputPath);
    const incomplete = JSON.parse(
      await readFile(outputPath, "utf8"),
    ) as typeof invalid;
    incomplete.files = incomplete.files.filter(
      (file) => !(file.area === "data" && file.path === "events.jsonl"),
    );
    const incompleteManifest = {
      schemaVersion: incomplete.schemaVersion,
      createdAt: incomplete.createdAt,
      files: incomplete.files,
      configuration: incomplete.configuration,
    };
    incomplete.manifestChecksum = createHash("sha256")
      .update(JSON.stringify(incompleteManifest))
      .digest("hex");
    await writeFile(outputPath, JSON.stringify(incomplete), "utf8");
    await expect(archive.restoreFrom(outputPath)).rejects.toThrow(
      "Archive is missing required file: data:events.jsonl",
    );

    await archive.exportTo(outputPath);
    const conflicting = JSON.parse(
      await readFile(outputPath, "utf8"),
    ) as typeof invalid;
    const conflictingEventFile = conflicting.files.find(
      (file) => file.area === "data" && file.path === "events.jsonl",
    );
    const first = completedGrade("evt_staging_conflict");
    const second = { ...first, occurredAt: "2026-08-23T12:00:00.000Z" };
    const envelopeFor = (event: AttemptCompletedEvent) =>
      JSON.stringify({
        schemaVersion: 1,
        event,
        checksum: createHash("sha256")
          .update(JSON.stringify(event))
          .digest("hex"),
      });
    const conflictingLog = `${envelopeFor(first)}\n${envelopeFor(second)}\n`;
    if (conflictingEventFile) {
      const bytes = Buffer.from(conflictingLog);
      conflictingEventFile.content = bytes.toString("base64");
      conflictingEventFile.checksum = createHash("sha256")
        .update(bytes)
        .digest("hex");
    }
    const conflictingManifest = {
      schemaVersion: conflicting.schemaVersion,
      createdAt: conflicting.createdAt,
      files: conflicting.files,
      configuration: conflicting.configuration,
    };
    conflicting.manifestChecksum = createHash("sha256")
      .update(JSON.stringify(conflictingManifest))
      .digest("hex");
    await writeFile(outputPath, JSON.stringify(conflicting), "utf8");
    await expect(archive.restoreFrom(outputPath)).rejects.toThrow(
      "Conflicting event identifier: evt_staging_conflict",
    );
    expect(await readdir(root)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\.cpp-learn-(?:data|workspaces)-restore-/),
      ]),
    );
  });
});
