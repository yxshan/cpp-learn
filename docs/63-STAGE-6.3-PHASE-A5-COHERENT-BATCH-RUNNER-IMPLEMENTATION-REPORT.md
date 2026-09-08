# Stage 6.3 Phase A5 Coherent Batch Runner Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-046 |
| Version | 1.0 |
| Status | Accepted; Phase A5 complete |
| Owner | Project Maintainer |
| Last updated | 2026-09-08 |

## 1. Objective

Compose the accepted single-draft run into a provider-neutral, resumable batch
that advances related Reference Entries in dependency order without hiding a
blocked Entry or manufacturing productivity evidence.

## 2. Delivered Interface

The schema-v1 Authoring Batch Plan contains one to five members. Each member has
a stable ID, an explicit dependency list, and one complete Authoring Run Plan.
Member, draft, and run IDs are unique; dependencies must exist, cannot name the
member itself, and must form an acyclic graph.

`ReferenceAuthoring.advanceBatch` topologically evaluates eligible child runs
through the existing `advanceRun` Interface. Its digest-bound Authoring Batch
Progress preserves plan order while reporting every member as `complete`,
`awaiting_generation`, `awaiting_dependency`, or `blocked`. Ready members carry
fresh Generation Bundle Templates, and waiting members name their incomplete
dependencies. The `reference:author batch --input FILE --json` CLI command is a
thin Adapter for the same operation.

## 3. Resume, isolation, and evidence

Batch progress is derived on each call. Child Generation Receipts remain the
only durable progress cursor, so process interruption requires no scheduler
recovery and repeated completed calls are idempotent. A blocked member makes the
batch status `blocked` but does not suppress ready templates on independent
branches. Invalid graph structure fails before any child run advances.

The runner inherits exact fact reuse, constrained contexts, compiler caching,
revision checks, and receipt gates from each child run and generation apply. It
does not call a model provider, modify canonical Reference content, publish a
draft, or populate the manually observed timing and correction fields required
by the Phase A3 Authoring Batch Report.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Dependency and resume | `T-AUTH-A5-BATCH-001` advances out-of-order declarations through a two-Entry dependency, applies each public template, reaches idempotent completion, and exposes independent work beside a missing draft | Passed |
| Five-Entry acceptance | One call exposes five independent Entry templates without claiming empirical throughput | Passed |
| Plan safety | Duplicate drafts/run IDs, missing dependencies, and cycles fail before execution | Passed |
| CLI parity | `T-AUTH-A5-BATCH-002` parses a JSON plan and returns the Module result unchanged | Passed |

Final repository evidence: 102 Markdown documents, 70 Activity
starters/references/error mutations, 120 Reference Entries with 226 locally
verified examples, quality coverage 116/120 with zero reviewed gaps, 33 test
files with 323 tests, and the production Web build pass.

## 5. Next phase

Phase A6 should prepare source-record and fact-group proposals only from
explicitly supplied source material, retain source classification, deduplicate
records, and require human verification for normative facts. The real observed
five-Entry batch required for Phase A3 empirical acceptance remains separate.
