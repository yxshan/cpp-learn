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

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporaryPath = join(
    dirname(path),
    `.${path.slice(path.lastIndexOf(sep) + 1)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
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

export function createFilesystemReferenceDraftRepository({
  root,
  forbiddenRoots = [],
}: FilesystemReferenceDraftRepositoryOptions): ReferenceDraftRepository {
  const repositoryRoot = resolve(root);
  assertRepositoryRootAllowed(repositoryRoot, forbiddenRoots);
  return {
    get: (draftId) => readWorkspace(repositoryRoot, draftId),
    async reserve(workspace) {
      const draftId = workspace.draft.draftId;
      assertDraftId(draftId);
      await mkdir(repositoryRoot, { recursive: true });
      const finalRoot = join(repositoryRoot, draftId);
      const temporaryRoot = join(
        repositoryRoot,
        `.${draftId}.${process.pid}.${randomUUID()}.tmp`,
      );
      try {
        await mkdir(temporaryRoot);
        await writeWorkspaceFiles(temporaryRoot, workspace.files);
        try {
          await rename(temporaryRoot, finalRoot);
          return { created: true, workspace };
        } catch (error) {
          if (
            !isNodeError(error) ||
            (error.code !== "EEXIST" && error.code !== "ENOTEMPTY")
          ) {
            throw error;
          }
        }
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
      const existing = await readWorkspace(repositoryRoot, draftId);
      if (existing === undefined) {
        throw new Error(`Draft reservation disappeared: ${draftId}`);
      }
      return { created: false, workspace: existing };
    },
    async commitCheck({ draftId, expectedRevision, expectedFiles, workspace }) {
      assertDraftId(draftId);
      const draftRoot = join(repositoryRoot, draftId);
      const lockPath = join(draftRoot, ".check-lock");
      try {
        await mkdir(lockPath);
      } catch (error) {
        if (isNodeError(error) && error.code === "EEXIST") return false;
        throw error;
      }
      try {
        const existing = await readWorkspace(repositoryRoot, draftId);
        if (
          existing === undefined ||
          existing.draft.revision !== expectedRevision ||
          !sameFileSnapshot(existing.files, expectedFiles)
        ) {
          return false;
        }
        await writeAtomic(
          join(draftRoot, "report.json"),
          workspace.files["report.json"]!,
        );
        const afterReport = await readWorkspace(repositoryRoot, draftId);
        if (
          afterReport === undefined ||
          !sameFileSnapshot(
            afterReport.files,
            expectedFiles,
            new Set(["report.json"]),
          )
        ) {
          await writeAtomic(
            join(draftRoot, "report.json"),
            expectedFiles["report.json"]!,
          );
          return false;
        }
        await writeAtomic(
          join(draftRoot, "draft.json"),
          workspace.files["draft.json"]!,
        );
        return true;
      } finally {
        await rm(lockPath, { recursive: true, force: true });
      }
    },
  };
}
