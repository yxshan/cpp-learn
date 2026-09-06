# Detailed Design

| Field | Value |
|---|---|
| Document ID | DD-001 |
| Version | 1.9 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Package layout

```text
apps/
  web/                      React Web Adapter
  server/                   Fastify HTTP Adapter and composition root
  cli/                      CLI Adapter
modules/
  learning-platform/        teaching rules and orchestration
  curriculum/               content loading and validation
  reference/                C++ Reference lookup, navigation, and search
  reference-authoring/      local Reference draft preparation and checks
  workspace/                learner files and snapshots
  judge/                    jobs, workers, stages, reports
  learning-record/          events and projections
packages/
  contracts/                versioned commands, queries, DTOs, events
  content-schema/           JSON Schemas and validators
  reference-schema/         Reference Entry schemas and validators
  ui/                       visual system and typed lesson blocks
curriculum/                 public versioned content; no private Judge inputs
reference-content/          public versioned Reference Entries and examples
judge-private/              server-only pedagogical-test registry
student-workspaces/         learner-editable files
data/                       events, projections, snapshots, logs
```

Production executable entry points are composition roots: `apps/server` wires
HTTP behavior and `apps/cli` wires local commands. Modules accept dependencies
and do not instantiate production Adapters internally.

### Reference Authoring Module seam

Phase A0 exposes `prepare({ target })` through the `ReferenceAuthoring`
Interface. It validates a stable Entry target, selects a controlled authoring
profile, scaffolds versioned draft/fact/source/report artifacts plus Markdown
and example files, resumes an identical draft, and rejects identity conflicts.
It cannot publish canonical Reference content. Draft repositories atomically
reserve an Entry ID: concurrent prepares either resume the same target or return
a conflict without replacing the first reservation.

The in-memory draft repository Adapter defensively copies on reads and atomic
reservations. The filesystem Adapter implements the same Interface with
temporary-directory reservation, confined file discovery, protected canonical
roots, and revision-plus-file-snapshot compare-and-swap for check commits.
Phase A1 adds `check({ draftId })` behind the same Module seam. Catalog-backed
prepare emits a reviewable proposal and related context; check returns hard
failures separately from a risk-ranked warning queue and rejects source-policy,
active/historical slug, and stale-snapshot conflicts. The CLI supplies
filesystem, catalog, canonical quality, and native compiler Adapters but owns no
validation decisions. The later Web Author Console must reuse this Interface.

## 2. Learning Platform Module

### Interface invariants

- Commands with side effects require a unique `commandId`.
- Replaying a successful `commandId` returns the prior result and produces no duplicate events.
- Queries do not mutate state.
- `events(jobId)` preserves event order for one job but makes no ordering promise across jobs.
- Activity and Concept identifiers are stable strings; version changes do not change identifiers.

### Command handling

```ts
type CommandEnvelope<C extends LearningCommand> = {
  schemaVersion: 1;
  commandId: string;
  issuedAt: string;
  command: C;
};
```

Processing order:

1. Validate contract and caller preconditions.
2. Read required Curriculum, Workspace, and projection state.
3. Calculate a deterministic decision.
4. Invoke external Module behavior if required.
5. Append resulting Learning Events atomically.
6. Return a versioned result.

Judge completion is handled as an internal command with the immutable Judge Report, preventing Web callbacks from writing Evidence directly.

### Session selection

Priority:

1. Incomplete blocking Activity.
2. Overdue Review whose prerequisite state is still valid.
3. Current Project Milestone.
4. Next unlocked required Activity fitting available time.
5. Optional enrichment Activity.

Tie-breaking must be deterministic and recorded in the session decision event.

### Concept transition rules

Concept transitions are derived using an Evidence policy attached to the Activity version. A transition may require several Evidence sources. The rules engine returns both the new state and a human-readable explanation.

## 3. Curriculum Module

### Public model

```ts
interface Activity {
  id: ActivityId;
  version: number;
  kind: "lesson" | "exercise" | "review" | "project-milestone";
  title: string;
  project?: {
    id: ProjectId;
    title: string;
    milestone: number;
    milestoneCount: number;
    portfolioOutcome: string;
  };
  estimatedMinutes: number;
  conceptIds: ConceptId[];
  prerequisiteIds: ActivityId[];
  content: ContentDocument;
  workspace?: WorkspaceContract;
  judge?: PublicJudgeContract;
  evidencePolicy: EvidencePolicy;
}
```

Validation returns all detected errors in one report where possible. Catalog activation is all-or-nothing: invalid required content cannot create a partially active Track.

The filesystem Adapter loads public Activity manifests and the server-only `judge-private/tests.json` registry separately. It rejects a public manifest containing `privateTests`, rejects private entries for unknown Activities, merges them only inside the Curriculum Module, and maps browser/API responses through the public model above.

### Content versioning

- Patch: wording, references, and non-semantic hint corrections.
- Minor activity version: starter or public-test change that may affect Attempts.
- Major schema version: breaking manifest format change with migration.
- Historical Attempts retain the content and judge versions used at the time.
- Adding or changing Project identity, Milestone sequence, Workspace identity, or portfolio outcome is semantic and requires an Activity version increment.

## 4. Workspace Module

### Interface

```ts
interface Workspace {
  open(activityId: ActivityId): Promise<WorkspaceView>;
  save(request: SaveWorkspaceRequest): Promise<SaveWorkspaceResult>;
  snapshot(activityId: ActivityId): Promise<SourceSnapshot>;
  diff(from: SnapshotId, to: SnapshotId): Promise<WorkspaceDiff>;
}
```

`WorkspaceView` exposes both the mutable learner `files` and an immutable copy
of the current Activity's `starterFiles`. The starter copy is a presentation
reset baseline; it is never persisted back into learner files by `open`.

### Invariants

- Starter initialization is idempotent.
- Save paths must be relative, normalized, and listed as editable.
- Symlinks, `..`, absolute paths, and device paths are rejected.
- Saves require `baseRevision`; a mismatch returns `revision_conflict` without overwriting.
- Snapshots include all build inputs allowed by the Workspace contract and are immutable.

### Upgrade behavior

Curriculum upgrades may add new read-only support files but never overwrite an existing editable file. Conflicts produce a migration report requiring explicit resolution.

## 5. Judge Module

### Internal state machine

```text
queued → preparing → compiling → testing → analyzing → completed
   │         │            │          │          │
   └─────────┴────────────┴──────────┴──────────┴→ cancelled / system_error
```

State is monotonic. A completed, cancelled, or failed job is terminal.

### Stage interface

```ts
interface JudgeStage {
  readonly kind: JudgeStageKind;
  execute(context: JudgeStageContext): Promise<JudgeStageResult>;
}
```

Stages return data; they do not append learning events. The pipeline stops after a blocking failure unless the specification marks the following stage safe and informative.

### Process execution

- Use argument arrays, never a shell command string.
- Use a per-job temporary root and minimal environment.
- Capture stdout and stderr separately with byte limits.
- Enforce wall-clock timeout and terminate the process group.
- Apply the same timeout, cancellation, and output limit to compiler/build-tool version inspection.
- Record exit code, signal, duration, and truncation.
- Delete transient artifacts after report persistence, except explicitly retained diagnostics.

### Report determinism

Reports include source digest, activity/judge version, compiler fingerprint, CMake/CTest versions when applicable, build flags, deterministic seeds, stage results, and redacted feedback. Same inputs under the same toolchain should produce semantically equivalent results.

Generated integer-vector properties use an Activity-owned 32-bit seed. A failed case records the seed, zero-based case index, and generated stdin so the Learner can replay it. The public Activity response omits the generator and oracle configuration.

Relative performance checks first verify declared output for baseline and scaled inputs, alternate both against the same executable and temporary environment, then compare median durations. They never use a cross-machine absolute millisecond threshold.

The fixed build profiles are:

- `direct`: C++20 compilation with optional `-pthread` and allowlisted `sqlite3` linkage.
- `cmake`: clean configure, option-safe named application and test targets, optional CTest, then the normal Judge tests; reports include CMake and CTest version fingerprints.

A CMake profile may request a closed set of runtime capabilities: `node` for executable TypeScript contracts, `git` for an isolated diagnostic-history fixture, and `web-frontend` for the platform-owned Vite/React build-and-mount harness. The composition root/Judge resolves each identifier to a trusted absolute executable or harness path and injects it as a CMake definition using an argument array. Activity content cannot supply or override paths, environment-variable names, package-install commands, or arbitrary configure arguments. Before CMake configure, the bounded inspection runner obtains Node/Git versions and a Web harness fingerprint containing its SHA-256 digest plus pinned Vite/React versions. Missing, timed-out, or incompatible capabilities produce a system/toolchain verdict rather than a Learner test failure, and all fingerprints are persisted in the immutable Judge Report. The Web harness builds the learner's clean Workspace into a disposable directory, mounts its component test through Vite SSR, and removes its output afterward.

System labs receive a unique temporary root through `cwd` and `TMPDIR`. Child process groups are killed on timeout/cancellation, and the root is recursively removed after every terminal report.

## 6. Learning Record Module

### Append protocol

- Events are newline-delimited JSON with schema version and checksum.
- Append is serialized through one writer.
- Events contain unique IDs and causal command/job IDs.
- Startup scans to the last valid event; a corrupt partial tail is quarantined before normal operation.
- Projection updates occur after durable append. Failed projection updates are repaired by rebuild.

### Projections

- Dashboard summary.
- Active Activity and Workspace revision.
- Concept state and Evidence history.
- Due Review queue.
- Attempts and Hint history.
- Project and Milestone state.
- Idempotency receipts.

Projection schemas are disposable and carry their own migration version.

## 7. Presentation Adapters

### Web Adapter

The Web Adapter validates transport contracts, translates them to Learning Commands/Queries, and maps results to HTTP. It may manage authentication in a future multi-user product, but no teaching rule belongs in routes or React state.

The Lesson editor formats C/C++ files with a token-aware, deterministic
formatter. Automatic presentation formatting is limited to a Workspace whose
editable files still exactly match its starter baseline, so existing learner
code is not silently rewritten. Explicit Format and Reset actions update only
the browser buffer, clear stale Judge output, update unsaved-change state, and
require Save, Run, or Grade before persistence. Reset requires confirmation.

### CLI Adapter

The CLI formats the same result types for humans or emits unmodified JSON with `--json`. Exit codes reflect transport/command success, not the detailed learning verdict alone.

### SSE Adapter

SSE events contain a monotonically increasing sequence for one job. Reconnection sends `Last-Event-ID`; the server replays retained events or returns a final report if the job is complete.

## 8. Teacher integration

Initial integration uses a generated Teacher Pack and structured observation file. A future MCP Adapter may call the same Learning Platform Interface. Teacher input is considered untrusted qualitative data and requires schema validation and an applicable rubric.

## 9. Error model

```ts
type PlatformErrorCode =
  | "validation_error"
  | "not_found"
  | "precondition_failed"
  | "revision_conflict"
  | "activity_locked"
  | "job_not_running"
  | "toolchain_unavailable"
  | "content_invalid"
  | "record_unavailable"
  | "internal_error";
```

Errors carry `correlationId`, safe details, and a retry classification. Raw process output is not placed in generic error messages.

## 10. Configuration

Configuration precedence:

1. CLI flag.
2. project-local configuration file.
3. environment variable allowlist.
4. safe default.

Paths are resolved once by the composition root and passed as explicit dependencies.

## 11. Reference Module

The Reference Module is a read-only content Module separate from Curriculum and
Learning Platform orchestration. Under the accepted
[ADR-0006](adr/0006-separate-declarative-api-reference.md), it owns Reference Entry activation,
navigation, lookup, deterministic search, source metadata, and relationship
resolution.

### Interface

```ts
interface ReferenceCatalog {
  readiness(): Promise<ReferenceReadiness>;
  getEntry(entryId: string): Promise<ReferenceEntryDetail | undefined>;
  resolveSlug(slug: string): Promise<ReferenceSlugResolution | undefined>;
  search(query: ReferenceSearchQuery): Promise<ReferenceSearchResult>;
  getNavigation(): Promise<ReferenceNavigation>;
}
```

The filesystem Adapter reads a catalog plus JSON manifests, Markdown, and
example files. An in-memory Adapter supplies Module and caller tests. Catalog
activation validates the Entry/category graph, builds navigation and a bounded
in-memory search index, and publishes the new catalog atomically. After
Curriculum and Reference activation, the composition root validates Activity
`referenceIds` and supplies the Reference query view with an immutable reverse
Activity-link index. A failed reload retains the previous valid catalog.

### Invariants

- Entry IDs are stable; IDs and active slugs are unique.
- Content and example paths are relative, normalized, and confined to the
  configured Reference root.
- Entry relationships resolve before Reference activation; Activity
  `referenceIds` resolve in composition before content readiness succeeds.
- Search ranking and tie-breaking are deterministic.
- Markdown is declarative and rendered through the existing safe renderer;
  arbitrary HTML, MDX, and scripts are rejected.
- Runtime Reference queries never write Workspace or Learning Record state.
- Standard status and local toolchain verification are represented separately.
- Standard filters use availability intervals rather than exact introduction
  versions; deprecation remains visible and removal ends the interval.
- Active and historical slugs resolve to a canonical slug before Entry lookup;
  redirect records target stable Entry IDs and cannot form chains.

### Search implementation

Activation normalizes and indexes Entry ID, symbol, header, title, aliases,
categories, headings, and plain-text body tokens. Ranking favors exact symbol,
header, ID, alias, and title matches before prefix, heading, category, and body
matches. Version 1 uses curated aliases rather than fuzzy edit distance.

Search accepts bounded text plus closed kind, category, standard, and local-
verification filters. It returns summaries only; Entry Markdown is returned by
`getEntry`.

### Degraded capability

Reference readiness is reported through bootstrap. Missing or invalid
Reference content disables Reference routes with a safe capability error but
does not block Dashboard, Activity, Workspace, Run, or Grade startup.

### Reference Playground seam

A published `run` Reference Example may create a temporary, non-Activity source
root and use a closed native Judge execution profile. The Playground has no
Activity identity, private tests, Attempt, Evidence policy, Concept transition,
or Review effect. The first tracer bullet accepts edited source only; standard
and stdin come from the published Example, while compiler flags, environment,
working paths, time, output, and global concurrency remain Adapter-owned.

The browser creates a UUIDv4-derived `ref_run_*` identity before it starts the
synchronous execution request. Before its first asynchronous Reference lookup,
the HTTP Adapter derives an immutable content-addressed non-Activity Source
Snapshot from the accepted source and registers the run identity with an
`AbortController`. It rejects an active duplicate with
`409 playground_run_id_conflict`, admits one native Playground execution by
default, and returns `429 playground_busy` with `Retry-After` when occupied. A
separate cancellation request aborts the matching Runner signal while the
original request completes with the terminal `cancelled` result.

The Runner tries a documented draft-standard alias only when the compiler
explicitly rejects the canonical flag, and returns infrastructure and cleanup
failures as structured `system_error` outcomes. Browser state is keyed by Entry
plus Example so same-named examples cannot share source or results across
navigation. Reset restores published source while explicit discard also closes
the editor; dirty discard requires confirmation. Compile errors, runtime errors,
timeout, output-limit, cancellation, reset/discard, and narrow-screen behavior
are covered through the real browser boundary.

The complete model, rollout, and rollback are defined in [C++ API Reference
Module Design](22-API-REFERENCE-MODULE-DESIGN.md).
