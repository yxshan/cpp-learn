# Stage 6.3 Phase A0 Reference Authoring Contracts Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-037 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

## 1. Objective

Establish the smallest safe Reference Authoring Module slice before adding a
CLI, filesystem drafts, incremental checks, compilation, AI assistance, or
canonical publication. Phase A0 must prove the draft vocabulary, deterministic
Entry-kind profiles, and in-memory Adapter through the same Interface future
callers will use.

## 2. Delivered scope

- Added the `@cpp-learn/reference-authoring` Module.
- Added strict versioned JSON Schemas for draft metadata, fact sheets, source
  ledgers, check reports, and publication plans.
- Added a `ReferenceAuthoring` Interface exposing only `prepare` in Phase A0.
  `check` and `publish` remain absent until they have real implementations.
- Added an in-memory draft repository Adapter that clones on read and write so
  caller mutation cannot alter stored drafts.
- Added deterministic `callable`, `entity`, `header`, and `navigation` profiles
  selected from the existing Reference Entry kind vocabulary.
- Added controlled Markdown headings, fact groups, candidate metadata, and one
  or two compiling C++ skeleton paths according to the selected profile.
- Added member, type, and header golden-profile fixtures.

## 3. Safety behavior

`prepare` validates the complete draft identity before storage. IDs and slugs
cannot contain absolute or parent paths. Repeating the same target resumes the
existing revision without replacing its files; attempting to reuse an Entry ID
for a different target returns `draft_conflict` and preserves the stored draft.

All prepared artifacts exist only in the injected draft repository. Phase A0
has no filesystem Adapter and no operation capable of writing
`reference/catalog.json` or `reference/entries`.

The generated `entry.json` is a candidate authoring worksheet, deliberately not
release-valid: unknown summary, categories, sources, and verification date stay
visibly incomplete. A later `check` must resolve those fields and validate the
result through the canonical Reference Entry Schema. This fail-closed shape
prevents a freshly scaffolded draft from appearing reviewed.

## 4. Module depth and seams

The caller supplies one target and learns one operation. Profile selection,
fact coverage, headings, example count, artifact naming, validation, resume,
conflict handling, and defensive copying remain inside the Module.

The draft repository is an internal seam injected into the Module. Phase A0
ships its in-memory Adapter for deterministic tests; Phase A1 adds the second,
filesystem Adapter before the CLI is connected.

## 5. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| Golden profiles | T-AUTH-001 compares member, type, and header profile, fact, heading, and example-path output | Passed |
| Resume/conflict | T-AUTH-001 proves idempotent resume and fail-closed target conflict | Passed |
| Storage isolation | T-AUTH-001 proves caller mutation cannot alter the stored draft | Passed |
| Request confinement | T-AUTH-001 rejects unsafe Entry IDs and slugs before storage | Passed |
| Artifact contracts | T-AUTH-SCHEMA-001 validates prepared artifacts and rejects stale revisions, unknown fact kinds, invalid source records, and unsafe publication paths | Passed |
| Repository gates | 93 Markdown files, 70-Activity curriculum gate, 120-Entry/226-example Reference gate, 116/120 applicable Entry quality audit, formatting, lint, typecheck, 227 Vitest tests, and production build | Passed |

## 6. Deferred work

- Phase A1: filesystem draft Adapter, CLI `prepare`, real `check`, fact/source
  coverage findings, and machine-readable reports.
- Phase A2: changed-example compilation cache, production-renderer preview, and
  atomic publication.
- Phase A3: related-Entry batches, constrained AI context packs, and throughput
  measurement.
- Phase A4: loopback-only Web Author Console.

No delivery report may claim T-AUTH-002 through T-AUTH-010 until the matching
behavior and executable evidence exist.

## 7. Migration and rollback

The Module is not composed into the product and writes no persistent state.
Rollback removes its workspace package and documentation entry. Reference
content, learner state, and existing commands remain unchanged.
