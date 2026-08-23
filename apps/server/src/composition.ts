import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import {
  createNativeJudge,
  createNativeToolchainProbe,
  executeProcess,
} from "@cpp-learn/judge";
import { createJsonlLearningRecord } from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import { createFilesystemWorkspace } from "@cpp-learn/workspace";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

export interface ProductionPlatformOptions {
  readonly dataRoot?: string;
  readonly workspaceRoot?: string;
}

export async function createProductionPlatform(
  options: ProductionPlatformOptions = {},
) {
  const dataRoot = options.dataRoot ?? join(projectRoot, ".cpp-learn", "data");
  const workspaceRoot =
    options.workspaceRoot ?? join(projectRoot, ".cpp-learn", "workspaces");
  const curriculum = createFilesystemCurriculum({
    catalogPath: join(projectRoot, "curriculum", "catalog.json"),
  });
  const record = createJsonlLearningRecord({ dataRoot });
  await record.initialize();
  const workspace = createFilesystemWorkspace({
    workspaceRoot,
    activities: await curriculum.listWorkspaceActivities(),
  });
  return createLearningPlatform({
    clock: () => new Date(),
    curriculum,
    workspace,
    judge: createNativeJudge(),
    record,
    probes: {
      curriculum: () => curriculum.readiness(),
      toolchain: createNativeToolchainProbe({ execute: executeProcess }),
      record: () => record.readiness(),
    },
  });
}
