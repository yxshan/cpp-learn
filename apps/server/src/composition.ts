import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import {
  createNativeJudge,
  createNativeToolchainProbe,
  executeProcess,
} from "@cpp-learn/judge";
import {
  createJsonlLearningRecord,
  createLocalDataArchive,
} from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import { createFilesystemWorkspace } from "@cpp-learn/workspace";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

export interface ProductionPlatformOptions {
  readonly dataRoot?: string;
  readonly workspaceRoot?: string;
}

function productionPaths(options: ProductionPlatformOptions) {
  return {
    dataRoot: options.dataRoot ?? join(projectRoot, ".cpp-learn", "data"),
    workspaceRoot:
      options.workspaceRoot ?? join(projectRoot, ".cpp-learn", "workspaces"),
  };
}

export function createProductionDataArchive(
  options: ProductionPlatformOptions = {},
) {
  return createLocalDataArchive(productionPaths(options));
}

export async function createProductionPlatform(
  options: ProductionPlatformOptions = {},
) {
  const { dataRoot, workspaceRoot } = productionPaths(options);
  const curriculum = createFilesystemCurriculum({
    catalogPath: join(projectRoot, "curriculum", "catalog.json"),
  });
  const record = createJsonlLearningRecord({ dataRoot });
  await record.initialize();
  const compiler = "/usr/bin/clang++";
  const toolchainProbe = createNativeToolchainProbe({
    execute: executeProcess,
    compiler,
  });
  const toolchain = await toolchainProbe();
  const workspace = createFilesystemWorkspace({
    workspaceRoot,
    activities: await curriculum.listWorkspaceActivities(),
  });
  return createLearningPlatform({
    clock: () => new Date(),
    curriculum,
    workspace,
    judge: createNativeJudge({
      compiler,
      compilerFingerprint: toolchain.compiler ?? "clang++ unavailable",
    }),
    record,
    probes: {
      curriculum: () => curriculum.readiness(),
      toolchain: toolchainProbe,
      record: () => record.readiness(),
    },
  });
}
