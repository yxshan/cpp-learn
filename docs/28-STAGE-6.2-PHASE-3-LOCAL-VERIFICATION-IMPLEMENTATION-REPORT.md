# Stage 6.2 Phase 3 Local Verification Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-013 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-28 |

## 1. Scope delivered

- Added a strict JSON Schema for the rebuildable local Reference verification
  manifest.
- Extended `npm run check:reference` to publish the manifest atomically only
  after the complete active catalog passes compilation and execution checks.
- Loaded current verification evidence in the production Reference
  composition and the standalone coverage reporter.
- Exposed `verified` through Entry examples, aggregate search results, and the
  existing `verified` search filter without changing HTTP schema version 2.
- Preserved safe degradation: absent, malformed, duplicate, partial, or stale
  evidence leaves affected examples `not-checked` and does not disable the
  Reference capability or the learning platform.

## 2. Trust and invalidation model

The manifest is local evidence about one catalog/toolchain combination, not a
claim about every conforming C++ implementation. Activation requires all of
the following to match current state:

- manifest schema version and catalog version;
- exact compiler fingerprint reported by the native toolchain probe;
- known Entry and example identity with no duplicate record;
- the example's declared C++ standard;
- the SHA-256 digest of the original example source.

Any catalog-wide inconsistency rejects the manifest. A structurally valid
partial manifest is allowed so evidence remains honest at example granularity:
unlisted examples stay `not-checked`, and an Entry is aggregate `verified`
only when all of its examples are verified.

## 3. Publication and data ownership

The content gate performs all bounded compiler and runtime checks before
writing. It serializes to a process-specific temporary file in the selected
data root, atomically renames that file to
`reference-verification.json`, and removes a leftover temporary file on either
success or failure. A failed content check never replaces the previous
manifest.

The manifest is generated under `.cpp-learn/data` by default or under
`CPP_LEARN_DATA_ROOT` when that supported override is selected. It is a
rebuildable capability cache: it is excluded from Git and backup/restore,
contains no learner Workspace, Attempt, Evidence, or Learning Record, and
cannot mutate those domains when loaded.

## 4. Acceptance evidence

| Check | Evidence | Result |
|---|---|---|
| Manifest schema | Accepts a bound result and rejects unknown verification states | Passed |
| Module behavior | Matching evidence appears in Entry and Search; stale compiler evidence degrades | Passed |
| Production composition | Real CLI/HTTP search filters and returns a verified `std::cout` result | Passed |
| Reference content | All 25 Entries and 22 examples compile/run before the manifest is replaced | Passed |
| Coverage reporting | The active local catalog reports 22 verified and 0 not-checked examples | Passed |
| Automated tests | 18 test files and 182 unit/integration tests, including bound and invalidation regressions | Passed |
| Repository gates | Documentation, format, lint, typecheck, production build, and 70-Activity content check | Passed |
| Two-axis review | Repository standards and local-verification specification reviews | Passed |

The curriculum check requires local permission to bind `127.0.0.1` for the
existing `loopback-http` Activity. The accepted run used that permission and
did not access an external network.

## 5. Controlled limitations

- Verification is refreshed explicitly by `npm run check:reference`; no
  background compiler process runs while a learner browses Reference content.
- The current release gate fails unsupported examples rather than publishing
  an `unsupported` result. The closed status remains in the contract for future
  multi-toolchain capability probing.
- Verification applies to authored examples, not to arbitrary code or the
  planned Reference Playground. Playground execution remains Phase 4.
- Phase 3 catalog breadth remains incomplete; filesystem, time, concurrency,
  broader algorithms, strings, memory, and utilities are still planned.

## 6. Rollback

Remove the optional verification dependency from production composition and
the reporter, revert manifest publication from the content checker, and remove
the verification JSON Schema together. Existing Reference content remains
readable and automatically returns `not-checked`. No learner-data migration or
rollback is required.
