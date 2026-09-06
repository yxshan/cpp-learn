# Stage 6.3 Phase A1 Reference Authoring CLI Prepare/Check Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-038 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Objective

Turn the accepted Phase A0 contracts into the first usable local authoring
workflow. An author must be able to create or resume a confined filesystem
draft, edit ordinary files, and receive deterministic human-readable or JSON
findings without constructing canonical Reference directories or changing the
active catalog.

## 2. Delivered Interface

`ReferenceAuthoring` now exposes two operations:

- `prepare({ target })` creates or resumes the controlled draft workspace.
- `check({ draftId })` validates the current disk snapshot, updates its report
  and revision, and returns `blocked` or `ready`.

The Interface still exposes no `publish`. A `ready` report means that the draft
passed the supported Phase A1 checks; it does not write canonical content or
commit to Git.

## 3. Filesystem and context Adapters

The filesystem draft Adapter stores workspaces below
`.cpp-learn/authoring/<draft-id>/`. It rejects unsafe IDs, paths, symbolic links,
and unsupported file types. Preparation writes a complete temporary directory
and atomically renames it into place. Concurrent reservations preserve the
first writer. Check results use an exclusive draft lock, compare the expected
revision, write `report.json` first, and make the new `draft.json` revision the
final visible state change.

The catalog-context Adapter validates the active catalog and Entry manifests,
then supplies Entry IDs, category IDs, and slug ownership to the Module. It is
read-only and cannot mutate `reference/catalog.json`.

## 4. Check coverage

The Phase A1 check reports deterministic hard findings for:

- malformed authoring artifacts and cross-artifact draft-ID mismatch;
- missing, unverified, duplicate, or unmapped fact/source records;
- future verification dates or source evidence older than the Entry's claimed
  verification date;
- invalid canonical Entry Schema, changed target identity, or unsafe target
  paths;
- missing categories and related Entries, and conflicting active slugs;
- remaining placeholders or missing profile sections;
- structural gaps from the same kind-aware quality audit used by the release
  gate; and
- missing example files, profile example-count gaps, compilation diagnostics,
  runtime bounds, exit status, and expected output.

The compiler acceptance rule previously reached only through the full-check
script now lives in the Reference Module and is reused by both the existing
release command and the authoring example Adapter. The old command behavior and
test surface remain intact.

## 5. CLI operation

Create a draft with an explicit identity:

```text
npm run reference:author -- prepare \
  --id std-vector-insert \
  --kind member \
  --slug standard-library/containers/vector/insert \
  --title std::vector::insert
```

Edit the generated files under `.cpp-learn/authoring/std-vector-insert/`, then
run:

```text
npm run reference:author -- check --draft std-vector-insert
npm run reference:author -- check --draft std-vector-insert --json
```

Exit code `0` means prepare succeeded or check is ready, `1` means a domain
conflict or blocked check, and `2` means invalid CLI usage. JSON check output is
the report only; it does not repeat Markdown and source files.

`CPP_LEARN_AUTHORING_ROOT` may select another local draft root and
`CPP_LEARN_REFERENCE_CATALOG` may select another catalog for controlled tests.
Both default to project-local paths.

## 6. Safety and failure behavior

- Neither operation writes below `reference/`.
- Invalid or partially edited JSON returns structured read/schema findings.
- A check cannot commit over a changed draft revision.
- Compiler execution is shell-free, bounded by time and output, and isolated in
  a temporary directory that is removed after each result.
- Interrupted draft-report persistence cannot expose a new checked revision
  before its report exists.

## 7. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Module check | T-AUTH-A1-CHECK-001 covers blocked and ready reports, source/fact/profile/link validation, persistence, not-found, and revision conflict | Passed |
| Filesystem Adapter | T-AUTH-A1-FS-001 covers disk resume, atomic concurrent reservation, check persistence, corrupt JSON, and Interface parity | Passed |
| Catalog context | T-AUTH-A1-CATALOG-001 loads validated IDs, categories, and slugs | Passed |
| Native examples | T-AUTH-A1-NATIVE-001 covers real C++20 compilation plus bounded fake compiler/runtime outcomes | Passed |
| CLI Adapter | T-AUTH-A1-CLI-001 covers prepare identity, JSON reports, exit codes, and usage failure | Passed |
| Existing compiler contract | Existing Reference compilation-acceptance tests pass through the extracted Reference Module rule | Passed |
| Repository gates | `npm run check`: 94 documentation files; 70 activities, starters, references, and mutations; 120 Entries and 226 examples; 116/120 quality-audited Entries with 0 reviewed gaps; 246 tests; production build | Passed |

## 8. Deferred work

Phase A2 owns content-addressed compiler caching, incremental/full equivalence,
production-renderer preview, exact publication plans, and atomic canonical
publication. Phase A3 owns batches and constrained AI context packs. Phase A4
owns the loopback-only Web Author Console.

## 9. Migration and rollback

The CLI is additive and the default draft root is already ignored by Git.
Rollback removes the `reference:author` command and filesystem/context/native
Adapters. Existing drafts remain ordinary recoverable files; canonical
Reference content and learner state are unchanged.
