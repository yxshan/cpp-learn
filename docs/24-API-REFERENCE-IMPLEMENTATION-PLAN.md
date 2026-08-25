# C++ API Reference Implementation Plan

| Field | Value |
|---|---|
| Document ID | REF-PLAN-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Objective

Deliver an offline-first C++ standard-library Reference that is searchable,
source-backed, accessible, and connected to the existing learning platform.
Implementation follows vertical slices so content, contracts, Module behavior,
and browser experience become executable together.

The accepted design source is [C++ API Reference Module
Design](22-API-REFERENCE-MODULE-DESIGN.md). Content work follows the [Authoring
Guide](23-API-REFERENCE-CONTENT-AUTHORING-GUIDE.md).

## 2. Delivery policy

- Capability-gated rather than date-gated.
- TDD at the Reference Module and transport seams.
- No Activity, Workspace, Judge, or Learning Record regression.
- No bulk content expansion before the 15-Entry vertical release is accepted.
- Each change keeps the catalog valid and can ship independently.
- Small commits preserve reviewable contracts and rollback.

## 3. Phase 0: specification baseline

### Deliver

- SRS, architecture, detailed design, contracts, data, quality, roadmap, and
  traceability updates.
- Proposed ADR for a separate declarative Reference Module.
- Entry model, content policy, and initial editorial backlog.

### Acceptance

- Every new requirement has a planned test ID and delivery stage.
- Module ownership and non-goals are explicit.
- Licensing, rollback, and learner-data effects are documented.
- Documentation link and requirement checks pass.

## 4. Phase 1: Reference Module tracer bullet

### Work packages

1. Scaffold `packages/reference-schema` with manifest and catalog schemas.
2. Scaffold `modules/reference` with Interface result types and in-memory test
   fixtures.
3. Implement full-catalog validation and filesystem loading.
4. Implement deterministic navigation, canonical slug resolution, lookup, and
   ranked search.
5. Add shared query DTOs to `packages/contracts`.
6. Compose the Module in `apps/server` with degraded readiness reporting.
7. Expose Reference list, search, slug-resolution, and detail routes.
8. Add five Entries representing landing, header, type, function, and member
   kinds.

### Required tests

- Schema rejects unknown fields, unsafe paths, unsupported standards, and
  missing sources.
- Catalog rejects duplicate IDs/slugs, invalid redirects, unknown Entry
  relationships, and cycles in navigation parents.
- Composition rejects unknown Activity-to-Reference links after both catalogs
  validate.
- Search covers exact symbol, header, alias, Chinese title, prefix, filter, and
  stable tie-break behavior, including standard availability intervals.
- HTTP routes match shared DTOs and expose no local file paths.
- Missing Reference content degrades bootstrap without blocking learning flows.

### Exit criterion

Five valid Entries can be queried through real HTTP, invalid catalogs cannot
activate, and existing checks remain green.

## 5. Phase 2: Web vertical release

### Work packages

1. Add lazy-loaded Reference navigation and stable URL state.
2. Build landing, search results, Entry article, local table of contents, and
   related-content views.
3. Add semantic status badges, code copy feedback, loading, empty, not-found,
   and degraded states.
4. Implement 15 representative Entries and all required example files.
5. Add optional `referenceIds` to Activity manifests and perform cross-catalog
   validation in the composition root.
6. Connect bidirectional Reference/Activity navigation from the validated link
   index.
7. Add content verification to `npm run check:content` or a dedicated
   `check:reference` gate invoked by `npm run check`.

### Required tests

- Browser search opens `std::vector` from symbol, `<vector>`, and Chinese alias.
- Direct Entry and anchor URLs survive reload and browser history; historical
  slugs replace themselves with the canonical slug without adding a history
  entry or dropping the anchor and search context.
- Keyboard-only search, result selection, table of contents, and Activity
  navigation work.
- A 390-pixel viewport has no document-level horizontal overflow.
- Browsing and copying produce no Workspace or Learning Record writes.
- Production build serves the Reference without external network requests.

### Exit criterion

The 15-Entry Reference is usable offline and passes Module, contract,
integration, accessibility, and Playwright gates.

## 6. Phase 3: core catalog expansion

### Work packages

- Expand to 80–120 Entries across containers, algorithms, strings, memory,
  utilities, I/O, filesystem, time, and concurrency.
- Add category and standard filters plus local toolchain verification status.
- Add content coverage reporting by category, kind, standard, source, and
  example status.

### Exit criterion

All required course Activities expose relevant Reference links, the core
catalog contains no broken relationships, and every ordinary example compiles
under its declared profile.

## 7. Phase 4: Reference Playground

### Work packages

1. Define temporary Playground and example-run contracts.
2. Create immutable snapshots outside Activity Workspace identities.
3. Reuse the Judge execution seam through a closed Reference example profile.
4. Add Run output, diagnostics, cancellation, reset, and discard behavior.
5. Prove that example execution cannot write Evidence or Concept state.

### Required tests

- A valid example compiles/runs and returns structured diagnostics.
- Invalid source cannot escape the temporary root or change build arguments.
- Run timeout, cancellation, output bounds, and cleanup match Judge policy.
- Activity Workspaces, Attempts, Evidence, Reviews, and Projects are unchanged.
- Restart does not resume a discarded Playground as an Activity.

### Exit criterion

Selected examples run safely under the documented native limitations without
changing learning state.

## 8. Phase 5: grounded AI assistance

This phase remains deferred until canonical content is accepted.

- Build a context pack from the selected public Entry, related Entries, and
  approved Activity summaries.
- Require answers to distinguish source-backed facts from generated teaching
  explanations.
- Prohibit silent modification of canonical Entry content.
- Exclude private Judge data and unrelated learner source.
- Add evaluations for nonexistent-symbol refusal, standard-version accuracy,
  and source attribution.

## 9. Suggested commit sequence

1. `docs: specify C++ API reference module`
2. `test: define reference schema fixtures`
3. `feat: add reference content schema`
4. `test: specify reference catalog behavior`
5. `feat: load and validate reference catalog`
6. `test: specify deterministic reference search`
7. `feat: add reference lookup and search`
8. `feat: expose reference query contracts`
9. `feat: add reference browser vertical slice`
10. `content: add initial C++ reference entries`
11. `test: cover offline reference learning flow`

Each implementation commit should pass its focused tests. The full repository
gate runs before each phase is accepted.

## 10. Verification matrix

| Test ID | Planned evidence |
|---|---|
| T-REF-001 | Schema, ID, slug, path, version, and source validation |
| T-REF-002 | Reference graph/navigation plus composition-root cross-catalog validation |
| T-REF-003 | Deterministic lookup, ranking, aliases, and availability-interval filters |
| T-REF-004 | Original example compilation under declared standards |
| T-REF-005 | HTTP DTO and degraded-readiness contract tests |
| T-REF-006 | Canonical/redirected URL, history, responsive, and keyboard browser flow |
| T-REF-007 | No Workspace, Learning Record, or Evidence mutation on browse |
| T-REF-008 | Offline production serving and no remote request requirement |
| T-REF-009 | Playground execution isolation and cleanup |
| T-REF-010 | Source, attribution, and reused-material policy validation |

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Catalog grows faster than review capacity | Gate expansion behind the 15-Entry vertical release and coverage report |
| Incorrect standard facts | Require primary source, verification date, and technical review |
| Licensing contamination | Original content default; explicit per-item attribution schema |
| Search becomes inconsistent | Deterministic weights, aliases, stable fixtures, no fuzzy search initially |
| Reference pollutes learning state | Separate Module and Playground identity; explicit no-event tests |
| Main Web bundle becomes too large | Lazy route and query-loaded Entry bodies |
| Draft features become stale | Visible draft state and mandatory re-verification before release |
| Platform startup blocked by optional docs | Degraded Reference readiness without disabling learning flows |

## 12. Rollback plan

Before Activity manifests depend on Reference IDs, the Module can be removed by
reverting its composition, routes, Web navigation, and release content. No
learner migration is required. After bidirectional links ship, rollback must
retain a compatibility reader or first release a content migration that removes
required Reference relationships.
