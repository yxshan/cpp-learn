# Stage 1 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-002 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- A Web-first learning loop: Dashboard → Markdown Lesson → lazy-loaded local Monaco editor → revision-aware save → Run → Grade → Judge Report → refreshed progress.
- A persistent filesystem Workspace with safe editable paths, monotonic revisions, immutable SHA-256 Source Snapshots, restart recovery, and stale-write rejection.
- A native Judge that compiles immutable snapshots with `clang++ -std=c++20 -Wall -Wextra -Wpedantic`, executes without a shell, and enforces time and output limits.
- Structured compile/test stages and Stage 1 verdicts: compile error, runtime error, public failure, timeout, output limit, automated pass, and judge system error.
- A checksummed append-only JSONL Learning Record whose completed Attempts survive process restart.
- Evidence derivation that leaves Run free of Concept Evidence and marks an automated passing Grade as `practiced`.
- Versioned HTTP Activity, Workspace, Dashboard, Run, Grade, Job Report, and SSE replay Adapters.
- CLI `doctor`, `status`, `check`, and `serve` operations over the same `LearningPlatform` Interface.
- Integrated loopback hosting of built Web assets and API through `cpplearn serve`.

## 2. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Web and CLI use the same Source Snapshot/Judge path | Shared `LearningPlatform.dispatch` contract tests for HTTP and CLI | Passed |
| Run never changes Concept State | `T-LEARN-002` | Passed |
| Passing Grade creates `practiced` Evidence | `T-LEARN-002`; `T-E2E-001` | Passed |
| Grade history survives process restart | `T-RECORD-001` | Passed |
| Stale saves cannot overwrite learner code | `T-WORK-003` | Passed |
| Source Snapshots are immutable and recoverable | `T-WORK-001` | Passed |
| Browser completes the entire first learning loop | `e2e/first-learning-loop.spec.ts` | Passed |
| Browser uses local Monaco assets without runtime errors | `T-E2E-001` page-error assertion | Passed |
| Built Web and API have one local entry point | `T-OPS-001` | Passed |

Reproduce the controlled gates with:

```bash
npm run check
npm run test:e2e
```

## 3. Runtime and data behavior

- Learner files default to `.cpp-learn/workspaces`; events default to `.cpp-learn/data/events.jsonl`.
- Saves use `baseRevision`; a stale revision returns HTTP 409 and preserves the newer contents.
- Run and Grade always create a fresh immutable snapshot before compiling.
- Every completed execution appends a checksummed `attempt.completed` event.
- Job SSE events are retained for replay during the current server process; completed reports are recovered from the event log after restart.
- Monaco and its Worker are served locally. The editor bundle is lazy-loaded only when the learner enters the Lesson Workspace.

## 4. Security boundary

Stage 1 is a trusted, single-user, local development product. The Judge uses argument-array process spawning, rejects unsafe snapshot paths, bounds time/output, and cleans its dedicated temporary directory. It is not an adversarial sandbox. Untrusted-code isolation, private tests, sanitizer profiles, cancellation, and worker crash containment remain Stage 2 requirements.

## 5. Known limitations

- The first Judge profile uses exact public stdout comparison and one executable; public/private test suites arrive in Stage 2.
- JSONL append is synced and checksummed, but interrupted-tail repair, single-writer locking, SQLite projections, export, and restore remain Stage 2.
- SSE provides retained in-process status replay; jobs are currently executed synchronously by the local Platform.
- The Lesson Workspace downloads a sizable lazy Monaco chunk on first entry, while the Dashboard remains in the smaller initial bundle.
- The accepted reference environment is Apple Silicon macOS with Apple Clang; Linux and Windows/WSL verification remain pending.

## 6. Next controlled increment

Stage 2 hardens the Judge and record system: multi-file profiles, private tests, sanitizer diagnostics, cancellation and worker isolation, full verdict fixtures, JSONL recovery, SQLite projections, rebuild, export, and restore.
