# C++ API Reference Implementation Plan

| Field | Value |
|---|---|
| Document ID | REF-PLAN-001 |
| Version | 1.19 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

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

Current state: the first expansion batch, category/standard/verification
filters, coverage reporting, compiler-bound local verification manifests, the
first three content-quality batches, and breadth-expansion batches 4 through 19
are delivered. The controlled 120-Entry Phase 3 catalog target is complete.

Before further breadth expansion, the content-quality program upgrades thin
vertical-release Entries against the learning-quality definition in the
Authoring Guide. The controlled 120-Entry candidate list and delivery order are
maintained in the [Content Quality Backlog](reference/API_REFERENCE_CONTENT_QUALITY_BACKLOG.md).
Each quality batch requires a primary-source research note, two deterministic
examples for upgraded ordinary entities, content verification, and an
implementation report.

Quality batch 1 established the ordinary-entity baseline for `std::optional`,
`std::make_unique`, and `std::string_view`. Quality batch 2 established the
reduced header-page baseline and the container-selection decision model for
`<vector>`, `<array>`, `<deque>`, and `<unordered_map>`. Quality batch 3 gave
the remaining 12 core ordinary entities a deterministic realistic example and
explicit selection guidance, clearing the catalog's known one-example debt.
Breadth batch 4 advanced the catalog from 25 to 37 Entries by adding six
associative/container-adaptor types and six high-frequency algorithms. Every
new entity ships at learning-quality depth with two deterministic C++20 Run
examples and explicit C++20/current-draft separation.

Breadth batch 5 advanced the catalog from 37 to 49 Entries and from 66 to 88
examples. Six header facility maps close discovery around the batch-4
containers and numeric algorithms; six ordinary algorithm pages cover
existence queries, copying, reversal, adjacent deduplication, and per-element
execution. The pages explicitly separate classic, C++17 policy, and C++20
ranges families, including the fact that `std::binary_search` has no policy
overload.

Breadth batch 6 advanced the catalog from 49 to 61 Entries and from 88 to 108
examples. Four header facility maps and eight ordinary pages connect owning and
borrowed text, locale-independent conversion, shared ownership, weak
observation, and shared construction. Article rendering now exposes a compact
definition panel, linkable sections, learning callouts, sticky table headings,
and visibly separated primary and secondary sources. The information
architecture is checked against cppreference, while version, exception,
complexity, lifetime, and undefined-behavior claims remain grounded in WG21
primary sources. JavaScript comparisons are limited to useful mental-model
contrasts rather than claimed semantic equivalence.

Breadth batch 7 advances the catalog from 61 to 66 Entries and from 108 to 118
examples. `<utility>` supplies the navigation map, while `std::move`,
`std::forward`, `std::swap`, and `std::pair` establish the C++20 value-category,
generic exchange, and binary-value vocabulary. The pages keep the utility cast
separate from the range algorithm, teach ADL at the generic swap boundary, and
avoid importing C++23 pair-like and `forward_like` facilities into C++20.

Breadth batch 8 advances the catalog from 66 to 71 Entries and from 118 to 128
examples. `std::tuple`, `std::variant`, `std::any`, `std::expected`, and
`std::function` establish product, sum, runtime-erased value, explicit result,
and callable-erasure vocabulary. The first four C++20-capable entities keep
their C++20 declaration boundary, while `std::expected` is correctly published
and locally verified as C++23 through a compiler-compatible `c++2b` flag.

Breadth batch 9 advances the catalog from 71 to 78 Entries and from 128 to 142
examples. `std::cerr`, `std::getline`, `<fstream>`, `std::ifstream`,
`std::ofstream`, `<sstream>`, and `std::stringstream` establish diagnostic,
line-input, file-stream, and in-memory text-stream vocabulary. All fourteen
examples use the C++20 profile; file examples run in isolated temporary working
directories and clean up their relative-path fixtures through RAII.

Breadth batch 10 advances the catalog from 78 to 85 Entries and from 142 to 156
examples. `<filesystem>`, `std::filesystem::path`, `directory_entry`,
`directory_iterator`, `exists`, `create_directories`, and `remove` establish a
path-and-directory lifecycle slice. All fourteen new examples use C++20,
relative ASCII roots, checked setup and operations, RAII cleanup, and sorted
directory output where the standard leaves enumeration order unspecified.

Breadth batch 11 advances the catalog from 85 to 90 Entries and from 156 to 166
examples. `<chrono>`, `std::chrono::duration`, `std::chrono::time_point`,
`std::chrono::steady_clock`, and `std::chrono::system_clock` establish typed
interval, clock-relative point, monotonic measurement, and civil-time
conversion vocabulary. All ten new examples use fixed C++20 values: none call
`now()`, sleep, inspect time zones, depend on locale, or assert
implementation-defined clock resolution.

Breadth batch 12 advances the catalog from 90 to 96 Entries and from 166 to 178
examples. `<list>`, `std::list`, `<forward_list>`, `std::forward_list`,
`<span>`, and `std::span` contrast owning node sequences with a non-owning
contiguous view. All twelve examples use C++20 and fixed values; they avoid
addresses, allocator/layout observations, dangling views, invalid ranges,
timing, and unspecified output.

Breadth batch 13 advances the catalog from 96 to 101 Entries and from 178 to
188 examples. The range algorithms `std::move`, `std::count`, `std::none_of`,
`std::rotate`, and `std::remove` complete the selected algorithm slice. All ten
new examples use deterministic C++20 values and avoid moved-from source output,
unspecified remove tails, predicate side effects, policy scheduling, timing,
and implementation-dependent observations.

Breadth batch 14 advances the catalog from 101 to 105 Entries and from 188 to
196 examples. `std::enable_shared_from_this`, `std::allocator`,
`std::uninitialized_copy`, and `std::destroy` connect shared-control-block
access with raw-storage allocation, object construction, destruction, and
deallocation. All eight examples use C++20 and avoid addresses, allocation
counts, dead-object reads, unspecified cleanup order, and policy scheduling.

Breadth batch 15 advances the catalog from 105 to 110 Entries and from 196 to
206 examples. `<thread>`, `std::thread`, `<mutex>`, `std::mutex`, and
`std::lock_guard` establish thread ownership, join synchronization, mutual
exclusion, and scope-bound lock release. All ten examples use C++20 and avoid
worker output, scheduling order, timing, thread-ID representations, mutex
fairness, detach, and undefined ownership paths. `std::jthread` remains in the
planned catalog until the local libc++ can execute its C++20 contract.

Breadth batch 16 advances the catalog from 110 to 114 Entries and from 206 to
214 examples. `std::unique_lock`, `std::scoped_lock`, `<condition_variable>`,
and `std::condition_variable` establish movable lock ownership, coordinated
multi-lock ownership, predicate-based waiting, and notification. All eight new
examples use C++20 and avoid sleep, wake-order assertions, lost-notification
assumptions, cross-thread mutex ownership transfer, and invalid adopt/release
paths. The complete catalog now contains 212 C++20 examples and the two
existing C++23 `std::expected` examples.

Breadth batch 17 advances the catalog from 114 to 116 Entries and from 214 to
218 examples. `<atomic>` and `std::atomic` establish atomic-object identity,
memory-order selection, release/acquire publication, compare-and-exchange,
blocking wait/notify, and honest lock-free boundaries. All four new examples
use C++20 and avoid polling, sleep, timing, worker output, schedule order, and
implementation-defined lock-free snapshots. The complete catalog now contains
216 C++20 examples and the two existing C++23 `std::expected` examples.

Breadth batch 18 advances the catalog from 116 to 119 Entries and from 218 to
224 examples. `<future>`, `std::future`, and `std::async` establish provider,
shared-state, single-consumer result, launch-policy, deferred-execution, and
exception-propagation contracts. All six new examples use C++20 and avoid
sleep, worker output, default-policy assumptions, wall-clock timing, and
implementation-defined error text. The complete catalog now contains 222
C++20 examples and the two existing C++23 `std::expected` examples.

Breadth batch 19 advances the catalog from 119 to 120 Entries and from 224 to
226 examples. `std::jthread` completes the controlled concurrency slice with
token-first callable selection, one-shot cooperative stopping, RAII stop/join,
move-only ownership, and explicit blocking and detach boundaries. Both new
examples use C++20 and deterministic atomic handshakes without sleep, worker
output, timing, thread IDs, or scheduling-order assumptions. The shared native
toolchain selector now prefers an explicit override or installed Homebrew LLVM
before the system Apple Clang, allowing the real C++20 stop-token contract to
be verified while keeping compiler fingerprints consistent across checks,
reports, Judge composition, and the running server. The complete catalog
contains 224 C++20 examples and two C++23 `std::expected` examples.

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
