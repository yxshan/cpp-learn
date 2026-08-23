import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";

import type { RecordReadiness } from "@cpp-learn/contracts";

export interface JsonlRecordProbeDependencies {
  readonly dataRoot: string;
}

export function createJsonlRecordProbe(
  dependencies: JsonlRecordProbeDependencies
): () => Promise<RecordReadiness> {
  return async () => {
    try {
      await mkdir(dependencies.dataRoot, { recursive: true });
      const eventLog = await open(join(dependencies.dataRoot, "events.jsonl"), "a");
      await eventLog.close();
      return { ready: true };
    } catch {
      return {
        ready: false,
        issues: ["Learning record data root is not writable"]
      };
    }
  };
}
