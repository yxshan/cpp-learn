import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

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
  readonly starterFiles: Readonly<Record<string, string>>;
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

export interface SourceSnapshotView extends SourceSnapshot {
  readonly files: Readonly<Record<string, string>>;
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
  readSnapshot(snapshotId: SnapshotId): Promise<SourceSnapshotView>;
  diff(from: SnapshotId, to: SnapshotId): Promise<WorkspaceDiff>;
}

export interface InMemoryWorkspaceActivity {
  readonly activityId: ActivityId;
  readonly version?: number;
  readonly persistenceId?: string;
  readonly editablePaths: readonly string[];
  readonly starterFiles: Readonly<Record<string, string>>;
}

interface InMemoryActivityState {
  readonly editablePaths: readonly string[];
  readonly starterFiles: Readonly<Record<string, string>>;
  revision: number;
  files: Record<string, string>;
}

interface StoredSnapshot extends SourceSnapshot {
  readonly files: Readonly<Record<string, string>>;
}

interface PersistedWorkspaceState {
  readonly schemaVersion: 1;
  readonly activityId: ActivityId;
  readonly revision: number;
  readonly contentVersion?: number;
  readonly files: Readonly<Record<string, string>>;
}

function copyFiles(
  files: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...files };
}

function createSnapshot(
  activityId: ActivityId,
  files: Readonly<Record<string, string>>,
): StoredSnapshot {
  const copiedFiles = copyFiles(files);
  const canonicalSource = JSON.stringify({
    activityId,
    files: Object.fromEntries(
      Object.entries(copiedFiles).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
  const digest = createHash("sha256").update(canonicalSource).digest("hex");
  return {
    id: `snap_${digest.slice(0, 20)}`,
    activityId,
    digest,
    files: copiedFiles,
  };
}

export function createInMemoryWorkspace(
  activities: readonly InMemoryWorkspaceActivity[],
): Workspace {
  const activityStates = new Map<ActivityId, InMemoryActivityState>(
    activities.map((activity) => [
      activity.activityId,
      {
        editablePaths: activity.editablePaths,
        starterFiles: copyFiles(activity.starterFiles),
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
        starterFiles: copyFiles(activity.starterFiles),
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
      const snapshot = createSnapshot(activityId, activity.files);
      snapshots.set(snapshot.id, snapshot);
      return { id: snapshot.id, activityId, digest: snapshot.digest };
    },
    async readSnapshot(snapshotId) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) throw new Error("Unknown Source Snapshot");
      return { ...snapshot, files: copyFiles(snapshot.files) };
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

export interface FilesystemWorkspaceDependencies {
  readonly workspaceRoot: string;
  readonly activities: readonly InMemoryWorkspaceActivity[];
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function rejectSpecialPath(path: string): Promise<void> {
  try {
    const info = await lstat(path);
    if (
      info.isSymbolicLink() ||
      info.isBlockDevice() ||
      info.isCharacterDevice()
    ) {
      throw new Error("Workspace storage path is not a regular directory");
    }
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

export function createFilesystemWorkspace(
  dependencies: FilesystemWorkspaceDependencies,
): Workspace {
  const activityDefinitions = new Map(
    dependencies.activities.map((activity) => [activity.activityId, activity]),
  );
  const saveQueues = new Map<ActivityId, Promise<void>>();

  function requireDefinition(
    activityId: ActivityId,
  ): InMemoryWorkspaceActivity {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(activityId)) {
      throw new Error("Invalid Activity identifier");
    }
    const definition = activityDefinitions.get(activityId);
    if (!definition) throw new Error(`Unknown Activity: ${activityId}`);
    return definition;
  }

  async function activityRoot(activityId: ActivityId): Promise<string> {
    const definition = requireDefinition(activityId);
    await mkdir(dependencies.workspaceRoot, { recursive: true });
    await rejectSpecialPath(dependencies.workspaceRoot);
    const root = join(
      dependencies.workspaceRoot,
      definition.persistenceId ?? activityId,
    );
    await rejectSpecialPath(root);
    await mkdir(root, { recursive: true });
    return root;
  }

  async function stateForUnlocked(
    activityId: ActivityId,
  ): Promise<PersistedWorkspaceState> {
    const definition = requireDefinition(activityId);
    const root = await activityRoot(activityId);
    const statePath = join(root, "workspace.json");
    try {
      const persisted = await readJson<PersistedWorkspaceState>(statePath);
      const storedVersion = persisted.contentVersion ?? 1;
      const currentVersion = definition.version ?? 1;
      if (storedVersion >= currentVersion) return persisted;
      const upgradedFiles = copyFiles(persisted.files);
      for (const [path, content] of Object.entries(definition.starterFiles)) {
        if (!(path in upgradedFiles)) upgradedFiles[path] = content;
      }
      const upgraded: PersistedWorkspaceState = {
        ...persisted,
        activityId,
        revision: persisted.revision + 1,
        contentVersion: currentVersion,
        files: upgradedFiles,
      };
      await atomicWriteJson(statePath, upgraded);
      return upgraded;
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      const initialState: PersistedWorkspaceState = {
        schemaVersion: 1,
        activityId,
        revision: 0,
        contentVersion: definition.version ?? 1,
        files: copyFiles(definition.starterFiles),
      };
      await atomicWriteJson(statePath, initialState);
      return initialState;
    }
  }

  async function serializeSave<T>(
    activityId: ActivityId,
    action: () => Promise<T>,
  ): Promise<T> {
    const queueId = requireDefinition(activityId).persistenceId ?? activityId;
    const prior = saveQueues.get(queueId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = prior.then(() => current);
    saveQueues.set(queueId, queued);
    await prior;
    try {
      return await action();
    } finally {
      release();
      if (saveQueues.get(queueId) === queued) saveQueues.delete(queueId);
    }
  }

  async function storedSnapshot(
    snapshotId: SnapshotId,
  ): Promise<StoredSnapshot> {
    if (!/^snap_[a-f0-9]{20}$/.test(snapshotId)) {
      throw new Error("Invalid Source Snapshot identifier");
    }
    const root = await snapshotRoot();
    return readJson<StoredSnapshot>(join(root, `${snapshotId}.json`));
  }

  async function snapshotRoot(): Promise<string> {
    await mkdir(dependencies.workspaceRoot, { recursive: true });
    await rejectSpecialPath(dependencies.workspaceRoot);
    const root = join(dependencies.workspaceRoot, ".snapshots");
    await rejectSpecialPath(root);
    await mkdir(root, { recursive: true });
    await rejectSpecialPath(root);
    return root;
  }

  return {
    async open(activityId) {
      const definition = requireDefinition(activityId);
      const state = await serializeSave(activityId, () =>
        stateForUnlocked(activityId),
      );
      return {
        activityId,
        revision: state.revision,
        files: copyFiles(state.files),
        starterFiles: copyFiles(definition.starterFiles),
      };
    },
    async save(request) {
      return serializeSave(request.activityId, async () => {
        const definition = requireDefinition(request.activityId);
        const state = await stateForUnlocked(request.activityId);
        if (state.revision !== request.baseRevision) {
          return { ok: false, code: "revision_conflict" } as const;
        }
        if (
          request.changes.some(
            (change) =>
              !validateEditablePath(change.path, definition.editablePaths).ok,
          )
        ) {
          return { ok: false, code: "invalid_path" } as const;
        }
        const files = copyFiles(state.files);
        for (const change of request.changes)
          files[change.path] = change.content;
        const nextState: PersistedWorkspaceState = {
          schemaVersion: 1,
          activityId: request.activityId,
          revision: state.revision + 1,
          contentVersion: state.contentVersion ?? definition.version ?? 1,
          files,
        };
        const root = await activityRoot(request.activityId);
        await atomicWriteJson(join(root, "workspace.json"), nextState);
        return { ok: true, revision: nextState.revision } as const;
      });
    },
    async snapshot(activityId) {
      const state = await serializeSave(activityId, () =>
        stateForUnlocked(activityId),
      );
      const snapshot = createSnapshot(activityId, state.files);
      const root = await snapshotRoot();
      await atomicWriteJson(join(root, `${snapshot.id}.json`), snapshot);
      return {
        id: snapshot.id,
        activityId: snapshot.activityId,
        digest: snapshot.digest,
      };
    },
    async readSnapshot(snapshotId) {
      const snapshot = await storedSnapshot(snapshotId);
      return { ...snapshot, files: copyFiles(snapshot.files) };
    },
    async diff(from, to) {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        storedSnapshot(from),
        storedSnapshot(to),
      ]);
      const paths = new Set([
        ...Object.keys(fromSnapshot.files),
        ...Object.keys(toSnapshot.files),
      ]);
      return {
        from,
        to,
        changedPaths: [...paths]
          .filter((path) => fromSnapshot.files[path] !== toSnapshot.files[path])
          .sort(),
      };
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
