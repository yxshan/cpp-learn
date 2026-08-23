# Interface Contracts

| Field | Value |
|---|---|
| Document ID | IC-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Contract policy

- All HTTP and event payloads include `schemaVersion`.
- Stable identifiers are opaque strings.
- Timestamps are ISO 8601 with timezone.
- Unknown fields are rejected for commands and accepted only where explicitly documented for forward-compatible query responses.
- Breaking changes require a new major route or payload schema version.
- HTTP, CLI JSON, and future MCP share DTO definitions from `packages/contracts`.

## 2. HTTP endpoints

### Health and bootstrap

```text
GET /api/v1/health
GET /api/v1/bootstrap
GET /api/v1/dashboard
```

`health` reports server liveness only. `bootstrap` includes toolchain and content readiness. `dashboard` returns derived learning state.

### Curriculum and sessions

```text
GET  /api/v1/tracks/:trackId
GET  /api/v1/activities/:activityId
POST /api/v1/sessions
POST /api/v1/activities/:activityId/start
```

Session request:

```json
{
  "schemaVersion": 1,
  "commandId": "cmd_...",
  "availableMinutes": 40
}
```

### Workspace

```text
GET   /api/v1/workspaces/:activityId
PATCH /api/v1/workspaces/:activityId
GET   /api/v1/snapshots/:snapshotId/diff/:otherSnapshotId
```

Save request:

```json
{
  "schemaVersion": 1,
  "commandId": "cmd_...",
  "baseRevision": 7,
  "changes": [
    { "path": "main.cpp", "content": "int main() { return 0; }\n" }
  ]
}
```

Conflict response uses HTTP `409` and returns the latest revision without overwriting.

### Run and Grade

```text
POST /api/v1/activities/:activityId/runs
POST /api/v1/activities/:activityId/grades
POST /api/v1/jobs/:jobId/cancel
GET  /api/v1/jobs/:jobId
GET  /api/v1/jobs/:jobId/events
```

Run request may include stdin and runtime arguments allowed by the Activity contract. Grade request contains no hidden-test selection.

Grade accepted response:

```json
{
  "schemaVersion": 1,
  "jobId": "job_...",
  "snapshotId": "snap_...",
  "status": "queued",
  "eventsUrl": "/api/v1/jobs/job_.../events"
}
```

### Hints, reflections, and progress

```text
POST /api/v1/activities/:activityId/hints
POST /api/v1/activities/:activityId/reflections
GET  /api/v1/reviews/due
GET  /api/v1/progress
GET  /api/v1/concepts/:conceptId
GET  /api/v1/attempts/:attemptId
```

### Teacher collaboration

```text
POST /api/v1/teacher-packs
POST /api/v1/teacher-observations
```

Teacher Pack creation requires an explicit Activity or Attempt scope and applies redaction before returning a path or payload.

## 3. SSE contract

```text
id: 14
event: judge.stage.finished
data: {"schemaVersion":1,"jobId":"job_...","sequence":14,"stage":"compile","outcome":"pass"}
```

Event types:

```text
judge.queued
judge.preparing
judge.stage.started
judge.diagnostic
judge.stage.finished
judge.report.ready
judge.cancelled
judge.system-error
```

Events contain safe structured diagnostics only. Private test inputs and expected outputs are forbidden fields.

## 4. Judge Report contract

```ts
interface JudgeReport {
  schemaVersion: 1;
  reportId: string;
  jobId: string;
  activity: { id: string; version: number; judgeVersion: number };
  source: { snapshotId: string; digest: string };
  toolchain: ToolchainFingerprint;
  verdict:
    | "compile_error"
    | "contract_failure"
    | "public_failure"
    | "hidden_property_failure"
    | "timeout"
    | "output_limit"
    | "memory_safety_failure"
    | "data_race_suspected"
    | "performance_failure"
    | "automated_pass"
    | "pending_teacher_review"
    | "judge_system_error";
  stages: JudgeStageResult[];
  startedAt: string;
  completedAt: string;
}
```

## 5. Error response

```json
{
  "schemaVersion": 1,
  "error": {
    "code": "revision_conflict",
    "message": "Workspace has changed since revision 7.",
    "retryable": true,
    "correlationId": "corr_...",
    "details": { "latestRevision": 8 }
  }
}
```

Suggested HTTP mapping:

- `400`: validation error.
- `404`: unknown resource.
- `409`: revision or lifecycle conflict.
- `422`: valid request whose learning preconditions are not met.
- `503`: toolchain or record storage unavailable.
- `500`: unexpected internal failure.

## 6. CLI contract

```text
cpplearn serve [--host 127.0.0.1] [--port N]
cpplearn next [--minutes N] [--json]
cpplearn check [--activity ID] [--json]
cpplearn status [--due] [--json]
cpplearn doctor [--json]
cpplearn export --output PATH
```

Exit codes:

- `0`: command completed; inspect structured verdict for learning outcome.
- `1`: command rejected by a user-correctable precondition.
- `2`: invalid CLI usage.
- `3`: platform/toolchain unavailable.
- `4`: unexpected internal error.

`--json` writes exactly one versioned result to stdout; logs go to stderr.

## 7. Compatibility tests

- Every HTTP route is tested against the shared contract schema.
- CLI JSON output is compared with direct Learning Platform results.
- SSE replay and final-report fallback are contract-tested.
- Old event fixtures are loaded in migration tests before a release.

