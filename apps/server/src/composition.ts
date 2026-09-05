import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import {
  DEFAULT_NATIVE_CPP_COMPILER,
  createNativeJudge,
  createNativeReferencePlayground,
  createNativeToolchainProbe,
  executeProcess,
} from "@cpp-learn/judge";
import {
  createJsonlLearningRecord,
  createLocalDataArchive,
} from "@cpp-learn/learning-record";
import { createLearningPlatform } from "@cpp-learn/learning-platform";
import {
  createFilesystemReferenceCatalog,
  createUnavailableReferenceCatalog,
  referenceVerificationManifestPath,
  resolveReferenceCppCompiler,
  type ReferenceCatalog,
} from "@cpp-learn/reference";
import { createFilesystemWorkspace } from "@cpp-learn/workspace";

import { createServer, type ServerDependencies } from "./server.js";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

export type ReferenceActivityIndexResult =
  | {
      readonly ok: true;
      readonly relatedActivityIdsByEntryId: ReadonlyMap<
        string,
        readonly string[]
      >;
    }
  | {
      readonly ok: false;
      readonly unknownLinks: readonly {
        readonly activityId: string;
        readonly referenceId: string;
      }[];
    };

export async function buildReferenceActivityIndex(
  activities: readonly {
    readonly id: string;
    readonly referenceIds?: readonly string[];
  }[],
  reference: ReferenceCatalog,
): Promise<ReferenceActivityIndexResult> {
  const index = new Map<string, string[]>();
  const unknownLinks: { activityId: string; referenceId: string }[] = [];
  for (const activity of activities) {
    for (const referenceId of activity.referenceIds ?? []) {
      if (!(await reference.getEntry(referenceId))) {
        unknownLinks.push({ activityId: activity.id, referenceId });
        continue;
      }
      const activityIds = index.get(referenceId) ?? [];
      activityIds.push(activity.id);
      index.set(referenceId, activityIds);
    }
  }
  return unknownLinks.length > 0
    ? { ok: false, unknownLinks }
    : { ok: true, relatedActivityIdsByEntryId: index };
}

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

export async function createProductionApplication(
  options: ProductionPlatformOptions = {},
) {
  const { dataRoot, workspaceRoot } = productionPaths(options);
  const curriculum = createFilesystemCurriculum({
    catalogPath: join(projectRoot, "curriculum", "catalog.json"),
    privateJudgePath: join(projectRoot, "judge-private", "tests.json"),
  });
  const referenceCatalogPath = join(projectRoot, "reference", "catalog.json");
  const baseReference = createFilesystemReferenceCatalog({
    catalogPath: referenceCatalogPath,
  });
  const compiler = DEFAULT_NATIVE_CPP_COMPILER;
  const toolchainProbe = createNativeToolchainProbe({
    execute: executeProcess,
    compiler,
  });
  const toolchain = await toolchainProbe();
  const referenceCompiler = resolveReferenceCppCompiler();
  const referenceToolchain = await createNativeToolchainProbe({
    execute: executeProcess,
    compiler: referenceCompiler,
  })();
  const referenceReadiness = await baseReference.readiness();
  let reference: ReferenceCatalog = baseReference;
  if (referenceReadiness.ready) {
    const activityIndex = await buildReferenceActivityIndex(
      await curriculum.listActivities(),
      baseReference,
    );
    reference = activityIndex.ok
      ? createFilesystemReferenceCatalog({
          catalogPath: referenceCatalogPath,
          relatedActivityIdsByEntryId:
            activityIndex.relatedActivityIdsByEntryId,
          ...(referenceToolchain.ready &&
          referenceToolchain.compiler !== undefined
            ? {
                verification: {
                  manifestPath: referenceVerificationManifestPath(dataRoot),
                  compilerFingerprint: referenceToolchain.compiler,
                },
              }
            : {}),
        })
      : createUnavailableReferenceCatalog("integration_invalid");
  }
  const record = createJsonlLearningRecord({ dataRoot });
  await record.initialize();
  const workspace = createFilesystemWorkspace({
    workspaceRoot,
    activities: await curriculum.listWorkspaceActivities(),
  });
  const platform = createLearningPlatform({
    clock: () => new Date(),
    curriculum,
    workspace,
    judge: createNativeJudge({
      compiler,
      compilerFingerprint: toolchain.compiler ?? "clang++ unavailable",
      webFrontendHarness: join(
        projectRoot,
        "scripts",
        "verify-react-project.mjs",
      ),
    }),
    record: {
      append: (event) => record.append(event),
      appendEvent: (event) => record.append(event),
      appendBatch: (events) => record.appendBatch(events),
      list: () => record.list(),
      events: () => record.events(),
      projection: () => record.projection(),
    },
    probes: {
      curriculum: () => curriculum.readiness(),
      toolchain: toolchainProbe,
      record: () => record.readiness(),
    },
  });
  const referencePlayground = createNativeReferencePlayground({
    compiler: referenceCompiler,
    compilerFingerprint:
      referenceToolchain.compiler ?? `${referenceCompiler} unavailable`,
  });
  return { platform, reference, referencePlayground };
}

type ProductionApplication = Awaited<
  ReturnType<typeof createProductionApplication>
>;

type ProductionHttpServerOptions = Omit<
  ServerDependencies,
  "platform" | "reference"
>;

export function createProductionHttpServer(
  application: ProductionApplication,
  options: ProductionHttpServerOptions,
) {
  return createServer({
    ...options,
    platform: application.platform,
    reference: application.reference,
    referencePlayground: application.referencePlayground,
  });
}

export async function createProductionPlatform(
  options: ProductionPlatformOptions = {},
) {
  return (await createProductionApplication(options)).platform;
}
