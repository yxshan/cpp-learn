import { constants } from "node:fs";
import { access, mkdir, open } from "node:fs/promises";
import { join } from "node:path";

import type { RecordReadiness } from "@cpp-learn/contracts";

export interface JsonlRecordProbeDependencies {
  readonly dataRoot: string;
}

export interface LearningRecordLifecycle {
  initialize(): Promise<void>;
  readiness(): Promise<RecordReadiness>;
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
