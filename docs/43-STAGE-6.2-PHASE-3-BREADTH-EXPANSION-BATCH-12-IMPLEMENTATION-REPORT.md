# Stage 6.2 Phase 3 Breadth Expansion Batch 12 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-027 |
| Version | 1.1 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-01 |

## 1. Objective

Add a coherent sequence-and-view learning slice that contrasts owning
bidirectional and singly-linked node containers with a non-owning contiguous
view, including position models, complexity, allocator preconditions,
invalidation, dangling, and standard-version boundaries.

## 2. Scope delivered

- Advanced the Reference catalog from version 11 to 12 and from 90 to 96
  Entries within the existing `containers` category.
- Added `<list>`, `std::list`, `<forward_list>`, `std::forward_list`, `<span>`,
  and `std::span`.
- Added twelve deterministic C++20 Run examples, increasing the catalog from
  166 to 178 examples: 176 use C++20 and two existing `std::expected` examples
  use C++23.
- Preserved the empty structural-debt baseline: 92 of 96 Entries are audited,
  with three landing Entries and one guide intentionally outside the profile.

## 3. Determinism and safety boundaries

- Node-container examples use fixed values, default equal allocators, valid
  iterators and ranges, sorted inputs where required, and specified sequence
  order.
- Examples demonstrate iterator/reference preservation through legal insertion
  and splice without printing addresses or relying on node layout.
- No example dereferences erased/end/before-begin positions, violates
  allocator equality, benchmarks cache behavior, or depends on allocation
  counts.
- Span owners outlive every view; examples avoid temporaries, reallocation,
  bounds violations, object-representation byte values, and pointer output.
- Every example directly includes the headers that own the facilities it uses
  and compiles under the declared C++20 profile.

## 4. Learning boundaries

| Entry | Primary boundary |
|---|---|
| `<list>` | Double-linked facility map and version split; no random access or universal O(1) promise |
| `std::list` | Stable unerased nodes and bidirectional iteration; splice/merge require compatible allocators |
| `<forward_list>` | Single-linked after-family map; deliberately no size, back, reverse iteration, or random access |
| `std::forward_list` | Modification through predecessors and open after-ranges; whole-list splice is not list's complexity |
| `<span>` | Static/dynamic extent and byte-view map; view/borrowed status does not provide ownership |
| `std::span` | Contiguous non-owning alias with constant-time subviews; owner lifetime and runtime-size preconditions remain external |

## 5. Source and content model

The Batch 12 research note records N2543, N3337, N4861, the span and range
proposal history, current Working Draft anchors, relevant LWG resolutions,
exact example output, and C++20/C++23/C++26 version guards. cppreference
remains a secondary information-architecture and coverage reference; all
prose, tables, JavaScript comparisons, and examples are project-authored.

## 6. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: version 12, 96-entry count, and six stable IDs failed before implementation, then passed |
| Reference activation | Passed: catalog version 12, 96 Entries |
| Reference quality ratchet | Passed: 92/96 audited, 0 reviewed gaps, no regressions |
| Example verification | Passed: 178 total examples; 176 C++20 and 2 C++23 |
| Focused tests | Passed: 43 tests across Reference, quality, verification, and CLI contracts |
| Complete repository check | Passed: docs, curriculum, 96-entry Reference, 178 examples, formatting, lint, types, 196 tests, and production build |
| Standards review | Passed against `5e87403...cbe7853`; no remaining standards or smell finding |
| Spec review | Passed against `5e87403...cbe7853`; scope, facts, counts, determinism, and acceptance behavior match |

The initial reviews found an omitted temporary-range constraint for span, an
over-broad `noexcept` statement, missing operation-specific type requirements
for forward_list, a missing header-level concurrency warning, and imprecise
insert exception wording. Commit `cbe7853` adds the
`borrowed_range || const ElementType` boundary and its dangling warning,
separates Throws contracts from exception specifications, records the relevant
Insertable/EmplaceConstructible/Erasable requirements, restores the structural
mutation synchronization warning, and states the modifier no-effects guarantee
at standard-defined precision. Both review axes then reported zero remaining
findings; `cbe7853` is the reviewed fixed point recorded by the quality
baseline.

## 7. Controlled limitations

- Pages show representative learner-visible declarations, not copied complete
  standard-library synopses.
- Individual list/forward_list members, custom allocators, PMR aliases,
  incomplete-element support, deduction guides, and all ranges-aware C++23
  overloads remain outside this batch.
- Span formatting, multidimensional views, C++26 `at()`, constant-iterator
  additions, and removed initializer-list construction are version notes rather
  than executable C++20 material.
- Tests do not claim linked containers outperform contiguous storage, node
  sizes are fixed, object bytes form a portable serialization, borrowed ranges
  keep owners alive, or invalid preconditions receive runtime diagnostics.

## 8. Rollback

Revert the six Entry directories, catalog version and stable-ID test, quality
baseline and contract expectations, research note, backlog/index/plan updates,
and this report together. Catalog version 11 can then reactivate and rebuild
its 166-example verification cache without learner-data migration.
