# Stage 6.3 Phase A2 Reference Authoring Cache, Preview, and Atomic Publish Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-039 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Objective

Close the expensive authoring inner loop without weakening the canonical
Reference gate. A checked draft must reuse only exact compiler results, render
as the learner will see it, show its complete canonical diff, and either publish
the whole batch or leave the active Reference tree unchanged.

## 2. Delivered Interface

`ReferenceAuthoring` retains `prepare` and `check` and adds:

- `publish({ draftId, expectedRevision, mode: "dry_run" | "apply" })`;
- rejection of stale revisions, non-ready reports, and authored bytes changed
  since the ready report;
- a versioned Publication Plan containing each create/update path, new digest,
  and the previous digest for updates.

The ready Authoring Report records `inputDigest`, `affectedEntryIds`,
`affectedActivityIds`, findings, review queue, and per-example cache evidence.
Generated report, revision, preview, and plan files are excluded from the author
input digest; every candidate manifest, article, fact, source, proposal, and
example byte is included.

## 3. Exact compiler cache

The native example Adapter calculates a SHA-256 cache key from:

- compiler path and bounded `--version` fingerprint;
- the actually selected `-std` value;
- warning-profile and runner versions;
- source digest, example kind, stdin, expected stdout, and expected diagnostic.

The filesystem cache defaults to `.cpp-learn/authoring-cache/`, writes by
temporary-file rename, rejects unsafe keys and protected-root overlap, and
treats missing or corrupt records as misses. Read/write failure never turns a
failed validation into a pass and never prevents an uncached validation from
remaining authoritative.

## 4. Incremental impact closure

The changed-draft closure begins with the target and declared related Entries,
then includes reverse relationships, affected category landing Entries,
historical redirect targets, and Activities referencing any affected Entry.
The fixture oracle independently performs a full graph scan and compares both
Entry and Activity sets with the incremental result.

## 5. Production preview

`reference:author preview` runs `check` first and then renders a standalone
`preview.html` beside the draft. It uses the production `ReferenceArticle`,
`ReactMarkdown`, `remark-gfm`, link generation, and the actual Web stylesheets.
The production component now accepts an optional current URL for server-side
rendering while retaining browser behavior by default. GFM tables therefore use
the same responsive wrapper in preview and the learner Web Adapter.

## 6. Publication and failure behavior

`publish` defaults to dry-run in the CLI. `--apply` is the only canonical write
switch and requires the exact checked revision. The filesystem Adapter:

1. rejects unsafe paths, duplicate targets, and symbolic links;
2. locks publication and computes exact current/new digests;
3. copies the complete active Reference tree to a sibling staging tree;
4. writes candidate files and a single incremented catalog version there;
5. runs the configured Reference readiness gate on staging;
6. compares canonical digests again immediately before installation; and
7. swaps the full directory, rolling back the original if installation fails.

An interrupted staging validation never touches canonical bytes. If both
installation and rollback fail, cleanup deliberately preserves the backup path
named in the error. Publication never creates a Git commit or performs release
acceptance.

## 7. CLI operation

```text
npm run reference:author -- preview --draft ID
npm run reference:author -- publish --draft ID --revision REVISION
npm run reference:author -- publish --draft ID --revision REVISION --apply
```

Human output lists each operation and digest. `--json` returns the unmodified
Module result. `CPP_LEARN_AUTHORING_CACHE_ROOT` complements the existing draft
and catalog environment overrides.

## 8. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Cache key and storage | T-AUTH-004 covers all execution inputs, compiler change, hit isolation, corrupt-file miss, and path confinement | Passed |
| Impact equivalence | T-AUTH-005 compares incremental closure with an independent full graph scan | Passed |
| Preview | T-AUTH-A2-PREVIEW-001/002 cover check-before-render and standalone production GFM/table/link/CSS output | Passed |
| Interrupted publication | T-AUTH-006 injects staging-gate failure and compares canonical bytes | Passed |
| Successful publication | T-AUTH-007 covers exact dry-run plans, checked input/revision binding, catalog versioning, full-tree preservation, and apply | Passed |
| CLI safety | T-AUTH-A2-PUBLISH-001 proves dry-run default and explicit `--apply` | Passed |
| Real CLI smoke | Temporary prepare and preview produced a standalone document outside canonical content; the fixture was removed afterward | Passed |
| Repository gates | `npm run check`: 95 documentation files; 70 Activities, starters, references, and mutations; 120 Reference Entries and 226 examples; 116/120 quality-audited Entries with 0 reviewed gaps; 260 tests; production build | Passed |

## 9. Migration, recovery, and rollback

The feature is additive. Existing A1 drafts remain readable; their next check
adds the input digest and impact fields required by A2 publication. Removing the
preview/cache/publisher Adapters restores A1 behavior without changing canonical
content. Cache deletion is always safe. A publication error naming a backup
directory requires manual inspection before recovery; automation must not delete
that directory.

## 10. Deferred work

Phase A3 owns verified fact reuse, constrained AI context packs, and five-Entry
throughput/escaped-defect measurements. Phase A4 owns the loopback-only Web
Author Console. Git commit, review, and release remain explicit maintainer work.
