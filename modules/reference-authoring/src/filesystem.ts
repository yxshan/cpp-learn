import { randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type {
  AuthoringDraftManifest,
  AuthoringFactSheet,
  AuthoringReport,
  AuthoringSourceLedger,
  DraftWorkspace,
  ReferenceDraftRepository,
} from "./index.js";

export interface FilesystemReferenceDraftRepositoryOptions {
  readonly root: string;
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

export function createFilesystemReferenceDraftRepository({
  root,
}: FilesystemReferenceDraftRepositoryOptions): ReferenceDraftRepository {
  const repositoryRoot = resolve(root);
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
    async commitCheck({ draftId, expectedRevision, workspace }) {
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
          existing.draft.revision !== expectedRevision
        ) {
          return false;
        }
        await writeAtomic(
          join(draftRoot, "report.json"),
          workspace.files["report.json"]!,
        );
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
