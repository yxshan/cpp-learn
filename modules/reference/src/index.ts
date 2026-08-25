import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type {
  CppStandard,
  ReferenceEntryDetail,
  ReferenceEntryKind,
  ReferenceNavigation,
  ReferenceReadiness,
  ReferenceReadinessIssueCode,
  ReferenceMatchField,
  ReferenceSearchQuery,
  ReferenceSearchResult,
  ReferenceSlugResolution,
  ReferenceSource,
} from "@cpp-learn/contracts";
import {
  validateReferenceCatalogManifest,
  validateReferenceEntryManifest,
} from "@cpp-learn/reference-schema";

export interface ReferenceCatalogManifest {
  readonly schemaVersion: 1;
  readonly version: number;
  readonly entries: readonly string[];
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
    readonly parentId?: string;
    readonly order: number;
  }[];
  readonly redirects: readonly {
    readonly fromSlug: string;
    readonly toEntryId: string;
  }[];
}

export interface ReferenceExampleManifest {
  readonly id: string;
  readonly path: string;
  readonly kind: "compile" | "run" | "expected-compile-failure";
  readonly standard: CppStandard;
  readonly stdin?: string;
  readonly expectedStdout?: string;
  readonly expectedDiagnosticCategory?: string;
}

export interface ReferenceEntryManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly slug: string;
  readonly kind: ReferenceEntryKind;
  readonly title: string;
  readonly summary: string;
  readonly symbol?: string;
  readonly header?: string;
  readonly namespace?: string;
  readonly since?: CppStandard;
  readonly deprecatedSince?: CppStandard;
  readonly removedSince?: CppStandard;
  readonly aliases: readonly string[];
  readonly categories: readonly string[];
  readonly relatedEntryIds: readonly string[];
  readonly content: { readonly format: "markdown"; readonly path: string };
  readonly examples: readonly ReferenceExampleManifest[];
  readonly sources: readonly ReferenceSource[];
  readonly verifiedAt: string;
}

export interface ReferenceCatalog {
  readiness(): Promise<ReferenceReadiness>;
  getEntry(entryId: string): Promise<ReferenceEntryDetail | undefined>;
  resolveSlug(slug: string): Promise<ReferenceSlugResolution | undefined>;
  search(query: ReferenceSearchQuery): Promise<ReferenceSearchResult>;
  getNavigation(): Promise<ReferenceNavigation>;
}

interface ActiveCatalog {
  readonly catalog: ReferenceCatalogManifest;
  readonly entriesById: ReadonlyMap<string, ReferenceEntryManifest>;
  readonly readText: (path: string) => Promise<string>;
  readonly textByPath: ReadonlyMap<string, string>;
  readonly relatedActivityIdsByEntryId: ReadonlyMap<string, readonly string[]>;
}

const CPP_STANDARDS: readonly CppStandard[] = [
  "c++98",
  "c++03",
  "c++11",
  "c++14",
  "c++17",
  "c++20",
  "c++23",
  "c++26-draft",
];

export class ReferenceQueryValidationError extends Error {}

type Activation =
  | { readonly ready: true; readonly active: ActiveCatalog }
  | {
      readonly ready: false;
      readonly issueCode: "catalog_missing" | "catalog_invalid";
    };

interface CatalogData {
  readonly catalog: ReferenceCatalogManifest;
  readonly entries: readonly ReferenceEntryManifest[];
  readonly readText: (path: string) => Promise<string>;
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function activate(data: CatalogData): Promise<ActiveCatalog> {
  const catalogIssues = validateReferenceCatalogManifest(data.catalog);
  const entryIssues = data.entries.flatMap((entry) =>
    validateReferenceEntryManifest(entry),
  );
  if (catalogIssues.length > 0 || entryIssues.length > 0) {
    throw new Error("Reference catalog schema is invalid");
  }
  if (data.catalog.entries.length !== data.entries.length) {
    throw new Error("Reference catalog Entry count does not match manifests");
  }

  const entriesById = new Map(data.entries.map((entry) => [entry.id, entry]));
  if (entriesById.size !== data.entries.length) {
    throw new Error("Reference Entry IDs must be unique");
  }
  const activeSlugs = new Set(data.entries.map((entry) => entry.slug));
  if (activeSlugs.size !== data.entries.length) {
    throw new Error("Reference Entry slugs must be unique");
  }

  const categoryIds = new Set(
    data.catalog.categories.map((category) => category.id),
  );
  if (categoryIds.size !== data.catalog.categories.length) {
    throw new Error("Reference category IDs must be unique");
  }
  const categoryById = new Map(
    data.catalog.categories.map((category) => [category.id, category]),
  );
  if (
    data.catalog.categories.some(
      (category) =>
        category.parentId !== undefined &&
        !categoryById.has(category.parentId),
    )
  ) {
    throw new Error("Reference category parent is unknown");
  }
  const visitingCategories = new Set<string>();
  const visitedCategories = new Set<string>();
  const visitCategory = (categoryId: string): boolean => {
    if (visitingCategories.has(categoryId)) return true;
    if (visitedCategories.has(categoryId)) return false;
    visitingCategories.add(categoryId);
    const parentId = categoryById.get(categoryId)?.parentId;
    const cyclic = parentId === undefined ? false : visitCategory(parentId);
    visitingCategories.delete(categoryId);
    visitedCategories.add(categoryId);
    return cyclic;
  };
  if (data.catalog.categories.some(({ id }) => visitCategory(id))) {
    throw new Error("Reference category navigation must be acyclic");
  }
  if (
    data.entries.some(
      (entry) =>
        entry.categories.some((categoryId) => !categoryIds.has(categoryId)) ||
        entry.relatedEntryIds.some(
          (relatedEntryId) => !entriesById.has(relatedEntryId),
        ),
    )
  ) {
    throw new Error("Reference Entry graph contains an unknown target");
  }
  const redirectSlugs = new Set<string>();
  for (const redirect of data.catalog.redirects) {
    if (
      redirectSlugs.has(redirect.fromSlug) ||
      activeSlugs.has(redirect.fromSlug) ||
      !entriesById.has(redirect.toEntryId)
    ) {
      throw new Error("Reference redirect is invalid");
    }
    redirectSlugs.add(redirect.fromSlug);
  }

  const paths = data.entries.flatMap((entry) => [
    entry.content.path,
    ...entry.examples.map((example) => example.path),
  ]);
  const contents = await Promise.all(paths.map(data.readText));
  const textByPath = new Map(
    paths.map((path, index) => [path, contents[index] ?? ""]),
  );
  return {
    catalog: data.catalog,
    entriesById,
    readText: data.readText,
    textByPath,
    relatedActivityIdsByEntryId:
      data.relatedActivityIdsByEntryId ?? new Map(),
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function searchableForms(value: string): readonly string[] {
  const normalized = normalize(value);
  const stripped = normalized.replace(/^<|>$/g, "").replace(/^std::/, "");
  return normalized === stripped ? [normalized] : [normalized, stripped];
}

function containsQuery(value: string, query: string): boolean {
  return searchableForms(value).some((form) => form.includes(query));
}

function exactQuery(value: string, query: string): boolean {
  return searchableForms(value).includes(query);
}

function standardIndex(standard: CppStandard): number {
  return CPP_STANDARDS.indexOf(standard);
}

function availableInStandard(
  entry: ReferenceEntryManifest,
  standard: CppStandard,
): boolean {
  if (!entry.since) return false;
  const target = standardIndex(standard);
  return (
    standardIndex(entry.since) <= target &&
    (entry.removedSince === undefined ||
      target < standardIndex(entry.removedSince))
  );
}

function headings(markdown: string): readonly string[] {
  return [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
    String(match[1]).replace(/\s+#+$/, "").trim(),
  );
}

function createReferenceCatalog(
  load: () => Promise<CatalogData>,
): ReferenceCatalog {
  const activation: Promise<Activation> = load()
    .then(activate)
    .then((active) => ({ ready: true as const, active }))
    .catch((error: unknown) => ({
      ready: false as const,
      issueCode:
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? ("catalog_missing" as const)
          : ("catalog_invalid" as const),
    }));

  return {
    async readiness() {
      const state = await activation;
      return state.ready
        ? {
            ready: true,
            catalogVersion: state.active.catalog.version,
            entryCount: state.active.entriesById.size,
          }
        : { ready: false, issueCodes: [state.issueCode] };
    },
    async getEntry(entryId) {
      const state = await activation;
      if (!state.ready) return undefined;
      const entry = state.active.entriesById.get(entryId);
      if (!entry) return undefined;
      const markdown = state.active.textByPath.get(entry.content.path) ?? "";
      const examples = await Promise.all(
        entry.examples.map(async (example) => {
          const source = state.active.textByPath.get(example.path) ?? "";
          return {
            id: example.id,
            kind: example.kind,
            standard: example.standard,
            source,
            digest: digest(source),
            verification: "not-checked" as const,
            ...(example.stdin === undefined ? {} : { stdin: example.stdin }),
            ...(example.expectedStdout === undefined
              ? {}
              : { expectedStdout: example.expectedStdout }),
            ...(example.expectedDiagnosticCategory === undefined
              ? {}
              : {
                  expectedDiagnosticCategory:
                    example.expectedDiagnosticCategory,
                }),
          };
        }),
      );
      return {
        schemaVersion: 1,
        catalogVersion: state.active.catalog.version,
        id: entry.id,
        version: entry.version,
        slug: entry.slug,
        kind: entry.kind,
        title: entry.title,
        summary: entry.summary,
        ...(entry.symbol === undefined ? {} : { symbol: entry.symbol }),
        ...(entry.header === undefined ? {} : { header: entry.header }),
        ...(entry.namespace === undefined
          ? {}
          : { namespace: entry.namespace }),
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
        markdown,
        examples,
        sources: entry.sources,
        verifiedAt: entry.verifiedAt,
        relatedActivityIds:
          state.active.relatedActivityIdsByEntryId.get(entry.id) ?? [],
      };
    },
    async resolveSlug(slug) {
      const state = await activation;
      if (!state.ready) return undefined;
      const activeEntry = [...state.active.entriesById.values()].find(
        (entry) => entry.slug === slug,
      );
      if (activeEntry) {
        return {
          schemaVersion: 1,
          entryId: activeEntry.id,
          canonicalSlug: activeEntry.slug,
          redirected: false,
        };
      }
      const redirect = state.active.catalog.redirects.find(
        (candidate) => candidate.fromSlug === slug,
      );
      if (!redirect) return undefined;
      const target = state.active.entriesById.get(redirect.toEntryId);
      if (!target) return undefined;
      return {
        schemaVersion: 1,
        entryId: target.id,
        canonicalSlug: target.slug,
        redirected: true,
      };
    },
    async search(query) {
      if (
        query.text.length > 200 ||
        (query.limit !== undefined &&
          (!Number.isInteger(query.limit) ||
            query.limit < 1 ||
            query.limit > 50))
      ) {
        throw new ReferenceQueryValidationError("Invalid Reference search");
      }
      const state = await activation;
      if (!state.ready) {
        return {
          schemaVersion: 1,
          catalogVersion: 0,
          query,
          total: 0,
          results: [],
        };
      }
      if (
        query.category !== undefined &&
        !state.active.catalog.categories.some(
          (category) => category.id === query.category,
        )
      ) {
        throw new ReferenceQueryValidationError("Invalid Reference search");
      }
      const normalizedQuery = normalize(query.text);
      const ranked = [...state.active.entriesById.values()]
        .filter(
          (entry) =>
            (query.kind === undefined || entry.kind === query.kind) &&
            (query.category === undefined ||
              entry.categories.includes(query.category)) &&
            (query.standard === undefined ||
              availableInStandard(entry, query.standard)) &&
            (query.verified === undefined || query.verified === "not-checked"),
        )
        .flatMap((entry) => {
          const markdown =
            state.active.textByPath.get(entry.content.path) ?? "";
          const matchedBy = new Set<ReferenceMatchField>();
          let score = normalizedQuery.length === 0 ? 100 : Infinity;
          const match = (
            field: ReferenceMatchField,
            value: string | undefined,
            exactScore: number,
            containsScore: number,
          ) => {
            if (!value || normalizedQuery.length === 0) return;
            if (exactQuery(value, normalizedQuery)) {
              matchedBy.add(field);
              score = Math.min(score, exactScore);
            } else if (containsQuery(value, normalizedQuery)) {
              matchedBy.add(field);
              score = Math.min(score, containsScore);
            }
          };
          match("id", entry.id, 0, 3);
          match("symbol", entry.symbol, 0, 2);
          match("header", entry.header, 0, 3);
          for (const alias of entry.aliases)
            match("alias", alias, 1, 3);
          match("title", entry.title, 1, 3);
          for (const heading of headings(markdown))
            match("heading", heading, 3, 3);
          for (const category of entry.categories)
            match("category", category, 4, 4);
          match("body", markdown.replace(/^#{1,6}\s+.+$/gm, ""), 4, 4);
          if (!Number.isFinite(score) && normalizedQuery.length > 0) return [];
          return [{ entry, matchedBy: [...matchedBy], score }];
        })
        .sort(
          (left, right) =>
            left.score - right.score ||
            normalize(left.entry.symbol ?? left.entry.title).localeCompare(
              normalize(right.entry.symbol ?? right.entry.title),
              "en",
            ) ||
            left.entry.id.localeCompare(right.entry.id, "en"),
        );
      const limit = query.limit ?? 20;
      return {
        schemaVersion: 1,
        catalogVersion: state.active.catalog.version,
        query,
        total: ranked.length,
        results: ranked.slice(0, limit).map(({ entry, matchedBy }) => ({
          id: entry.id,
          slug: entry.slug,
          kind: entry.kind,
          title: entry.title,
          summary: entry.summary,
          ...(entry.symbol === undefined ? {} : { symbol: entry.symbol }),
          ...(entry.header === undefined ? {} : { header: entry.header }),
          ...(entry.since === undefined ? {} : { since: entry.since }),
          ...(entry.deprecatedSince === undefined
            ? {}
            : { deprecatedSince: entry.deprecatedSince }),
          matchedBy,
        })),
      };
    },
    async getNavigation() {
      const state = await activation;
      if (!state.ready) {
        return {
          schemaVersion: 1,
          catalogVersion: 0,
          categories: [],
          supportedStandards: CPP_STANDARDS,
        };
      }
      return {
        schemaVersion: 1,
        catalogVersion: state.active.catalog.version,
        categories: [...state.active.catalog.categories]
          .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
          .map((category) => ({
            id: category.id,
            title: category.title,
            ...(category.parentId === undefined
              ? {}
              : { parentId: category.parentId }),
            order: category.order,
            entryIds: [...state.active.entriesById.values()]
              .filter((entry) => entry.categories.includes(category.id))
              .map((entry) => entry.id),
          })),
        supportedStandards: CPP_STANDARDS,
      };
    },
  };
}

export interface InMemoryReferenceCatalogDependencies {
  readonly catalog: ReferenceCatalogManifest;
  readonly entries: readonly ReferenceEntryManifest[];
  readonly files: Readonly<Record<string, string>>;
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

export function createInMemoryReferenceCatalog(
  dependencies: InMemoryReferenceCatalogDependencies,
): ReferenceCatalog {
  return createReferenceCatalog(async () => ({
    catalog: dependencies.catalog,
    entries: dependencies.entries,
    readText: async (path) => {
      const content = dependencies.files[path];
      if (content === undefined) throw new Error(`Missing file: ${path}`);
      return content;
    },
    ...(dependencies.relatedActivityIdsByEntryId === undefined
      ? {}
      : {
          relatedActivityIdsByEntryId:
            dependencies.relatedActivityIdsByEntryId,
        }),
  }));
}

function resolveInsideRoot(root: string, path: string): string {
  const resolved = resolve(root, path);
  const fromRoot = relative(root, resolved);
  if (
    path.includes("\\") ||
    isAbsolute(path) ||
    fromRoot.startsWith("..") ||
    isAbsolute(fromRoot)
  ) {
    throw new Error("Reference path escapes the catalog root");
  }
  return resolved;
}

export interface FilesystemReferenceCatalogDependencies {
  readonly catalogPath: string;
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

export function createFilesystemReferenceCatalog(
  dependencies: FilesystemReferenceCatalogDependencies,
): ReferenceCatalog {
  return createReferenceCatalog(async () => {
    const root = dirname(dependencies.catalogPath);
    const catalog = JSON.parse(
      await readFile(dependencies.catalogPath, "utf8"),
    ) as ReferenceCatalogManifest;
    const entries = await Promise.all(
      catalog.entries.map(async (path) =>
        JSON.parse(
          await readFile(resolveInsideRoot(root, path), "utf8"),
        ),
      ),
    );
    return {
      catalog,
      entries,
      readText: (path) => readFile(resolveInsideRoot(root, path), "utf8"),
      ...(dependencies.relatedActivityIdsByEntryId === undefined
        ? {}
        : {
            relatedActivityIdsByEntryId:
              dependencies.relatedActivityIdsByEntryId,
          }),
    };
  });
}

export function createUnavailableReferenceCatalog(
  issueCode: ReferenceReadinessIssueCode,
): ReferenceCatalog {
  return {
    async readiness() {
      return { ready: false, issueCodes: [issueCode] };
    },
    async getEntry() {
      return undefined;
    },
    async resolveSlug() {
      return undefined;
    },
    async search(query) {
      return {
        schemaVersion: 1,
        catalogVersion: 0,
        query,
        total: 0,
        results: [],
      };
    },
    async getNavigation() {
      return {
        schemaVersion: 1,
        catalogVersion: 0,
        categories: [],
        supportedStandards: CPP_STANDARDS,
      };
    },
  };
}
