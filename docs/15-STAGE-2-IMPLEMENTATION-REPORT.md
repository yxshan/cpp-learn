# Stage 2 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-003 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- Multi-file Workspace editing and compilation from immutable Source Snapshots.
- Versioned Judge Profiles with public and private test cases, stdin, safe failure categories, ASan, UBSan, wall-clock limits, output-byte limits, and build reproduction flags.
- Structured compiler and Sanitizer diagnostics plus ten terminal verdicts.
- End-to-end cancellation from Web or HTTP command through `AbortSignal` to the dedicated learner process group.
- Process-runner crash containment: a failed job returns `judge_system_error`; the Judge remains usable for later jobs and does not create Concept Evidence.
- Checksummed JSONL startup scanning, corrupt-tail quarantine, `recovery.performed`, event-ID deduplication, and serialized appends.
- Disposable SQLite Attempts and Concept State projections with validation and rebuild from source events.
- Checksummed local backup/export and staged restore for events, projections, Workspaces, and retained Source Snapshots. Prior roots remain recoverable after restore.
- Web and CLI export/restore adapters, Web multi-file tabs, readable multi-stage reports, and an explicit cancellation control.

## 2. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Every required Judge verdict has a controlled fixture | `T-JUDGE-005` compiles and executes committed C++ golden programs with real Apple Clang for pass, compile, runtime, public, private, timeout, output-limit, ASan, and UBSan outcomes; cancellation and infrastructure failure use their dedicated process/control fixtures | Passed |
| Worker crash is isolated and creates no false Evidence | `T-JUDGE-003` proves subsequent Judge usability; `T-LEARN-002` restricts Concept promotion to passing Grade | Passed |
| Duplicate report/event ingestion is idempotent | `T-RECORD-001` appends one event ID twice and observes one JSONL event and one projection row | Passed |
| Rebuilt projections match pre-rebuild state | `T-RECORD-001` compares Attempts and Concept State before, during, and after rebuild | Passed |
| Interrupted appends recover safely | `T-RECORD-001` injects an invalid partial tail, verifies quarantine, and reads the recovery event | Passed |
| Private Judge material does not cross presentation or export boundaries | `T-JUDGE-003` verifies report redaction; `T-DATA-002` verifies scoped export; Judge Profiles are not exposed by Activity HTTP payloads | Passed |
| Backup and restore preserve data | `T-DATA-001` and `T-DATA-002` cover CLI/core and HTTP/Web-facing paths with checksum validation and explicit confirmation | Passed |

Teacher Packs are not yet an available adapter; consequently no private Judge fields can enter one in Stage 2. Their positive construction and redaction suite remains part of the Stage 3 collaboration increment.

Reproduce the controlled gates with:

```bash
npm run check
npm run test:e2e
```

## 3. Runtime and data behavior

- Grade runs public tests, then redacted private tests, then configured Sanitizers; Run remains a fast public-feedback path.
- A private-test stage exposes only its name, outcome, duration, and authored failure category. It never serializes stdin, expected stdout, actual stdout, or stderr.
- Cancellation is idempotent. Cancelling an active deterministic Job ID aborts its current child process group; cancelling an absent or finished job returns `cancelled: false`.
- `events.jsonl` remains the source of truth. `projections.sqlite` is read by Dashboard/Job queries and is recreated from valid events at startup or through the maintenance Interface.
- Export is an explicit local action. It includes a checksummed configuration object (currently empty because Stage 2 has no persisted user settings) and excludes Curriculum private Judge definitions, caches, compiler binaries, and process logs.
- Restore validates the complete archive before replacing either root and retains the prior roots under `.pre-restore-*` names.

## 4. Security boundary

The Native Judge remains a trusted local execution adapter, not an adversarial sandbox. It uses no shell interpolation, a minimal environment, path validation, per-job temporary roots, process groups, wall/output bounds, private-output redaction, and loopback-Origin checks. Unknown or hostile code should use a future container or VM Judge adapter.

## 5. Known limitations

- Node.js 22 labels `node:sqlite` experimental; the project pins Node 22 or newer and isolates SQLite behind the Learning Record Interface.
- HTTP execution currently returns the final report rather than an immediate queued receipt; deterministic Job IDs still permit concurrent cancellation.
- Web restore requires a local service restart so open projection handles cannot serve stale pre-restore state.
- Previous roots retained by restore are intentionally not deleted automatically; the Learner may remove them after verifying the restored system.
- Strong multi-process file locking and container isolation remain future hardening work.
- The large Monaco worker/editor chunks remain lazy-loaded and produce a non-blocking build-size warning.

## 6. Next controlled increment

Stage 3 adds ordered hints, assistance tracking, reflections, explainable Concept Evidence transitions, Review scheduling, Teacher Observations, Teacher Packs, Knowledge Map, and Review Queue.
