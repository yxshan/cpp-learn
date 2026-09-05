# Stage 6.2 Phase 4 Reference Playground Tracer Bullet Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-035 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

## 1. Objective

Deliver the first end-to-end Reference Playground slice so a Learner can edit
and run a published `run` example from its Reference Entry without creating an
Activity Workspace, Attempt, Evidence, Concept transition, Review, or Project
mutation.

This report does not accept all of Phase 4. Cancellation over HTTP, explicit
discard semantics, and the complete failure-path browser matrix remain follow-up
work.

## 2. Scope delivered

- Added a versioned `ReferencePlaygroundRunResult` contract with explicit
  compile and run stages, diagnostics, bounded-output verdicts, and the selected
  compiler profile.
- Added a native Reference Playground Adapter that writes exactly one
  `main.cpp` into a fresh temporary root, compiles it with a fixed
  declared-standard warning profile, runs the resulting executable, and removes
  the root in a `finally` boundary.
- Added
  `POST /api/v1/reference/entries/:entryId/examples/:exampleId/runs`.
- Restricted the HTTP Adapter to an existing published example whose kind is
  `run`; the client can provide source text but cannot provide paths,
  executables, flags, environment variables, or command arguments.
- Added a 64 KiB UTF-8 source limit, strict request shape, loopback-origin
  enforcement, and deterministic 400/403/404/413/503 responses.
- Added an inline Reference Playground with editable source, Run, Reset,
  structured outcome, stdout/stderr, compiler identity, and an explicit native
  execution warning.
- Kept the Playground outside the Learning Platform command path and all
  learner-owned Activity Workspaces.

## 3. Public behavior

A supported Run example exposes an **在 Playground 中运行** control. Expanding
it creates browser-local editing state initialized from the immutable Reference
Example. Reset restores that original source. Run sends only the edited source
to the example-specific endpoint.

A successful execution displays the program's actual stdout and keeps stderr or
compiler warnings in a separately labelled stream. It is operational feedback,
not comparison against `expectedStdout`, so changing the example's output does
not turn the result into a Grade failure. Compile errors, runtime errors,
timeout, output-limit, cancellation, and system errors remain separate verdicts.

Examples declared as expected compile failures or marked unsupported do not
expose the Run control in this slice.

## 4. Isolation and security boundary

The implementation reuses the bounded native-process seam and fixed argument
arrays. It does not use a shell and does not accept build arguments from the
browser. Each run receives a fresh temporary working directory, bounded time,
bounded aggregate output, a closed environment, and unconditional cleanup.

The application remains a trusted local single-user product. Native execution
is not an adversarial sandbox: C++ code can invoke operating-system APIs outside
the temporary working directory. Unknown or untrusted code must not be run until
a container/Linux execution Adapter provides an enforceable filesystem,
process, network, memory, and CPU boundary.

## 5. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Runner contract | `modules/judge/src/judge.test.ts` verifies fixed flags, temporary paths, output-not-Grade behavior, and compile timeout/output classifications | Passed |
| HTTP contract | `apps/server/src/server.test.ts` verifies published-example lookup, strict body validation, byte limit, origin rejection, and zero Learning Platform dispatch/query calls | Passed |
| Web API contract | `apps/web/src/api.test.ts` verifies the versioned example-specific POST request | Passed |
| Browser tracer bullet | `e2e/reference-browser.spec.ts` edits and runs `std::vector` source through real Clang, observes separately labelled stdout and stderr, and proves Dashboard state is byte-for-byte unchanged | Passed; full suite 15/15 |
| Static gates | Docs, formatting, ESLint, TypeScript, 206 Vitest tests, production build, 70-activity curriculum validation, and 120-Entry/226-example Reference validation | Passed |

The Playwright integration harness uses one worker because both browser files
share a single fixture store and bounded native compiler service. This keeps the
gate deterministic without changing product-side admission behavior.

## 6. Remaining Phase 4 work

- Give running requests a durable client-visible ID before completion and add a
  cancellation endpoint wired to the Runner's `AbortSignal`.
- Add browser coverage for compiler diagnostics, runtime failure, timeout,
  output limit, reset, close/discard, and 390-pixel layout.
- Define concurrency admission and per-client in-flight limits.
- Decide whether a later editor enhancement should lazy-load Monaco or retain
  the lightweight textarea.
- Add container/Linux execution before any public or multi-user deployment.

## 7. Migration and rollback

The change is additive. It does not migrate Reference content, Workspaces,
learning events, SQLite projections, or catalog versions. Rolling back removes
the Playground DTO, Runner, endpoint, Web controls, styles, and T-REF-009 tests;
the read-only Reference catalog and all learner state remain valid.
