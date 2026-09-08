# Stage 6.3 Phase A4 Provider-neutral Authoring Run Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-045 |
| Version | 1.0 |
| Status | Accepted; Phase A4 complete |
| Owner | Project Maintainer |
| Last updated | 2026-09-08 |

## 1. Objective

Complete Phase A4 with a resumable single-draft generation sequence that an AI
agent can drive through local JSON files without embedding a model SDK,
credentials, or provider-specific state in the platform.

## 2. Delivered contracts

The schema-v1 Authoring Run Plan names one draft and an ordered set of unique
summary, section, or Reference Example targets. Each step declares its verified
fact-group allowlist; example steps may also declare the execution kind and C++
standard, defaulting to `run` and C++20.

`ReferenceAuthoring.advanceRun` validates the plan, derives a deterministic
SHA-256 plan digest, reads the draft's validated Generation Receipts, and
returns either completed progress or the next fresh Generation Bundle Template.
The `reference:author run --input FILE --json` CLI command is a thin Adapter for
that operation.

## 3. Resume and safety model

The plan file is the external resume token. There is no separate mutable cursor:
progress is reconstructed from durable receipt metadata containing the run ID,
plan digest, and step ID. A receipt completes a step only when all three values,
the generation target, its fact allowlist, and any example execution contract
match. Legacy or unrelated receipts do not advance a run.

Repeated use of an unchanged plan is idempotent and returns the same next
template until it is applied. The first applied receipt establishes run
identity; an unstarted plan may still be edited without leaving hidden state.
After that point, reusing its run ID with a changed plan, encountering a corrupt
or identity-inconsistent receipt, or finding unknown step metadata fails
closed. Every next template rebuilds its constrained context and expected
revision, so normal provenance, compiler, stale-context, compare-and-swap, and
human-review gates remain authoritative. A run never calls a model provider and
does not publish content.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Run Module | `T-AUTH-A4-RUN-001` covers plan validation, deterministic digest, idempotent resume, receipt-bound completion, refreshed revisions, changed-plan blocking, duplicate targets, and exact example kind/standard matching | Passed |
| CLI Adapter | `T-AUTH-A4-RUN-002` proves JSON plan parsing and unmodified Interface dispatch/result output | Passed |
| Existing generation gates | Summary, section, example, template, receipt, filesystem, type, lint, docs, Reference, and build suites | Passed |

Final repository evidence: 101 Markdown documents, 70 Activity
starters/references/error mutations, 120 Reference Entries with 226 locally
verified examples, quality coverage 116/120 with zero reviewed gaps, 33 test
files with 317 tests, and the production Web build pass.

## 5. Next phase

Phase A5 can compose the accepted single-draft run contract into a
dependency-aware multi-Entry batch runner. It must report blocked Entries,
resume each Entry from receipts, and retain a real five-Entry observation for
the still-pending empirical Phase A3 acceptance instead of manufacturing timing
evidence.
