import Ajv from "ajv";
import addFormats from "ajv-formats";

import bootstrapResultSchema from "./bootstrap-result.schema.json" with { type: "json" };

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
export type LearningCommand = never;
export type CommandResult = never;
export type JobId = string;

export interface PlatformEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly jobId: JobId;
  readonly sequence: number;
  readonly type: string;
}

export interface LearningPlatform {
  dispatch(command: LearningCommand): Promise<CommandResult>;
  query(query: LearningQuery): Promise<QueryResult>;
  events(jobId: JobId): AsyncIterable<PlatformEvent>;
}

const ajv = new Ajv({
  allErrors: true,
  strict: true,
});
addFormats(ajv);
const validateBootstrapResult = ajv.compile(bootstrapResultSchema);

export function parseBootstrapResult(value: unknown): BootstrapResult {
  if (!validateBootstrapResult(value)) {
    throw new Error("Bootstrap response violates the transport contract");
  }
  return value as unknown as BootstrapResult;
}

export { bootstrapResultSchema };
