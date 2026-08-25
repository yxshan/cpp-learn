# Stage 6.2 Phase 3 Batch 1 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-012 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Scope delivered

- Added a validated Reference coverage report available through
  `npm run report:reference`.
- Added coverage dimensions for category, Entry kind, introduction standard,
  source kind, example kind, declared example standard, and local verification
  state.
- Expanded the catalog from 15 to 25 Entries and from 12 to 22 deterministic
  examples.
- Added the I/O category with `<iostream>`, `std::cout`, and `std::cin`.
- Added `<array>`, `std::array`, `<deque>`, `std::deque`, `<unordered_map>`,
  `std::unordered_map`, and `std::vector::reserve`.
- Added the `object` Entry kind because `std::cin` and `std::cout` are standard
  objects rather than types or functions.

## 2. Evidence and editorial controls

The batch is based on the controlled [Phase 3 Batch 1 primary-source research
baseline](reference/API_REFERENCE_PHASE3_BATCH1_RESEARCH.md). Content uses the
current C++ Working Draft for current behavior and WG21 historical drafts for
first-standard claims. Each Entry manifest carries the sources needed to
verify its own metadata and behavioral statements.

Examples are original C++20 programs. Input examples declare exact stdin;
unordered-container examples never depend on iteration order; capacity
examples assert only portable lower bounds. Every example is compiled with
strict warnings, and every Run example is compared with exact stdout.

## 3. Contract versioning

Adding `object` changes a closed public Entry-kind vocabulary. Reference Entry
manifests and public Reference DTOs therefore use Reference schema version 2.
Catalog manifests remain schema version 1 because their structure did not
change; catalog content version 3 identifies this activated content graph.

The Web transport Adapter checks Reference schema version 2 independently from
the platform's other schema-version-1 payloads. Contracts, JSON Schema,
Reference Module results, HTTP tests, Web labels, and filesystem manifests are
updated together.

## 4. Acceptance evidence

| Check | Evidence | Result |
|---|---|---|
| Reference schema | Rejects superseded Entry schema v1 and accepts `object` under v2 | Passed |
| Coverage reporting | Real catalog reports 25 Entries, 22 examples, and complete primary-source coverage | Passed |
| Reference content | `npm run check:reference` compiles/runs all 22 examples | Passed |
| Curriculum regression | `npm run check:content` validates 70 Activities, starters, references, and mutations | Passed |
| Automated tests | 177 unit and integration tests | Passed |
| Repository gates | Documentation, format, lint, typecheck, and production build | Passed |

The curriculum check requires loopback socket permission for the existing
`loopback-http` Activity. A restricted sandbox rejects that bind operation;
the accepted run used a local environment that permits `127.0.0.1` dynamic
ports and did not access an external network.

## 5. Coverage after this batch

- 25 total Entries; all 25 carry at least one primary source.
- 22 Entries have examples; the three landing Entries intentionally do not.
- 12 container Entries, 4 algorithm Entries, 3 I/O Entries, 2 string Entries,
  2 memory Entries, 1 utility Entry, and 1 standard-library landing Entry.
- 6 headers, 8 types, 2 objects, 3 functions, 2 members, 3 landings, and 1
  guide.

## 6. Controlled limitations and next batch

- Phase 3 remains in progress. The target is 80–120 Entries, so this batch is
  not a declaration that the API Reference is complete.
- Filesystem, time, concurrency, broader algorithms, strings, memory, and
  utility coverage remain pending.
- The standalone coverage command reports `not-checked` when its catalog
  instance has not received persisted local toolchain results. The release
  gate still verifies all authored examples; wiring persisted verification
  state into production remains a later Phase 3 work package.
- Reference Playground execution remains Phase 4 and continues to be isolated
  from learner Evidence.

## 7. Rollback

Revert catalog version 3, the ten Entry directories, Reference schema version
2, the `object` vocabulary, and the coverage reporter together. The change does
not migrate or mutate learner Workspaces, Attempts, Evidence, or Learning
Records.
