import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";
import type { DraftWorkspace } from "@cpp-learn/reference-authoring";
import { renderArticleDocument } from "@cpp-learn/reference-presentation";
import type { ReferenceEntryManifest } from "@cpp-learn/reference";

import type { ReferenceAuthorPreviewAdapter } from "./reference-author-cli.js";

/**
 * The preview reproduces the published page, so it inlines the Web Adapter's
 * stylesheets. This is the only remaining reference to the Web Adapter from the
 * CLI and it is a build asset, not a code dependency: no React and no Web
 * module is loaded. Splitting the Reference styles out of the application
 * stylesheet would remove even this.
 */
const referenceStylesheets = [
  fileURLToPath(new URL("../../web/src/styles.css", import.meta.url)),
  fileURLToPath(new URL("../../web/src/mdn-theme.css", import.meta.url)),
];

let stylesheet: Promise<string> | undefined;

function loadReferenceStylesheet(): Promise<string> {
  stylesheet ??= Promise.all(
    referenceStylesheets.map((path) => readFile(path, "utf8")),
  ).then((parts) => parts.join("\n"));
  return stylesheet;
}

export interface FilesystemReferenceAuthorPreviewOptions {
  readonly root: string;
  readonly baseUrl?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

function isAtOrInside(path: string, root: string): boolean {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" || (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
}

function toPreviewEntry(workspace: DraftWorkspace): ReferenceEntryDetail {
  const entry = JSON.parse(
    workspace.files["entry.json"] ?? "null",
  ) as ReferenceEntryManifest;
  if (entry === null || entry.id !== workspace.draft.target.entryId) {
    throw new Error("entry.json does not describe the draft target");
  }
  const content = workspace.files["content.md"];
  if (content === undefined) throw new Error("content.md is missing");
  const examplePrefix = `${workspace.draft.targetPaths.examples}/`;

  return {
    schemaVersion: entry.schemaVersion,
    catalogVersion: 0,
    id: entry.id,
    version: entry.version,
    slug: entry.slug,
    kind: entry.kind,
    title: entry.title,
    summary: entry.summary,
    ...(entry.symbol === undefined ? {} : { symbol: entry.symbol }),
    ...(entry.header === undefined ? {} : { header: entry.header }),
    ...(entry.namespace === undefined ? {} : { namespace: entry.namespace }),
    ...(entry.since === undefined ? {} : { since: entry.since }),
    ...(entry.deprecatedSince === undefined
      ? {}
      : { deprecatedSince: entry.deprecatedSince }),
    ...(entry.removedSince === undefined
      ? {}
      : { removedSince: entry.removedSince }),
    aliases: entry.aliases,
    categories: entry.categories,
    relatedEntryIds: entry.relatedEntryIds,
    content,
    examples: entry.examples.map((example) => {
      const relativePath = example.path.startsWith(examplePrefix)
        ? `examples/${example.path.slice(examplePrefix.length)}`
        : example.path;
      const source = workspace.files[relativePath];
      if (source === undefined) {
        throw new Error(`Example source is missing: ${relativePath}`);
      }
      return {
        ...example,
        source,
        digest: sha256(source),
        verification: "not-checked" as const,
      };
    }),
    sources: entry.sources,
    verifiedAt: entry.verifiedAt ?? "尚未核对",
    relatedActivityIds: [],
  };
}

export function createFilesystemReferenceAuthorPreview({
  root,
  baseUrl = "http://127.0.0.1:4173",
}: FilesystemReferenceAuthorPreviewOptions): ReferenceAuthorPreviewAdapter {
  const previewRoot = physicalPath(root);
  return {
    async render(workspace) {
      const draftId = workspace.draft.draftId;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(draftId)) {
        throw new Error(`Invalid draft ID: ${draftId}`);
      }
      const directory = join(previewRoot, draftId);
      if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) {
        throw new Error(`Draft preview directory must not be a symbolic link`);
      }
      const entry = toPreviewEntry(workspace);
      const html = renderArticleDocument({
        entry,
        relatedEntries: {},
        currentUrl: new URL(`/reference/${entry.slug}`, baseUrl),
        stylesheet: await loadReferenceStylesheet(),
      });
      const target = join(directory, "preview.html");
      const temporary = join(
        directory,
        `.preview.${process.pid}.${randomUUID()}.tmp`,
      );
      await mkdir(directory, { recursive: true });
      if (!isAtOrInside(await realpath(directory), previewRoot)) {
        throw new Error("Draft preview directory escaped its configured root");
      }
      try {
        await writeFile(temporary, html, { encoding: "utf8", flag: "wx" });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
      return target;
    },
  };
}
