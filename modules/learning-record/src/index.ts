import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { access, mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  AttemptCompletedEvent,
  RecordReadiness,
} from "@cpp-learn/contracts";

export interface JsonlRecordProbeDependencies {
  readonly dataRoot: string;
}

export interface LearningRecordLifecycle {
  initialize(): Promise<void>;
  readiness(): Promise<RecordReadiness>;
}

export interface LearningRecord extends LearningRecordLifecycle {
  append(event: AttemptCompletedEvent): Promise<void>;
  list(): Promise<readonly AttemptCompletedEvent[]>;
}

interface StoredEvent {
  readonly schemaVersion: 1;
  readonly event: AttemptCompletedEvent;
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
  return {
    initialize: () => initializeJsonlRecord(dependencies),
    readiness: createJsonlRecordProbe(dependencies),
  };
}

function checksum(event: AttemptCompletedEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function parseStoredEvent(
  line: string,
  lineNumber: number,
): AttemptCompletedEvent {
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
    !("event" in parsed) ||
    typeof parsed.event !== "object" ||
    parsed.event === null ||
    !("checksum" in parsed) ||
    typeof parsed.checksum !== "string"
  ) {
    throw new Error(`Invalid learning record envelope at line ${lineNumber}`);
  }
  const event = parsed.event as AttemptCompletedEvent;
  if (
    event.schemaVersion !== 1 ||
    event.type !== "attempt.completed" ||
    typeof event.eventId !== "string" ||
    parsed.checksum !== checksum(event)
  ) {
    throw new Error(`Corrupt learning record at line ${lineNumber}`);
  }
  return event;
}

export function createJsonlLearningRecord(
  dependencies: JsonlRecordProbeDependencies,
): LearningRecord {
  const eventPath = join(dependencies.dataRoot, "events.jsonl");
  let appendQueue: Promise<void> = Promise.resolve();

  return {
    initialize: () => initializeJsonlRecord(dependencies),
    readiness: createJsonlRecordProbe(dependencies),
    append(event) {
      const stored: StoredEvent = {
        schemaVersion: 1,
        event,
        checksum: checksum(event),
      };
      const operation = appendQueue.then(async () => {
        const log = await open(eventPath, "a");
        try {
          await log.write(`${JSON.stringify(stored)}\n`);
          await log.sync();
        } finally {
          await log.close();
        }
      });
      appendQueue = operation.catch(() => undefined);
      return operation;
    },
    async list() {
      await appendQueue;
      const content = await readFile(eventPath, "utf8");
      return content
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line, index) => parseStoredEvent(line, index + 1));
    },
  };
}
