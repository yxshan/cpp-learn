import { posix } from "node:path";
import { lstat } from "node:fs/promises";
import { join } from "node:path";

export type EditablePathResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly code: "invalid_path" };

export function validateEditablePath(
  candidate: string,
  editablePaths: readonly string[],
): EditablePathResult {
  if (
    candidate.length === 0 ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    candidate.includes(":") ||
    posix.isAbsolute(candidate) ||
    candidate.split("/").includes("..") ||
    candidate
      .split("/")
      .some((segment) =>
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
      )
  ) {
    return { ok: false, code: "invalid_path" };
  }

  const normalizedPath = posix.normalize(candidate);
  if (normalizedPath !== candidate || !editablePaths.includes(normalizedPath)) {
    return { ok: false, code: "invalid_path" };
  }

  return { ok: true, path: normalizedPath };
}

export interface ResolveEditablePathRequest {
  readonly workspaceRoot: string;
  readonly candidate: string;
  readonly editablePaths: readonly string[];
}

export type ActivityId = string;
export type SnapshotId = string;

export interface WorkspaceView {
  readonly activityId: ActivityId;
  readonly revision: number;
  readonly files: Readonly<Record<string, string>>;
}

export interface SaveWorkspaceRequest {
  readonly activityId: ActivityId;
  readonly baseRevision: number;
  readonly changes: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

export type SaveWorkspaceResult =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly code: "revision_conflict" | "invalid_path" };

export interface SourceSnapshot {
  readonly id: SnapshotId;
  readonly activityId: ActivityId;
  readonly digest: string;
}

export interface WorkspaceDiff {
  readonly from: SnapshotId;
  readonly to: SnapshotId;
  readonly changedPaths: readonly string[];
}

export interface Workspace {
  open(activityId: ActivityId): Promise<WorkspaceView>;
  save(request: SaveWorkspaceRequest): Promise<SaveWorkspaceResult>;
  snapshot(activityId: ActivityId): Promise<SourceSnapshot>;
  diff(from: SnapshotId, to: SnapshotId): Promise<WorkspaceDiff>;
}

export async function resolveEditablePath(
  request: ResolveEditablePathRequest,
): Promise<EditablePathResult> {
  const lexicalResult = validateEditablePath(
    request.candidate,
    request.editablePaths,
  );
  if (!lexicalResult.ok) return lexicalResult;

  const segments = lexicalResult.path.split("/");
  for (
    let segmentCount = 0;
    segmentCount <= segments.length;
    segmentCount += 1
  ) {
    const path = join(
      request.workspaceRoot,
      ...segments.slice(0, segmentCount),
    );
    try {
      const pathInfo = await lstat(path);
      if (
        pathInfo.isSymbolicLink() ||
        pathInfo.isBlockDevice() ||
        pathInfo.isCharacterDevice()
      ) {
        return { ok: false, code: "invalid_path" };
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        break;
      }
      return { ok: false, code: "invalid_path" };
    }
  }

  return lexicalResult;
}
