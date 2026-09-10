import type { REFERENCE_SCHEMA_VERSION, SCHEMA_VERSION } from "./index.ts";
import type { JudgeDiagnostic } from "./judge.ts";

/**
 * Reference transport contracts
 *
 * Entry shape, search, navigation, readiness, and the Playground DTOs. Self-contained: nothing here depends on another contract domain.
 */

export const REFERENCE_ENTRY_KINDS = [
  "landing",
  "header",
  "type",
  "object",
  "function",
  "member",
  "concept",
  "guide",
] as const;
export type ReferenceEntryKind = (typeof REFERENCE_ENTRY_KINDS)[number];

export const CPP_STANDARDS = [
  "c++98",
  "c++03",
  "c++11",
  "c++14",
  "c++17",
  "c++20",
  "c++23",
  "c++26-draft",
] as const;
export type CppStandard = (typeof CPP_STANDARDS)[number];

export const REFERENCE_VERIFICATIONS = [
  "verified",
  "unsupported",
  "not-checked",
] as const;
export type ReferenceVerification = (typeof REFERENCE_VERIFICATIONS)[number];

export interface ReferenceSource {
  readonly kind: "primary" | "secondary" | "vendor";
  readonly title: string;
  readonly url: string;
  readonly standardSection?: string;
  readonly reusedMaterial?: {
    readonly license: string;
    readonly attribution: string;
    readonly modifications: string;
  };
}

export interface ReferenceExampleView {
  readonly id: string;
  readonly kind: "compile" | "run" | "expected-compile-failure";
  readonly standard: CppStandard;
  readonly source: string;
  readonly digest: string;
  readonly verification: ReferenceVerification;
  readonly stdin?: string;
  readonly expectedStdout?: string;
  readonly expectedDiagnosticCategory?: string;
}

export interface ReferenceEntryDetail {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly id: string;
  readonly version: number;
  readonly slug: string;
  readonly kind: ReferenceEntryKind;
  readonly title: string;
  readonly summary: string;
  readonly symbol?: string;
  readonly header?: string;
  readonly namespace?: string;
  readonly since?: CppStandard;
  readonly deprecatedSince?: CppStandard;
  readonly removedSince?: CppStandard;
  readonly aliases: readonly string[];
  readonly categories: readonly string[];
  readonly relatedEntryIds: readonly string[];
  readonly content: string;
  readonly examples: readonly ReferenceExampleView[];
  readonly sources: readonly ReferenceSource[];
  readonly verifiedAt: string;
  readonly relatedActivityIds: readonly string[];
}

export type ReferencePlaygroundVerdict =
  | "success"
  | "compile_error"
  | "runtime_error"
  | "timeout"
  | "output_limit"
  | "cancelled"
  | "system_error";

export interface ReferencePlaygroundStage {
  readonly kind: "compile" | "run";
  readonly outcome: "pass" | "fail" | "system_error";
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly diagnostics?: readonly JudgeDiagnostic[];
}

export interface ReferencePlaygroundRunResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly runId: string;
  readonly entryId: string;
  readonly exampleId: string;
  readonly verdict: ReferencePlaygroundVerdict;
  readonly stdout: string;
  readonly stderr: string;
  readonly stages: readonly ReferencePlaygroundStage[];
  readonly toolchain: {
    readonly compiler: string;
    readonly standard: CppStandard;
    readonly flags: readonly string[];
  };
}

export interface ReferencePlaygroundRunRequestDto {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly runId: string;
  readonly source: string;
}

export interface ReferencePlaygroundCancellationRequestDto {
  readonly schemaVersion: typeof SCHEMA_VERSION;
}

export interface ReferencePlaygroundCancellationResult {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly runId: string;
  readonly cancelled: boolean;
}

export interface ReferenceSearchQuery {
  readonly text: string;
  readonly kind?: ReferenceEntryKind;
  readonly category?: string;
  readonly standard?: CppStandard;
  readonly verified?: ReferenceVerification;
  readonly limit?: number;
}

export type ReferenceMatchField =
  | "id"
  | "symbol"
  | "header"
  | "alias"
  | "title"
  | "heading"
  | "category"
  | "body";

export interface ReferenceSearchItem {
  readonly id: string;
  readonly slug: string;
  readonly kind: ReferenceEntryKind;
  readonly title: string;
  readonly summary: string;
  readonly symbol?: string;
  readonly header?: string;
  readonly since?: CppStandard;
  readonly deprecatedSince?: CppStandard;
  readonly verification: ReferenceVerification;
  readonly matchedBy: readonly ReferenceMatchField[];
}

export interface ReferenceSearchResult {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly query: ReferenceSearchQuery;
  readonly total: number;
  readonly results: readonly ReferenceSearchItem[];
}

export interface ReferenceSlugResolution {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly entryId: string;
  readonly canonicalSlug: string;
  readonly redirected: boolean;
}

export interface ReferenceNavigation {
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
  readonly catalogVersion: number;
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
    readonly parentId?: string;
    readonly order: number;
    readonly entryIds: readonly string[];
  }[];
  readonly supportedStandards: readonly CppStandard[];
}

export type ReferenceReadinessIssueCode =
  "catalog_missing" | "catalog_invalid" | "integration_invalid";

export type ReferenceReadiness =
  | {
      readonly ready: true;
      readonly catalogVersion: number;
      readonly entryCount: number;
      readonly activationDurationMs: number;
    }
  | {
      readonly ready: false;
      readonly issueCodes: readonly ReferenceReadinessIssueCode[];
    };
