# Test and Quality Plan

| Field | Value |
|---|---|
| Document ID | TQP-001 |
| Version | 2.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

## 1. Quality objectives

- Teaching decisions are deterministic, explainable, and traceable to Evidence.
- Web and CLI behavior remains equivalent.
- Unreliable learner programs cannot corrupt platform history or terminate the server.
- Content errors are detected before activation.
- Releases can rebuild learning state from events and reproduce Grade results within documented toolchain limits.

## 2. Test levels

### Module tests

Test each deep Module through its Interface:

- Learning Platform: command/query behavior, idempotency, transitions, scheduling.
- Curriculum: schema, graph, version, content lint, migration.
- Reference: schema, activation, navigation, deterministic search, sources,
  relationships, and degraded readiness.
- Workspace: revisions, path confinement, snapshots, upgrades.
- Judge: job lifecycle, stage planning, cancellation, reports, redaction.
- Learning Record: append, recovery, upcasting, rebuild, projections.

Tests must describe observable behavior and survive implementation refactors.

### Contract tests

Run the same behavior suite against:

- Filesystem and in-memory Curriculum Adapters.
- Filesystem and in-memory Reference Adapters.
- Native and fake Judge Adapters where semantics overlap.
- JSONL/SQLite and in-memory Learning Record Adapters.
- Direct Learning Platform calls, HTTP routes, and CLI JSON.

### Integration tests

- Fastify with real Modules and temporary data roots.
- Judge with real Apple Clang and controlled fixtures.
- CMake/CTest project Activities.
- Event append followed by SQLite projection update and rebuild.
- Teacher Pack generation and redaction.
- Reference HTTP lookup/search against the activated filesystem catalog.

### End-to-end tests

Playwright validates:

1. Dashboard and time-boxed session selection.
2. Lesson render and Workspace initialization.
3. Monaco edit and conflict-safe save.
4. Run with compiler diagnostics.
5. Grade with public/private/Sanitizer stages.
6. Reflection, Evidence, Concept state, and Review scheduling.
7. Restart and retained history.
8. Reference navigation, search, direct Entry URLs, keyboard operation, and
   narrow-screen rendering without learning-state mutation.

End-to-end services use dedicated loopback ports and temporary data and
Workspace roots. The test runner recreates those roots before the API opens its
SQLite store and never reuses a manually running learner service. A test must
not read, reset, save, run, Grade, or project events in the default learner
roots.

## 3. Judge verification

Golden fixtures cover every verdict category. For each judge profile:

- Reference solution must pass.
- Known incorrect solutions must fail the intended stage.
- Private failure output must not disclose exact hidden data.
- Timeout and cancellation must terminate child processes.
- Deterministic property failures must reproduce from seed.
- Generated-property reports must retain seed, case index, and replayable stdin without exposing fixed private tests.
- ASan/UBSan fixtures must classify representative reports.
- Performance fixtures alternate baseline/scaled runs, compare medians on the same machine, and avoid absolute-time claims.
- CMake fixtures configure a clean directory, build named application/test targets, execute CTest, and then run integration tests.
- System fixtures use per-Grade files, child processes, joined threads, dynamic loopback ports, and isolated SQLite databases; the Judge root must be absent afterward.

Passing stress tests or TSan does not prove absence of data races; reports and lessons must preserve that limitation.

## 4. Content quality tests

Content CI validates:

- JSON Schema and stable identifiers.
- Acyclic required prerequisites.
- Referenced files and source URLs.
- Starter and reference build status.
- Public and private tests against reference and mutation fixtures.
- Hint ordering and answer-leak policy, including private fixed/performance inputs and expected outputs.
- Evidence policy and Review coverage.
- Print/read-only fallback for interactive blocks.
- Terminology consistency with [CONTEXT.md](CONTEXT.md).

Reference content CI additionally validates:

- Entry and catalog JSON Schema, stable IDs, versions, unique slugs, safe paths,
  and closed standard/kind values.
- Navigation and related-Entry integrity inside Reference, plus
  Activity-to-Reference integrity at the composition root.
- Required sections, original-content policy, source URLs, verification date,
  and reused-material attribution.
- Deterministic search fixtures for exact symbol, header, alias, Chinese term,
  prefix, standard availability intervals, filters, and tie-breaking behavior.
- Every ordinary example compiles with its declared standard and warnings; Run
  examples also satisfy bounded deterministic output.
- Kind-aware structural quality profiles detect missing selection, interface,
  call contract, complexity, error, lifetime, example, mistake, JavaScript,
  relationship, source, and header-navigation coverage as applicable.
- The reviewed-debt baseline is an exact ratchet: new findings, stale resolved
  findings, and catalog-version drift all fail CI.
- Reference browsing and Playground execution cannot produce Activity Evidence.
- Playground contracts cover stable client-visible run identity, immutable
  content-addressed non-Activity snapshots, duplicate identity rejection,
  cancellation before/during execution, bounded outcomes, temporary-root
  cleanup, restart non-resumption, and zero Learning Platform calls.
- Real-browser coverage includes compile failure, runtime failure, timeout,
  output limit, cancellation, reset/discard, Entry-isolated source, unchanged
  Dashboard state, and the 390-pixel layout.
- Authoring Phase A0 uses golden member/type/header profiles through the Module
  Interface, complete generated-file snapshots, and strict artifact-schema
  fixtures. It proves idempotent resume, atomic concurrent reservation,
  fail-closed identity conflict, unsafe-path rejection, defensive in-memory
  storage, and absence of canonical publication behavior.
- Authoring Phase A1 checks the same Module Interface through in-memory and
  filesystem Adapters. Coverage includes blocked/ready reports, exact revisions,
  full-snapshot concurrency rejection, corrupt artifacts, catalog proposals,
  active and historical slug relationships, risk-ranked warning queues,
  normative/secondary source policy, canonical structural quality, bounded real
  C++ compilation, CLI result/exit semantics, protected-root/symlink rejection,
  and confirmation that canonical Reference files remain read-only.
- Authoring Phase A2 verifies exact compiler-cache invalidation, corrupt-cache
  fallback, actual incremental/full graph-gate agreement, production GFM
  preview with draft-path confinement, create/update/delete file and catalog
  diffs, checked-input/target/revision binding, historical redirects, successful
  whole-tree publication, interrupted-swap recovery, and byte-for-byte canonical
  preservation when staging validation is interrupted.
- Authoring Phase A3 verifies revision/digest-bound fact reuse between related
  drafts without copying fact prose, rejection of unverified context requests,
  draft/artifact identity, and deterministic context-pack source allowlists.
  Generated claims without allowed fact IDs return to an `unverified` queue.
  Batch tests bind each member revision/input digest and aggregate timing, cache,
  categorized hard findings, high-risk reviews, pre/post-publication factual and
  example corrections, baseline throughput, and flaky reruns. CLI tests reject
  fractional counters and empty baselines as usage errors. Fixture results
  validate instrumentation only; acceptance requires a separately observed real
  batch.
- Authoring Phase A4 verifies provider-neutral generated-content ingestion at
  the `ReferenceAuthoring` Interface and CLI Adapter. Tests cover authoritative
  context rebuild, claim allowlists, profile heading confinement, revision
  conflict, unchanged state on rejection, Generation Receipts, and complete
  snapshot installation through both in-memory and filesystem Adapters. The
  filesystem suite also covers active-reader serialization and recovery after a
  writer stops between snapshot moves, including competing recovery readers;
  receipt corruption and pending generated-content review are hard findings.
  `T-AUTH-A4-SUMMARY-001/002` verifies summary-only mutation, all JSON/Unicode
  single-line boundaries, claim rejection, stale revision and write conflict,
  dedicated receipt validation, receipt-derived human-review blocking,
  filesystem persistence, and correctly labelled CLI dispatch through the same
  machine command.
  `T-AUTH-A4-EXAMPLE-001/002` verifies derived safe paths, source/manifest
  atomicity, claim rejection, schema bounds, validator absence/failure,
  compiler rejection, stale revision, compare-and-swap conflict, same-ID
  replacement, receipt-derived human review, real native compilation with the
  filesystem Adapter, and CLI parity.

## 5. Security tests

Follow [Security and Privacy](08-SECURITY_AND_PRIVACY.md), including command
injection, traversal, symlink escape, output flood, fork/child cleanup, loopback
binding, state-changing request origin validation, cancellation ID/body
validation, redaction, and event integrity tests.

## 6. Non-functional tests

- Dashboard latency against representative history.
- Judge queue admission and first-event latency.
- Long event-log rebuild time and memory use.
- Browser keyboard navigation and semantic labeling.
- Reference warm-search p95 and Entry lookup latency at a 1,000-Entry fixture.
- Offline Reference production serving with outbound network requests blocked.
- macOS reference toolchain matrix.
- Optional Linux/container compatibility matrix.
- Backup/restore and upgrade migration.

## 7. Test data

- Tests use temporary roots and deterministic clocks/IDs.
- Browser tests pass explicit `CPP_LEARN_DATA_ROOT` and
  `CPP_LEARN_WORKSPACE_ROOT` values to their dedicated API composition root.
- Real learner data and private reflections are not test fixtures.
- Golden source fixtures are minimal and purpose-specific.
- Historical event fixtures are immutable once published for migration tests.

## 8. Release quality gates

Required before merge:

- Typecheck, lint, formatting, and Module/contract tests.
- Content lint for changed Activities.
- Reference lint, kind-aware content-quality ratchet, and example compilation
  for changed Entries.
- No unexplained snapshot changes.

Required before release:

- All integration and end-to-end critical paths pass.
- Judge golden fixtures pass on the reference toolchain.
- Projection rebuild equals the pre-release projection.
- Dependency/security scan reviewed.
- Documentation links and requirement traceability validated.
- Backup and restore smoke test passes.

## 9. Defect severity

- **S1 Critical**: data loss/corruption, host compromise, private judge leak, wrong Evidence recorded as retained.
- **S2 High**: server crash, irrecoverable job, incorrect verdict, Web/CLI semantic mismatch.
- **S3 Medium**: blocked lesson, incorrect hint, broken migration with workaround, significant accessibility issue.
- **S4 Low**: cosmetic issue, non-blocking wording or advisory diagnostic problem.

S1 blocks all releases; S2 blocks the affected milestone release.

## 10. Evidence and reporting

CI preserves test reports, coverage summaries, judge fixture reports, content-lint reports, and migration/rebuild checks. Coverage percentage is advisory; requirement and risk coverage are the release criteria.
