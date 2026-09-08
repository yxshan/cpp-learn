# Stage 6.3 Phase A4 AI Authoring Adapter Tracer Bullet Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-041 |
| Version | 1.2 |
| Status | Tracer bullet implemented; phase in progress |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

## 1. Objective

Provide a machine-oriented authoring entry point for Codex or another AI agent
without embedding a model provider, credentials, or correctness policy in the
CLI. The tracer bullet must carry one generated Reference section from verified
facts into a draft while proving that blocked or conflicting input cannot cause
a partial write.

## 2. Delivered Interface

`ReferenceAuthoring` adds:

```ts
applyGeneratedSection({
  context,
  expectedRevision,
  generation,
}): Promise<ApplyGeneratedSectionResult>;
```

An `AuthoringSectionGeneration` names one draft, exact context digest, one
profile-owned heading, generated Markdown, and explicit claim-to-fact mappings.
The CLI exposes the same operation as:

```text
npm run reference:author -- apply-generation --input FILE --json
```

The input file contains `context`, `expectedRevision`, and `generation`. The
command performs no remote request; an external agent prepares this local JSON
bundle.

## 3. Safety and quality behavior

Before any write, the Module:

1. validates the Authoring Generation schema and identity;
2. validates the complete v2 context pack, verifies its digest, rebuilds it from
   the current draft, and rechecks its author-input digest immediately before
   mutation;
3. returns unmapped or out-of-allowlist claims to the unverified review queue;
4. requires the exact expected draft revision;
5. permits only headings declared by the draft profile;
6. rejects empty Markdown and both ATX and Setext level-one/two headings
   anywhere in the generated fragment; and
7. replaces exactly one existing Markdown section.

Successful application increments the revision, returns the draft to
`not_checked`, clears stale findings/cache evidence, and creates
`generation/revision-N.json`. This receipt retains the accepted generation,
claim review, context digest, revision, and application time. It is audit
evidence, not proof that cited prose is semantically correct.
The receipt is schema-validated before commit and during later checks. The
report also records a separate `generatedSections` provenance row with
`human-review-required`; generated explanations are never relabelled as
standards facts.
Until the later explicit human-review operation is implemented, `check` records
this label as a hard finding and publication remains unavailable by design.

## 4. Atomic filesystem behavior

The draft repository commit operation now accepts a complete expected and next
workspace snapshot. The filesystem Adapter stages every next file, verifies the
stage, performs a locked directory swap, and restores the original if
installation fails. Readers share the draft lock, so they observe the old or
new complete snapshot rather than the gap between directory moves. A stale lock
and hidden backup from a stopped writer are recovered on the next operation.
Competing recovery attempts are serialized by a separate recovery lock, and
post-install cleanup is best-effort so a committed snapshot is never reported
as a failed write merely because an obsolete backup could not be removed.
Content, receipt, draft metadata, and report therefore move as one recoverable
snapshot rather than a series of independent file writes. The in-memory Adapter
uses the same compare-and-swap Interface.

## 5. Verification

| Test | Evidence | Result |
|---|---|---|
| Module success | T-AUTH-A4-GENERATION-001 applies an allowlisted section, increments revision, resets readiness, and persists a receipt | Passed |
| Module rejection | T-AUTH-A4-GENERATION-001 returns unsupported claims to review and preserves the exact previous workspace | Passed |
| Boundary confinement | T-AUTH-A4-GENERATION-001 rejects malformed contexts, whitespace-only content, unauthorized/injected headings, stale revisions, same-revision input changes, and repository write failure | Passed |
| Provenance | T-AUTH-A4-GENERATION-001 retains report provenance; T-AUTH-A1-FS-001 treats a corrupt receipt as a hard finding | Passed |
| Filesystem integration | T-AUTH-A1-FS-001 reads the installed Markdown and receipt, serializes readers during swaps, and recovers an interrupted backup | Passed |
| CLI parity | T-AUTH-A4-GENERATION-002 reads one JSON bundle and forwards the exact Module request/result | Passed |
| Repository gates | `npm run check`: 97 docs, 70 curriculum activities, 120 Reference Entries/226 examples, quality 116/120 with 0 reviewed gaps, 30 test files/290 tests, production build | Passed |

## 6. Remaining Phase A4 work

This tracer bullet deliberately does not claim a complete AI authoring flow.
Controlled summary updates are delivered in [IMP-042](59-STAGE-6.3-PHASE-A4-GENERATED-SUMMARY-IMPLEMENTATION-REPORT.md).
Reference Example proposals are delivered in [IMP-043](60-STAGE-6.3-PHASE-A4-GENERATED-REFERENCE-EXAMPLE-IMPLEMENTATION-REPORT.md).
Remaining work includes bundle-template generation and a provider-neutral run
orchestrator that can advance all required parts while stopping on review findings. Phase A5 then
adds resumable coherent-batch execution. A Web review surface remains optional
and is not part of the current critical path.
