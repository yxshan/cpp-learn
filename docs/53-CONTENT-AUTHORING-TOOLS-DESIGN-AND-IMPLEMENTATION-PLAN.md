# C++ API Reference Content Authoring Tools Design and Implementation Plan

| Field | Value |
|---|---|
| Document ID | AUTHOR-TOOLS-001 |
| Version | 2.3 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. Problem and outcome

The existing Reference gate is deliberately strict, but the author currently
repeats research organization, directory scaffolding, manifest editing, example
compilation, catalog wiring, quality inspection, and full-catalog verification
for every Entry. A single Entry can therefore consume more than one hour even
when its subject is closely related to recently completed work.

The target is not “AI writes an unchecked page faster.” The target is a local
authoring pipeline that removes mechanical work, reuses verified facts across a
small batch, checks only the affected graph during the inner loop, and reserves
human attention for claims whose correctness cannot be proven mechanically.

Process-level quality can be guaranteed by deterministic gates, traceable
sources, compiling examples, and risk-based review. AI alone cannot guarantee
that a standards claim is correct or complete.

## 2. Success measures

- Starting a draft creates all required files and valid placeholder metadata in
  one command without modifying the active catalog.
- The fast inner-loop gate reports only actionable findings for changed Entries
  and normally completes in under three minutes on the reference machine.
- Unchanged example results are reused through a content-addressed compiler
  cache; any source, standard, compiler, or flag change invalidates that result.
- A batch of related Entries shares one reviewed fact sheet without copying
  prose or silently inheriting unsupported claims.
- Publishing is atomic, produces a reviewable diff, and cannot proceed after a
  failed hard gate.
- The full release gate remains equivalent to today's `npm run check` and runs
  once per accepted batch rather than after every paragraph edit.

Initial planning targets are 15–30 minutes of active author time for an ordinary
Entry after shared research exists, or 60–90 minutes for a coherent five-Entry
batch. These are measurement targets, not correctness trade-offs or delivery
promises.

## 3. Scope

### Included

- Local draft workspaces outside `reference/entries`.
- Entry and example scaffolding from controlled profiles by Entry kind.
- A structured fact sheet and claim-to-source ledger.
- Changed-entry schema, relationship, editorial, and example checks.
- Content-addressed example compilation and execution cache.
- Draft preview, diff, review queue, and atomic publish plan.
- CLI and machine-oriented AI Adapters first; an optional lightweight Web
  review surface may follow using the same Module.
- Optional AI draft and revision assistance constrained by the fact sheet.

### Excluded from the first release

- Scraping, mirroring, machine-translating, or automatically publishing
  cppreference or another external site.
- Treating generated prose as a factual source.
- Replacing maintainer review for signatures, preconditions, complexity,
  exception guarantees, lifetime/invalidation, or standard-version boundaries.
- Editing learner state or serving the Author Console on a non-loopback address.
- General-purpose CMS, collaboration, accounts, or remote publishing.

## 4. Deep Module boundary

The original plan placed draft storage, templates, schema details, catalog graph
updates, claim ledgers, compiler cache keys, preview artifacts, and atomic
publication behind the `prepare` / `check` / `publish` lifecycle.

That lifecycle remains the authority boundary, but the implementation now has a
16-operation compatibility facade after A3–A7 added context, generation,
research, run, batch, measurement, and bounded repair capabilities. The current
interface is documented in [Detailed Design](04-DETAILED_DESIGN.md#8-reference-authoring).

Future work must preserve current requests, results, receipts, and artifact
Schemas while grouping the facade internally by lifecycle capability. New
Adapters should receive the narrowest required capability interface; they must
not recreate rules or make the broad facade grow by default.

- `prepare` creates or resumes a draft and materializes the selected Entry-kind
  profile and reusable fact sheet. Phase A0 creates controlled related-Entry
  slots; Phase A1 resolves catalog-backed related-Entry context.
- `check` performs deterministic validation and returns hard failures, review
  warnings, affected graph, cache evidence, and a risk-ranked human review queue.
- `publish` rechecks the expected draft revision, creates an exact publish plan,
  writes all canonical files atomically, and never commits to Git.

The CLI and later Web UI are Adapters. They must not recreate validation,
template selection, catalog mutation, or caching rules. Production uses a
filesystem Adapter; tests use an in-memory Adapter with the same Module
Interface. The first draft root is `.cpp-learn/authoring/<draft-id>/`, which is
already outside version control.

## 5. Authoring data model

Each draft owns the following versioned artifacts:

| Artifact | Purpose |
|---|---|
| `draft.json` | Identity, Entry kind, target paths, revision, authorship state, and affected IDs |
| `facts.json` | Structured standards facts grouped by signature, availability, parameters, return, errors, complexity, lifetime/invalidation, and thread safety |
| `sources.json` | Source IDs, direct URLs, titles, source class, verification date, and claim-group mappings |
| `entry.json` | Candidate canonical manifest generated from controlled metadata |
| `content.md` | Original project prose following the selected learning-quality profile |
| `examples/*.cpp` | Minimal and realistic deterministic examples |
| `report.json` | Machine-readable gate results, cache evidence, and review decisions |
| `catalog-proposal.json` | Proposed catalog entry, relations, and slug changes emitted by `prepare` |
| `generation/revision-<n>.json` | Generation Receipts binding each accepted generated artifact to its context and revision |
| `repair/*.json` | Module-managed issued-attempt evidence for one digest-bound Repair Plan |

Every substantive fact group must map to at least one source ID. A source record
does not authorize copying its prose. The authoring Module stores citations and
author-authored notes, not a mirrored page snapshot.

AI-proposed facts enter as `unverified`; they cannot satisfy a source or publish
gate until the author attaches a direct source and confirms the claim group.
Generated teaching explanations remain labelled separately from standards facts
inside the draft report even though the final page reads as one cohesive article.

## 6. Fast, quality-preserving workflow

### Step 1: choose a coherent batch

Select up to five related Entries from the quality backlog—for example a type,
its high-impact members, and its header. A schema-v1 batch plan is capped at five
members, so a larger scope needs several batches. Reuse shared header,
availability, and terminology research through linked facts while keeping
operation-specific preconditions and invalidation claims explicit.

### Step 2: build the fact sheet before prose

Record representative declarations, overload/version boundaries, parameters,
return/value category, errors, complexity, lifetime/invalidation, thread safety,
and source mappings. The tool highlights missing high-risk groups before time is
spent polishing prose.

### Step 3: scaffold from a controlled profile

`prepare` generates the correct manifest shape, headings, examples, related-link
slots, source slots, and catalog proposal for `landing`, `header`, `type`,
`object`, `function`, `member`, `concept`, or `guide`. Non-applicable sections
require a reviewed reason; the tool does not generate filler.

### Step 4: use AI only with a context pack

The context pack today carries the target, Entry-kind profile, required
headings, fact groups, sources, and policy. Project vocabulary and nearby
accepted pages are the intended extension and are not loaded yet; see the
[documentation and code conflict audit](72-DOC-CODE-CONFLICT-AUDIT.md). AI may draft
original explanations, examples, questions, and mistake cases. It may not add a
fact absent from the sheet without returning it to the `unverified` review queue.

### Step 5: run the inner-loop gate

The fast gate checks only changed Entries plus their impacted relationships:

1. JSON schema, paths, IDs, slugs, versions, and source policy.
2. Required semantic sections and valid `notApplicable` decisions.
3. Fact-group-to-source coverage and stale verification dates.
4. Heading anchors, related IDs, catalog reachability, and affected redirects.
5. Changed examples under their declared standard and warning profile.
6. Determinism, expected output, source digest, and local render preview.
7. JS comparison presence when useful and an explicit analogy limit.

Hard failures block publication. Editorial depth scores create warnings and a
review queue; a numeric score never overrides a missing fact or failing example.

### Step 6: human review by risk

The report groups attention instead of asking the reviewer to reread everything:

- **High risk:** signature/overload, undefined behavior, preconditions,
  exception guarantees, complexity, lifetime/invalidation, concurrency, and
  version boundaries.
- **Medium risk:** API selection advice, portability, examples, and JS analogy
  limits.
- **Low risk:** wording, search aliases, typography, and internal links.

### Step 7: publish a batch, then run the release gate

`publish` shows exact create/update/delete and catalog edits. Dry-run may obtain
a fresh checked revision automatically; apply requires that revision and
revalidates the draft immediately before installation. The existing full
Reference, quality, docs, unit, browser, and build gates run once for the
accepted batch. This two-speed model keeps the author loop fast without
weakening release acceptance.

## 7. Cache and incremental validation

Example cache keys include compiler fingerprint, selected standard flag,
warning profile version, source digest, stdin, expected outcome, and Runner
version. A cache hit is evidence for an unchanged exact input, never a blanket
“previously compiled” badge.

The impact graph starts from changed draft and catalog files, then includes
related Entries, historical slugs, category navigation, and Activities that
reference affected IDs. The full gate remains the oracle. Tests must prove that
the incremental gate produces the same result as the full gate for every
fixture whose affected graph is within scope.

Cache storage lives under `.cpp-learn/authoring-cache/`; it is disposable and
must never become required product state.

## 8. Adapter plan

The CLI is the first Adapter because it is cheap to automate and suitable for
golden tests:

```text
npm run reference:author -- prepare --id std-vector-insert --kind member --slug standard-library/containers/std-vector-insert --title "std::vector::insert"
npm run reference:author -- context --draft std-vector-insert --facts selection --json
npm run reference:author -- apply-generation --input generated-section.json --json
npm run reference:author -- check --draft std-vector-insert
npm run reference:author -- preview --draft std-vector-insert
npm run reference:author -- publish --draft std-vector-insert --dry-run
```

The full Adapter surface has thirteen subcommands. Beyond the six shown above
there are `repair-plan`, `repair`, `research`, `batch`, `run`, `template`, and
`measure`; run `npm run reference:author -- --help` for the current list, which
is also enumerated in [Detailed Design](04-DETAILED_DESIGN.md#8-reference-authoring).
`check` always evaluates the changed scope internally, so it has no `--changed`
flag.

`preview` is Adapter sugar over `check` and the generated preview artifact. The
machine-oriented AI Adapter consumes a JSON Authoring Generation rather than
embedding model credentials or provider rules in the platform. The Module
rebuilds and verifies its context, reviews every declared claim, writes one
profile-owned section, and records a Generation Receipt.

If later needed, a lightweight Web review surface may provide:

- backlog and batch selection;
- a form-based fact/source ledger;
- Markdown and example editing with live section status;
- cached compiler evidence and rendered preview;
- a risk-ranked review queue and publish diff.

Any Web UI calls the same local Module through versioned loopback HTTP
contracts. No correctness rule may exist only in React.

## 9. Delivery phases

### Phase A0: contracts and golden fixtures

**Status: Accepted.** See the [Phase A0 Implementation Report](54-STAGE-6.3-PHASE-A0-AUTHORING-CONTRACTS-IMPLEMENTATION-REPORT.md).

- Define draft, fact, source, report, and publication schemas.
- Capture golden fixtures for one `member`, one `type`, and one `header` Entry.
- Implement non-publishing `prepare` through an in-memory Adapter with atomic
  Entry-ID reservation, deterministic full-file golden snapshots, and no
  canonical writes.

Exit met: strict draft/fact/source/report/publication Schemas, deterministic
member/type/header golden profiles, non-publishing `prepare`, safe resume and
conflict handling, and the in-memory draft Adapter are executable. Candidate
`entry.json` deliberately remains release-invalid until later checks resolve
its missing facts and sources; no canonical files are written.

### Phase A1: CLI prepare/check tracer bullet

**Status: Accepted.** See the [Phase A1 Implementation Report](55-STAGE-6.3-PHASE-A1-CLI-PREPARE-CHECK-IMPLEMENTATION-REPORT.md).

- Implement filesystem and in-memory Adapters.
- Scaffold a draft by Entry kind and resume by revision.
- Extract reusable validation functions from the existing scripts without
  changing their current command behavior.
- Validate schema, quality profile, facts, sources, affected links, and changed
  examples.
- Emit human-readable and JSON reports.

Exit: an ordinary Entry can move from backlog ID to a fully checked draft without
manual directory/catalog construction.

Exit met: the standalone CLI prepares or resumes confined filesystem drafts and
emits catalog-backed proposals plus revisioned human/JSON reports after
artifact, normative/secondary source policy, active/historical slug, canonical
quality, and shared bounded native example validation. Successful checks commit
only when both revision and the complete input-file snapshot still match, and
reports separate blocking findings from a risk-ranked warning queue. It has no
publication capability.

### Phase A2: cache, preview, and atomic publish

- Add content-addressed compiler results and invalidation tests.
- Establish full-vs-incremental equivalence tests for affected-graph fixtures.
- Render the draft through the production safe Markdown renderer.
- Generate exact catalog/file diffs and atomically publish a checked revision.
- Keep Git commit and release acceptance explicit maintainer actions.

Exit: a checked batch publishes without partial writes and passes the existing
full gate.

**Status: Accepted.** See the [Phase A2 Implementation Report](56-STAGE-6.3-PHASE-A2-CACHE-PREVIEW-ATOMIC-PUBLISH-IMPLEMENTATION-REPORT.md).

Exit met: exact cache-key tests cover compiler, selected standard, profiles,
source, input, and expected outcome; actual incremental/full graph gates agree
for affected fixtures; preview uses the production React/GFM renderer and
confines draft paths; checked input/target/revision binding feeds exact
create/update/delete plans, historical redirects, staging validation,
pre-install revalidation, rollback, and interrupted-swap recovery. Git commit
and release acceptance remain manual.

### Phase A3: batch and AI context packs

- Share verified fact groups across related drafts through explicit references.
- Build constrained AI context packs and reject unverified introduced facts.
- Measure active author time, machine time, cache hit rate, review findings, and
  post-publication corrections.

Exit: a five-Entry batch meets the time target with no higher escaped-defect rate
than the current manual baseline.

Implementation status: the reusable-fact, constrained context-pack, and batch
measurement contracts are delivered. Reuse is reference-only, generated claims
outside the context allowlist return to an unverified queue, and batch reports
bind member revisions while comparing factual/example defects separately. A
real observed five-Entry batch is still required before the Phase A3 exit can be
accepted; deterministic fixture results prove calculation and rejection
behavior, not author throughput.

### Phase A4: AI Authoring Adapter

- Expose profile/target/required-heading guidance in constrained context packs.
- Accept schema-validated generated sections and summaries through a
  provider-neutral JSON bundle and CLI Adapter.
- Review every declared claim against an authoritative rebuilt context.
- Apply accepted sections, summaries, and compiler-validated Reference Examples
  through revision-bound full-snapshot commits and keep Generation Receipts.

**Status: Accepted.** Controlled section, Entry-summary, compiled Reference
Example generation, revision-bound structured bundle templates, and a resumable
provider-neutral single-draft run are implemented. Run progress is reconstructed
from Generation Receipts; a deterministic plan digest prevents a reused run ID
from silently changing meaning.

Exit: an AI agent can fill a complete draft through controlled operations while
unsupported claims remain unverified and no failed operation partially changes
the draft.

### Phase A5: coherent batch runner

- Plan and execute dependency-aware groups of related Entries.
- Reuse verified fact references and cache results across the batch.
- Resume idempotently from per-Entry receipts and emit one batch report.

**Status: Accepted.** Schema-v1 plans coordinate one to five unique draft runs
through an acyclic dependency graph. Progress is derived from child Generation
Receipts, exposes every ready, waiting, blocked, and complete member, and keeps
independent work visible when another branch is blocked. The same behavior is
available through the provider-neutral CLI Adapter.

Exit: one command advances a five-Entry batch without hiding blocked Entries.

### Phase A6: source and fact-sheet assistant

- Prepare source-record and fact-group proposals from explicitly supplied URLs
  and primary-source excerpts without mirroring external pages.
- Require human verification for normative facts and preserve source class.
- Deduplicate source records and suggest reusable related facts.

**Status: Accepted.** Schema-v1 Authoring Research Bundles accept one to twenty
explicit HTTPS source excerpts and Fact Sheet summaries. The Module
canonicalizes fragment-only URL variants, reuses matching Source Ledger
identities without changing source class, stores only excerpt digests in its
revision/input-bound proposal, rejects long verbatim prose reuse, and marks
every fact for human verification. Reusable facts from unchanged ready related
drafts are suggestions only and retain their evidence digests.

Exit: source research becomes structured input while verification authority
remains outside generated prose.

### Phase A7: quality repair loop

- Translate deterministic findings into bounded repair requests.
- Retry only affected sections/examples with fixed attempt limits.
- Compare each retry with the same revision-bound facts and quality profile.

**Status: Accepted.** A schema-v1 immutable Repair Plan is derived only from a
current full-check report. Supported content-quality, TODO-section,
missing-section, missing-example, missing-source, and compiler/example findings become narrow
section or example targets with verified Fact Sheet allowlists; all other
findings remain explicit manual/infrastructure work. The plan binds the draft
revision, author-input digest, report digest, authoring profile, target set, and
fixed three-attempt policy.

`advanceRepair` rebuilds the authoritative target set before issuing a normal
Generation Bundle Template. Issued attempts are atomically persisted under the
draft's `repair/` evidence namespace without changing the content revision or
digest, so restarting the CLI or resubmitting the original plan cannot reset
the limit. The caller's `repairId` is not part of the retry-budget identity, so
renaming a run cannot mint more attempts. Applying a repair still uses the existing claim, compiler, context,
revision, receipt, human-review, and publication gates and resets the report to
`not_checked`.

Exit: common completeness and compilation failures can be repaired quickly
without weakening gates or looping indefinitely.

### Phase A8: optional lightweight Web review

- Add only preview, risk confirmation, and publication diff if manual review
  demand justifies it.
- Preserve loopback-only access, keyboard operation, refresh recovery, and
  narrow-screen use.

Exit: a human can review and confirm generated drafts without duplicating
authoring rules or building a general-purpose CMS.

**Status: Optional, not implemented.** No Web review surface exists; it is
developed only if a measured manual-review bottleneck justifies it.

## 10. Test and acceptance plan

- `T-AUTH-001`: each Entry-kind profile scaffolds deterministic golden files.
- `T-AUTH-002`: invalid or stale facts cannot satisfy the publish gate.
- `T-AUTH-003`: every substantive claim group is source-mapped; generated facts
  remain unverified until reviewed.
- `T-AUTH-004`: changed-example cache hits and invalidation follow the exact key.
- `T-AUTH-005`: incremental and full gates agree for affected-graph fixtures.
- `T-AUTH-006`: failed checks and interrupted publication leave canonical
  content byte-for-byte unchanged.
- `T-AUTH-007`: a successful publish is atomic, revision-aware, and produces the
  expected catalog diff.
- `T-AUTH-008`: CLI and Web Adapters return equivalent reports for the same draft.
- `T-AUTH-009`: Web authoring is loopback-only, origin-validated, keyboard
  operable, and recoverable after refresh.
- `T-AUTH-010`: measured batch throughput improves while escaped factual and
  example defects do not regress.
- `T-AUTH-011`: generated sections are context/revision-bound, claim-reviewed,
  receipt-backed, and atomically applied through in-memory and filesystem
  Adapters.
- `T-AUTH-012`: batch execution is resumable and reports every blocked Entry.
- `T-AUTH-013`: source/fact proposals cannot verify themselves or change source
  classification.
- `T-AUTH-014`: repair attempts are bounded and cannot bypass the full gate.
- `T-AUTH-015`: generated summaries are single-line, context/revision-bound,
  claim-reviewed, receipt-backed, summary-only mutations that remain blocked
  until explicit human review.
- `T-AUTH-016`: generated Reference Examples use derived confined paths,
  context-reviewed claims, bounded compilation, atomic manifest/source writes,
  dedicated receipts, and mandatory human review.

## 11. Metrics and operating policy

Record per batch:

- author active minutes and machine-wait minutes;
- Entries and examples completed;
- compiler cache hit rate;
- hard-gate failures by category;
- high-risk claims reviewed;
- corrections required before and after publication;
- full-gate duration and flaky reruns.

Optimize only after three measured batches. If speed improves while
post-publication corrections rise, tighten fact-sheet or review gates before
adding more generation. If most time remains in compilation, improve cache and
changed-entry selection before weakening compiler coverage.

## 12. Immediate next development slice

Follow the order in the [future development plan](69-FUTURE-DEVELOPMENT-PLAN.md):
security-debt convergence (P1) first, then the Reference content policy (P2).
After that, deepen the Authoring lifecycle internals (P3) and complete a real
coherent five-Entry run for empirical Phase A3 acceptance (P5). Evaluate A8's
lightweight Web review surface only after observed manual-review demand proves
that it is the remaining bottleneck.

This status clarification and current-interface correction were prepared by
**GPT-5.6 Sol**.
