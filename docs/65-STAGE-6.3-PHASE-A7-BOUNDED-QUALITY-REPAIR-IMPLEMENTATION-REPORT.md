# Stage 6.3 Phase A7 Bounded Quality Repair Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-048 |
| Version | 1.0 |
| Status | Accepted; Phase A7 complete |
| Owner | Project Maintainer |
| Last updated | 2026-09-09 |

## 1. Objective

Convert deterministic authoring findings into narrow, retry-bounded generation
requests without allowing repair automation to change its factual baseline,
weaken compilation, skip human review, or publish unchecked content.

## 2. Delivered interface

`ReferenceAuthoring.buildRepairPlan` accepts a stable draft and repair ID only
after the full `check` gate has produced a current report. It derives supported
section and example targets from that report, chooses only compatible verified
Fact Sheet groups, records unsupported finding digests, and returns an immutable
schema-v1 plan. Its baseline contains the draft revision, author-input digest,
report digest, and authoring profile; its plan digest also fixes every target
and fact allowlist.

`ReferenceAuthoring.advanceRepair` re-derives the authoritative target set,
checks the complete baseline, and returns one ordinary Generation Bundle
Template for the next eligible target. The CLI exposes the same operations as
`reference:author repair-plan` and `reference:author repair`.

## 3. Bounded retry and gate policy

Every issued template is recorded atomically in a plan-specific file under the
draft's `repair/` namespace. Repair evidence is excluded from the author-input
digest and does not increment the content revision, allowing retries to use the
exact same context. The stored counter survives a new process and adapter; the
same target receives at most three templates. Attempt history is module-managed,
and caller-supplied history is rejected. Retry-budget identity is derived from
the checked baseline and targets rather than the caller's display-only
`repairId`, so relabelling a plan cannot reset the counter.

The repair operation never edits content. A completed template must still pass
the existing `applyGenerationBundle` path: context and revision binding, claim
review, compiler/example validation where applicable, atomic mutation, and a
Generation Receipt. A successful mutation changes the draft revision and resets
its report to `not_checked`; preview and publication therefore require a new
full check and outstanding generated-content human review still blocks release.

## 4. Finding coverage and limits

The first repair policy handles canonical content-quality areas, including the
Header-specific quick-information, direct-include, and facility-map checks;
TODO bodies in known profile sections, absent required sections, missing required examples,
missing example source files, and deterministic example-validation failures.
Metadata-level example gaps create example targets rather than unrelated prose
repairs. New example targets use C++20 or the Entry's later `since` standard. It does not invent repairs for
unverified facts, source/citation defects, catalog conflicts, schema corruption,
unavailable validators, or findings that lack a verified fact group. Those
digests stay explicit in the plan result for manual or infrastructure work.

## 5. Verification

| Test | Evidence | Result |
|---|---|---|
| Finding translation | `T-AUTH-014` maps only the affected complexity section and failing example while retaining an unrelated fact finding | Passed |
| Context stability | Repair templates retain the checked revision, profile, and exact verified fact allowlist | Passed |
| Durable bound | Three issued attempts persist across fresh filesystem adapters and alternate repair labels; a fourth call returns `exhausted` | Passed |
| Gate preservation | Applying a repair increments the revision, writes through the standard generation path, and resets the report to `not_checked` | Passed |
| CLI parity | `repair-plan` and `repair` return the Module results unchanged in JSON mode | Passed |

Final repository evidence: 104 Markdown documents, 70 Activity
starters/references/error mutations, 120 Reference Entries with 226 locally
verified examples, quality coverage 116/120 with zero reviewed gaps, 36 test
files with 350 tests, and a passing production Web build.

## 6. Next phase

Phase A8 remains optional. Before building a Web review surface, observe whether
preview, risk confirmation, and publication-diff work is materially slowed by
the CLI. The real five-Entry authoring run needed to close Phase A3 empirical
throughput acceptance remains outstanding and cannot be inferred from these
automated tests.
