# C++ API Reference Module Design

| Field | Value |
|---|---|
| Document ID | REF-DES-001 |
| Version | 1.3 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Purpose

Define a local, searchable, learning-oriented C++ Reference that adopts the
useful information architecture of MDN without copying its Web-specific domain
model. The Reference must explain standard-library entities in Chinese, retain
precise C++ semantics, link to Activities, and later open verified examples in
an isolated Playground.

The design introduces a `Reference` deep Module. It does not expand the
`Curriculum` Activity model: a Reference Entry has no prerequisite, Judge,
reflection, Evidence policy, or learner-owned Workspace.

## 2. Scope

### Initial scope

- C++ standard-library headers, types, objects, functions, concepts, and
  selected high-value members.
- C++20 as the executable baseline, with `since`, `deprecated`, and later-
  standard metadata where relevant.
- Offline catalog navigation, filtering, and ranked search.
- Original Chinese explanations, verified examples, explicit sources, and
  links to related Entries and Activities.
- A read-only Web experience that does not change learning state.

### Deferred scope

- General C++ language syntax Reference.
- POSIX, Boost, Qt, vendor SDKs, operating-system interfaces, and third-party
  libraries.
- Automated import, scraping, or translation of cppreference or MDN content.
- Remote search infrastructure or a Reference database.
- AI-generated canonical facts or automatic publication of AI-written content.
- Example execution until the read-only catalog is accepted.

## 3. Domain terminology

- **Reference Entry**: one versioned, addressable documentation item.
- **Entry kind**: `landing`, `header`, `type`, `object`, `function`, `member`,
  `concept`, or `guide`.
- **Symbol**: the canonical C++ name, such as `std::vector` or
  `std::ranges::sort`.
- **Standard status**: first standard, optional deprecation/removal standard,
  and whether the local toolchain has verified the example.
- **Reference Source**: an authoritative or secondary link used to verify a
  factual statement; it is not copied content.
- **Reference Example**: an original, deterministic C++ snippet associated
  with one Entry.
- **Playground**: a temporary, non-Activity code area used to compile or run a
  Reference Example without producing learning Evidence.

Stable Entry IDs use lowercase kebab-case and do not change when titles or
slugs change. Symbols retain exact C++ spelling and case.

## 4. Architecture

```text
┌──────────────────────┐       ┌────────────────────────┐
│ Reference Web Adapter│──────▶│ Fastify HTTP Adapter   │
└──────────────────────┘       └───────────┬────────────┘
                                           ▼
                                ┌────────────────────────┐
                                │ Reference Module       │
                                │ lookup/search/navigation│
                                └───────────┬────────────┘
                                            ▼
                                ┌────────────────────────┐
                                │ Filesystem Adapter     │
                                │ JSON + Markdown        │
                                └────────────────────────┘

Curriculum Activity ──referenceIds──▶ Reference Entry
Reference Example ─────────▶ temporary Playground ──▶ Judge execution seam
```

`apps/server` remains the only composition root. The Reference Module receives
its catalog root and file reader as dependencies. After both catalogs validate,
the composition root also supplies an immutable Activity-link index derived
from Curriculum `referenceIds`. The Module cannot write Workspaces, Learning
Records, or Curriculum files.

The initial production and test implementations both use the same filesystem
content rules. An in-memory Adapter is justified for Module tests; no database
Adapter is introduced until catalog scale or measured latency requires one.

## 5. Module Interface

```ts
interface ReferenceCatalog {
  readiness(): Promise<ReferenceReadiness>;
  getEntry(entryId: string): Promise<ReferenceEntryDetail | undefined>;
  resolveSlug(slug: string): Promise<ReferenceSlugResolution | undefined>;
  search(query: ReferenceSearchQuery): Promise<ReferenceSearchResult>;
  getNavigation(): Promise<ReferenceNavigation>;
}
```

### Interface invariants

- Queries are read-only and deterministic for one activated catalog version.
- Catalog activation is all-or-nothing after validation.
- Unknown IDs and slug resolutions return `undefined`; invalid search filters
  return a validation error.
- Search results use stable tie-breaking by normalized symbol and Entry ID.
- Public results contain content and attribution only; filesystem paths and
  authoring diagnostics remain server-side.
- One Entry cannot declare a relationship to an unknown Entry.
- A slug may change only with an explicit catalog redirect; an ID never changes.

The Module hides Markdown loading, normalization, indexing, ranking, link
resolution, source validation, and navigation-tree construction behind this
small Interface.

## 6. Repository layout

```text
modules/
  reference/                  Reference Module and tests
packages/
  reference-schema/           Entry JSON Schema and validator
  contracts/                  versioned Reference query DTOs
reference-content/
  catalog.json
  standard-library/
    containers/
      vector/
        entry.json
        content.md
        examples/
          basic.cpp
apps/
  server/                     HTTP Adapter and composition
  web/src/reference/          lazy-loaded Reference Web Adapter
```

Reference content is repository-owned release material. It is not included in
learner backup/restore because it can be restored from the application release.

## 7. Entry model

The normative JSON Schema will live in `packages/reference-schema`. The first
schema version represents the following authoring and storage manifest shape:

```ts
type ReferenceEntryKind =
  | "landing"
  | "header"
  | "type"
  | "object"
  | "function"
  | "member"
  | "concept"
  | "guide";

type CppStandard =
  | "c++98"
  | "c++03"
  | "c++11"
  | "c++14"
  | "c++17"
  | "c++20"
  | "c++23"
  | "c++26-draft";

interface ReferenceCatalogManifest {
  schemaVersion: 1;
  version: number;
  entries: string[];
  categories: {
    id: string;
    title: string;
    parentId?: string;
    order: number;
  }[];
  redirects: {
    fromSlug: string;
    toEntryId: string;
  }[];
}

interface ReferenceExampleManifest {
  id: string;
  path: string;
  kind: "compile" | "run" | "expected-compile-failure";
  standard: CppStandard;
  stdin?: string;
  expectedStdout?: string;
  expectedDiagnosticCategory?: string;
}

interface ReferenceSource {
  kind: "primary" | "secondary" | "vendor";
  title: string;
  url: string;
  standardSection?: string;
  reusedMaterial?: {
    license: string;
    attribution: string;
    modifications: string;
  };
}

interface ReferenceEntryManifest {
  schemaVersion: 2;
  id: string;
  version: number;
  slug: string;
  kind: ReferenceEntryKind;
  title: string;
  summary: string;
  symbol?: string;
  header?: string;
  namespace?: string;
  since?: CppStandard;
  deprecatedSince?: CppStandard;
  removedSince?: CppStandard;
  aliases: string[];
  categories: string[];
  relatedEntryIds: string[];
  content: { format: "markdown"; path: string };
  examples: ReferenceExampleManifest[];
  sources: ReferenceSource[];
  verifiedAt: string;
}
```

Catalog entry values are confined relative paths to `entry.json` manifests.
Category IDs are unique and their optional parent graph is acyclic. Redirect
source slugs are unique, cannot equal an active slug, and target an existing
Entry ID.

Every Entry requires at least one `primary` source. A `run` example requires
bounded deterministic `expectedStdout`; an
`expected-compile-failure` example requires `expectedDiagnosticCategory` and
cannot declare expected stdout. `c++26-draft` is visibly different from a
published standard and may remain locally unverified when the toolchain lacks
support.

Complexity, exception guarantees, iterator invalidation, thread safety,
constraints, overload explanations, and feature-test macros remain structured
Markdown sections in version 1. They become manifest fields only after a real
query or rendering need demonstrates leverage.

## 8. Content structure

Entry kinds adapt MDN's landing/reference/subpage separation to C++:

- A `landing` Entry organizes a library area such as Containers.
- A `header` Entry describes one standard header and links its public entities.
- A `type` Entry summarizes constructors, members, invariants, and invalidation.
- Simple members remain addressable anchors within a type Entry.
- A complex or high-frequency member may become a `member` Entry.
- A `guide` is task-oriented and must link back to precise Reference Entries.

Every non-landing Entry must include, where applicable:

1. Summary and intended use.
2. Header, namespace, and standard availability.
3. Synopsis or representative signatures.
4. Parameters and return value.
5. Preconditions and constraints.
6. Complexity and exception guarantee.
7. Lifetime, invalidation, and thread-safety rules.
8. At least one minimal original example.
9. Common mistakes and JavaScript comparison when pedagogically useful.
10. Related Entries, Activities derived from Curriculum links, and factual
    sources.

## 9. Search design

The initial index is constructed in memory during catalog activation. It stores
normalized symbol, title, header, aliases, categories, headings, and plain-text
body tokens. Markdown HTML is never indexed as executable content.

Ranking order:

1. Exact Entry ID, symbol, or header match.
2. Exact alias or title match.
3. Symbol prefix match.
4. Title and heading token match.
5. Category and body token match.
6. Stable symbol/ID tie-break.

Normalization preserves `std::`, `<header>`, and underscores as searchable
forms while also indexing stripped variants. The search query is bounded in
length and result count. Version 1 does not use fuzzy edit-distance matching;
curated aliases cover common Chinese and English terms with deterministic
results.

Supported filters:

- Entry kind.
- Category.
- Standard version.
- Local toolchain verification status.

`standard=X` means “available when compiling in X”, not “introduced in X”. An
entity Entry matches when `since <= X` and `removedSince` is absent or
`X < removedSince`, using the order declared by `CppStandard`.
`deprecatedSince` does not remove a result; the result remains visible with a
deprecated status. `c++26-draft` sorts after C++23 and includes earlier,
non-removed entities plus draft-only entities, but its draft status remains
visible. A `landing` or `guide` Entry without `since` is excluded when a
standard filter is active and remains visible in unfiltered navigation and
search.

## 10. HTTP and Web presentation

Planned query routes:

```text
GET /api/v1/reference
GET /api/v1/reference/search?q=vector&standard=c%2B%2B20
GET /api/v1/reference/resolve?slug=standard-library%2Fcontainers%2Fvector
GET /api/v1/reference/entries/:entryId
```

These routes are active contracts in [Interface
Contracts](05-INTERFACE_CONTRACTS.md). Their DTOs are shared from
`packages/contracts` and covered through executable Module and Fastify tests.

Proposed query DTOs:

```ts
interface ReferenceSearchQuery {
  text: string;
  kind?: ReferenceEntryKind;
  category?: string;
  standard?: CppStandard;
  verified?: "verified" | "unsupported" | "not-checked";
  limit?: number; // 1..50, default 20
}

interface ReferenceSearchItem {
  id: string;
  slug: string;
  kind: ReferenceEntryKind;
  title: string;
  summary: string;
  symbol?: string;
  header?: string;
  since?: CppStandard;
  deprecatedSince?: CppStandard;
  verification: "verified" | "unsupported" | "not-checked";
  matchedBy: (
    | "id"
    | "symbol"
    | "header"
    | "alias"
    | "title"
    | "heading"
    | "category"
    | "body"
  )[];
}

interface ReferenceSearchResult {
  schemaVersion: 2;
  catalogVersion: number;
  query: ReferenceSearchQuery;
  total: number;
  results: ReferenceSearchItem[];
}

interface ReferenceSlugResolution {
  schemaVersion: 2;
  entryId: string;
  canonicalSlug: string;
  redirected: boolean;
}

interface ReferenceExampleView {
  id: string;
  kind: ReferenceExampleManifest["kind"];
  standard: CppStandard;
  source: string;
  digest: string;
  verification: "verified" | "unsupported" | "not-checked";
  stdin?: string;
  expectedStdout?: string;
  expectedDiagnosticCategory?: string;
}

interface ReferenceEntryDetail
  extends Omit<
    ReferenceEntryManifest,
    "content" | "examples"
  > {
  schemaVersion: 2;
  catalogVersion: number;
  content: string;
  examples: ReferenceExampleView[];
  relatedActivityIds: string[];
}

interface ReferenceNavigation {
  schemaVersion: 2;
  catalogVersion: number;
  categories: {
    id: string;
    title: string;
    parentId?: string;
    order: number;
    entryIds: string[];
  }[];
  supportedStandards: CppStandard[];
}

type ReferenceReadiness =
  | {
      ready: true;
      catalogVersion: number;
      entryCount: number;
      activationDurationMs: number;
    }
  | {
      ready: false;
      issueCodes: (
        | "catalog_missing"
        | "catalog_invalid"
        | "integration_invalid"
      )[];
    };
```

Public DTOs omit manifest paths and add example source text, SHA-256 digest,
local verification state, and Activity links from the validated integration
index. Unknown Entries return `404`, invalid bounded filters return `400`, and
unavailable Reference capability returns `503 reference_unavailable` without
changing platform health.

Successful readiness also exposes the measured catalog activation duration in
milliseconds. Readiness exposes only the closed, stable `issueCodes`
vocabulary. Detailed
schema paths, filesystem paths, source excerpts, and authoring diagnostics are
logged and displayed only through server-side development tooling.

The in-memory Adapter may receive a local verification map keyed by
Entry/example identity. The production filesystem Adapter instead loads an
optional, schema-validated verification manifest from the local data root. The
content gate writes this rebuildable manifest atomically only after every
example passes. Each record is bound to the catalog version, compiler
fingerprint, Entry/example identity, declared standard, and source SHA-256
digest. A mismatch invalidates the manifest rather than carrying evidence
across content or toolchain changes; a valid partial manifest leaves unlisted
examples `not-checked`.

Entry search status is `verified` only when every example is verified,
`unsupported` when any example is unsupported, and otherwise `not-checked`.
Missing, malformed, duplicate, or stale verification data is never treated as
proof of support and never makes Reference unavailable. The manifest is a
local cache, excluded from source control and learner backups. The HTTP
bootstrap response includes Reference readiness without making this optional
capability part of overall learning-platform readiness.

Slug resolution is deterministic. An active slug returns its Entry ID and
`redirected: false`; a historical catalog redirect returns the target Entry's
ID and canonical slug with `redirected: true`; an unknown slug returns `404`.
Redirects target Entry IDs directly, so redirect chains are neither stored nor
followed. The detail route accepts only a stable Entry ID.

The Web Adapter is lazy-loaded from the primary navigation. Its desktop layout
uses a category sidebar, main article, and local table of contents. Narrow
screens collapse the sidebar behind a labeled control and keep search, title,
status, and article content within the viewport.

Required interactions:

- Keyboard-accessible global search with a real label.
- Stable URL for Entry and heading anchors.
- Back/forward navigation without losing the search query. A historical slug
  is replaced with its canonical slug using `history.replaceState`, preserving
  the heading anchor and search context without adding a history entry.
- Visible standard, draft, deprecated, and local-support states that do not
  rely on color alone.
- Copy buttons that announce success without modifying code or records.
- Links to related Activities that preserve unsaved-Workspace confirmation.

## 11. Curriculum integration

Activities add optional `referenceIds` in the read-only vertical release. The
Curriculum Module validates their shape and owns which References are relevant
to an Activity. After both Modules activate internally, the composition root
validates every cross-catalog ID and builds an immutable reverse link index.
This is a relationship between Modules, not ownership transfer:

- Curriculum owns when a Reference is relevant to an Activity.
- Reference owns Entry content, navigation, and related-Entry relationships.
- The composition root owns cross-catalog validation and derives Activity links
  for Reference query results.
- Learning Platform owns Activity navigation and Evidence.
- Reference browsing produces no Activity start, completion, or Evidence event.

## 12. Example verification and Playground

### Read-only release

Each example file is compiled by content CI with its declared standard and the
reference warning profile. Compile-failure examples require an explicit kind
and expected diagnostic category; they cannot silently fail the gate.

The local content gate additionally publishes successful results to the
verification manifest described above. It does not publish a replacement when
any example fails, times out, exceeds output bounds, produces unexpected
stdout, or misses its expected diagnostic category. This preserves the last
complete result while its catalog/toolchain binding prevents stale evidence
from being presented as current.

### Interactive release

Opening a supported Run example creates browser-local source state separate from
every Activity Workspace. Starting it creates a stable, client-visible temporary
Playground run identity and an immutable, content-addressed, non-Activity Source
Snapshot. Playground Run:

- uses that snapshot and the existing Judge execution seam without persisting it
  as learner-owned Workspace state;
- never executes private tests or produces Evidence;
- never changes Concept state, Review state, or Project progress;
- uses a closed build profile and bounded stdin/runtime settings;
- labels native execution limitations consistently with Activity Run;
- supports cancellation through its active run identity;
- has bounded compile, runtime, output, and cleanup outcomes; and
- can be reset or explicitly discarded without affecting learner backups.

Reference content cannot provide shell commands, arbitrary compiler paths,
environment variables, or custom Judge stages.

## 13. Versioning and activation

- Patch: wording, source, alias, or non-semantic example explanation.
- Entry version: signature, behavior, status, example, or relationship change.
- Catalog version: navigation or required-set change.
- Schema major: breaking manifest representation.

Activation reads all manifests, validates the complete graph, builds the search
index and navigation tree, and then atomically replaces the active in-memory
catalog. A failed reload leaves the previous valid catalog active.

`verifiedAt` records content verification time, not a guarantee that every
vendor implementation matches the standard. Draft Entries require explicit
re-verification before release.

## 14. Sources, licensing, and authorship

- Explanations and examples are original project content by default.
- Sources are used to verify facts and are linked; source prose is not copied.
- Each Entry requires at least one primary source, normally a published-standard
  reference or current working-draft section, and may add cppreference or vendor
  documentation as secondary context.
- Reused text or code requires per-item license, attribution, source URL, and
  modification notes. A catalog cannot activate if required attribution is
  absent.
- MDN visual identity, logos, and trade dress are not reused.
- Automated scraping and machine translation are outside the production
  content workflow.

Authoring references:

- [MDN page types](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Page_structures/Page_types)
- [MDN API reference guidance](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Howto/Write_an_api_reference)
- [MDN attribution and licensing](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license)
- [ISO C++ standard status](https://isocpp.org/std/the-standard)
- [Current C++ working draft](https://eel.is/c%2B%2Bdraft/)
- [cppreference licensing](https://en.cppreference.com/Cppreference%3AAbout)

## 15. Security and privacy

- Markdown uses the existing safe renderer; arbitrary HTML, MDX, scripts, and
  event attributes are rejected.
- External links receive the same safe-link behavior as Lesson sources.
- Search input is data, never a filesystem path, regular expression, SQL, or
  shell fragment.
- Public DTOs omit repository paths and content-author diagnostics.
- Reading and searching remain local and generate no learning-history events.
- A later AI Adapter receives only the selected public Entry and approved
  context, never private Judge data or unrelated learner files.

## 16. Performance and observability

For a catalog of 1,000 Entries on the reference machine:

- Catalog activation target: under 1 second excluding example compilation.
- Warm search p95 target: under 100 ms for a bounded 20-result query.
- Entry query target: under 50 ms after activation.
- Initial Web route must lazy-load so the Dashboard bundle does not include the
  complete rendered Reference.

Startup readiness reports Entry count, catalog version, activation duration,
and safe validation summaries. Search logs may include duration and result
count, but not raw free-form queries by default.

## 17. Failure behavior

- Invalid required content prevents a new Reference catalog from activating.
- An unavailable Reference Module does not prevent existing Dashboard,
  Activity, Workspace, or Grade flows from starting; bootstrap reports the
  degraded capability.
- An unknown related Entry is a Reference activation error; an unknown Activity
  `referenceId` is a cross-catalog content readiness error.
- Missing example toolchain support marks the example unverified for that local
  toolchain; it does not rewrite normative standard status.
- A Playground system error remains separate from learning verdicts.

## 18. Acceptance criteria

The initial Reference release is accepted when:

- At least 15 representative Entries across five categories validate and load.
- Exact symbol, header, alias, Chinese title, and filtered search are
  deterministic and contract-tested, including standard availability
  intervals.
- Entry, navigation, and related-Entry links have no broken targets.
- Active and historical slugs resolve to one canonical URL; unknown slugs have
  deterministic not-found behavior.
- All ordinary examples compile under their declared standard when the local
  toolchain supports it; unsupported later-standard examples are explicitly
  reported and cannot be labeled verified.
- Reference browsing produces no Workspace or Learning Record mutation.
- Direct URLs, browser history, keyboard navigation, and a 390-pixel viewport
  pass Playwright coverage.
- A production build works offline after local server startup.
- Content sources and any reused-material attribution pass validation.

## 19. Rollback

The Reference is a read-only optional capability. Rolling back removes its Web
route, HTTP routes, Module composition, and release content without migrating
learner data. Activity manifests must not require Reference IDs until the
Reference capability is part of the compatible release baseline.
