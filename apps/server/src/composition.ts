import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFilesystemCurriculumProbe } from "@cpp-learn/curriculum";
import { createNativeToolchainProbe, executeProcess } from "@cpp-learn/judge";
import { createJsonlRecordProbe } from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

export interface ProductionPlatformOptions {
  readonly dataRoot?: string;
}

export function createProductionPlatform(options: ProductionPlatformOptions = {}) {
  const dataRoot = options.dataRoot ?? join(projectRoot, ".cpp-learn", "data");
  return createLearningPlatform({
    clock: () => new Date(),
    probes: {
      curriculum: createFilesystemCurriculumProbe({
        catalogPath: join(projectRoot, "curriculum", "catalog.json")
      }),
      toolchain: createNativeToolchainProbe({ execute: executeProcess }),
      record: createJsonlRecordProbe({ dataRoot })
    }
  });
}

