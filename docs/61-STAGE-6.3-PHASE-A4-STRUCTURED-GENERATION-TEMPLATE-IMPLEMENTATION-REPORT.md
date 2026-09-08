# Stage 6.3 Phase A4 Structured Generation Template Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-044 |
| Version | 1.0 |
| Status | Implemented; Phase A4 in progress |
| Owner | Project Maintainer |
| Last updated | 2026-09-08 |

## 1. Objective

Remove the error-prone manual assembly of context, revision, digest, and
generation JSON while preserving the existing provider-neutral trust boundary.

## 2. Delivered Interface

`ReferenceAuthoring.buildGenerationTemplate` accepts a draft, an explicit
verified fact-group allowlist, and one target kind: section, summary, or
Reference Example. It reuses `buildContext`, binds the returned context digest
and current draft revision, and emits a schema-v1 Generation Bundle Template.

The `reference:author template` CLI command exposes the same operation. Section
templates require `--heading`; example templates require `--example-id` and may
override their execution kind and C++ standard. A run example defaults to C++20.

## 3. Safety and workflow

Every new template has empty content, no claims, `status: incomplete`, and the
required actions `write-content`, `declare-claims`, and `mark-ready`. This shape
is valid as an editable template but invalid as a final Authoring Generation.
`apply-generation` additionally refuses a template envelope until its status is
`ready`; it then still applies the final generation schema, fact allowlist,
revision/digest, compiler, receipt, and human-review gates.

This split makes generation faster without turning placeholders into content or
allowing metadata to bypass Module validation. Bare legacy generation bundles
remain compatible.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Module template generation | T-AUTH-A4-TEMPLATE-001 covers section, summary, example, context binding, schema validity, defaults, and invalid headings | Passed |
| CLI parity | T-AUTH-A4-TEMPLATE-002 maps flags to the Interface and returns the editable bundle | Passed |
| Incomplete-template guard | CLI test proves incomplete envelopes never dispatch generation | Passed |
| Existing generation regression | Section, summary, example, filesystem, CLI, type, lint, docs, and full repository gates | Passed |

Final evidence: 100 Markdown documents, 70 Activity starters/references/error
mutations, 120 Reference Entries with 226 locally verified examples, quality
coverage 116/120 with zero reviewed gaps, 32 test files with 308 tests, and the
production Web build all pass. The loopback Activity check requires the normal
host environment because the filesystem sandbox denies its local socket bind.

## 5. Remaining Phase A4 work

Add a resumable provider-neutral authoring run command that sequences template
targets and records progress without embedding model credentials. Phase A5 can
then extend the same run state across coherent multi-Entry batches.
