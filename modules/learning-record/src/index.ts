import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  SCHEMA_VERSION,
  type AttemptCompletedEvent,
  type ConceptState,
  type EvidenceRecordedEvent,
  type LearningRecordEvent,
  type RecordReadiness,
  type RecoveryPerformedEvent,
  type ReviewScheduledEvent,
} from "@cpp-learn/contracts";

export interface JsonlRecordProbeDependencies {
  readonly dataRoot: string;
  readonly clock?: () => Date;
}

export interface LearningRecordLifecycle {
  initialize(): Promise<void>;
  readiness(): Promise<RecordReadiness>;
}

export interface LearningProjection {
  readonly attempts: readonly AttemptCompletedEvent[];
  readonly conceptStates: Readonly<Record<string, ConceptState>>;
  readonly concepts: Readonly<
    Record<
      string,
      {
        readonly state: ConceptState;
        readonly explanation: string;
        readonly supportingEvidenceIds: readonly string[];
      }
    >
  >;
  readonly evidence?: readonly EvidenceRecordedEvent[];
  readonly reviews?: readonly ReviewScheduledEvent[];
}

export interface LearningRecord extends LearningRecordLifecycle {
  append(event: LearningRecordEvent): Promise<void>;
  appendBatch(events: readonly LearningRecordEvent[]): Promise<void>;
  list(): Promise<readonly AttemptCompletedEvent[]>;
  events(): Promise<readonly LearningRecordEvent[]>;
  projection(): Promise<LearningProjection>;
  rebuild(): Promise<LearningProjection>;
}

export interface LocalDataArchive {
  exportTo(outputPath: string): Promise<{
    readonly schemaVersion: 1;
    readonly createdAt: string;
    readonly fileCount: number;
  }>;
  restoreFrom(inputPath: string): Promise<{
    readonly schemaVersion: 1;
    readonly restoredFiles: number;
  }>;
}

export interface LocalDataArchiveDependencies {
  readonly dataRoot: string;
  readonly workspaceRoot: string;
  readonly clock?: () => Date;
}

interface ArchiveFile {
  readonly area: "data" | "workspaces";
  readonly path: string;
  readonly content: string;
  readonly checksum: string;
}

interface ArchiveDocument {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly files: readonly ArchiveFile[];
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly manifestChecksum: string;
}

type ArchiveManifest = Omit<ArchiveDocument, "manifestChecksum">;

interface StoredEvent {
  readonly schemaVersion: 1;
  readonly event: LearningRecordEvent;
  readonly checksum: string;
}

interface StoredEventBatch {
  readonly schemaVersion: 1;
  readonly events: readonly LearningRecordEvent[];
  readonly checksum: string;
}

export async function initializeJsonlRecord(
  dependencies: JsonlRecordProbeDependencies,
): Promise<void> {
  await mkdir(dependencies.dataRoot, { recursive: true });
  const eventLog = await open(join(dependencies.dataRoot, "events.jsonl"), "a");
  await eventLog.close();
}

export function createJsonlRecordProbe(
  dependencies: JsonlRecordProbeDependencies,
): () => Promise<RecordReadiness> {
  return async () => {
    try {
      await access(
        join(dependencies.dataRoot, "events.jsonl"),
        constants.R_OK | constants.W_OK,
      );
      await access(
        join(dependencies.dataRoot, "projections.sqlite"),
        constants.R_OK | constants.W_OK,
      );
      return { ready: true };
    } catch {
      return {
        ready: false,
        issues: ["Learning record is not initialized or writable"],
      };
    }
  };
}

export function createJsonlRecordLifecycle(
  dependencies: JsonlRecordProbeDependencies,
): LearningRecordLifecycle {
  return createJsonlLearningRecord(dependencies);
}

function checksum(event: LearningRecordEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

const judgeVerdicts = new Set([
  "compile_error",
  "runtime_error",
  "public_failure",
  "timeout",
  "output_limit",
  "private_failure",
  "sanitizer_failure",
  "cancelled",
  "automated_pass",
  "judge_system_error",
]);
const judgeStageKinds = new Set([
  "compile",
  "test",
  "public_test",
  "private_test",
  "asan",
  "ubsan",
]);

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function isJudgeDiagnostic(value: unknown): boolean {
  return (
    isRecordObject(value) &&
    (value["category"] === "compiler" ||
      value["category"] === "sanitizer" ||
      value["category"] === "runtime") &&
    typeof value["message"] === "string" &&
    isOptionalString(value["file"]) &&
    isOptionalNumber(value["line"]) &&
    isOptionalNumber(value["column"])
  );
}

function isAttemptCompletedEvent(
  value: unknown,
): value is AttemptCompletedEvent {
  if (!isRecordObject(value) || !isRecordObject(value["report"])) return false;
  const report = value["report"];
  if (
    !isRecordObject(report["activity"]) ||
    !isRecordObject(report["source"]) ||
    !isRecordObject(report["toolchain"]) ||
    !Array.isArray(report["stages"])
  ) {
    return false;
  }
  return (
    value["schemaVersion"] === 1 &&
    value["type"] === "attempt.completed" &&
    typeof value["eventId"] === "string" &&
    typeof value["occurredAt"] === "string" &&
    typeof value["commandId"] === "string" &&
    typeof value["activityId"] === "string" &&
    isStringArray(value["conceptIds"]) &&
    (value["mode"] === "run" || value["mode"] === "grade") &&
    isOptionalString(value["attemptId"]) &&
    (value["independence"] === undefined ||
      value["independence"] === "independent" ||
      value["independence"] === "assisted" ||
      value["independence"] === "solution_exposed") &&
    (value["hintsUsed"] === undefined ||
      typeof value["hintsUsed"] === "number") &&
    (value["fullSolutionExposed"] === undefined ||
      typeof value["fullSolutionExposed"] === "boolean") &&
    report["schemaVersion"] === 1 &&
    typeof report["reportId"] === "string" &&
    typeof report["jobId"] === "string" &&
    report["mode"] === value["mode"] &&
    typeof report["activity"]["id"] === "string" &&
    typeof report["activity"]["version"] === "number" &&
    typeof report["activity"]["judgeVersion"] === "number" &&
    typeof report["source"]["snapshotId"] === "string" &&
    typeof report["source"]["digest"] === "string" &&
    typeof report["toolchain"]["compiler"] === "string" &&
    report["toolchain"]["standard"] === "c++20" &&
    (report["buildFlags"] === undefined ||
      isStringArray(report["buildFlags"])) &&
    typeof report["verdict"] === "string" &&
    judgeVerdicts.has(report["verdict"]) &&
    report["stages"].every(
      (stage) =>
        isRecordObject(stage) &&
        typeof stage["kind"] === "string" &&
        judgeStageKinds.has(stage["kind"]) &&
        (stage["outcome"] === "pass" ||
          stage["outcome"] === "fail" ||
          stage["outcome"] === "system_error") &&
        typeof stage["durationMs"] === "number" &&
        isOptionalString(stage["stdout"]) &&
        isOptionalString(stage["stderr"]) &&
        isOptionalString(stage["testName"]) &&
        isOptionalString(stage["feedback"]) &&
        (stage["diagnostics"] === undefined ||
          (Array.isArray(stage["diagnostics"]) &&
            stage["diagnostics"].every(isJudgeDiagnostic))),
    ) &&
    typeof report["startedAt"] === "string" &&
    typeof report["completedAt"] === "string"
  );
}

function isRecoveryPerformedEvent(
  value: unknown,
): value is RecoveryPerformedEvent {
  return (
    isRecordObject(value) &&
    value["schemaVersion"] === 1 &&
    value["type"] === "recovery.performed" &&
    typeof value["eventId"] === "string" &&
    typeof value["occurredAt"] === "string" &&
    typeof value["quarantinedFile"] === "string" &&
    typeof value["invalidBytes"] === "number"
  );
}

const conceptStateValues = new Set([
  "unseen",
  "introduced",
  "practiced",
  "demonstrated",
  "retained",
]);

function conceptStateRank(state: ConceptState): number {
  return [
    "unseen",
    "introduced",
    "practiced",
    "demonstrated",
    "retained",
  ].indexOf(state);
}
const independenceValues = new Set([
  "independent",
  "assisted",
  "solution_exposed",
]);

function hasEventEnvelope(
  value: unknown,
  type: string,
): value is Record<string, unknown> {
  return (
    isRecordObject(value) &&
    value["schemaVersion"] === 1 &&
    value["type"] === type &&
    typeof value["eventId"] === "string" &&
    typeof value["occurredAt"] === "string"
  );
}

function isStage3Event(value: unknown): value is LearningRecordEvent {
  if (!isRecordObject(value)) return false;
  switch (value["type"]) {
    case "hint.revealed":
      return (
        hasEventEnvelope(value, "hint.revealed") &&
        typeof value["commandId"] === "string" &&
        typeof value["attemptId"] === "string" &&
        typeof value["activityId"] === "string" &&
        typeof value["hintId"] === "string" &&
        typeof value["order"] === "number" &&
        typeof value["fullSolutionExposed"] === "boolean"
      );
    case "reflection.submitted":
      return (
        hasEventEnvelope(value, "reflection.submitted") &&
        typeof value["commandId"] === "string" &&
        typeof value["attemptId"] === "string" &&
        typeof value["activityId"] === "string" &&
        Array.isArray(value["answers"]) &&
        value["answers"].every(
          (answer) =>
            isRecordObject(answer) &&
            typeof answer["promptId"] === "string" &&
            typeof answer["answer"] === "string",
        )
      );
    case "evidence.recorded":
      return (
        hasEventEnvelope(value, "evidence.recorded") &&
        typeof value["evidenceId"] === "string" &&
        typeof value["conceptId"] === "string" &&
        typeof value["activityId"] === "string" &&
        typeof value["attemptId"] === "string" &&
        (value["source"] === "automated_grade" ||
          value["source"] === "review" ||
          value["source"] === "teacher_observation") &&
        (value["outcome"] === "pass" || value["outcome"] === "fail") &&
        typeof value["independence"] === "string" &&
        independenceValues.has(value["independence"]) &&
        isStringArray(value["supportingEventIds"])
      );
    case "concept.state.changed":
      return (
        hasEventEnvelope(value, "concept.state.changed") &&
        typeof value["conceptId"] === "string" &&
        typeof value["previousState"] === "string" &&
        conceptStateValues.has(value["previousState"]) &&
        typeof value["nextState"] === "string" &&
        conceptStateValues.has(value["nextState"]) &&
        isStringArray(value["evidenceIds"]) &&
        typeof value["explanation"] === "string"
      );
    case "review.scheduled":
      return (
        hasEventEnvelope(value, "review.scheduled") &&
        typeof value["reviewId"] === "string" &&
        typeof value["conceptId"] === "string" &&
        typeof value["sourceActivityId"] === "string" &&
        typeof value["dueAt"] === "string" &&
        typeof value["intervalDays"] === "number" &&
        typeof value["reason"] === "string"
      );
    case "review.completed":
      return (
        hasEventEnvelope(value, "review.completed") &&
        typeof value["reviewId"] === "string" &&
        typeof value["conceptId"] === "string" &&
        typeof value["attemptId"] === "string" &&
        typeof value["evidenceId"] === "string"
      );
    case "teacher.observation.accepted":
    case "teacher.observation.rejected":
      return (
        hasEventEnvelope(value, value["type"]) &&
        typeof value["commandId"] === "string" &&
        typeof value["observationId"] === "string" &&
        typeof value["attemptId"] === "string" &&
        typeof value["activityId"] === "string" &&
        typeof value["rubricId"] === "string" &&
        (value["outcome"] === "pass" || value["outcome"] === "revise") &&
        typeof value["summary"] === "string" &&
        isOptionalString(value["reason"])
      );
    default:
      return false;
  }
}

function isLearningRecordEvent(value: unknown): value is LearningRecordEvent {
  return (
    isAttemptCompletedEvent(value) ||
    isRecoveryPerformedEvent(value) ||
    isStage3Event(value)
  );
}

function parseStoredEvents(
  line: string,
  lineNumber: number,
): readonly LearningRecordEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Invalid learning record JSON at line ${lineNumber}`);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("schemaVersion" in parsed) ||
    parsed.schemaVersion !== 1 ||
    !("checksum" in parsed) ||
    typeof parsed.checksum !== "string"
  ) {
    throw new Error(`Invalid learning record envelope at line ${lineNumber}`);
  }
  if ("event" in parsed) {
    const event = parsed.event;
    if (!isLearningRecordEvent(event) || parsed.checksum !== checksum(event)) {
      throw new Error(`Corrupt learning record at line ${lineNumber}`);
    }
    return [event];
  }
  if (
    !("events" in parsed) ||
    !Array.isArray(parsed.events) ||
    parsed.events.length === 0 ||
    !parsed.events.every(isLearningRecordEvent) ||
    parsed.checksum !==
      createHash("sha256").update(JSON.stringify(parsed.events)).digest("hex")
  ) {
    throw new Error(`Corrupt learning record at line ${lineNumber}`);
  }
  return parsed.events;
}

function storedLine(events: readonly LearningRecordEvent[]): string {
  if (events.length > 1) {
    const stored: StoredEventBatch = {
      schemaVersion: SCHEMA_VERSION,
      events,
      checksum: createHash("sha256")
        .update(JSON.stringify(events))
        .digest("hex"),
    };
    return `${JSON.stringify(stored)}\n`;
  }
  const event = events[0];
  if (!event) throw new Error("Cannot append an empty event batch");
  const stored: StoredEvent = {
    schemaVersion: SCHEMA_VERSION,
    event,
    checksum: checksum(event),
  };
  return `${JSON.stringify(stored)}\n`;
}

function initializeProjection(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE IF NOT EXISTS projection_meta (
      schema_version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      event_id TEXT PRIMARY KEY,
      event_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS concept_states (
      concept_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      evidence_ids_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS concept_evidence (
      evidence_id TEXT PRIMARY KEY,
      event_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_queue (
      review_key TEXT PRIMARY KEY,
      event_json TEXT NOT NULL
    );
  `);
  for (const migration of [
    "ALTER TABLE concept_states ADD COLUMN explanation TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE concept_states ADD COLUMN evidence_ids_json TEXT NOT NULL DEFAULT '[]'",
  ]) {
    try {
      database.exec(migration);
    } catch (error) {
      if (!String(error).includes("duplicate column name")) throw error;
    }
  }
  database
    .prepare(
      "INSERT INTO projection_meta(schema_version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM projection_meta)",
    )
    .run();
}

function projectEvent(
  database: DatabaseSync,
  event: LearningRecordEvent,
): void {
  if (event.type === "evidence.recorded") {
    database
      .prepare(
        "INSERT OR IGNORE INTO concept_evidence(evidence_id, event_json) VALUES (?, ?)",
      )
      .run(event.evidenceId, JSON.stringify(event));
    return;
  }
  if (event.type === "concept.state.changed") {
    const current = database
      .prepare("SELECT state FROM concept_states WHERE concept_id = ?")
      .get(event.conceptId);
    if (
      typeof current?.["state"] === "string" &&
      conceptStateValues.has(current["state"]) &&
      conceptStateRank(event.nextState) <
        conceptStateRank(current["state"] as ConceptState)
    ) {
      throw new Error(
        `Concept state cannot regress: ${event.conceptId} ${current["state"]} -> ${event.nextState}`,
      );
    }
    database
      .prepare(
        `
    INSERT INTO concept_states(
      concept_id, state, last_event_id, explanation, evidence_ids_json
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(concept_id) DO UPDATE SET
      state = excluded.state,
      last_event_id = excluded.last_event_id,
      explanation = excluded.explanation,
      evidence_ids_json = excluded.evidence_ids_json
    `,
      )
      .run(
        event.conceptId,
        event.nextState,
        event.eventId,
        event.explanation,
        JSON.stringify(event.evidenceIds),
      );
    return;
  }
  if (event.type === "review.scheduled") {
    database
      .prepare(
        `
      INSERT INTO review_queue(review_key, event_json) VALUES (?, ?)
      ON CONFLICT(review_key) DO UPDATE SET event_json = excluded.event_json
    `,
      )
      .run(`${event.reviewId}:${event.conceptId}`, JSON.stringify(event));
    return;
  }
  if (event.type === "review.completed") {
    database
      .prepare("DELETE FROM review_queue WHERE review_key = ?")
      .run(`${event.reviewId}:${event.conceptId}`);
    return;
  }
  if (event.type !== "attempt.completed") return;
  const inserted = database
    .prepare(
      "INSERT OR IGNORE INTO attempts(event_id, event_json) VALUES (?, ?)",
    )
    .run(event.eventId, JSON.stringify(event));
  if (
    inserted.changes > 0 &&
    event.mode === "grade" &&
    event.report.verdict === "automated_pass"
  ) {
    const statement = database.prepare(`
      INSERT INTO concept_states(
        concept_id, state, last_event_id, explanation, evidence_ids_json
      ) VALUES (?, 'practiced', ?, 'A passing Grade supplied automated practice evidence.', ?)
      ON CONFLICT(concept_id) DO NOTHING
    `);
    for (const conceptId of event.conceptIds) {
      statement.run(conceptId, event.eventId, JSON.stringify([event.eventId]));
    }
  }
}

function readProjection(database: DatabaseSync): LearningProjection {
  const attempts = database
    .prepare("SELECT event_json FROM attempts ORDER BY rowid")
    .all()
    .map(
      (row) => JSON.parse(String(row["event_json"])) as AttemptCompletedEvent,
    );
  const conceptStates: Record<string, ConceptState> = {};
  const concepts: Record<
    string,
    {
      state: ConceptState;
      explanation: string;
      supportingEvidenceIds: readonly string[];
    }
  > = {};
  for (const row of database
    .prepare(
      "SELECT concept_id, state, explanation, evidence_ids_json FROM concept_states ORDER BY concept_id",
    )
    .all()) {
    if (
      typeof row["state"] === "string" &&
      conceptStateValues.has(row["state"])
    ) {
      const conceptId = String(row["concept_id"]);
      const state = row["state"] as ConceptState;
      const parsedEvidence = JSON.parse(String(row["evidence_ids_json"]));
      conceptStates[conceptId] = state;
      concepts[conceptId] = {
        state,
        explanation: String(row["explanation"]),
        supportingEvidenceIds: Array.isArray(parsedEvidence)
          ? parsedEvidence.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      };
    }
  }
  const evidence = database
    .prepare("SELECT event_json FROM concept_evidence ORDER BY rowid")
    .all()
    .map(
      (row) => JSON.parse(String(row["event_json"])) as EvidenceRecordedEvent,
    );
  const reviews = database
    .prepare("SELECT event_json FROM review_queue ORDER BY rowid")
    .all()
    .map(
      (row) => JSON.parse(String(row["event_json"])) as ReviewScheduledEvent,
    );
  return {
    attempts,
    conceptStates,
    concepts,
    ...(evidence.length > 0 ? { evidence } : {}),
    ...(reviews.length > 0 ? { reviews } : {}),
  };
}

function isSafeArchivePath(path: string): boolean {
  return (
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

async function collectArchiveFiles(
  root: string,
  area: ArchiveFile["area"],
  include: (path: string) => boolean,
): Promise<ArchiveFile[]> {
  const collected: ArchiveFile[] = [];
  const visit = async (directory: string, prefix: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, path);
      } else if (entry.isFile() && include(path)) {
        const bytes = await readFile(absolutePath);
        collected.push({
          area,
          path,
          content: bytes.toString("base64"),
          checksum: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  };
  await visit(root, "");
  return collected;
}

function parseArchive(value: unknown): ArchiveDocument {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("createdAt" in value) ||
    typeof value.createdAt !== "string" ||
    !("files" in value) ||
    !Array.isArray(value.files) ||
    !("configuration" in value) ||
    typeof value.configuration !== "object" ||
    value.configuration === null ||
    !("manifestChecksum" in value) ||
    typeof value.manifestChecksum !== "string"
  ) {
    throw new Error("Invalid local data archive");
  }
  const files = value.files as unknown[];
  const uniquePaths = new Set<string>();
  for (const candidate of files) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("area" in candidate) ||
      (candidate.area !== "data" && candidate.area !== "workspaces") ||
      !("path" in candidate) ||
      typeof candidate.path !== "string" ||
      !isSafeArchivePath(candidate.path) ||
      !("content" in candidate) ||
      typeof candidate.content !== "string" ||
      !("checksum" in candidate) ||
      typeof candidate.checksum !== "string"
    ) {
      throw new Error("Invalid local data archive file");
    }
    const key = `${candidate.area}:${candidate.path}`;
    if (uniquePaths.has(key)) throw new Error("Duplicate archive path");
    uniquePaths.add(key);
    const bytes = Buffer.from(candidate.content, "base64");
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== candidate.checksum) {
      throw new Error(`Archive checksum mismatch: ${key}`);
    }
    if (candidate.area === "data" && candidate.path === "events.jsonl") {
      const eventLines = bytes
        .toString("utf8")
        .split(/\r?\n/)
        .filter((line) => line.length > 0);
      eventLines.forEach((line, index) => parseStoredEvents(line, index + 1));
    }
  }
  const document = value as ArchiveDocument;
  const manifest: ArchiveManifest = {
    schemaVersion: document.schemaVersion,
    createdAt: document.createdAt,
    files: document.files,
    configuration: document.configuration,
  };
  const manifestChecksum = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  if (manifestChecksum !== document.manifestChecksum) {
    throw new Error("Archive manifest checksum mismatch");
  }
  const fileKeys = new Set(
    document.files.map((file) => `${file.area}:${file.path}`),
  );
  for (const required of ["data:events.jsonl"]) {
    if (!fileKeys.has(required)) {
      throw new Error(`Archive is missing required file: ${required}`);
    }
  }
  return document;
}

async function rebuildStagedProjection(dataRoot: string): Promise<void> {
  const eventContent = await readFile(join(dataRoot, "events.jsonl"), "utf8");
  const uniqueEvents = new Map<string, LearningRecordEvent>();
  for (const [index, line] of eventContent
    .split(/\r?\n/)
    .filter((candidate) => candidate.length > 0)
    .entries()) {
    for (const event of parseStoredEvents(line, index + 1)) {
      const existing = uniqueEvents.get(event.eventId);
      if (existing && checksum(existing) !== checksum(event)) {
        throw new Error(`Conflicting event identifier: ${event.eventId}`);
      }
      uniqueEvents.set(event.eventId, event);
    }
  }
  const projectionPath = join(dataRoot, "projections.sqlite");
  await rm(projectionPath, { force: true });
  const database = new DatabaseSync(projectionPath);
  try {
    initializeProjection(database);
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const event of uniqueEvents.values()) projectEvent(database, event);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    if (
      readProjection(database).attempts.length !==
      [...uniqueEvents.values()].filter(
        (event) => event.type === "attempt.completed",
      ).length
    ) {
      throw new Error("Restored projection failed validation");
    }
  } finally {
    database.close();
  }
}

export function createLocalDataArchive(
  dependencies: LocalDataArchiveDependencies,
): LocalDataArchive {
  const clock = dependencies.clock ?? (() => new Date());
  return {
    async exportTo(outputPath) {
      const [dataFiles, workspaceFiles] = await Promise.all([
        collectArchiveFiles(dependencies.dataRoot, "data", (path) =>
          /^(events\.jsonl|projections\.sqlite|configuration\.json|quarantine-[a-f0-9]+\.jsonl)$/.test(
            path,
          ),
        ),
        collectArchiveFiles(
          dependencies.workspaceRoot,
          "workspaces",
          () => true,
        ),
      ]);
      const manifest: ArchiveManifest = {
        schemaVersion: SCHEMA_VERSION,
        createdAt: clock().toISOString(),
        files: [...dataFiles, ...workspaceFiles],
        configuration: {},
      };
      const document: ArchiveDocument = {
        ...manifest,
        manifestChecksum: createHash("sha256")
          .update(JSON.stringify(manifest))
          .digest("hex"),
      };
      await mkdir(dirname(outputPath), { recursive: true });
      const temporaryPath = `${outputPath}.tmp-${process.pid}`;
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, outputPath);
      return {
        schemaVersion: SCHEMA_VERSION,
        createdAt: document.createdAt,
        fileCount: document.files.length,
      };
    },
    async restoreFrom(inputPath) {
      const document = parseArchive(
        JSON.parse(await readFile(inputPath, "utf8")) as unknown,
      );
      const roots = {
        data: dependencies.dataRoot,
        workspaces: dependencies.workspaceRoot,
      } as const;
      const stamp = `${clock().getTime()}-${process.pid}`;
      const staged = new Map<ArchiveFile["area"], string>();
      const activated: {
        readonly root: string;
        readonly previous?: string;
      }[] = [];
      try {
        for (const area of ["data", "workspaces"] as const) {
          const root = roots[area];
          await mkdir(dirname(root), { recursive: true });
          const stage = join(
            dirname(root),
            `.cpp-learn-${area}-restore-${stamp}`,
          );
          await rm(stage, { recursive: true, force: true });
          await mkdir(stage, { recursive: true });
          staged.set(area, stage);
        }
        for (const file of document.files) {
          const destination = join(staged.get(file.area) ?? "", file.path);
          await mkdir(dirname(destination), { recursive: true });
          await writeFile(destination, Buffer.from(file.content, "base64"), {
            mode: 0o600,
          });
        }
        const stagedDataRoot = staged.get("data");
        if (!stagedDataRoot) throw new Error("Missing staged data root");
        await rebuildStagedProjection(stagedDataRoot);

        for (const area of ["data", "workspaces"] as const) {
          const root = roots[area];
          const stage = staged.get(area);
          if (!stage) throw new Error(`Missing restore stage: ${area}`);
          const previous = `${root}.pre-restore-${stamp}`;
          let hadPrevious = true;
          try {
            await rename(root, previous);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            hadPrevious = false;
          }
          try {
            await rename(stage, root);
          } catch (error) {
            if (hadPrevious) await rename(previous, root);
            throw error;
          }
          activated.push({ root, ...(hadPrevious ? { previous } : {}) });
        }
      } catch (error) {
        for (const item of activated.reverse()) {
          const failedRoot = `${item.root}.failed-restore-${stamp}`;
          await rename(item.root, failedRoot);
          if (item.previous) await rename(item.previous, item.root);
          await rm(failedRoot, { recursive: true, force: true });
        }
        throw error;
      } finally {
        for (const stage of staged.values()) {
          await rm(stage, { recursive: true, force: true });
        }
      }
      return {
        schemaVersion: SCHEMA_VERSION,
        restoredFiles: document.files.length,
      };
    },
  };
}

export function createJsonlLearningRecord(
  dependencies: JsonlRecordProbeDependencies,
): LearningRecord {
  const eventPath = join(dependencies.dataRoot, "events.jsonl");
  const projectionPath = join(dependencies.dataRoot, "projections.sqlite");
  const projectionTemporaryPath = join(
    dependencies.dataRoot,
    "projections.rebuild.sqlite",
  );
  const clock = dependencies.clock ?? (() => new Date());
  let operationQueue: Promise<unknown> = Promise.resolve();
  let database: DatabaseSync | undefined;
  let allEvents: LearningRecordEvent[] = [];
  const eventDigests = new Map<string, string>();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationQueue.then(operation);
    operationQueue = result.catch(() => undefined);
    return result;
  };

  const durableAppend = async (
    events: readonly LearningRecordEvent[],
  ): Promise<void> => {
    const log = await open(eventPath, "a");
    try {
      await log.write(storedLine(events));
      await log.sync();
    } finally {
      await log.close();
    }
  };

  const rebuildProjection = async (): Promise<LearningProjection> => {
    await rm(projectionTemporaryPath, { force: true });
    const candidate = new DatabaseSync(projectionTemporaryPath);
    try {
      initializeProjection(candidate);
      candidate.exec("BEGIN IMMEDIATE");
      try {
        for (const event of allEvents) projectEvent(candidate, event);
        candidate.exec("COMMIT");
      } catch (error) {
        candidate.exec("ROLLBACK");
        throw error;
      }
      const snapshot = readProjection(candidate);
      const expectedAttempts = new Set(
        allEvents
          .filter((event) => event.type === "attempt.completed")
          .map((event) => event.eventId),
      ).size;
      if (snapshot.attempts.length !== expectedAttempts) {
        throw new Error("Rebuilt projection failed validation");
      }
      candidate.close();
      database?.close();
      database = undefined;
      await rename(projectionTemporaryPath, projectionPath);
      database = new DatabaseSync(projectionPath);
      return snapshot;
    } catch (error) {
      try {
        candidate.close();
      } catch {
        // The candidate may already have been closed after validation.
      }
      await rm(projectionTemporaryPath, { force: true });
      throw error;
    }
  };

  return {
    initialize: () =>
      enqueue(async () => {
        await initializeJsonlRecord(dependencies);
        const content = await readFile(eventPath, "utf8");
        const lines = content.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const validEvents: LearningRecordEvent[] = [];
        let invalidIndex = -1;
        for (const [index, line] of lines.entries()) {
          try {
            validEvents.push(...parseStoredEvents(line, index + 1));
          } catch {
            invalidIndex = index;
            break;
          }
        }

        if (invalidIndex >= 0) {
          const validLines = lines.slice(0, invalidIndex);
          const invalidTail = lines.slice(invalidIndex).join("\n");
          const tailDigest = createHash("sha256")
            .update(invalidTail)
            .digest("hex");
          const quarantinedFile = `quarantine-${tailDigest.slice(0, 12)}.jsonl`;
          await writeFile(
            join(dependencies.dataRoot, quarantinedFile),
            invalidTail,
            "utf8",
          );
          const repairedPath = `${eventPath}.recovered`;
          await writeFile(
            repairedPath,
            validLines.length > 0 ? `${validLines.join("\n")}\n` : "",
            "utf8",
          );
          await rename(repairedPath, eventPath);
          const recovery: RecoveryPerformedEvent = {
            schemaVersion: SCHEMA_VERSION,
            eventId: `recovery_${tailDigest}`,
            type: "recovery.performed",
            occurredAt: clock().toISOString(),
            quarantinedFile,
            invalidBytes: Buffer.byteLength(invalidTail),
          };
          await durableAppend([recovery]);
          validEvents.push(recovery);
        }

        allEvents = [];
        eventDigests.clear();
        for (const event of validEvents) {
          const digest = checksum(event);
          const existingDigest = eventDigests.get(event.eventId);
          if (existingDigest) {
            if (existingDigest !== digest) {
              throw new Error(`Conflicting event identifier: ${event.eventId}`);
            }
            continue;
          }
          eventDigests.set(event.eventId, digest);
          allEvents.push(event);
        }
        await rebuildProjection();
      }),
    readiness: createJsonlRecordProbe(dependencies),
    append(event) {
      return this.appendBatch([event]);
    },
    appendBatch(events) {
      return enqueue(async () => {
        if (events.length === 0 || !events.every(isLearningRecordEvent)) {
          throw new Error("Invalid learning record event batch");
        }
        const pending: LearningRecordEvent[] = [];
        const batchDigests = new Map<string, string>();
        for (const event of events) {
          const digest = checksum(event);
          const existingDigest = eventDigests.get(event.eventId);
          const batchDigest = batchDigests.get(event.eventId);
          if (
            (existingDigest && existingDigest !== digest) ||
            (batchDigest && batchDigest !== digest)
          ) {
            throw new Error(`Conflicting event identifier: ${event.eventId}`);
          }
          batchDigests.set(event.eventId, digest);
          if (
            !existingDigest &&
            !pending.some((candidate) => candidate.eventId === event.eventId)
          ) {
            pending.push(event);
          }
        }
        if (pending.length === 0) return;
        if (!database) throw new Error("Learning record is not initialized");
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const event of pending) projectEvent(database, event);
          await durableAppend(pending);
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        for (const event of pending) {
          eventDigests.set(event.eventId, checksum(event));
          allEvents.push(event);
        }
      });
    },
    list: () =>
      enqueue(async () => {
        if (!database) throw new Error("Learning record is not initialized");
        return readProjection(database).attempts;
      }),
    events: () => enqueue(async () => [...allEvents]),
    projection: () =>
      enqueue(async () => {
        if (!database) throw new Error("Learning record is not initialized");
        return readProjection(database);
      }),
    rebuild: () => enqueue(rebuildProjection),
  };
}
