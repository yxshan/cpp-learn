# Stage 6.2 Phase 4 Reference Playground Completion Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-036 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Objective

Close the remaining Reference Playground acceptance debt after the vertical
tracer bullet: cancellable in-flight execution, explicit discard semantics, and
real-browser coverage for every bounded terminal outcome and the narrow layout.

## 2. Delivered behavior

- The browser creates a UUIDv4-derived `ref_run_*` identity before execution and
  sends it with the exact versioned run request.
- Before asynchronous Reference lookup, the HTTP Adapter creates a frozen,
  content-addressed `ref_snapshot_*` source value and registers the active run
  identity with an `AbortController`. This removes the early-cancellation race.
- The Adapter
  rejects a duplicate active identity with `409 playground_run_id_conflict`, and
  forwards the signal through the existing Reference Runner Interface.
- `POST /api/v1/reference/runs/:runId/cancellations` cancels a matching active
  run and safely reports `cancelled: false` for an unknown or terminal run.
- The Playground exposes an in-flight Cancel action and preserves timeout as a
  fallback when cancellation cannot be delivered.
- Reset restores the immutable published example. **放弃修改并关闭** additionally
  closes the editor and confirms before losing dirty browser-local source.
- Real-browser scenarios cover compile failure, runtime failure, timeout, output
  limit, cancellation, reset/discard, state isolation, and a 390-pixel viewport.

## 3. State and isolation model

The run identity and its immutable content-addressed Source Snapshot are
operational and ephemeral. They are not an Activity, Attempt, learner-owned
Source Snapshot, Evidence item, Review, or persisted learning event. The active
registry exists only inside the local HTTP Adapter and is removed in `finally`
after the Runner reaches a terminal result. A server restart therefore does not
resume or convert a Playground run into learner state.

The original execution request remains synchronous. Cancellation is a separate
HTTP request because the client must be able to signal the run while that first
request is still awaiting its final structured result. This closes the required
seam without introducing a queue, polling protocol, or persistent job model.

## 4. Security boundary

Execution remains a trusted-local native capability, not an adversarial
sandbox. Run and cancellation requests use loopback-origin enforcement and
strict body validation. The client controls only the run identity and source;
the selected example, standard, stdin, compiler, arguments, environment,
timeout, output bound, and concurrency remain server-owned. Native process
groups receive the Runner abort signal and the temporary root is cleaned after
every terminal path.

Container/Linux isolation and per-client quotas remain future deployment work
and are not prerequisites for the accepted local single-user product.

## 5. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Snapshot and HTTP cancellation | `apps/server/src/server.test.ts` covers frozen content-addressed source, pre-lookup identity reservation, active-ID conflict, signal delivery, terminal/repeated cancellation, strict cancellation validation, origin rejection, and restart non-resumption | Passed |
| Web transport | `apps/web/src/api.test.ts` covers exact run and cancellation requests | Passed |
| Browser outcomes | `e2e/reference-browser.spec.ts` exercises compile/runtime failure, timeout, output limit, and active cancellation through real Clang | Passed |
| Reset and discard | `e2e/reference-browser.spec.ts` verifies published-source reset, confirmed dirty discard, reopen behavior, and 390-pixel containment | Passed |
| Learning isolation | The HTTP contract proves zero Learning Platform dispatch/query calls—the sole state boundary for Workspace, Attempt, Evidence, Concept, Review, and Project—and browser evidence proves Dashboard state remains byte-for-byte unchanged | Passed |
| Repository gates | 92 Markdown files, 70-Activity content gate, 120-Entry/226-example Reference gate, 116/120 applicable Entry quality audit, formatting, lint, typecheck, 215 Vitest tests, production build, and 18 Playwright tests | Passed |

## 6. Acceptance decision

T-REF-009 and Stage 6.2 Phase 4 are accepted. Optional editor replacement,
public deployment isolation, and multi-client admission policy remain separately
gated work.

## 7. Migration and rollback

The contract change is additive relative to read-only Reference usage and does
not migrate content or learner data. Rolling back removes the cancellation DTO,
active-run registry, endpoint, Web actions, and new tests. Existing Reference
Entries and all Activity state remain valid.
