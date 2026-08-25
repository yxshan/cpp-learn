# Data Design

| Field | Value |
|---|---|
| Document ID | DATA-001 |
| Version | 1.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Storage strategy

```text
data/events.jsonl          append-only source of truth
data/projections.sqlite    rebuildable query model
data/snapshots/            immutable source snapshots
student-workspaces/        mutable learner files
data/exports/              explicit learner exports
reference-content/         versioned Reference manifests, Markdown, examples
```

Curriculum, Reference, and private judge data are versioned repository content,
not learner data.

## 2. Event envelope

```json
{
  "schemaVersion": 1,
  "eventId": "evt_...",
  "eventType": "grade.completed",
  "occurredAt": "2027-07-18T10:32:14+08:00",
  "commandId": "cmd_...",
  "correlationId": "corr_...",
  "payload": {},
  "checksum": "sha256:..."
}
```

Event IDs are unique. Payload schemas are versioned by event type. Existing event meaning is never changed in place.

## 3. Event catalog

### Session and Activity

```text
session.started
activity.started
activity.resumed
activity.completed
activity.migrated
```

### Workspace and Attempt

```text
workspace.initialized
workspace.saved
snapshot.created
attempt.started
run.completed
grade.requested
grade.completed
hint.revealed
reflection.submitted
```

### Learning

```text
teacher.observation.accepted
teacher.observation.rejected
evidence.recorded
concept.state.changed
review.scheduled
review.completed
project.milestone.completed
```

### Operations

```text
content.catalog.activated
projection.rebuilt
export.created
recovery.performed
```

## 4. Core payloads

### Grade completed

```json
{
  "attemptId": "attempt_...",
  "activity": { "id": "cpp.references.01", "version": 2 },
  "snapshot": { "id": "snap_...", "digest": "sha256:..." },
  "reportId": "report_...",
  "verdict": "automated_pass",
  "hintsUsed": 1,
  "fullSolutionExposed": false
}
```

### Evidence recorded

```json
{
  "evidenceId": "evidence_...",
  "conceptId": "cpp.references.use",
  "source": "hidden-test",
  "outcome": "pass",
  "independence": "assisted",
  "difficulty": "core",
  "attemptId": "attempt_...",
  "contentVersion": 2
}
```

## 5. SQLite projections

Suggested tables:

```text
projection_meta
active_activity
attempts
attempt_hints
judge_reports
concept_state
concept_evidence
review_queue
project_milestones
command_receipts
workspace_revisions
```

Projection rows contain `last_event_id`. Rebuild processes events in order inside transactions and updates the checkpoint only after successful application.

## 6. Concept state projection

```text
unseen → introduced → practiced → demonstrated → retained
```

The projection stores current state, next Review date, last independent Evidence, recurring misconception tags, and supporting Evidence IDs. It does not store an opaque AI-generated mastery score.

## 7. Snapshot design

- Snapshot ID is derived from normalized manifest and file contents.
- Paths are sorted and encoded with explicit lengths before hashing.
- File metadata unrelated to compilation is excluded.
- Snapshots are immutable after creation.
- Large generated build artifacts are excluded.
- Retention keeps every Grade snapshot; Run snapshots may be compacted after a configurable period if not referenced by Evidence.

## 8. Atomicity and recovery

- Event append uses one writer and flushes before acknowledging success.
- A checksum detects partial or modified lines.
- On startup, invalid trailing bytes are moved to a quarantine file with a recovery event.
- Projection failure never removes source events.
- Projection rebuild creates a new database and swaps it into place only after validation.

## 9. Migration

- Event migrations are upcasters from old payload versions to the current in-memory model.
- Projection migrations may rebuild from scratch rather than mutate complex historical tables.
- Curriculum changes retain Activity IDs and increment versions.
- An Evidence policy change does not silently rewrite historical Evidence; it may trigger revalidation status.

## 10. Backup, export, and privacy

Backup includes events, Workspaces, retained Source Snapshots, human Learning Records, and configuration. SQLite may be included for faster restore but remains rebuildable.

Default export excludes private judge data, build caches, process logs containing source, and toolchain binaries. A machine-readable export includes schema metadata and checksums.

## 11. Data integrity tests

- Duplicate event and command handling.
- Partial last line recovery.
- Random interruption during projection rebuild.
- Old event upcasting.
- Snapshot hash stability.
- Backup/restore equivalence.
- Projection equality before and after rebuild.

## 12. Reference content data

Reference content is immutable release input at runtime:

```text
reference-content/catalog.json
reference-content/<category>/<entry>/entry.json
reference-content/<category>/<entry>/content.md
reference-content/<category>/<entry>/examples/*.cpp
```

Catalog activation derives an in-memory navigation tree and search index. Those
derived structures are disposable and are not added to SQLite or the event log.
They can be rebuilt from manifests and Markdown after every startup or content
upgrade.

Reference data invariants:

- Entry ID and active slug are unique.
- Manifest, content, and example paths remain inside `reference-content/`.
- Related Entry and Activity IDs resolve before activation.
- Entry and schema versions are positive and explicit.
- Published and draft standard states are distinct values.
- Sources include kind, title, URL, and optional standard section.
- Reused material additionally records license, attribution, and modification
  notes.
- Example digest, declared standard, execution kind, and verification result
  are reproducible release evidence rather than learner history.

Reference content and derived indexes are excluded from learner backup and
restore. An export may include stable Entry IDs referenced by a future learning
artifact, but it does not copy the Reference catalog itself.
