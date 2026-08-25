# System Architecture

| Field | Value |
|---|---|
| Document ID | ARCH-001 |
| Version | 1.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Architecture drivers

- Web-first learning experience with a first-class CLI Adapter.
- One source of truth for teaching rules and Concept state.
- Local execution, ownership, and offline operation.
- Unreliable learner programs must not crash the Web process.
- Curriculum and judge capabilities must evolve without overwriting Learner work.
- Objective tools and qualitative teaching must produce distinguishable Evidence.

## 2. Logical architecture

```text
┌──────────────────┐        ┌──────────────────┐
│ React Web Adapter│        │ CLI Adapter      │
└────────┬─────────┘        └────────┬─────────┘
         │ HTTP + SSE                │ direct / HTTP
         └──────────────┬────────────┘
                        ▼
              ┌────────────────────┐
              │ Learning Platform  │
              │ deep Module        │
              └───┬────┬────┬─────┘
                  │    │    │
          ┌───────┘    │    └─────────┐
          ▼            ▼              ▼
┌────────────────┐ ┌──────────────┐ ┌────────────────┐
│ Curriculum     │ │ Workspace    │ │ Learning Record│
│ Module         │ │ Module       │ │ Module         │
└───────┬────────┘ └──────────────┘ └────────────────┘
        │
        ▼
┌────────────────┐        ┌──────────────────────────┐
│ Judge Module   │───────▶│ Native Process Adapter   │
│ queue + reports│ events │ Clang/CMake/CTest        │
└────────────────┘        └──────────────────────────┘
```

## 3. Deployment architecture

The first release is one local installation with three operating-system processes:

1. Vite development server or static production assets.
2. Fastify local server containing the Learning Platform implementation.
3. One or more short-lived Judge Workers for compiler and test execution.

The Fastify server binds to `127.0.0.1`. Judge Workers receive immutable job specifications and Source Snapshots; they do not receive database write access.

## 4. Module responsibilities

### Learning Platform Module

Interface:

```ts
interface LearningPlatform {
  dispatch(command: LearningCommand): Promise<CommandResult>;
  query(query: LearningQuery): Promise<QueryResult>;
  events(jobId: JobId): AsyncIterable<PlatformEvent>;
}
```

It owns session selection, Activity lifecycle, Evidence policy, hint independence, Concept transitions, Review scheduling, idempotency, and cross-Module orchestration.

### Curriculum Module

Owns versioned content, the Concept graph, Activity manifests, content validation, migrations, and public material lookup. A filesystem Adapter serves production; an in-memory Adapter serves tests.

### Reference Module

Owns versioned C++ Reference Entries, complete-catalog validation, navigation,
lookup, deterministic ranked search, relationship resolution, source metadata,
and example definitions. A filesystem Adapter serves production and an
in-memory Adapter serves Module tests. It is read-only at runtime and does not
participate in learning-state transitions.

### Workspace Module

Owns starter initialization, editable path contracts, optimistic revisions, learner files, immutable Source Snapshots, and non-destructive content upgrades.

### Judge Module

Owns job admission, stage planning, events, cancellation, structured reports, and output redaction. Native, fake, and future container Adapters sit at the execution seam.

### Learning Record Module

Owns atomic event append, schema evolution, idempotency, projection rebuilds, and queries. JSONL is the write Adapter; SQLite is a derived read model; in-memory Adapters support tests.

## 5. Data flow: Grade

```text
Learner clicks Grade
  → Web Adapter sends submission.grade
  → Learning Platform requests immutable Source Snapshot
  → Judge accepts job and returns JobId
  → Web subscribes to SSE events
  → Worker executes configured stages
  → Judge emits immutable Judge Report
  → Learning Platform applies Evidence policy
  → Learning Record appends events atomically
  → SQLite projections update
  → Web receives final state and refreshes dashboard
```

## 6. Data ownership

- Curriculum owns content definitions and private references to judge configuration.
- Reference owns Entry content, search index, navigation, factual sources, and
  Reference-to-Activity relationships.
- Workspace owns Learner-editable files and Source Snapshots.
- Judge owns transient execution artifacts and immutable reports.
- Learning Record owns history and derived Concept state.
- Web and CLI own no domain state.

No Module may write another Module's storage directly.

## 7. Primary seams and Adapters

- **Presentation seam**: Web Adapter, CLI Adapter, future MCP Adapter.
- **Curriculum seam**: filesystem Adapter and in-memory Adapter.
- **Reference seam**: filesystem Adapter and in-memory Adapter.
- **Execution seam**: native process Adapter, fake Adapter, future container/Linux Adapter.
- **Record seam**: JSONL/SQLite implementation and in-memory test Adapter.
- **Teacher seam**: teacher-pack file Adapter initially; future MCP or remote AI Adapter.

These seams are justified by actual production/test or native/container variation. Internal helpers that do not vary remain implementation details.

## 8. Technology baseline

- React + TypeScript + Vite SPA.
- Monaco Editor.
- Node.js + TypeScript + Fastify local server.
- npm workspaces monorepo.
- JSON Schema for content and transport validation.
- JSONL event log and SQLite projections.
- Apple Clang and C++20 baseline; CMake/CTest for engineering Activities.
- Vitest for TypeScript Module tests and Playwright for browser flows.

Exact dependency versions are locked in `package-lock.json` during implementation and upgraded through controlled changes.

## 9. Reliability model

- Every command has a correlation ID.
- Every Grade uses an immutable Source Snapshot.
- Judge Workers are disposable.
- Judge Reports are immutable and idempotently ingested.
- The event log is append-only; the SQLite projection can be deleted and rebuilt.
- Partial or corrupt trailing event records are detected during startup recovery.

## 10. Architecture limitations

- Native Judge execution is not a security sandbox.
- Reference availability may degrade independently; a missing or invalid
  Reference catalog must not disable existing learning flows.
- Local private tests are discoverable by a determined machine owner.
- macOS cannot validate every Linux production behavior.
- A single local process is sufficient for one Learner; scalability to multiple users is deliberately not designed.

## 11. Decision references

See [ADR index](README.md#architecture-decisions) for the rationale behind the architecture shape.
