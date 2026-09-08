# Stage 6.3 Phase A4 Generated Summary Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-042 |
| Version | 1.1 |
| Status | Implemented; Phase A4 in progress |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

## 1. Objective

Extend the provider-neutral AI Authoring Adapter from profile-owned Markdown
sections to the candidate Reference Entry summary without creating another CLI
workflow or weakening provenance and publication gates.

## 2. Delivered behavior

`ReferenceAuthoring.applyGeneratedSummary` accepts an exact v2 context pack,
expected draft revision, and schema-v1 `AuthoringSummaryGeneration`. The
generation contains one 4–160 character trimmed single-line summary and at
least one claim-to-fact mapping.

The existing command accepts both generation shapes:

```text
npm run reference:author -- apply-generation --input FILE --json
```

The CLI Adapter dispatches bundles containing `generation.summary` to the
summary operation. It does not contact a model provider.

## 3. Invariants

- only `entry.json.summary`, draft/report metadata, and a Generation Receipt
  change; `content.md` remains byte-for-byte unchanged;
- every declared claim passes the authoritative context rebuild and allowlist
  review used by section generation;
- invalid, multiline, stale, unsupported, conflicting, or failed writes leave
  the previous complete draft snapshot unchanged;
- a dedicated v1 Summary Generation Receipt is written at
  `generation/revision-N.json`, preserving compatibility with the existing v1
  Section Generation Receipt and Authoring Report schemas; and
- every validated receipt independently produces a mandatory human-review
  finding, so deleting optional report metadata cannot make `check` ready or
  allow `publish` to promote unreviewed AI text.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Module success | T-AUTH-A4-SUMMARY-001 updates the summary, preserves Markdown, increments revision, and writes a dedicated receipt | Passed |
| Module rejection | T-AUTH-A4-SUMMARY-001 rejects JSON and Unicode multiline text, out-of-allowlist claims, stale revisions, and write conflicts without mutation | Passed |
| Continued checking | T-AUTH-A4-SUMMARY-001 derives the mandatory human-review finding from the durable receipt even without report presentation metadata | Passed |
| Filesystem Adapter | T-AUTH-A1-FS-001 persists summary, receipt, revision, and gate as one recoverable snapshot | Passed |
| CLI parity | T-AUTH-A4-SUMMARY-002 dispatches the summary bundle through `apply-generation` and labels human output as summary | Passed |
| Repository gates | `npm run check`: 98 docs, 70 activities, 120 Reference Entries / 226 examples, quality 116/120 with 0 gaps, 30 files / 295 tests, and production build | Passed |

## 5. Remaining Phase A4 work

Reference Example proposals are delivered in [IMP-043](60-STAGE-6.3-PHASE-A4-GENERATED-REFERENCE-EXAMPLE-IMPLEMENTATION-REPORT.md).
Structured bundle templates and a resumable provider-neutral authoring run
follow; the optional Web review surface remains outside the critical path.
