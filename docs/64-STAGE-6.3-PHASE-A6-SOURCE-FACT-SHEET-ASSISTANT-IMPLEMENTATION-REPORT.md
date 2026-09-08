# Stage 6.3 Phase A6 Source and Fact-sheet Assistant Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-047 |
| Version | 1.0 |
| Status | Accepted; Phase A6 complete |
| Owner | Project Maintainer |
| Last updated | 2026-09-08 |

## 1. Objective

Turn explicitly supplied source research into deterministic Source Ledger and
Fact Sheet proposals without scraping pages, copying source prose into the
proposal, mutating a draft, or allowing generated material to verify itself.

## 2. Delivered Interface

`ReferenceAuthoring.proposeSourceFacts` accepts a strict schema-v1 Authoring
Research Bundle for one existing draft. A bundle carries one to twenty HTTPS
sources with stable input IDs, declared `primary`, `secondary`, or `vendor`
class, precise locators, bounded excerpts, and one to twenty proposed Fact Sheet
summaries. Proposed fact IDs and kinds must match the draft's scaffolded Fact
Sheet profile and cite supplied source IDs.

The output is a schema-v1 Authoring Research Proposal bound to the draft
revision and author-input digest. It contains canonical source-record actions,
unverified fact groups, eligible reuse suggestions, policy metadata, and a
deterministic proposal digest. The `reference:author research --input FILE
--json` CLI command passes the parsed bundle to the same Module operation and
returns the result unchanged.

## 3. Safety and reuse policy

The operation performs no outbound request and no repository write. URL
fragments are removed while query text and ordering are retained. Matching
Source Ledger URLs retain the existing stable ID, title, standard section, and
source class; a class or ID conflict is rejected. Multiple supplied locators
for one canonical URL become one source proposal with multiple excerpt digests.
The excerpts themselves are not emitted, and long verbatim excerpt reuse in a
proposed summary is rejected.

Every proposed fact has `status: unverified`, `state: pending_human`, and
`required: true`. Normative fact kinds are labelled `normative-fact`; this label
does not verify the claim. Only unchanged `checked`/`ready` related drafts may
contribute reuse suggestions, matched by shared canonical source URL or exact
summary. Suggestions retain revision and evidence digests and are never applied
automatically.

## 4. Verification

| Test | Evidence | Result |
|---|---|---|
| Proposal isolation | `T-AUTH-A6-RESEARCH-001` creates an unverified digest-bound proposal and proves the stored draft is unchanged | Passed |
| Source policy | Equivalent URLs deduplicate; existing class and ID conflicts fail closed | Passed |
| Fact policy | Unknown sources, profile mismatches, and long verbatim excerpt prose are rejected | Passed |
| Related reuse | Only eligible ready related facts are suggested and remain unapplied | Passed |
| CLI parity | `T-AUTH-A6-RESEARCH-002` returns the Module result unchanged from a JSON bundle | Passed |

Final repository evidence: 103 Markdown documents, 70 Activity
starters/references/error mutations, 120 Reference Entries with 226 locally
verified examples, quality coverage 116/120 with zero reviewed gaps, 35 test
files with 337 tests, and a passing production Web build.

## 5. Next phase

Phase A7 should translate deterministic draft findings into bounded repair
requests, retry only affected content with fixed attempt limits, and retain the
same revision-bound fact and quality constraints. The separately observed real
five-Entry batch required for Phase A3 empirical acceptance remains outstanding.
