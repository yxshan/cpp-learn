import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
  CPP_STANDARDS,
  REFERENCE_SCHEMA_VERSION,
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
  validateReferenceVerificationManifest,
} from "@cpp-learn/reference-schema";

export {
  createReferenceCoverageReport,
  type ReferenceCoverageReport,
} from "./coverage.ts";
export {
  assertReferenceCompilationAccepted,
  createReferenceExampleVerifier,
  ReferenceExampleVerificationError,
  type ReferenceCompilationCheck,
  type ReferenceExampleVerificationRequest,
  type ReferenceExampleVerifierOptions,
} from "./example-verifier.ts";

const MODERN_REFERENCE_CPP_COMPILER_CANDIDATES = [
  "/opt/homebrew/opt/llvm/bin/clang++",
  "/usr/local/opt/llvm/bin/clang++",
] as const;

export const REFERENCE_CPP_COMPILER_ENVIRONMENT_VARIABLE =
  "CPP_LEARN_REFERENCE_COMPILER";

export function resolveReferenceCppCompiler(
  configuredCompiler: string | undefined = process.env[
    REFERENCE_CPP_COMPILER_ENVIRONMENT_VARIABLE
  ],
  pathExists: (path: string) => boolean = existsSync,
): string {
  const configured = configuredCompiler?.trim();
  if (configured) {
    if (!isAbsolute(configured)) {
      throw new Error(
        `${REFERENCE_CPP_COMPILER_ENVIRONMENT_VARIABLE} must be an absolute path`,
      );
    }
    if (!pathExists(configured)) {
      throw new Error(
        `${REFERENCE_CPP_COMPILER_ENVIRONMENT_VARIABLE} does not exist: ${configured}`,
      );
    }
    return configured;
  }

  return (
    MODERN_REFERENCE_CPP_COMPILER_CANDIDATES.find((candidate) =>
      pathExists(candidate),
    ) ?? "/usr/bin/clang++"
  );
}

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
  readonly schemaVersion: typeof REFERENCE_SCHEMA_VERSION;
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

export interface ReferenceVerificationManifest {
  readonly schemaVersion: 1;
  readonly catalogVersion: number;
  readonly compilerFingerprint: string;
  readonly examples: readonly {
    readonly entryId: string;
    readonly exampleId: string;
    readonly sourceDigest: string;
    readonly standard: CppStandard;
    readonly verification: "verified" | "unsupported";
  }[];
}

export const REFERENCE_VERIFICATION_MANIFEST_FILENAME =
  "reference-verification.json";

export function referenceVerificationManifestPath(dataRoot: string): string {
  return join(dataRoot, REFERENCE_VERIFICATION_MANIFEST_FILENAME);
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
  readonly activationDurationMs: number;
}

interface IndexedSearchField {
  readonly forms: readonly string[];
  readonly tokenSets: readonly (readonly string[])[];
}

interface ReferenceSearchDocument {
  readonly entry: ReferenceEntryManifest;
  readonly id: IndexedSearchField;
  readonly symbol?: IndexedSearchField;
  readonly header?: IndexedSearchField;
  readonly aliases: IndexedSearchField;
  readonly title: IndexedSearchField;
  readonly headings: IndexedSearchField;
  readonly categories: IndexedSearchField;
  readonly body: IndexedSearchField;
  readonly sortKey: string;
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
  readonly verification?: {
    readonly manifest: ReferenceVerificationManifest;
    readonly compilerFingerprint: string;
  };
  readonly relatedActivityIdsByEntryId?: ReadonlyMap<
    string,
    readonly string[]
  >;
}

function verificationFromManifest(
  verificationContext:
    | {
        readonly manifest: ReferenceVerificationManifest;
        readonly compilerFingerprint: string;
      }
    | undefined,
  catalog: ReferenceCatalogManifest,
  entries: readonly ReferenceEntryManifest[],
  textByPath: ReadonlyMap<string, string>,
): ReadonlyMap<string, ReferenceVerification> {
  if (
    verificationContext === undefined ||
    verificationContext.manifest.catalogVersion !== catalog.version ||
    verificationContext.manifest.compilerFingerprint !==
      verificationContext.compilerFingerprint
  ) {
    return new Map();
  }

  const { manifest } = verificationContext;
  const examples = new Map(
    entries.flatMap((entry) =>
      entry.examples.map((example) => [
        exampleVerificationKey(entry.id, example.id),
        { entry, example },
      ]),
    ),
  );
  const verification = new Map<string, ReferenceVerification>();
  for (const result of manifest.examples) {
    const key = exampleVerificationKey(result.entryId, result.exampleId);
    const current = examples.get(key);
    if (
      current === undefined ||
      verification.has(key) ||
      current.example.standard !== result.standard ||
      digest(textByPath.get(current.example.path) ?? "") !== result.sourceDigest
    ) {
      return new Map();
    }
    verification.set(key, result.verification);
  }
  return verification;
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
    data.verificationByExampleKey ??
    verificationFromManifest(
      data.verification,
      data.catalog,
      data.entries,
      textByPath,
    );
  const searchDocuments = data.entries.map((entry) => {
    const markdown = textByPath.get(entry.content.path) ?? "";
    const categoryValues = entry.categories.flatMap((categoryId) => {
      const title = categoryById.get(categoryId)?.title;
      return title === undefined ? [categoryId] : [categoryId, title];
    });
    return {
      entry,
      id: indexSearchValues([entry.id]),
      ...(entry.symbol === undefined
        ? {}
        : { symbol: indexSearchValues([entry.symbol]) }),
      ...(entry.header === undefined
        ? {}
        : { header: indexSearchValues([entry.header]) }),
      aliases: indexSearchValues(entry.aliases),
      title: indexSearchValues([entry.title]),
      headings: indexSearchValues(headings(markdown)),
      categories: indexSearchValues(categoryValues),
      body: indexSearchValues([markdown.replace(/^#{1,6}\s+.+$/gm, "")]),
      sortKey: normalize(entry.symbol ?? entry.title),
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
    activationDurationMs: 0,
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

function tokens(value: string): readonly string[] {
  return value.match(/[\p{L}\p{N}_:+<>-]+/gu) ?? [];
}

function indexSearchValues(values: readonly string[]): IndexedSearchField {
  const forms = [...new Set(values.flatMap(searchableForms))];
  return {
    forms,
    tokenSets: forms.map((form) => [
      ...new Set(tokens(form).flatMap(searchableForms)),
    ]),
  };
}

function exactQuery(field: IndexedSearchField, query: string): boolean {
  return field.forms.includes(query);
}

function prefixQuery(field: IndexedSearchField, query: string): boolean {
  return field.forms.some((form) => form.startsWith(query));
}

function tokenQuery(
  field: IndexedSearchField,
  query: string,
  queryTokens: readonly string[],
): boolean {
  if (/\p{Script=Han}/u.test(query)) {
    return field.forms.some((form) => form.includes(query));
  }
  if (queryTokens.length === 0) return false;
  return field.tokenSets.some((fieldTokens) =>
    queryTokens.every((token) => fieldTokens.includes(token)),
  );
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
  const activationStartedAt = performance.now();
  const activation: Promise<Activation> = load()
    .then(activate)
    .then((active) => ({
      ready: true as const,
      active: {
        ...active,
        activationDurationMs: Math.max(0, performance.now() - activationStartedAt),
      },
    }))
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
            activationDurationMs: state.active.activationDurationMs,
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
        schemaVersion: REFERENCE_SCHEMA_VERSION,
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
          schemaVersion: REFERENCE_SCHEMA_VERSION,
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
        schemaVersion: REFERENCE_SCHEMA_VERSION,
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
          schemaVersion: REFERENCE_SCHEMA_VERSION,
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
      const normalizedQueryTokens = tokens(normalizedQuery);
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
          recordMatch("id", exactQuery(document.id, normalizedQuery), 0);
          recordMatch(
            "symbol",
            document.symbol !== undefined &&
              exactQuery(document.symbol, normalizedQuery),
            0,
          );
          recordMatch(
            "header",
            document.header !== undefined &&
              exactQuery(document.header, normalizedQuery),
            0,
          );
          recordMatch(
            "alias",
            exactQuery(document.aliases, normalizedQuery),
            1,
          );
          recordMatch("title", exactQuery(document.title, normalizedQuery), 1);
          recordMatch(
            "symbol",
            document.symbol !== undefined &&
              prefixQuery(document.symbol, normalizedQuery),
            2,
          );
          recordMatch(
            "title",
            tokenQuery(document.title, normalizedQuery, normalizedQueryTokens),
            3,
          );
          recordMatch(
            "heading",
            tokenQuery(
              document.headings,
              normalizedQuery,
              normalizedQueryTokens,
            ),
            3,
          );
          recordMatch(
            "category",
            tokenQuery(
              document.categories,
              normalizedQuery,
              normalizedQueryTokens,
            ),
            4,
          );
          recordMatch(
            "body",
            tokenQuery(document.body, normalizedQuery, normalizedQueryTokens),
            4,
          );
          if (!Number.isFinite(score) && normalizedQuery.length > 0) return [];
          return [{ ...document, matchedBy: [...matchedBy], score }];
        })
        .sort(
          (left, right) =>
            left.score - right.score ||
            left.sortKey.localeCompare(right.sortKey, "en") ||
            left.entry.id.localeCompare(right.entry.id, "en"),
        );
      const limit = query.limit ?? 20;
      return {
        schemaVersion: REFERENCE_SCHEMA_VERSION,
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
          schemaVersion: REFERENCE_SCHEMA_VERSION,
          catalogVersion: 0,
          categories: [],
          supportedStandards: CPP_STANDARDS,
        };
      }
      return {
        schemaVersion: REFERENCE_SCHEMA_VERSION,
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
  readonly verification?: {
    readonly manifestPath: string;
    readonly compilerFingerprint: string;
  };
}

export function createFilesystemReferenceCatalog(
  dependencies: FilesystemReferenceCatalogDependencies,
): ReferenceCatalog {
  return createReferenceCatalog(async () => {
    const configuredCatalogPath = resolve(dependencies.catalogPath);
    const configuredRoot = dirname(configuredCatalogPath);
    let catalogPath: string;
    let root: string;
    try {
      root = await realpath(configuredRoot);
      catalogPath = await realpath(configuredCatalogPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ReferenceCatalogMissingError();
      }
      throw error;
    }
    const catalogFromRoot = relative(root, catalogPath);
    if (catalogFromRoot.startsWith("..") || isAbsolute(catalogFromRoot)) {
      throw new Error("Reference catalog symlink escapes the configured root");
    }
    const catalog = JSON.parse(
      await readFile(catalogPath, "utf8"),
    ) as ReferenceCatalogManifest;
    const entries = await Promise.all(
      catalog.entries.map(async (path) =>
        JSON.parse(await readConfinedText(root, path)),
      ),
    );
    let verificationManifest: ReferenceVerificationManifest | undefined;
    if (dependencies.verification !== undefined) {
      try {
        const candidate: unknown = JSON.parse(
          await readFile(resolve(dependencies.verification.manifestPath), "utf8"),
        );
        if (validateReferenceVerificationManifest(candidate).length === 0) {
          verificationManifest = candidate as ReferenceVerificationManifest;
        }
      } catch {
        verificationManifest = undefined;
      }
    }
    return {
      catalog,
      entries,
      readText: (path) => readConfinedText(root, path),
      ...(verificationManifest === undefined ||
      dependencies.verification === undefined
        ? {}
        : {
            verification: {
              manifest: verificationManifest,
              compilerFingerprint:
                dependencies.verification.compilerFingerprint,
            },
          }),
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
        schemaVersion: REFERENCE_SCHEMA_VERSION,
        catalogVersion: 0,
        query,
        total: 0,
        results: [],
      };
    },
    async getNavigation() {
      return {
        schemaVersion: REFERENCE_SCHEMA_VERSION,
        catalogVersion: 0,
        categories: [],
        supportedStandards: CPP_STANDARDS,
      };
    },
  };
}
