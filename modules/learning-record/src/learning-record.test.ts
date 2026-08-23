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

import type {
  AttemptCompletedEvent,
  LearningRecordEvent,
} from "@cpp-learn/contracts";

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

  it("round-trips Stage 5 toolchain and deterministic report metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const base = completedGrade("evt_stage_5_report");
    const event: AttemptCompletedEvent = {
      ...base,
      report: {
        ...base.report,
        toolchain: {
          compiler: "Apple clang 17",
          standard: "c++20",
          buildSystem: "cmake/ctest",
          cmake: "cmake version 4.1.0",
          ctest: "ctest version 4.1.0",
        },
        seeds: [20_260_823],
        stages: [
          { kind: "configure", outcome: "pass", durationMs: 20 },
          { kind: "build", outcome: "pass", durationMs: 30 },
          { kind: "ctest", outcome: "pass", durationMs: 5 },
          {
            kind: "property_test",
            outcome: "pass",
            durationMs: 4,
            seed: 20_260_823,
          },
        ],
      },
    };

    const record = createJsonlLearningRecord({ dataRoot: root });
    await record.initialize();
    await record.append(event);
    const restarted = createJsonlLearningRecord({ dataRoot: root });
    await restarted.initialize();

    await expect(restarted.list()).resolves.toEqual([event]);
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
      concepts: {
        "compile-link-run": {
          state: "practiced",
          explanation: "A passing Grade supplied automated practice evidence.",
          supportingEvidenceIds: [event.eventId],
        },
      },
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

describe("[T-RECORD-002] Stage 3 Evidence projection rebuild", () => {
  it("preserves hints, reflections, explainable Concept state, and Review schedule", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const record = createJsonlLearningRecord({ dataRoot: root });
    await record.initialize();
    const events: LearningRecordEvent[] = [
      {
        schemaVersion: 1,
        eventId: "evt_hint",
        type: "hint.revealed",
        occurredAt: "2026-08-23T08:00:00.000Z",
        commandId: "cmd_hint",
        attemptId: "attempt_1",
        activityId: "source-to-program",
        hintId: "locate-entry",
        order: 1,
        fullSolutionExposed: false,
      },
      {
        schemaVersion: 1,
        eventId: "evt_reflection",
        type: "reflection.submitted",
        occurredAt: "2026-08-23T08:01:00.000Z",
        commandId: "cmd_reflection",
        attemptId: "attempt_1",
        activityId: "source-to-program",
        answers: [
          { promptId: "compile-versus-run", answer: "Build then run." },
        ],
      },
      {
        schemaVersion: 1,
        eventId: "evt_evidence",
        type: "evidence.recorded",
        occurredAt: "2026-08-23T08:02:00.000Z",
        evidenceId: "evidence_1",
        conceptId: "compile-link-run",
        activityId: "source-to-program",
        attemptId: "attempt_1",
        source: "automated_grade",
        outcome: "pass",
        independence: "independent",
        supportingEventIds: ["evt_grade", "evt_reflection"],
      },
      {
        schemaVersion: 1,
        eventId: "evt_state",
        type: "concept.state.changed",
        occurredAt: "2026-08-23T08:02:00.000Z",
        conceptId: "compile-link-run",
        previousState: "practiced",
        nextState: "demonstrated",
        evidenceIds: ["evidence_1"],
        explanation: "Independent private Grade plus reflection.",
      },
      {
        schemaVersion: 1,
        eventId: "evt_review",
        type: "review.scheduled",
        occurredAt: "2026-08-23T08:02:00.000Z",
        reviewId: "source-to-program-review",
        conceptId: "compile-link-run",
        sourceActivityId: "source-to-program",
        dueAt: "2026-08-24T08:02:00.000Z",
        intervalDays: 1,
        reason: "Check delayed retention.",
      },
    ];
    await record.appendBatch(events);

    const persistedLines = (await readFile(join(root, "events.jsonl"), "utf8"))
      .trim()
      .split("\n");
    expect(persistedLines).toHaveLength(1);
    expect(JSON.parse(persistedLines[0] ?? "{}")).toMatchObject({
      schemaVersion: 1,
      events: events.map((event) => ({ eventId: event.eventId })),
    });

    const before = await record.projection();
    const restarted = createJsonlLearningRecord({ dataRoot: root });
    await restarted.initialize();
    const rebuilt = await restarted.rebuild();

    expect(await restarted.events()).toEqual(events);
    expect(before).toEqual(rebuilt);
    expect(rebuilt).toMatchObject({
      conceptStates: { "compile-link-run": "demonstrated" },
      evidence: [expect.objectContaining({ evidenceId: "evidence_1" })],
      reviews: [
        expect.objectContaining({
          reviewId: "source-to-program-review",
          dueAt: "2026-08-24T08:02:00.000Z",
        }),
      ],
    });
  });

  it("rejects a Concept-state regression without changing the projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const record = createJsonlLearningRecord({ dataRoot: root });
    await record.initialize();
    const demonstrated: LearningRecordEvent = {
      schemaVersion: 1,
      eventId: "evt_demonstrated",
      type: "concept.state.changed",
      occurredAt: "2026-08-23T08:00:00.000Z",
      conceptId: "compile-link-run",
      previousState: "practiced",
      nextState: "demonstrated",
      evidenceIds: ["evidence_1"],
      explanation: "Demonstrated.",
    };
    await record.append(demonstrated);
    const regressed: LearningRecordEvent = {
      ...demonstrated,
      eventId: "evt_regressed",
      occurredAt: "2026-08-23T09:00:00.000Z",
      previousState: "demonstrated",
      nextState: "practiced",
      explanation: "Invalid regression.",
    };

    await expect(record.append(regressed)).rejects.toThrow(
      "Concept state cannot regress",
    );
    await expect(record.projection()).resolves.toMatchObject({
      conceptStates: { "compile-link-run": "demonstrated" },
    });
  });
});

describe("[T-DATA-001] explicit local backup and restore", () => {
  it("round-trips portfolio history while excluding private judge material", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-backup-"));
    temporaryRoots.push(root);
    const dataRoot = join(root, "data");
    const workspaceRoot = join(root, "workspaces");
    const outputPath = join(root, "backup.json");
    const record = createJsonlLearningRecord({ dataRoot });
    await record.initialize();
    const baseGrade = completedGrade("evt_backup");
    const projectGrade: AttemptCompletedEvent = {
      ...baseGrade,
      activityId: "cpp-http-service-m2",
      attemptId: "attempt_backup_http",
      conceptIds: ["http-service-contract", "production-artifact"],
      report: {
        ...baseGrade.report,
        activity: {
          id: "cpp-http-service-m2",
          version: 3,
          judgeVersion: 1,
        },
      },
    };
    const projectEvidence: LearningRecordEvent = {
      schemaVersion: 1,
      eventId: "evt_backup_evidence",
      type: "evidence.recorded",
      occurredAt: "2026-08-23T08:00:00.013Z",
      evidenceId: "evidence_backup_http",
      conceptId: "http-service-contract",
      activityId: "cpp-http-service-m2",
      attemptId: "attempt_backup_http",
      source: "automated_grade",
      outcome: "pass",
      independence: "independent",
      supportingEventIds: [projectGrade.eventId],
    };
    await record.append(projectGrade);
    await record.append(projectEvidence);
    await mkdir(join(workspaceRoot, "cpp-http-service"), { recursive: true });
    await writeFile(
      join(workspaceRoot, "cpp-http-service", "PORTFOLIO.md"),
      "# HTTP service\n\nbuild: clean CMake\ntest: CTest\nbenchmark: loopback baseline\nretrospective: unknown route\n",
      "utf8",
    );
    const privateJudgeRoot = join(root, "judge-private");
    await mkdir(privateJudgeRoot, { recursive: true });
    await writeFile(
      join(privateJudgeRoot, "http-service.json"),
      "PRIVATE_JUDGE_SENTINEL\n",
      "utf8",
    );
    const archive = createLocalDataArchive({
      dataRoot,
      workspaceRoot,
      clock: () => new Date("2026-08-23T10:00:00.000Z"),
    });

    const exported = await archive.exportTo(outputPath);
    const serializedArchive = await readFile(outputPath, "utf8");
    const archiveDocument = JSON.parse(serializedArchive) as {
      files: { path: string; content: string }[];
    };
    const decodedFiles = archiveDocument.files.map((file) => ({
      path: file.path,
      content: Buffer.from(file.content, "base64").toString("utf8"),
    }));
    const eventHistory = decodedFiles.find(
      (file) => file.path === "events.jsonl",
    );
    expect(decodedFiles.map((file) => file.path)).toContain(
      "cpp-http-service/PORTFOLIO.md",
    );
    expect(eventHistory?.content).toContain("cpp-http-service-m2");
    expect(eventHistory?.content).toContain("evidence_backup_http");
    expect(decodedFiles.map((file) => file.content).join("\n")).not.toContain(
      "PRIVATE_JUDGE_SENTINEL",
    );
    await writeFile(join(dataRoot, "events.jsonl"), "damaged", "utf8");
    await writeFile(
      join(workspaceRoot, "cpp-http-service", "PORTFOLIO.md"),
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
    await expect(
      readFile(join(workspaceRoot, "cpp-http-service", "PORTFOLIO.md"), "utf8"),
    ).resolves.toContain("benchmark: loopback baseline");
    const restarted = createJsonlLearningRecord({ dataRoot });
    await restarted.initialize();
    await expect(restarted.list()).resolves.toEqual([projectGrade]);
    await expect(restarted.events()).resolves.toEqual([
      projectGrade,
      projectEvidence,
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
