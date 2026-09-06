import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";
import type { DraftWorkspace } from "@cpp-learn/reference-authoring";
import type { ReferenceEntryManifest } from "@cpp-learn/reference";
import { renderReferenceArticleDocument } from "@cpp-learn/web/reference-preview";

import type { ReferenceAuthorPreviewAdapter } from "./reference-author-cli.js";

export interface FilesystemReferenceAuthorPreviewOptions {
  readonly root: string;
  readonly baseUrl?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
  const previewRoot = resolve(root);
  return {
    async render(workspace) {
      const draftId = workspace.draft.draftId;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(draftId)) {
        throw new Error(`Invalid draft ID: ${draftId}`);
      }
      const entry = toPreviewEntry(workspace);
      const html = await renderReferenceArticleDocument({
        entry,
        relatedEntries: {},
        currentUrl: new URL(`/reference/${entry.slug}`, baseUrl),
      });
      const directory = join(previewRoot, draftId);
      const target = join(directory, "preview.html");
      const temporary = join(
        directory,
        `.preview.${process.pid}.${randomUUID()}.tmp`,
      );
      await mkdir(directory, { recursive: true });
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
