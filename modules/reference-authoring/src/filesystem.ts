import { randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type {
  AuthoringDraftManifest,
  AuthoringCatalogProposal,
  AuthoringFactSheet,
  AuthoringReport,
  AuthoringSourceLedger,
  DraftWorkspace,
  ReferenceDraftRepository,
} from "./index.js";

export interface FilesystemReferenceDraftRepositoryOptions {
  readonly root: string;
  readonly forbiddenRoots?: readonly string[];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function assertDraftId(draftId: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(draftId)) {
    throw new Error(`Invalid draft ID: ${draftId}`);
  }
}

function assertWorkspacePath(path: string): void {
  if (
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === ".." || part === ".")
  ) {
    throw new Error(`Unsafe draft workspace path: ${path}`);
  }
}

function resolveInside(root: string, path: string): string {
  assertWorkspacePath(path);
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === "..") {
    throw new Error(`Draft workspace path escaped its root: ${path}`);
  }
  return target;
}

function physicalPath(path: string): string {
  let existing = resolve(path);
  const missingSegments: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    missingSegments.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...missingSegments);
}

function isAtOrInside(path: string, root: string): boolean {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== "..")
  );
}

function assertRepositoryRootAllowed(
  repositoryRoot: string,
  forbiddenRoots: readonly string[],
): void {
  const physicalRepositoryRoot = physicalPath(repositoryRoot);
  for (const forbiddenRoot of forbiddenRoots.map(physicalPath)) {
    if (
      isAtOrInside(physicalRepositoryRoot, forbiddenRoot) ||
      isAtOrInside(forbiddenRoot, physicalRepositoryRoot)
    ) {
      throw new Error(
        `Draft root must be separate from protected content: ${repositoryRoot}`,
      );
    }
  }
}

async function writeWorkspaceFiles(
  root: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const target = resolveInside(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { encoding: "utf8", flag: "wx" });
  }
}

async function readWorkspaceFiles(
  root: string,
  current = root,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Draft workspace contains a symbolic link: ${entry.name}`,
      );
    }
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await readWorkspaceFiles(root, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Draft workspace contains an unsupported file: ${entry.name}`,
      );
    }
    const path = relative(root, absolutePath).split(sep).join("/");
    assertWorkspacePath(path);
    files[path] = await readFile(absolutePath, "utf8");
  }
  return files;
}

function parseJson<T>(
  files: Readonly<Record<string, string>>,
  path: string,
): T {
  const source = files[path];
  if (source === undefined)
    throw new Error(`Draft artifact is missing: ${path}`);
  try {
    return JSON.parse(source) as T;
  } catch (error) {
    throw new Error(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
      { cause: error },
    );
  }
}

async function readWorkspace(
  repositoryRoot: string,
  draftId: string,
): Promise<DraftWorkspace | undefined> {
  assertDraftId(draftId);
  const draftRoot = join(repositoryRoot, draftId);
  let files: Record<string, string>;
  try {
    files = await readWorkspaceFiles(draftRoot);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
  return {
    draft: parseJson<AuthoringDraftManifest>(files, "draft.json"),
    proposal: parseJson<AuthoringCatalogProposal>(
      files,
      "catalog-proposal.json",
    ),
    facts: parseJson<AuthoringFactSheet>(files, "facts.json"),
    sources: parseJson<AuthoringSourceLedger>(files, "sources.json"),
    report: parseJson<AuthoringReport>(files, "report.json"),
    files,
  };
}

function sameFileSnapshot(
  current: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
  ignoredPaths: ReadonlySet<string> = new Set(),
): boolean {
  const currentPaths = Object.keys(current).filter(
    (path) => !ignoredPaths.has(path),
  );
  const expectedPaths = Object.keys(expected).filter(
    (path) => !ignoredPaths.has(path),
  );
  return (
    currentPaths.length === expectedPaths.length &&
    currentPaths.every((path) => current[path] === expected[path])
  );
}

interface DraftLockOwner {
  readonly schemaVersion: 1;
  readonly pid: number;
  readonly token: string;
}

async function lockOwnerIsActive(lockPath: string): Promise<boolean> {
  let owner: DraftLockOwner;
  try {
    owner = JSON.parse(await readFile(lockPath, "utf8")) as DraftLockOwner;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    return false;
  }
  if (!Number.isInteger(owner.pid) || owner.pid < 1) return false;
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === "EPERM";
  }
}

async function acquireDraftLock(
  repositoryRoot: string,
  draftId: string,
  wait: boolean,
): Promise<(() => Promise<void>) | undefined> {
  await mkdir(repositoryRoot, { recursive: true });
  const lockPath = join(repositoryRoot, `.${draftId}.write-lock`);
  const owner: DraftLockOwner = {
    schemaVersion: 1,
    pid: process.pid,
    token: randomUUID(),
  };
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      await writeFile(lockPath, `${JSON.stringify(owner)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return async () => {
        try {
          const current = JSON.parse(
            await readFile(lockPath, "utf8"),
          ) as DraftLockOwner;
          if (current.token === owner.token)
            await rm(lockPath, { force: true });
        } catch {
          // The committed snapshot remains authoritative; a later operation can
          // diagnose or recover an abandoned lock without reversing the commit.
        }
      };
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      if (await clearStaleDraftLock(repositoryRoot, draftId, lockPath)) {
        continue;
      }
      if (!wait) return undefined;
      await delay(10);
    }
  }
  throw new Error(`Timed out waiting for draft lock: ${draftId}`);
}

async function clearStaleDraftLock(
  repositoryRoot: string,
  draftId: string,
  lockPath: string,
): Promise<boolean> {
  const recoveryLock = join(repositoryRoot, `.${draftId}.lock-recovery`);
  const owner: DraftLockOwner = {
    schemaVersion: 1,
    pid: process.pid,
    token: randomUUID(),
  };
  try {
    await writeFile(recoveryLock, `${JSON.stringify(owner)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") throw error;
    if (!(await lockOwnerIsActive(recoveryLock))) {
      await rm(recoveryLock, { force: true });
    }
    return false;
  }
  try {
    if (await lockOwnerIsActive(lockPath)) return false;
    await rm(lockPath, { force: true });
    return true;
  } finally {
    try {
      const current = JSON.parse(
        await readFile(recoveryLock, "utf8"),
      ) as DraftLockOwner;
      if (current.token === owner.token) {
        await rm(recoveryLock, { force: true });
      }
    } catch {
      // A later call can recover an abandoned recovery lock by owner liveness.
    }
  }
}

async function recoverDraftSwap(
  repositoryRoot: string,
  draftId: string,
): Promise<void> {
  let names: string[];
  try {
    names = await readdir(repositoryRoot);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
  const artifactPrefix = `.${draftId}.`;
  const backups = names
    .filter(
      (name) => name.startsWith(artifactPrefix) && name.endsWith(".backup"),
    )
    .map((name) => join(repositoryRoot, name));
  const stages = names
    .filter(
      (name) => name.startsWith(artifactPrefix) && name.endsWith(".stage"),
    )
    .map((name) => join(repositoryRoot, name));
  const draftRoot = join(repositoryRoot, draftId);
  if (!existsSync(draftRoot)) {
    if (backups.length > 1) {
      throw new Error(
        `Multiple interrupted backups exist for draft: ${draftId}`,
      );
    }
    if (backups.length === 1) await rename(backups[0]!, draftRoot);
  }
  await Promise.all(
    [...backups, ...stages]
      .filter((path) => path !== draftRoot && existsSync(path))
      .map((path) => rm(path, { recursive: true, force: true })),
  );
}

export function createFilesystemReferenceDraftRepository({
  root,
  forbiddenRoots = [],
}: FilesystemReferenceDraftRepositoryOptions): ReferenceDraftRepository {
  const repositoryRoot = resolve(root);
  assertRepositoryRootAllowed(repositoryRoot, forbiddenRoots);
  return {
    async get(draftId) {
      assertDraftId(draftId);
      const release = await acquireDraftLock(repositoryRoot, draftId, true);
      if (release === undefined) throw new Error(`Draft is locked: ${draftId}`);
      try {
        await recoverDraftSwap(repositoryRoot, draftId);
        return await readWorkspace(repositoryRoot, draftId);
      } finally {
        await release();
      }
    },
    async reserve(workspace) {
      const draftId = workspace.draft.draftId;
      assertDraftId(draftId);
      const release = await acquireDraftLock(repositoryRoot, draftId, true);
      if (release === undefined) throw new Error(`Draft is locked: ${draftId}`);
      try {
        await recoverDraftSwap(repositoryRoot, draftId);
        const existing = await readWorkspace(repositoryRoot, draftId);
        if (existing !== undefined)
          return { created: false, workspace: existing };
        const finalRoot = join(repositoryRoot, draftId);
        const temporaryRoot = join(
          repositoryRoot,
          `.${draftId}.${process.pid}.${randomUUID()}.tmp`,
        );
        try {
          await mkdir(temporaryRoot);
          await writeWorkspaceFiles(temporaryRoot, workspace.files);
          await rename(temporaryRoot, finalRoot);
          return { created: true, workspace };
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      } finally {
        await release();
      }
    },
    async commitWorkspace({
      draftId,
      expectedRevision,
      expectedFiles,
      workspace,
    }) {
      assertDraftId(draftId);
      const release = await acquireDraftLock(repositoryRoot, draftId, false);
      if (release === undefined) return false;
      try {
        await recoverDraftSwap(repositoryRoot, draftId);
        const draftRoot = join(repositoryRoot, draftId);
        const existing = await readWorkspace(repositoryRoot, draftId);
        if (
          existing === undefined ||
          existing.draft.revision !== expectedRevision ||
          !sameFileSnapshot(existing.files, expectedFiles)
        ) {
          return false;
        }
        if (workspace.draft.draftId !== draftId) return false;
        const operationId = `${process.pid}.${randomUUID()}`;
        const stageRoot = join(
          repositoryRoot,
          `.${draftId}.${operationId}.stage`,
        );
        const backupRoot = join(
          repositoryRoot,
          `.${draftId}.${operationId}.backup`,
        );
        let originalMoved = false;
        let installed = false;
        try {
          await mkdir(stageRoot);
          await writeWorkspaceFiles(stageRoot, workspace.files);
          const stagedFiles = await readWorkspaceFiles(stageRoot);
          if (!sameFileSnapshot(stagedFiles, workspace.files)) {
            throw new Error(
              "Staged draft snapshot differs from the requested commit",
            );
          }
          await rename(draftRoot, backupRoot);
          originalMoved = true;
          await rename(stageRoot, draftRoot);
          installed = true;
          return true;
        } finally {
          if (installed) {
            await Promise.allSettled([
              rm(stageRoot, { recursive: true, force: true }),
              rm(backupRoot, { recursive: true, force: true }),
            ]);
          } else {
            if (
              originalMoved &&
              !existsSync(draftRoot) &&
              existsSync(backupRoot)
            ) {
              await rename(backupRoot, draftRoot);
            }
            await rm(stageRoot, { recursive: true, force: true });
          }
        }
      } finally {
        await release();
      }
    },
  };
}
