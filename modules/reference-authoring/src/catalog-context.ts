import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
  readonly activityRoot?: string;
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
  activityRoot,
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
      const entryIds = new Set(entries.map(({ id }) => id));
      if (entryIds.size !== entries.length) {
        throw new Error("Active Reference Entry IDs must be unique");
      }
      const activeSlugs = new Set<string>();
      for (const entry of entries) {
        if (activeSlugs.has(entry.slug)) {
          throw new Error(`Active Reference slug is duplicated: ${entry.slug}`);
        }
        activeSlugs.add(entry.slug);
      }
      const redirectSlugs = new Set<string>();
      for (const redirect of catalog.redirects) {
        if (
          activeSlugs.has(redirect.fromSlug) ||
          redirectSlugs.has(redirect.fromSlug) ||
          !entryIds.has(redirect.toEntryId)
        ) {
          throw new Error(
            `Historical Reference redirect is invalid: ${redirect.fromSlug}`,
          );
        }
        redirectSlugs.add(redirect.fromSlug);
      }
      const activityIdsByEntryId: Record<string, string[]> = {};
      if (activityRoot !== undefined) {
        for (const directory of await readdir(resolve(activityRoot), {
          withFileTypes: true,
        })) {
          if (directory.isSymbolicLink()) {
            throw new Error(
              `Curriculum Activity root contains a symbolic link: ${directory.name}`,
            );
          }
          if (!directory.isDirectory()) continue;
          const rawActivity = await readJson(
            join(resolve(activityRoot), directory.name, "activity.json"),
          );
          if (
            typeof rawActivity !== "object" ||
            rawActivity === null ||
            !("id" in rawActivity) ||
            typeof rawActivity.id !== "string"
          ) {
            throw new Error(`Invalid Activity identity: ${directory.name}`);
          }
          const referenceIds =
            "referenceIds" in rawActivity &&
            Array.isArray(rawActivity.referenceIds)
              ? rawActivity.referenceIds
              : [];
          if (!referenceIds.every((id) => typeof id === "string")) {
            throw new Error(
              `Invalid Activity Reference links: ${rawActivity.id}`,
            );
          }
          for (const entryId of referenceIds) {
            (activityIdsByEntryId[entryId] ??= []).push(rawActivity.id);
          }
        }
      }
      return {
        entries: entries.map((entry) => ({
          id: entry.id,
          slug: entry.slug,
          kind: entry.kind,
          title: entry.title,
          ...(entry.symbol === undefined ? {} : { symbol: entry.symbol }),
          ...(entry.header === undefined ? {} : { header: entry.header }),
          categories: entry.categories,
          relatedEntryIds: entry.relatedEntryIds,
        })),
        entryIds: [...entryIds],
        categoryIds: catalog.categories.map((category) => category.id),
        slugsByEntryId: Object.fromEntries(
          entries.map((entry) => [entry.id, entry.slug]),
        ),
        redirects: catalog.redirects,
        ...(activityRoot === undefined ? {} : { activityIdsByEntryId }),
      };
    },
  };
}
