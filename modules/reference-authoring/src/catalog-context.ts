import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  ReferenceCatalogManifest,
  ReferenceEntryManifest,
} from "@cpp-learn/reference";
import {
  validateReferenceCatalogManifest,
  validateReferenceEntryManifest,
} from "@cpp-learn/reference-schema";

import type { AuthoringCatalogContextAdapter } from "./index.js";

export interface FilesystemAuthoringCatalogContextOptions {
  readonly catalogPath: string;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function assertValid(
  label: string,
  issues: readonly { path: string; message: string }[],
): void {
  if (issues.length === 0) return;
  const first = issues[0]!;
  throw new Error(`${label}${first.path}: ${first.message}`);
}

export function createFilesystemAuthoringCatalogContext({
  catalogPath,
}: FilesystemAuthoringCatalogContextOptions): AuthoringCatalogContextAdapter {
  const absoluteCatalogPath = resolve(catalogPath);
  const referenceRoot = dirname(absoluteCatalogPath);
  return {
    async load() {
      const rawCatalog = await readJson(absoluteCatalogPath);
      assertValid("catalog.json", validateReferenceCatalogManifest(rawCatalog));
      const catalog = rawCatalog as ReferenceCatalogManifest;
      const entries: ReferenceEntryManifest[] = [];
      for (const entryPath of catalog.entries) {
        const rawEntry = await readJson(resolve(referenceRoot, entryPath));
        assertValid(entryPath, validateReferenceEntryManifest(rawEntry));
        entries.push(rawEntry as ReferenceEntryManifest);
      }
      return {
        entryIds: entries.map((entry) => entry.id),
        categoryIds: catalog.categories.map((category) => category.id),
        slugsByEntryId: Object.fromEntries(
          entries.map((entry) => [entry.id, entry.slug]),
        ),
      };
    },
  };
}
