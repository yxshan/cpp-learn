import {
  SCHEMA_VERSION,
  type CurriculumReadiness,
  type LearningPlatform,
  type QueryResult,
  type RecordReadiness,
  type ToolchainReadiness,
} from "@cpp-learn/contracts";

export interface LearningPlatformProbes {
  curriculum(): Promise<CurriculumReadiness>;
  toolchain(): Promise<ToolchainReadiness>;
  record(): Promise<RecordReadiness>;
}

export interface LearningPlatformDependencies {
  readonly clock: () => Date;
  readonly probes: LearningPlatformProbes;
}

export function createLearningPlatform(
  dependencies: LearningPlatformDependencies,
): LearningPlatform {
  return {
    async dispatch(): Promise<never> {
      throw new Error("No Learning Commands are defined in Stage 0");
    },
    async query(query): Promise<QueryResult> {
      switch (query.type) {
        case "bootstrap.get": {
          const [curriculum, toolchain, record] = await Promise.all([
            dependencies.probes.curriculum(),
            dependencies.probes.toolchain(),
            dependencies.probes.record(),
          ]);

          return {
            schemaVersion: SCHEMA_VERSION,
            generatedAt: dependencies.clock().toISOString(),
            ready: curriculum.ready && toolchain.ready && record.ready,
            services: { curriculum, toolchain, record },
          };
        }
      }
    },
    async *events() {
      // Judge jobs are introduced by the Stage 1 vertical slice.
    },
  };
}
