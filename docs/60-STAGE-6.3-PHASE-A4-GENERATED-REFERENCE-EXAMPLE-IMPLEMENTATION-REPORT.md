# Stage 6.3 Phase A4 Generated Reference Example Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-043 |
| Version | 1.0 |
| Status | Implemented; Phase A4 in progress |
| Owner | Project Maintainer |
| Last updated | 2026-09-07 |

## 1. Objective

Add provider-neutral Reference Example proposals without allowing AI output to
choose filesystem paths, bypass factual provenance, skip compiler validation,
or partially update a draft.

## 2. Delivered Interface

`ReferenceAuthoring.applyGeneratedExample` accepts an exact v2 context pack,
expected draft revision, and schema-v1 `AuthoringExampleGeneration`. The
generation contains a safe example ID, Reference Example execution contract,
bounded LF-terminated C++ source, and claim-to-fact mappings. The existing
`apply-generation --input FILE` CLI command dispatches it by the typed
`generation.example` member.

The Module derives `examples/<id>.cpp` and the canonical manifest path; input
cannot supply a path. It authoritatively rebuilds the context, reviews all
claims, invokes the configured bounded Authoring Example Validator, and upserts
the manifest by ID. Source, `entry.json`, draft revision, reset report, and a
dedicated v1 Generation Receipt are committed as one compare-and-swap snapshot.

## 3. Safety invariants

- source is non-empty, at most 128 KiB, contains no NUL or CR, and ends in LF;
- execution kind controls required expected output or diagnostic metadata;
- the path is derived from a lowercase stable ID and remains under the draft's
  example root;
- unsupported claims, stale context/revision, validator absence/failure,
  compiler rejection, or storage conflict changes no accepted draft file;
- a repeated registered ID replaces its same-path source/manifest without a
  duplicate; an untouched generated scaffold may be filled, while an
  unregistered modified file produces `file-conflict` rather than being
  overwritten; and
- every valid receipt independently keeps `check` blocked for explicit human
  review, so generated code cannot be published automatically.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Module success | T-AUTH-A4-EXAMPLE-001 installs source, manifest, receipt, revision, and review gate atomically | Passed |
| Rejection and confinement | Schema/path, fact allowlist, compilation, validator, revision, and compare-and-swap cases preserve the previous snapshot | Passed |
| Update behavior | Reapplying one example ID replaces it without manifest duplication | Passed |
| Filesystem/native compiler | T-AUTH-A1-FS-001 persists and compiles a real generated C++20 example | Passed |
| CLI parity | T-AUTH-A4-EXAMPLE-002 dispatches and labels example generation through the existing command | Passed |
| Repository gates | `npm run check`: 99 docs, 70 activities, 120 Reference Entries / 226 examples, quality 116/120 with 0 gaps, 31 files / 303 tests, and production build | Passed |

## 5. Remaining Phase A4 work

The next slice creates validated JSON bundle templates for section, summary,
and example operations. A resumable provider-neutral authoring run can then
sequence those existing operations without embedding model credentials or
weakening any review gate.
