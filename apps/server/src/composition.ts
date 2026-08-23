import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import { createNativeToolchainProbe, executeProcess } from "@cpp-learn/judge";
import { createJsonlRecordLifecycle } from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

export interface ProductionPlatformOptions {
  readonly dataRoot?: string;
}

export async function createProductionPlatform(
  options: ProductionPlatformOptions = {},
) {
  const dataRoot = options.dataRoot ?? join(projectRoot, ".cpp-learn", "data");
  const curriculum = createFilesystemCurriculum({
    catalogPath: join(projectRoot, "curriculum", "catalog.json"),
  });
  const record = createJsonlRecordLifecycle({ dataRoot });
  await record.initialize();
  return createLearningPlatform({
    clock: () => new Date(),
    probes: {
      curriculum: () => curriculum.readiness(),
      toolchain: createNativeToolchainProbe({ execute: executeProcess }),
      record: () => record.readiness(),
    },
  });
}
