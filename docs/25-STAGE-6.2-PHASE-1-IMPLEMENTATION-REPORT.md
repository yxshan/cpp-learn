# Stage 6.2 Phase 1 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-010 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Scope delivered

- Added strict catalog and Entry JSON Schemas in
  `packages/reference-schema`.
- Added the read-only `ReferenceCatalog` Module Interface with filesystem and
  in-memory Adapters.
- Implemented atomic activation, confined paths, complete graph validation,
  ordered navigation, stable ID lookup, canonical slug resolution, and
  deterministic ranked search.
- Added standard availability filters that distinguish introduction,
  deprecation, removal, and draft status.
- Added shared Reference DTOs and Fastify navigation, search, resolve, and
  detail routes with deterministic `400`, `404`, and degraded `503` responses.
- Added optional Curriculum `referenceIds`; the composition root validates the
  cross-catalog relationship and supplies the immutable reverse Activity index.
- Added five original Chinese Entries spanning landing, header, type, function,
  and member kinds, with four deterministic C++20 examples.
- Added `npm run check:reference` to the repository quality gate.

## 2. Architecture and safety

Reference content remains release-owned JSON, Markdown, and C++ source. It is
not learner data and cannot create Workspaces, Attempts, Judge jobs, Learning
Records, or Evidence. Public DTOs omit repository paths and authoring
diagnostics. Readiness exposes only `catalog_missing`, `catalog_invalid`, or
`integration_invalid`.

Activity manifests own outbound `referenceIds`. Reference owns Entry content
and Entry-to-Entry relationships. The server composition root alone validates
the cross-catalog graph and builds reverse Activity links.

## 3. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| `T-REF-001` | Schema fixtures, real filesystem activation, confined paths, and symlink escape rejection | Passed |
| `T-REF-002` | Duplicate/graph/navigation/redirect rejection and composition-root link validation | Passed |
| `T-REF-003` | Symbol, explicit prefix, title, alias, Chinese, heading, header, positive filters, verification, stable ties, and standard-interval search | Passed |
| `T-REF-004` | Clang compiles four examples with declared C++20 and strict warnings; Run output is exact | Passed |
| `T-REF-005` | Real Fastify injection covers bootstrap readiness, all Reference query routes, and safe error semantics | Passed |
| `T-REF-010` | Schema and activation require primary sources and complete reused-material attribution | Passed |
| Existing regression suite | Curriculum, server, learning, Workspace, Judge, Web build, lint, and type checks | Passed |

## 4. Release content

The tracer-bullet catalog contains:

- C++ Standard Library landing.
- `<vector>` header.
- `std::vector` type.
- `std::sort` function.
- `std::vector::push_back` member.

The STL Lesson and sorting Exercise link to the applicable stable Entry IDs.

## 5. Controlled limitations

- Phase 1 exposes HTTP and Module capabilities but does not add the Web
  Reference browser; that is Phase 2.
- The accepted tracer bullet has five Entries, not the 15-Entry Web vertical
  release or the later 80–120 Entry core catalog.
- Example execution is a maintainer content gate only. Learners do not yet have
  a Reference Playground.
- Runtime verification remains `not-checked` until a local verification Adapter
  supplies per-example results; release CI success is not presented as proof
  about a different local toolchain.
- Search is deliberately deterministic and alias-driven; fuzzy matching and
  remote search are not enabled.

## 6. Rollback

The capability is read-only and stores no learner state. Before the Web route
ships, rollback removes the Reference server dependency, Module, schemas,
content, and Activity `referenceIds`. Existing Curriculum, Workspace, Judge,
and Learning Record data require no migration.
