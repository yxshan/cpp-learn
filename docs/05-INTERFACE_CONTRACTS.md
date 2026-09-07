# Interface Contracts

| Field | Value |
|---|---|
| Document ID | IC-001 |
| Version | 2.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

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

`health` reports server liveness only. `bootstrap` includes Curriculum,
toolchain, record, and Reference readiness. Reference readiness is capability
status: `ready: false` does not change the overall platform `ready` result or
disable learning flows. A successful Reference readiness result includes
`catalogVersion`, `entryCount`, and `activationDurationMs`. `dashboard` returns
derived learning state.

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

### C++ API Reference

```text
GET /api/v1/reference
GET /api/v1/reference/search?q=vector&standard=c%2B%2B20
GET /api/v1/reference/resolve?slug=standard-library%2Fcontainers%2Fvector
GET /api/v1/reference/entries/:entryId
POST /api/v1/reference/entries/:entryId/examples/:exampleId/runs
```

Reference navigation, search, resolution, and detail payloads use
`schemaVersion: 2`. The platform route remains under `/api/v1`; payload schema
versions are independently checked by the Web Adapter. Reference schema v2
adds the closed `object` Entry kind required for standard objects such as
`std::cin` and `std::cout`. Entry manifests use the same Reference schema
version; catalog manifests retain their independent schema v1.

`GET /api/v1/reference` returns ordered category navigation and the supported
C++ standards. Search accepts bounded `q`, `kind`, `category`, `standard`,
`verified`, and `limit` parameters. A standard filter means “available when
compiling in that standard”; it is not an exact introduction-version filter.
Results use deterministic ranking and stable Entry-ID tie-breaking.
Repeated values for scalar query parameters are invalid and return `400`
rather than being coerced.
Each result includes aggregate local verification status. Entry examples expose
their individual `verified`, `unsupported`, or `not-checked` state; absence of a
verification Adapter is represented as `not-checked`, never inferred from the
normative C++ standard status.

The production filesystem Adapter may load a rebuildable local verification
manifest produced by `npm run check:reference`. A record is accepted only when
the manifest schema, catalog version, compiler fingerprint, Entry/example
identity, declared standard, and source SHA-256 digest match the active
catalog. Missing, malformed, duplicate, partial, or stale data does not make
Reference unavailable: affected examples remain `not-checked`. Verification
data is local capability evidence, not learner state, and is never returned
with filesystem paths or compiler command details.

The resolve endpoint accepts a current or historical slug and returns the
stable Entry ID, canonical slug, and `redirected` flag. The detail endpoint
accepts only a stable Entry ID. Public Entry responses contain rendered
Markdown, original example source and digest, sources, and related IDs; they
never contain manifest, Markdown, example, or repository filesystem paths.

Invalid filters return `400 validation_error`; unknown IDs and slugs return
`404 reference_not_found`. A missing, invalid, or cross-catalog-inconsistent
Reference returns `503 reference_unavailable` with only closed readiness issue
codes. Reference queries are read-only and do not create a Workspace, Attempt,
Judge job, or Evidence.

The Playground POST accepts the shared
`ReferencePlaygroundRunRequestDto` from `packages/contracts`:

```json
{
  "schemaVersion": 1,
  "runId": "ref_run_550e8400-e29b-41d4-a716-446655440000",
  "source": "#include <iostream>\nint main() {}\n"
}
```

The body rejects unknown fields and empty source; UTF-8 source is limited to
64 KiB. Entry and Example must resolve to a published `run` example. Its
declared standard and stdin are server-owned; paths, compiler/runtime
executables, arguments, flags, and environment are never accepted from the
client. A `200` response is a shared `ReferencePlaygroundRunResult` containing
the run/Entry/Example IDs, explicit verdict, stdout, stderr, compile/run stages,
diagnostics, and selected toolchain profile. Actual output is not compared with
the published expected output and does not create a Grade.

The client creates `runId` before starting the request. It must be a lowercase
or uppercase UUIDv4 prefixed with `ref_run_`; an active duplicate is rejected so
the identifier always selects at most one execution. After syntactic and size
validation, the Adapter reserves the identity before asynchronous Reference
lookup and derives an immutable `ref_snapshot_*` identity plus SHA-256 digest
from `source`. Only that internal non-Activity snapshot crosses the Runner
Interface; it is not persisted as a learner Source Snapshot.

Validation, origin, lookup, source-size, identity, admission, and capability failures use
`400 validation_error`, `403 origin_rejected`,
`404 reference_example_not_found`, `413 source_too_large`,
`409 playground_run_id_conflict`,
`429 playground_busy` (with `Retry-After`), and
`503 playground_unavailable` or `reference_unavailable`. The local Adapter
admits one native Playground execution by default. The native Adapter gives each
compile and run process a five-second wall-clock limit and a 64 KiB combined
stdout/stderr limit.

Cancellation is a separate state-changing request so it can be sent while the
original synchronous run request remains in flight:

```text
POST /api/v1/reference/runs/:runId/cancellations
```

```json
{ "schemaVersion": 1 }
```

A `200` response returns `schemaVersion`, `runId`, and `cancelled`. `cancelled`
is `true` only when an active matching run was signalled; unknown and already
terminal identities return `false` without revealing other state. The request
uses the same loopback-origin enforcement and exact-body validation as execution.

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

Workspace query response:

```json
{
  "schemaVersion": 1,
  "workspace": {
    "activityId": "modern-vocabulary",
    "revision": 3,
    "files": { "main.cpp": "int main() { return 0; }\n" },
    "starterFiles": { "main.cpp": "int main(){std::cout<<\"TODO\\n\";}\n" }
  }
}
```

`starterFiles` is a read-only reset baseline from the current Activity
definition. It does not imply that learner `files` match the baseline, and it
is never accepted in the save request. Web Format and Reset operations change
the local editor buffer first; existing PATCH revision rules remain the only
persistence path.

### Run and Grade

```text
POST /api/v1/activities/:activityId/runs
POST /api/v1/activities/:activityId/grades
POST /api/v1/jobs/:jobId/cancellations
GET  /api/v1/jobs/:jobId
GET  /api/v1/jobs/:jobId/events
```

Run request may include stdin and runtime arguments allowed by the Activity contract. Grade request contains no hidden-test selection.

Current local Grade response:

```json
{
  "schemaVersion": 1,
  "jobId": "job_...",
  "snapshotId": "snap_...",
  "status": "completed",
  "report": { "verdict": "automated_pass", "stages": [] }
}
```

The current local adapter completes the request before returning the final report. The deterministic Job ID is `job_${commandId}`, so the Web adapter can issue a cancellation while the execution request remains in flight.

### Local data operations

```text
POST /api/v1/exports
POST /api/v1/restores
```

Both routes reject non-loopback Origins. Restore requires `confirm: true`, validates every path and checksum before mutation, activates staged data roots, retains the prior roots for recovery, and reports that the local service must be restarted.
Archive request bodies have an explicit 64 MiB local safety limit; larger restores use the CLI adapter.

### Hints, reflections, and progress

```text
POST /api/v1/activities/:activityId/hints
POST /api/v1/activities/:activityId/reflections
GET  /api/v1/reviews/due
GET  /api/v1/progress
GET  /api/v1/concepts/:conceptId
GET  /api/v1/attempts/:attemptId
```

Hints are revealed in manifest order. A request carries one stable `attemptId`; a solution-kind hint additionally requires `confirmFullSolution: true`. The event is durably appended before hint content is returned. Revealing a full solution atomically schedules a compensating independent Review variant. Reflection answers use the same Attempt ID and are validated against the Activity's versioned prompts. Attempt IDs are Activity-scoped and cannot be reused across Activities.

Any command that derives multiple Learning Record events—such as Grade, full-solution disclosure, or an accepted Teacher Observation—appends those events as one checksummed JSONL batch and one SQLite transaction. Replaying the same persisted command after process restart returns its prior result without appending a partial or duplicate derivation.

`GET /api/v1/progress` returns Concept state, its human-readable explanation, supporting Evidence IDs, and the next Review time. `GET /api/v1/reviews/due?all=true` includes scheduled future Reviews; without `all=true` it returns only due work.

### Teacher collaboration

```text
POST /api/v1/teacher-packs
POST /api/v1/teacher-observations
```

Teacher Pack creation requires an explicit Activity or Attempt scope and applies redaction before returning a path or payload.
The returned pack contains approved Activity text, reflection prompts and rubric, learner Workspace diff, public structured diagnostics, recent Attempt summaries, and current Concept explanations. Hint bodies, solution disclosures, private stages, private inputs, expected values, and reference solutions are excluded.

A Teacher Observation references an existing Attempt and the Activity's declared rubric. Invalid observations are recorded as rejected. Valid observations remain qualitative input: only the Learning Platform rules may combine one with automated Evidence, independence, and reflection to change Concept state.

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
  buildFlags: string[];
  verdict:
    | "compile_error"
    | "runtime_error"
    | "public_failure"
    | "timeout"
    | "output_limit"
    | "private_failure"
    | "property_failure"
    | "performance_failure"
    | "sanitizer_failure"
    | "cancelled"
    | "automated_pass"
    | "judge_system_error";
  stages: JudgeStageResult[];
  startedAt: string;
  completedAt: string;
}
```

Stage kinds additionally include `property_test`, `performance`, `configure`, `build`, and `ctest`. Generated-property stages may expose `seed`, `caseIndex`, and a reproducible generated counterexample. Performance profiles declare expected results for both scaled inputs; stages expose only their median durations and ratio. CMake reports identify `cmake/ctest` as the build system and record the inspected CMake and CTest version lines. Private fixed/performance inputs and expected outputs remain forbidden.

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
- `503`: toolchain, record storage, or optional Reference capability unavailable.
- `500`: unexpected internal failure.

## 6. CLI contract

```text
cpplearn serve [--host 127.0.0.1] [--port N]
cpplearn next [--minutes N] [--json]
cpplearn check [--activity ID] [--json]
cpplearn status [--due] [--json]
cpplearn doctor [--json]
cpplearn export --output PATH [--json]
cpplearn restore --input PATH [--json]
```

Exit codes:

- `0`: command completed; inspect structured verdict for learning outcome.
- `1`: command rejected by a user-correctable precondition.
- `2`: invalid CLI usage.
- `3`: platform/toolchain unavailable.
- `4`: unexpected internal error.

`--json` writes exactly one versioned result to stdout; logs go to stderr.

## 7. Local Reference authoring contract

The non-HTTP `ReferenceAuthoring` Interface owns eight operations:

```ts
prepare({ target }): Promise<PrepareDraftResult>;
buildContext({ draftId, factGroupIds }): Promise<BuildAuthoringContextResult>;
reviewGeneratedClaims({ context, claims }): Promise<ReviewGeneratedClaimsResult>;
applyGeneratedSection({ context, expectedRevision, generation }): Promise<ApplyGeneratedSectionResult>;
applyGeneratedSummary({ context, expectedRevision, generation }): Promise<ApplyGeneratedSummaryResult>;
check({ draftId }): Promise<CheckDraftResult>;
publish({ draftId, expectedRevision, mode }): Promise<PublishDraftResult>;
measureBatch({ batchId, draftIds, timing, quality }): Promise<MeasureAuthoringBatchResult>;
```

`prepare` optionally accepts an explicit source draft and fact-group allowlist.
Reuse succeeds only from a related, unchanged `checked` draft at a ready
revision. The target stores a reference and evidence digest rather than copied
fact prose or Source Ledger records. `buildContext` resolves those references,
accepts only explicit verified group IDs, and returns a deterministic
`AuthoringContextPack`. `reviewGeneratedClaims` accepts an unchanged context
pack plus claim-to-fact mappings; claims without a mapping or with IDs outside
the allowlist are returned in an `unverified` review queue. An AI Adapter must
use this operation and may not treat the pack or generated prose as a primary
source. A cited allowed ID is provenance evidence, not semantic truth; human
review remains required.

`applyGeneratedSection` accepts one schema-validated Authoring Generation bound
to an exact context digest and expected draft revision. It invokes generated-
claim review, permits only a heading owned by the draft profile, rejects
level-one/two heading injection, replaces exactly one Markdown section, resets
the draft to unchecked state, and commits the complete draft snapshot with a
Generation Receipt. A blocked review or write conflict leaves the draft
unchanged.
Repository failures return `write_failed`; compare-and-swap races return
`write_conflict`. Neither result mutates the accepted draft snapshot.
The current phase treats every valid Generation Receipt as an unresolved human
review obligation; `check` keeps that draft blocked, so `publish` cannot promote
AI prose before the later explicit review operation exists. Report display
metadata is not the authority for this gate and cannot be removed to bypass it.

`applyGeneratedSummary` applies the same context, provenance, revision, receipt,
and human-review rules to the plain-text `entry.json.summary` field. Summary
text must be a trimmed single line of 4–160 characters. It never changes
`content.md`; invalid or unsupported input leaves the complete draft unchanged.

`mode` is `dry_run` or `apply`. Publication succeeds only when the stored draft
revision equals `expectedRevision`, its ready report names the same revision,
and its checked author-input digest still matches. A successful result carries a
versioned Publication Plan with exact create/update/delete paths, new digests
for writes, and previous digests for updates/deletes. Adapter errors are
returned as `publication_failed`; no operation creates a Git commit.

The CLI maps `prepare`, `apply-generation`, `check`, `preview`, and `publish` to
this Interface.
Preview is a presentation operation over a fresh check result. CLI publication
is dry-run unless `--apply` is present. The CLI also maps `context` and
`measure`. `apply-generation --input FILE` is the machine-oriented AI Adapter:
the JSON file contains the exact context, expected revision, and either a
generated section or generated summary. The Adapter dispatches by the typed
generation member rather than exposing a second command. Batch reports bind every member
revision/input digest and evaluate the 60–90 minute five-Entry target, per-Entry
throughput improvement, separately observed factual/example defect regression,
high-risk review coverage, and flaky reruns. They do not replace release
acceptance.

## 8. Compatibility tests

- Every HTTP route is tested against the shared contract schema.
- CLI JSON output is compared with direct Learning Platform results.
- SSE replay and final-report fallback are contract-tested.
- Old event fixtures are loaded in migration tests before a release.
- Reference Module and Fastify responses are compared through T-REF-005; route
  responses are built from `packages/contracts` DTOs.
