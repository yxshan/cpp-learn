import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
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

import type { AuthoringPublicationPlan } from "./index.js";

export interface AuthoringPublicationCandidate {
  readonly path: string;
  readonly content: string;
}

export interface AuthoringPublishAdapterRequest {
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly mode: "dry_run" | "apply";
  readonly entryPath: string;
  readonly files: readonly AuthoringPublicationCandidate[];
  readonly confirmDraft: () => Promise<boolean>;
}

export interface AuthoringPublisher {
  publish(
    request: AuthoringPublishAdapterRequest,
  ): Promise<AuthoringPublicationPlan>;
}

export interface FilesystemAuthoringPublisherOptions {
  readonly root: string;
  readonly validateStaging: (root: string) => Promise<void>;
}

interface CatalogFile {
  readonly schemaVersion: number;
  readonly version: number;
  readonly entries: readonly string[];
  readonly [key: string]: unknown;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePath(path: string): void {
  if (
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe publication path: ${path}`);
  }
}

function resolveInside(root: string, path: string): string {
  assertSafePath(path);
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`Publication path escaped its root: ${path}`);
  }
  return target;
}

function physicalPath(path: string): string {
  let existing = resolve(path);
  const missing: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    missing.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...missing);
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function assertNoSymlinks(root: string, current = root): Promise<void> {
  const metadata = await lstat(current);
  if (metadata.isSymbolicLink()) {
    throw new Error(
      `Canonical Reference tree contains a symbolic link: ${current}`,
    );
  }
  if (!metadata.isDirectory()) return;
  for (const entry of await readdir(current)) {
    await assertNoSymlinks(root, join(current, entry));
  }
}

async function directoryDigest(root: string): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (current: string): Promise<void> => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Canonical Reference tree contains a symbolic link: ${absolute}`,
        );
      }
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(
          `Canonical Reference tree contains an unsupported file: ${absolute}`,
        );
      }
      const path = relative(root, absolute).split(sep).join("/");
      const content = await readFile(absolute);
      hash.update(`${path.length}:${path}${content.byteLength}:`);
      hash.update(content);
    }
  };
  await visit(root);
  return hash.digest("hex");
}

function parseCatalog(source: string): CatalogFile {
  const catalog = JSON.parse(source) as unknown;
  if (
    typeof catalog !== "object" ||
    catalog === null ||
    !("version" in catalog) ||
    !Number.isInteger(catalog.version) ||
    !("entries" in catalog) ||
    !Array.isArray(catalog.entries) ||
    !catalog.entries.every((entry) => typeof entry === "string")
  ) {
    throw new Error("Canonical catalog.json is invalid");
  }
  return catalog as CatalogFile;
}

function parseExistingEntry(source: string | undefined): {
  readonly slug?: string;
  readonly examplePaths: readonly string[];
} {
  if (source === undefined) return { examplePaths: [] };
  try {
    const value = JSON.parse(source) as unknown;
    if (typeof value !== "object" || value === null) {
      return { examplePaths: [] };
    }
    const slug =
      "slug" in value && typeof value.slug === "string"
        ? value.slug
        : undefined;
    const examples =
      "examples" in value && Array.isArray(value.examples)
        ? value.examples
        : [];
    return {
      ...(slug === undefined ? {} : { slug }),
      examplePaths: examples.flatMap((example) =>
        typeof example === "object" &&
        example !== null &&
        "path" in example &&
        typeof example.path === "string"
          ? [example.path]
          : [],
      ),
    };
  } catch {
    return { examplePaths: [] };
  }
}

async function planPublication(
  root: string,
  request: AuthoringPublishAdapterRequest,
): Promise<{
  readonly plan: AuthoringPublicationPlan;
  readonly desiredFiles: ReadonlyMap<string, string>;
}> {
  assertSafePath(request.entryPath);
  const candidatePaths = new Set<string>();
  for (const file of request.files) {
    assertSafePath(file.path);
    if (file.path === "catalog.json") {
      throw new Error("Catalog is managed by the publication Adapter");
    }
    if (candidatePaths.has(file.path)) {
      throw new Error(`Duplicate publication path: ${file.path}`);
    }
    candidatePaths.add(file.path);
  }

  const catalogSource = await readFile(join(root, "catalog.json"), "utf8");
  const catalog = parseCatalog(catalogSource);
  const existingEntry = parseExistingEntry(
    await readOptional(resolveInside(root, request.entryPath)),
  );
  const desiredFiles = new Map<string, string>();
  const filePlans: AuthoringPublicationPlan["files"][number][] = [];
  for (const file of [...request.files].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const current = await readOptional(resolveInside(root, file.path));
    if (current === file.content) continue;
    desiredFiles.set(file.path, file.content);
    filePlans.push({
      path: file.path,
      digest: digest(file.content),
      operation: current === undefined ? "create" : "update",
      ...(current === undefined ? {} : { previousDigest: digest(current) }),
    });
  }

  const examplesRoot = `${request.entryPath.slice(0, -"entry.json".length)}examples/`;
  for (const path of [...existingEntry.examplePaths].sort()) {
    if (!path.startsWith(examplesRoot) || candidatePaths.has(path)) continue;
    assertSafePath(path);
    const current = await readOptional(resolveInside(root, path));
    if (current === undefined) continue;
    filePlans.push({
      path,
      operation: "delete",
      previousDigest: digest(current),
    });
  }

  const entries = catalog.entries.includes(request.entryPath)
    ? [...catalog.entries]
    : [...catalog.entries, request.entryPath];
  const candidateEntry = parseExistingEntry(
    request.files.find(({ path }) => path === request.entryPath)?.content,
  );
  const redirects = Array.isArray(catalog["redirects"])
    ? [...catalog["redirects"]]
    : [];
  if (
    existingEntry.slug !== undefined &&
    candidateEntry.slug !== undefined &&
    existingEntry.slug !== candidateEntry.slug &&
    !redirects.some(
      (redirect) =>
        typeof redirect === "object" &&
        redirect !== null &&
        "fromSlug" in redirect &&
        redirect.fromSlug === existingEntry.slug,
    )
  ) {
    redirects.push({
      fromSlug: existingEntry.slug,
      toEntryId: request.draftId,
    });
  }
  if (filePlans.length > 0 || entries.length !== catalog.entries.length) {
    const desiredCatalog = `${JSON.stringify(
      { ...catalog, version: catalog.version + 1, entries, redirects },
      null,
      2,
    )}\n`;
    desiredFiles.set("catalog.json", desiredCatalog);
    filePlans.push({
      path: "catalog.json",
      digest: digest(desiredCatalog),
      operation: "update",
      previousDigest: digest(catalogSource),
    });
  }

  return {
    plan: {
      schemaVersion: 1,
      draftId: request.draftId,
      expectedRevision: request.expectedRevision,
      mode: request.mode,
      files: filePlans,
    },
    desiredFiles,
  };
}

async function assertPlanStillCurrent(
  root: string,
  plan: AuthoringPublicationPlan,
): Promise<void> {
  for (const file of plan.files) {
    const current = await readOptional(resolveInside(root, file.path));
    if (
      (file.operation === "create" && current !== undefined) ||
      ((file.operation === "update" || file.operation === "delete") &&
        (current === undefined || digest(current) !== file.previousDigest))
    ) {
      throw new Error(
        `Canonical file changed during publication: ${file.path}`,
      );
    }
  }
}

async function recoverInterruptedPublication(root: string): Promise<void> {
  const parent = dirname(root);
  const prefix = `.${basename(root)}.`;
  const names = await readdir(parent);
  const backups = names
    .filter((name) => name.startsWith(prefix) && name.endsWith(".backup"))
    .sort();
  const stages = names.filter(
    (name) => name.startsWith(prefix) && name.endsWith(".stage"),
  );
  if (!existsSync(root)) {
    if (backups.length !== 1) {
      throw new Error(
        backups.length === 0
          ? "Canonical Reference root is missing and no recovery backup exists"
          : "Canonical Reference root is missing and recovery is ambiguous",
      );
    }
    await rename(join(parent, backups[0]!), root);
  }
  await Promise.all(
    backups.map((name) =>
      rm(join(parent, name), { recursive: true, force: true }),
    ),
  );
  await Promise.all(
    stages.map((name) =>
      rm(join(parent, name), { recursive: true, force: true }),
    ),
  );
}

export function createFilesystemAuthoringPublisher({
  root,
  validateStaging,
}: FilesystemAuthoringPublisherOptions): AuthoringPublisher {
  const configuredRoot = resolve(root);
  if (
    existsSync(configuredRoot) &&
    lstatSync(configuredRoot).isSymbolicLink()
  ) {
    throw new Error(
      `Canonical Reference root must not be a symbolic link: ${root}`,
    );
  }
  const canonicalRoot = physicalPath(root);
  return {
    async publish(request) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId)) {
        throw new Error(`Invalid draft ID: ${request.draftId}`);
      }
      const lock = join(
        dirname(canonicalRoot),
        `.${basename(canonicalRoot)}.authoring-publish-lock`,
      );
      try {
        await mkdir(lock);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST"
        ) {
          throw new Error("Another Reference publication is in progress", {
            cause: error,
          });
        }
        throw error;
      }

      try {
        await recoverInterruptedPublication(canonicalRoot);
        await assertNoSymlinks(canonicalRoot);
        const canonicalDigest = await directoryDigest(canonicalRoot);
        const planned = await planPublication(canonicalRoot, request);
        if (request.mode === "dry_run" || planned.plan.files.length === 0) {
          return planned.plan;
        }
        const token = `${process.pid}.${randomUUID()}`;
        const staging = join(
          dirname(canonicalRoot),
          `.${basename(canonicalRoot)}.${token}.stage`,
        );
        const backup = join(
          dirname(canonicalRoot),
          `.${basename(canonicalRoot)}.${token}.backup`,
        );
        let originalMoved = false;
        try {
          await cp(canonicalRoot, staging, {
            recursive: true,
            errorOnExist: true,
          });
          for (const [path, content] of planned.desiredFiles) {
            const target = resolveInside(staging, path);
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, content, "utf8");
          }
          for (const file of planned.plan.files) {
            if (file.operation === "delete") {
              await rm(resolveInside(staging, file.path));
            }
          }
          await validateStaging(staging);
          await assertPlanStillCurrent(canonicalRoot, planned.plan);
          if ((await directoryDigest(canonicalRoot)) !== canonicalDigest) {
            throw new Error(
              "Canonical Reference tree changed during publication",
            );
          }
          if (!(await request.confirmDraft())) {
            throw new Error("Checked draft changed during publication");
          }
          await rename(canonicalRoot, backup);
          originalMoved = true;
          try {
            await rename(staging, canonicalRoot);
          } catch (error) {
            try {
              await rename(backup, canonicalRoot);
              originalMoved = false;
            } catch (rollbackError) {
              throw new Error(
                `Publication install failed (${error instanceof Error ? error.message : "unknown error"}) and rollback failed; original tree is preserved at ${backup}`,
                { cause: rollbackError },
              );
            }
            throw error;
          }
          await rm(backup, { recursive: true, force: true });
          originalMoved = false;
          return planned.plan;
        } finally {
          await rm(staging, { recursive: true, force: true });
          if (!originalMoved) {
            await rm(backup, { recursive: true, force: true });
          }
        }
      } finally {
        await rm(lock, { recursive: true, force: true });
      }
    },
  };
}
