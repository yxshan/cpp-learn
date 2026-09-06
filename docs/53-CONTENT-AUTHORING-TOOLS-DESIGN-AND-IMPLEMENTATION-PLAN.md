# C++ API Reference Content Authoring Tools Design and Implementation Plan

| Field | Value |
|---|---|
| Document ID | AUTHOR-TOOLS-001 |
| Version | 1.2 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

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
- CLI Adapter first, followed by a Web Author Console using the same Module.
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

The target `Reference Authoring Module` hides draft storage, templates, schema details,
catalog graph updates, claim ledgers, compiler cache keys, preview artifacts,
and atomic filesystem publication behind three operations:

```ts
interface ReferenceAuthoring {
  prepare(request: PrepareDraftRequest): Promise<DraftWorkspace>;
  check(request: CheckDraftRequest): Promise<AuthoringReport>;
  publish(request: PublishDraftRequest): Promise<PublishResult>;
}
```

Phase A0 exposes only `prepare`; an Interface does not advertise `check` or
`publish` before those behaviors exist. Phase A1 adds `check`, and Phase A2 adds
`publish`, preserving the request/result vocabulary established by the
versioned artifact Schemas.

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

Every substantive fact group must map to at least one source ID. A source record
does not authorize copying its prose. The authoring Module stores citations and
author-authored notes, not a mirrored page snapshot.

AI-proposed facts enter as `unverified`; they cannot satisfy a source or publish
gate until the author attaches a direct source and confirms the claim group.
Generated teaching explanations remain labelled separately from standards facts
inside the draft report even though the final page reads as one cohesive article.

## 6. Fast, quality-preserving workflow

### Step 1: choose a coherent batch

Select five to ten related Entries from the quality backlog—for example a type,
its high-impact members, and its header. Reuse shared header, availability, and
terminology research through linked facts while keeping operation-specific
preconditions and invalidation claims explicit.

### Step 2: build the fact sheet before prose

Record representative declarations, overload/version boundaries, parameters,
return/value category, errors, complexity, lifetime/invalidation, thread safety,
and source mappings. The tool highlights missing high-risk groups before time is
spent polishing prose.

### Step 3: scaffold from a controlled profile

`prepare` generates the correct manifest shape, headings, examples, related-link
slots, source slots, and catalog proposal for `member`, `function`, `type`,
`object`, `header`, or `guide`. Non-applicable sections require a reviewed reason;
the tool does not generate filler.

### Step 4: use AI only with a context pack

The context pack contains the fact sheet, project vocabulary, Entry-kind
template, nearby accepted pages, and explicit JS-comparison rules. AI may draft
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

`publish` shows the exact files and catalog edits, requires the checked draft
revision, and writes atomically. The existing full Reference, quality, docs,
unit, browser, and build gates run once for the accepted batch. This two-speed
model keeps the author loop fast without weakening release acceptance.

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

## 8. CLI and Web Adapter plan

The CLI is the first Adapter because it is cheap to automate and suitable for
golden tests:

```text
npm run reference:author -- prepare --id std-vector-insert --kind member
npm run reference:author -- check --draft std-vector-insert --changed
npm run reference:author -- preview --draft std-vector-insert
npm run reference:author -- publish --draft std-vector-insert --dry-run
```

`preview` is Adapter sugar over `check` and the generated preview artifact; it
is not a fourth Module operation. The later Web Author Console provides:

- backlog and batch selection;
- a form-based fact/source ledger;
- Markdown and example editing with live section status;
- cached compiler evidence and rendered preview;
- a risk-ranked review queue and publish diff.

The Web UI calls the same local Module through versioned loopback HTTP contracts.
No correctness rule may exist only in React.

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

- Implement filesystem and in-memory Adapters.
- Scaffold a draft by Entry kind and resume by revision.
- Extract reusable validation functions from the existing scripts without
  changing their current command behavior.
- Validate schema, quality profile, facts, sources, affected links, and changed
  examples.
- Emit human-readable and JSON reports.

Exit: an ordinary Entry can move from backlog ID to a fully checked draft without
manual directory/catalog construction.

### Phase A2: cache, preview, and atomic publish

- Add content-addressed compiler results and invalidation tests.
- Establish full-vs-incremental equivalence tests for affected-graph fixtures.
- Render the draft through the production safe Markdown renderer.
- Generate exact catalog/file diffs and atomically publish a checked revision.
- Keep Git commit and release acceptance explicit maintainer actions.

Exit: a checked batch publishes without partial writes and passes the existing
full gate.

### Phase A3: batch and AI context packs

- Share verified fact groups across related drafts through explicit references.
- Build constrained AI context packs and reject unverified introduced facts.
- Measure active author time, machine time, cache hit rate, review findings, and
  post-publication corrections.

Exit: a five-Entry batch meets the time target with no higher escaped-defect rate
than the current manual baseline.

### Phase A4: Web Author Console

- Add loopback-only authoring contracts and a lazy Web route.
- Implement fact/source forms, editors, preview, findings, and publish diff.
- Preserve keyboard access, recovery after refresh, and narrow-screen use.

Exit: the Web Adapter reaches feature parity with the supported CLI flow while
all authoring rules remain in the Module.

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

Start Phase A1 with a confined filesystem draft Adapter and a CLI `prepare`
command calling the accepted Module Interface. Then add the smallest real
`check` slice: validate the prepared artifacts, require fact/source mappings,
and emit human-readable plus JSON findings without compiling or publishing.
Keep existing Reference commands as the release oracle and do not add canonical
writes, UI, or AI behavior in this slice.
