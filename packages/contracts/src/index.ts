export const SCHEMA_VERSION = 1 as const;

export interface CurriculumReadiness {
  readonly ready: boolean;
  readonly activityCount: number;
  readonly issues?: readonly string[];
}

export interface ToolchainReadiness {
  readonly ready: boolean;
  readonly compiler?: string;
  readonly issues?: readonly string[];
}

export interface RecordReadiness {
  readonly ready: boolean;
  readonly issues?: readonly string[];
}

export interface BootstrapResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly ready: boolean;
  readonly services: {
    readonly curriculum: CurriculumReadiness;
    readonly toolchain: ToolchainReadiness;
    readonly record: RecordReadiness;
  };
}

export type LearningQuery = { readonly type: "bootstrap.get" };
export type QueryResult = BootstrapResult;

export interface LearningPlatform {
  query(query: LearningQuery): Promise<QueryResult>;
}

