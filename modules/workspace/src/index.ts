import { posix } from "node:path";
import { lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
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

export interface InMemoryWorkspaceActivity {
  readonly activityId: ActivityId;
  readonly editablePaths: readonly string[];
  readonly starterFiles: Readonly<Record<string, string>>;
}

interface InMemoryActivityState {
  readonly editablePaths: readonly string[];
  revision: number;
  files: Record<string, string>;
}

interface StoredSnapshot extends SourceSnapshot {
  readonly files: Readonly<Record<string, string>>;
}

function copyFiles(
  files: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...files };
}

export function createInMemoryWorkspace(
  activities: readonly InMemoryWorkspaceActivity[],
): Workspace {
  const activityStates = new Map<ActivityId, InMemoryActivityState>(
    activities.map((activity) => [
      activity.activityId,
      {
        editablePaths: activity.editablePaths,
        revision: 0,
        files: copyFiles(activity.starterFiles),
      },
    ]),
  );
  const snapshots = new Map<SnapshotId, StoredSnapshot>();

  function requireActivity(activityId: ActivityId): InMemoryActivityState {
    const activity = activityStates.get(activityId);
    if (!activity) throw new Error(`Unknown Activity: ${activityId}`);
    return activity;
  }

  return {
    async open(activityId) {
      const activity = requireActivity(activityId);
      return {
        activityId,
        revision: activity.revision,
        files: copyFiles(activity.files),
      };
    },
    async save(request) {
      const activity = requireActivity(request.activityId);
      if (request.baseRevision !== activity.revision) {
        return { ok: false, code: "revision_conflict" };
      }
      if (
        request.changes.some(
          (change) =>
            !validateEditablePath(change.path, activity.editablePaths).ok,
        )
      ) {
        return { ok: false, code: "invalid_path" };
      }

      const nextFiles = copyFiles(activity.files);
      for (const change of request.changes)
        nextFiles[change.path] = change.content;
      activity.files = nextFiles;
      activity.revision += 1;
      return { ok: true, revision: activity.revision };
    },
    async snapshot(activityId) {
      const activity = requireActivity(activityId);
      const files = copyFiles(activity.files);
      const canonicalSource = JSON.stringify({
        activityId,
        files: Object.fromEntries(
          Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
        ),
      });
      const digest = createHash("sha256").update(canonicalSource).digest("hex");
      const snapshot: StoredSnapshot = {
        id: `snap_${digest.slice(0, 20)}`,
        activityId,
        digest,
        files,
      };
      snapshots.set(snapshot.id, snapshot);
      return { id: snapshot.id, activityId, digest };
    },
    async diff(from, to) {
      const fromSnapshot = snapshots.get(from);
      const toSnapshot = snapshots.get(to);
      if (!fromSnapshot || !toSnapshot)
        throw new Error("Unknown Source Snapshot");
      const allPaths = new Set([
        ...Object.keys(fromSnapshot.files),
        ...Object.keys(toSnapshot.files),
      ]);
      const changedPaths = [...allPaths]
        .filter((path) => fromSnapshot.files[path] !== toSnapshot.files[path])
        .sort();
      return { from, to, changedPaths };
    },
  };
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
