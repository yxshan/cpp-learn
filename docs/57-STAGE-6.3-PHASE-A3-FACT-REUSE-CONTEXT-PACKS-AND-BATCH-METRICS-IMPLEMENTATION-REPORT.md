# Stage 6.3 Phase A3 Fact Reuse, Context Packs, and Batch Metrics Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-040 |
| Version | 1.0 |
| Status | Implemented; empirical acceptance pending |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

## 1. Objective

Reduce repeated work across a coherent Reference batch without allowing AI
output or copied prose to become evidence. The Module must reuse only explicit,
revision-bound verified facts, expose only an allowlisted evidence context, and
measure throughput and escaped corrections without manufacturing acceptance
evidence.

## 2. Delivered Module Interface

`prepare` now accepts an optional `reuse` request naming one related source
draft and explicit fact-group IDs. `ReferenceAuthoring` also provides:

```ts
buildContext({ draftId, factGroupIds });
measureBatch({ batchId, draftIds, ...observations });
```

Existing `check` and `publish` remain the authority for readiness and canonical
promotion. No operation calls a remote AI, scrapes a documentation site,
creates a Git commit, or converts generated prose into verified facts.

## 3. Verified fact reuse

Every `reusedFrom` reference records the source draft ID, exact checked
revision, source fact-group ID, and evidence digest. Preparation copies the
selected fact payload and its exact Source Ledger records only when:

- the source is a related draft;
- the source draft is unchanged, `checked`, and has a ready report;
- the source fact is verified and compatible with the target profile; and
- every referenced source record exists.

Both `buildContext` and `check` revalidate this relationship. A changed source
revision, fact, or source record therefore blocks use rather than silently
inheriting stale claims.

## 4. Constrained AI context packs

The versioned `AuthoringContextPack` contains only explicitly requested
verified fact groups, their evidence digests, and their referenced sources. Its
own digest binds the draft revision, current author-input digest, facts, sources,
and policy. The policy requires generated substantive claims to cite allowed
fact-group IDs and prohibits introducing external signature, version,
complexity, error, or lifetime assertions. Normative groups additionally require
primary C++ Working Draft evidence before they can enter the pack.

This is a mechanical allowlist, not semantic truth detection. An AI Adapter can
be prevented from receiving unverified draft facts, but arbitrary generated
prose must still be reviewed and mapped into `facts.json` before `check` can
authorize publication.

## 5. Batch measurement

`AuthoringBatchReport` aggregates one to five current Draft reports:

- ready Entries and Reference Example count;
- compiler-cache hits, misses, unchecked records, and hit rate;
- hard, warning, and high-risk finding counts;
- author-active, machine, and full-gate minutes;
- flaky reruns and post-publication corrections versus a supplied baseline.

The report is deterministic and digest-bound. `meets-target` requires exactly
five ready Entries, 60–90 active author minutes, and no escaped-correction-rate
regression against the supplied baseline Entry count. Timing and correction
counters are author observations; they are not inferred or silently improved by
the Module.

## 6. CLI workflow

```text
npm run reference:author -- prepare ... --reuse-from RELATED_ID --reuse-facts selection,complexity
npm run reference:author -- context --draft ID --facts selection,complexity --json
npm run reference:author -- measure --batch ID --drafts A,B,C,D,E --active-minutes 75 --machine-minutes 12 --gate-minutes 4 --corrections 0 --baseline-corrections 0 --baseline-entries 5 --flaky-reruns 0 --json
```

The JSON context result is suitable for a future AI Adapter. The JSON batch
result should be retained with the human batch review.

## 7. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Fact reuse | T-AUTH-A3-CONTEXT-001 covers explicit preparation reuse, ready-revision binding, related-draft enforcement, and digest invalidation | Passed |
| Context constraint | T-AUTH-A3-CONTEXT-001 rejects unverified requested facts and emits only selected fact/source evidence | Passed |
| CLI context | T-AUTH-A3-CONTEXT-002 verifies exact Module request and JSON parity | Passed |
| Batch calculation | T-AUTH-010 verifies five-Entry timing/cache/finding aggregation and correction regression visibility | Passed |
| CLI measurement | T-AUTH-A3-BATCH-001 verifies observation parsing and JSON parity | Passed |
| Repository gates | `npm run check`: 96 documentation files; 70 Activities and supporting fixtures; 120 Reference Entries and 226 examples; 116/120 quality-audited Entries with 0 reviewed gaps; 29 test files and 274 tests; production build | Passed |

## 8. Remaining acceptance work

The implementation is complete, but the Phase A3 exit is not yet accepted. Run
one real coherent five-Entry authoring batch, retain its report, compare escaped
corrections with the manual baseline, and only then update the phase status.
Phase A4 Web Author Console work may begin as an implementation task, but it
must not be used to claim the missing A3 throughput result.
