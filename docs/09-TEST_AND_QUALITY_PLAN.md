# Test and Quality Plan

| Field | Value |
|---|---|
| Document ID | TQP-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

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
- Workspace: revisions, path confinement, snapshots, upgrades.
- Judge: job lifecycle, stage planning, cancellation, reports, redaction.
- Learning Record: append, recovery, upcasting, rebuild, projections.

Tests must describe observable behavior and survive implementation refactors.

### Contract tests

Run the same behavior suite against:

- Filesystem and in-memory Curriculum Adapters.
- Native and fake Judge Adapters where semantics overlap.
- JSONL/SQLite and in-memory Learning Record Adapters.
- Direct Learning Platform calls, HTTP routes, and CLI JSON.

### Integration tests

- Fastify with real Modules and temporary data roots.
- Judge with real Apple Clang and controlled fixtures.
- CMake/CTest project Activities.
- Event append followed by SQLite projection update and rebuild.
- Teacher Pack generation and redaction.

### End-to-end tests

Playwright validates:

1. Dashboard and time-boxed session selection.
2. Lesson render and Workspace initialization.
3. Monaco edit and conflict-safe save.
4. Run with compiler diagnostics.
5. Grade with public/private/Sanitizer stages.
6. Reflection, Evidence, Concept state, and Review scheduling.
7. Restart and retained history.

## 3. Judge verification

Golden fixtures cover every verdict category. For each judge profile:

- Reference solution must pass.
- Known incorrect solutions must fail the intended stage.
- Private failure output must not disclose exact hidden data.
- Timeout and cancellation must terminate child processes.
- Deterministic property failures must reproduce from seed.
- ASan/UBSan fixtures must classify representative reports.
- Performance fixtures use same-machine ratios and tolerate noise.

Passing stress tests or TSan does not prove absence of data races; reports and lessons must preserve that limitation.

## 4. Content quality tests

Content CI validates:

- JSON Schema and stable identifiers.
- Acyclic required prerequisites.
- Referenced files and source URLs.
- Starter and reference build status.
- Public and private tests against reference and mutation fixtures.
- Hint ordering and answer-leak policy.
- Evidence policy and Review coverage.
- Print/read-only fallback for interactive blocks.
- Terminology consistency with [CONTEXT.md](CONTEXT.md).

## 5. Security tests

Follow [Security and Privacy](08-SECURITY_AND_PRIVACY.md), including command injection, traversal, symlink escape, output flood, fork/child cleanup, loopback binding, redaction, and event integrity tests.

## 6. Non-functional tests

- Dashboard latency against representative history.
- Judge queue admission and first-event latency.
- Long event-log rebuild time and memory use.
- Browser keyboard navigation and semantic labeling.
- macOS reference toolchain matrix.
- Optional Linux/container compatibility matrix.
- Backup/restore and upgrade migration.

## 7. Test data

- Tests use temporary roots and deterministic clocks/IDs.
- Real learner data and private reflections are not test fixtures.
- Golden source fixtures are minimal and purpose-specific.
- Historical event fixtures are immutable once published for migration tests.

## 8. Release quality gates

Required before merge:

- Typecheck, lint, formatting, and Module/contract tests.
- Content lint for changed Activities.
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

