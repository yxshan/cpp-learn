import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import {
  CPP_STANDARDS,
  type CppStandard,
  type ReferenceEntryDetail,
  type ReferenceEntryKind,
  type ReferenceNavigation,
  type ReferenceReadiness,
  type ReferenceReadinessIssueCode,
  type ReferenceMatchField,
  type ReferenceSearchQuery,
  type ReferenceSearchResult,
  type ReferenceSlugResolution,
  type ReferenceSource,
  type ReferenceVerification,
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
  readonly textByPath: ReadonlyMap<string, string>;
  readonly searchDocuments: readonly ReferenceSearchDocument[];
  readonly verificationByExampleKey: ReadonlyMap<
    string,
    ReferenceVerification
  >;
  readonly relatedActivityIdsByEntryId: ReadonlyMap<string, readonly string[]>;
}

interface ReferenceSearchDocument {
  readonly entry: ReferenceEntryManifest;
  readonly headings: readonly string[];
  readonly body: string;
  readonly categoryValues: readonly string[];
  readonly verification: ReferenceVerification;
}

export class ReferenceQueryValidationError extends Error {}
class ReferenceCatalogMissingError extends Error {}

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
  readonly verificationByExampleKey?: ReadonlyMap<
    string,
    ReferenceVerification
  >;
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function exampleVerificationKey(entryId: string, exampleId: string): string {
  return `${entryId}/${exampleId}`;
}

function entryVerification(
  entry: ReferenceEntryManifest,
  verificationByExampleKey: ReadonlyMap<string, ReferenceVerification>,
): ReferenceVerification {
  const states = entry.examples.map(
    (example) =>
      verificationByExampleKey.get(
        exampleVerificationKey(entry.id, example.id),
      ) ?? "not-checked",
  );
  if (states.includes("unsupported")) return "unsupported";
  if (states.length > 0 && states.every((state) => state === "verified")) {
    return "verified";
  }
  return "not-checked";
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
  const verificationByExampleKey =
    data.verificationByExampleKey ?? new Map<string, ReferenceVerification>();
  const searchDocuments = data.entries.map((entry) => {
    const markdown = textByPath.get(entry.content.path) ?? "";
    return {
      entry,
      headings: headings(markdown),
      body: markdown.replace(/^#{1,6}\s+.+$/gm, ""),
      categoryValues: entry.categories.flatMap((categoryId) => {
        const title = categoryById.get(categoryId)?.title;
        return title === undefined ? [categoryId] : [categoryId, title];
      }),
      verification: entryVerification(entry, verificationByExampleKey),
    };
  });
  return {
    catalog: data.catalog,
    entriesById,
    textByPath,
    searchDocuments,
    verificationByExampleKey,
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

function exactQuery(value: string, query: string): boolean {
  return searchableForms(value).includes(query);
}

function prefixQuery(value: string, query: string): boolean {
  return searchableForms(value).some((form) => form.startsWith(query));
}

function tokenQuery(value: string, query: string): boolean {
  const forms = searchableForms(value);
  if (/\p{Script=Han}/u.test(query)) {
    return forms.some((form) => form.includes(query));
  }
  const queryTokens: readonly string[] =
    query.match(/[\p{L}\p{N}_:+<>-]+/gu) ?? [];
  if (queryTokens.length === 0) return false;
  return forms.some((form) => {
    const tokens: readonly string[] =
      form.match(/[\p{L}\p{N}_:+<>-]+/gu) ?? [];
    return queryTokens.every((token) => tokens.includes(token));
  });
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
        error instanceof ReferenceCatalogMissingError
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
            verification:
              state.active.verificationByExampleKey.get(
                exampleVerificationKey(entry.id, example.id),
              ) ?? "not-checked",
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
        content: markdown,
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
      const ranked = state.active.searchDocuments
        .filter(
          (document) =>
            (query.kind === undefined ||
              document.entry.kind === query.kind) &&
            (query.category === undefined ||
              document.entry.categories.includes(query.category)) &&
            (query.standard === undefined ||
              availableInStandard(document.entry, query.standard)) &&
            (query.verified === undefined ||
              document.verification === query.verified),
        )
        .flatMap((document) => {
          const { entry } = document;
          const matchedBy = new Set<ReferenceMatchField>();
          let score = normalizedQuery.length === 0 ? 100 : Infinity;
          const recordMatch = (
            field: ReferenceMatchField,
            matched: boolean,
            matchScore: number,
          ) => {
            if (matched && normalizedQuery.length > 0) {
              matchedBy.add(field);
              score = Math.min(score, matchScore);
            }
          };
          recordMatch("id", exactQuery(entry.id, normalizedQuery), 0);
          recordMatch(
            "symbol",
            entry.symbol !== undefined &&
              exactQuery(entry.symbol, normalizedQuery),
            0,
          );
          recordMatch(
            "header",
            entry.header !== undefined &&
              exactQuery(entry.header, normalizedQuery),
            0,
          );
          recordMatch(
            "alias",
            entry.aliases.some((alias) => exactQuery(alias, normalizedQuery)),
            1,
          );
          recordMatch("title", exactQuery(entry.title, normalizedQuery), 1);
          recordMatch(
            "symbol",
            entry.symbol !== undefined &&
              prefixQuery(entry.symbol, normalizedQuery),
            2,
          );
          recordMatch("title", tokenQuery(entry.title, normalizedQuery), 3);
          recordMatch(
            "heading",
            document.headings.some((heading) =>
              tokenQuery(heading, normalizedQuery),
            ),
            3,
          );
          recordMatch(
            "category",
            document.categoryValues.some((category) =>
              tokenQuery(category, normalizedQuery),
            ),
            4,
          );
          recordMatch("body", tokenQuery(document.body, normalizedQuery), 4);
          if (!Number.isFinite(score) && normalizedQuery.length > 0) return [];
          return [{ ...document, matchedBy: [...matchedBy], score }];
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
        results: ranked.slice(0, limit).map(({ entry, matchedBy, verification }) => ({
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
          verification,
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
  readonly verificationByExampleKey?: ReadonlyMap<
    string,
    ReferenceVerification
  >;
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
    ...(dependencies.verificationByExampleKey === undefined
      ? {}
      : {
          verificationByExampleKey: dependencies.verificationByExampleKey,
        }),
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

async function readConfinedText(root: string, path: string): Promise<string> {
  const lexicalPath = resolveInsideRoot(root, path);
  const physicalPath = await realpath(lexicalPath);
  const fromRoot = relative(root, physicalPath);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("Reference symlink escapes the catalog root");
  }
  return readFile(physicalPath, "utf8");
}

export interface FilesystemReferenceCatalogDependencies {
  readonly catalogPath: string;
  readonly verificationByExampleKey?: ReadonlyMap<
    string,
    ReferenceVerification
  >;
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

export function createFilesystemReferenceCatalog(
  dependencies: FilesystemReferenceCatalogDependencies,
): ReferenceCatalog {
  return createReferenceCatalog(async () => {
    let catalogPath: string;
    try {
      catalogPath = await realpath(dependencies.catalogPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ReferenceCatalogMissingError();
      }
      throw error;
    }
    const root = dirname(catalogPath);
    const catalog = JSON.parse(
      await readFile(catalogPath, "utf8"),
    ) as ReferenceCatalogManifest;
    const entries = await Promise.all(
      catalog.entries.map(async (path) =>
        JSON.parse(await readConfinedText(root, path)),
      ),
    );
    return {
      catalog,
      entries,
      readText: (path) => readConfinedText(root, path),
      ...(dependencies.verificationByExampleKey === undefined
        ? {}
        : {
            verificationByExampleKey: dependencies.verificationByExampleKey,
          }),
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
