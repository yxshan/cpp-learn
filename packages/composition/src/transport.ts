import { createHash } from "node:crypto";

import type {
  ReferencePlaygroundCancellationRequestDto,
  ReferencePlaygroundRunRequestDto,
} from "@cpp-learn/contracts";

/**
 * Shared transport policy for the local HTTP Adapter.
 *
 * Origin handling, request-body guards, and byte budgets live here so that every
 * route group enforces the same rules instead of each re-implementing them.
 * `server.ts` only installs route groups.
 */

export const MAX_ARCHIVE_REQUEST_BYTES = 64 * 1024 * 1024;
export const MAX_REFERENCE_PLAYGROUND_SOURCE_BYTES = 64 * 1024;
export const REFERENCE_PLAYGROUND_RUN_ID =
  /^ref_run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface SaveWorkspaceBody {
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly changes: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

interface ExecuteActivityBody {
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly attemptId?: string;
}

export function isReferencePlaygroundRunBody(
  value: unknown,
): value is ReferencePlaygroundRunRequestDto {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    Object.keys(body).length === 3 &&
    body["schemaVersion"] === 1 &&
    typeof body["runId"] === "string" &&
    REFERENCE_PLAYGROUND_RUN_ID.test(body["runId"]) &&
    typeof body["source"] === "string" &&
    body["source"].length > 0
  );
}

export function isReferencePlaygroundCancellationBody(
  value: unknown,
): value is ReferencePlaygroundCancellationRequestDto {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body["schemaVersion"] === 1;
}

export function isExecuteActivityBody(
  value: unknown,
): value is ExecuteActivityBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body["schemaVersion"] === 1 &&
    typeof body["commandId"] === "string" &&
    (body["attemptId"] === undefined || typeof body["attemptId"] === "string")
  );
}

export function recordBody(
  value: unknown,
): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function isRestoreBody(value: unknown): value is ExecuteActivityBody & {
  readonly confirm: true;
  readonly archive: unknown;
} {
  return (
    isExecuteActivityBody(value) &&
    "confirm" in value &&
    value.confirm === true &&
    "archive" in value
  );
}

export function isAllowedMutationOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function isSaveWorkspaceBody(
  value: unknown,
): value is SaveWorkspaceBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body["schemaVersion"] === 1 &&
    typeof body["commandId"] === "string" &&
    Number.isInteger(body["baseRevision"]) &&
    Array.isArray(body["changes"]) &&
    body["changes"].every((change) => {
      if (typeof change !== "object" || change === null) return false;
      const candidate = change as Record<string, unknown>;
      return (
        typeof candidate["path"] === "string" &&
        typeof candidate["content"] === "string"
      );
    })
  );
}

export function createReferencePlaygroundSnapshot(source: string) {
  const digest = createHash("sha256").update(source).digest("hex");
  return Object.freeze({
    id: `ref_snapshot_${digest.slice(0, 24)}`,
    digest,
    source,
  });
}
