# Detailed Design

| Field | Value |
|---|---|
| Document ID | DD-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Package layout

```text
apps/
  web/                      React Web Adapter
  server/                   Fastify HTTP Adapter and composition root
  cli/                      CLI Adapter
modules/
  learning-platform/        teaching rules and orchestration
  curriculum/               content loading and validation
  workspace/                learner files and snapshots
  judge/                    jobs, workers, stages, reports
  learning-record/          events and projections
packages/
  contracts/                versioned commands, queries, DTOs, events
  content-schema/           JSON Schemas and validators
  ui/                       visual system and typed lesson blocks
curriculum/                 public versioned content
judge-private/              private pedagogical tests
student-workspaces/         learner-editable files
data/                       events, projections, snapshots, logs
```

Only `apps/server` is the composition root. Modules accept dependencies and do not instantiate production Adapters internally.

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

### Content versioning

- Patch: wording, references, and non-semantic hint corrections.
- Minor activity version: starter or public-test change that may affect Attempts.
- Major schema version: breaking manifest format change with migration.
- Historical Attempts retain the content and judge versions used at the time.

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
- Record exit code, signal, duration, and truncation.
- Delete transient artifacts after report persistence, except explicitly retained diagnostics.

### Report determinism

Reports include source digest, activity/judge version, toolchain fingerprint, build flags, deterministic seeds, stage results, and redacted feedback. Same inputs under the same toolchain should produce semantically equivalent results.

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

