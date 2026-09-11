# Current Architecture Audit

| Field | Value |
|---|---|
| Document ID | ARCH-AUDIT-001 |
| Version | 1.2 |
| Status | In Review |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-12 |

> Layout note (2026-09-10): the measurements in §3 were taken before the
> `docs/73` refactor. `apps/server/src/{server,composition,config}.ts` now live in
> `packages/composition/src/`, `apps/cli` no longer depends on `apps/server` or
> `apps/web`, and `packages/ui` has been deleted in favour of
> `packages/reference-presentation`. Candidate A-03 is complete; the remaining
> candidates and their paths are unchanged.

## 1. Executive verdict

The project does not need a rewrite. Its top-level monorepo, declarative content,
Learning Platform, Reference, Workspace, Judge, and Learning Record seams remain
appropriate for a local single-user product. The accepted ADRs still fit the
actual product.

Growth has instead concentrated friction in five places: duplicated Reference
content policy, the expanding Reference Authoring interface and implementation,
presentation code shared through an app-to-app dependency, large transport and
React files, and a flat documentation baseline. These should be addressed before
building a feature-rich Web Author Console or expanding Reference content by
hundreds of Entries.

## 2. What the authoring tool and Web review surface are for

The existing CLI authoring Adapter is sufficient for an AI-assisted author to:

- prepare an Authoring Draft;
- organize and verify Source Ledger and Fact Sheet input;
- generate bounded section, summary, and example templates;
- apply generated proposals through claim and compiler gates;
- check, repair, preview, measure, and atomically publish accepted content.

The Web review surface is not a development-log viewer. Its useful role is a
human-review Adapter over the same Reference Authoring module:

- show a risk-ranked review queue;
- compare the candidate Entry with the currently published Entry;
- connect generated claims to verified Fact Sheet groups and source locators;
- display compiler evidence and rendered preview together;
- accept or reject individual findings and inspect the exact publication plan.

Because the initial maintainer and Learner are the same person, a read-only or
approval-focused surface is enough. A general CMS, AI chat transcript viewer,
and browser implementation of authoring rules are not justified.

## 3. Measured current shape

| Area | Evidence | Architectural meaning |
|---|---:|---|
| Tracked application source files | 33 | Three Adapters remain small in package count |
| Tracked domain module source files | 66 | Most behavior is correctly outside Adapters |
| Curriculum files | 141 | Declarative per-Activity layout is scaling predictably |
| Reference files | 469 | Content has become a first-class subsystem |
| Documentation files | 110 | Navigation and lifecycle grouping now matter |
| `reference-authoring/src/index.ts` | 5,271 lines | Authoring orchestration has lost locality |
| `ReferenceAuthoring` interface | 16 operations | The facade keeps growing because no lifecycle capability owns its workflows |
| Authoring schemas | 22 JSON Schema files | Versioned artifacts are valuable but need grouping and ownership |
| `apps/server/src/server.ts` | 903 lines | Several transport concerns share one implementation file |
| `apps/web/src/App.tsx` | 1,097 lines | Navigation, loading, backup, dashboard derivation, and rendering are mixed |
| `packages/contracts/src/index.ts` | 956 lines | A real shared seam is represented by one oversized source file |
| `packages/ui/src/index.ts` | 1 line | The planned package is currently a shallow, unused placeholder |
| Architecture baseline drift | `docs/05` still lists fourteen Authoring operations while the interface has sixteen; docs 11, 53 and 67 still order content policy before the security debt that docs 69, 70 and the root README promote to P1 | Current design documentation no longer fully describes the implementation or the agreed priority order |

The measurements are line and tracked-file counts, not quality scores. They are
used only to locate places where understanding and change require excessive
cross-file movement or one file contains several independent reasons to change.

### 3.1 Refreshed measurements (2026-09-12)

The table above is the fixed-point evidence of this audit and is left unchanged.
These are the same areas measured after the `docs/73` refactor, on the commit that
recorded `ADR-0008`. Counts are of **Git-tracked** files, and each count states its
own filter, because the earlier "domain module source files = 66" could not be
reproduced under any single rule (`.ts` 31, `.ts` including tests 54, `+.schema.json`
76, all tracked 93).

| Area | Filter | Count |
|---|---|---:|
| Application source | `apps/**/*.ts(x)`, excluding tests | 42 |
| Application files | all tracked under `apps/` | 59 |
| Domain module source | `modules/**/*.ts`, excluding tests | 31 |
| Domain module files | all tracked under `modules/` | 93 |
| Curriculum files | all tracked under `curriculum/` | 141 |
| Reference files | all tracked under `reference/` | 468 |
| Documentation | `docs/**/*.md` | 114 |
| Authoring schemas | `modules/reference-authoring/**/*.schema.json` | 22 |
| `reference-authoring/src/index.ts` | lines | 994 (was 5,271) |
| `packages/composition/src/server.ts` | lines | 146 (was 903 in `apps/server`) |
| `apps/web/src/App.tsx` | lines | 26 (was 1,097) |
| `packages/contracts/src/index.ts` | lines | 495 (was 956) |
| `packages/composition/src/transport.ts` | lines | 320, the extracted shared policy |
| `packages/ui/` | — | deleted; `packages/reference-presentation` replaced it |

The direction the audit argued for has been taken: the two files it called out as
having lost locality are an order of magnitude smaller, and the shared transport
policy it asked for exists. The interface count is unchanged at sixteen operations.

The drift row is also resolved: `docs/05` no longer lists fourteen operations, and
the priority order in `docs/69`, `docs/70` and the root `README.md` now agrees, with
the security debt recorded as complete in `docs/71` §10.

## 4. Strengths to preserve

### 4.1 Domain modules are real

Curriculum, Reference, Workspace, Judge, Learning Record, and Learning Platform
own distinct domain state. Filesystem and in-memory adapters give several seams
at least two concrete adapters, so these are not hypothetical abstractions.

### 4.2 Content is declarative and locally verifiable

Activity and Reference content is versioned, schema-checked, and kept outside
React. This gives the content pipeline leverage across Web, CLI, tests, and
future tooling.

### 4.3 Runtime Reference and learning state remain separate

Reference Entries do not produce Evidence or masquerade as Activities. This is
an important domain distinction and matches ADR-0006.

### 4.4 The Judge seam supports future isolation

Native process execution is accurately documented as non-sandboxed and remains
replaceable by a future container or remote adapter without changing the
Learning Platform interface.

## 5. Deepening candidates

### A-01 — Centralize Reference profile and quality policy

**Recommendation: Strong. Dependency category: in-process.**

Files:

- `modules/reference-authoring/src/index.ts`
- `modules/reference-authoring/src/repair.ts`
- `scripts/reference-content-quality.ts`
- `packages/reference-schema/`

Problem: profile headings, fact kinds, quality-area recognition, risk, and
repair targeting live in separate string maps. A7 already produced a concrete
failure: Header quality findings existed in the checker but were initially
ignored by repair planning.

Deepen: one Reference content-policy module owns Entry-kind profiles, semantic
area IDs, heading recognition, fact requirements, risk, and repairability. The
quality checker and Authoring module become callers of that policy.

Benefits:

- locality: one semantic policy;
- leverage: checker and repair agree;
- typed area IDs replace strings;
- one contract-test matrix;
- future Entry kinds change once.

Deletion test: deleting this proposed module would force the same policy back
into at least the checker, scaffolder, validator, and repair planner. It would
therefore concentrate real complexity and be deep.

### A-02 — Re-form the Reference Authoring lifecycle module

**Recommendation: Strong. Dependency category: local-substitutable.**

Files:

- `modules/reference-authoring/src/index.ts`
- `modules/reference-authoring/src/{generation,run,batch,repair,research}.ts`
- `modules/reference-authoring/src/*.schema.json`

Problem: the original `prepare`/`check`/`publish` lifecycle has grown into a
16-operation interface. The 5,271-line composition implementation still owns
validation, orchestration, evidence materialization, receipt handling, repair,
and publication coordination despite several extracted helpers. Understanding a
single workflow repeatedly crosses one broad interface and one very large file.

Deepen: group implementation and schemas by Authoring lifecycle capability,
with one compatibility facade during migration. Draft repository, catalog,
validator, compiler, and publisher adapters remain internal seams used by the
deepened lifecycle modules.

Benefits:

- locality: one workflow per module;
- interface stops expanding by default;
- schema ownership becomes visible;
- tests use lifecycle outcomes;
- Web review can request less authority.

This candidate must preserve ADR-0007: CLI and Web remain adapters and no
provider-specific AI logic enters the Authoring module.

### A-03 — Extract shared Reference presentation

**Recommendation: Strong. Dependency category: in-process. Status: DONE (see
[Refactoring plan](73-REFACTORING-PLAN.md) slice 2).**

Files as audited:

- `apps/cli/src/reference-author-preview.ts`
- `apps/web/src/reference-preview.tsx` (deleted)
- `apps/web/src/ReferenceArticle.tsx`
- `apps/web/src/reference-links.ts`
- `packages/ui/` (deleted)

Problem: the CLI imports `@cpp-learn/web/reference-preview`. An Adapter therefore
depends on another Adapter and pulls Web package knowledge into a server-side
preview workflow. The planned `packages/ui` package is empty and currently adds
no depth.

Deepen: shared Reference presentation and static rendering move behind a
presentation module consumed by both Web and CLI. Browser routing remains in the
Web Adapter; filesystem output remains in the CLI Adapter.

Outcome: `packages/reference-presentation` owns a framework-free block model and
both leaf renderers consume it, which is stronger than the original proposal —
the two renderers share semantics rather than one importing the other. A parity
test pins them together, and the empty `packages/ui` package is gone.

### A-04 — Partition the Fastify transport Adapter by domain

**Recommendation: Worth exploring. Dependency category: in-process.**

Files:

- `apps/server/src/server.ts`
- `apps/server/src/composition.ts`

Problem: one 903-line implementation registers learning queries, Workspace
mutation, Judge jobs, Reference browsing, Playground concurrency, backup, and
SSE. Input parsing, loopback-origin policy, error mapping, and domain calls are
interleaved.

Deepen: domain-oriented route registration modules own transport parsing and
mapping for Learning, Reference/Playground, and local data operations. A small
server composition implementation installs them and shared transport policy.

Benefits:

- locality: transport behavior by domain;
- Playground admission stays together;
- smaller contract-test fixtures;
- composition root becomes legible;
- no domain rules move into Fastify.

Avoid one-file-per-route extraction: that would create shallow modules and move
navigation cost rather than concentrate complexity.

### A-05 — Partition the Web Adapter by learner workflow

**Recommendation: Worth exploring. Dependency category: in-process.**

Files:

- `apps/web/src/App.tsx`
- `apps/web/src/LessonWorkspace.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/styles.css`

Problem: `App.tsx` owns URL/history synchronization, dirty-workspace protection,
five parallel queries, backup operations, derived project progress, and the
complete dashboard view. Changes to one learner workflow require understanding
unrelated presentation state.

Deepen: route-level learner workflow modules own their loading, derived view
model, and interaction state. The app shell owns only navigation and top-level
route selection. Shared transport calls remain in one typed adapter.

Benefits:

- locality: state follows workflow;
- dashboard tests need less setup;
- Reference stays independently loadable;
- author review can be lazy-loaded;
- app shell becomes a small interface.

### A-06 — Give documentation a lifecycle information architecture

**Recommendation: Strong. Dependency category: in-process.**

Files:

- `docs/README.md`
- `docs/01-...` through `docs/65-...`
- `docs/reference/`
- `docs/archive/`

Problem: 65 numbered baseline and delivery files shared the root before this
audit, and the reading order presents every historical implementation report as
if it were required current architecture. Research is partly grouped, but stage
reports are not. Priority drift is also visible: docs 11, 53 and 67 still put the
Reference content policy first, while docs 69, 70 and the root README promote
security-debt convergence to P1 and demote content policy to P2.

Deepen: organize documents by lifecycle while retaining stable Document IDs:

```text
docs/
  product/        charter, requirements, roadmap, traceability
  architecture/   system, detailed design, data, interfaces, security
  operations/     development and quality guides
  decisions/      ADRs
  reports/        stage and batch implementation evidence
  research/       external and Reference research evidence
  archive/        superseded material
```

Benefits:

- locality: current baseline is obvious;
- reports stop dominating navigation;
- research gains one home;
- new stages do not flatten root;
- AI retrieval becomes more precise.

Migration should be mechanical and atomic: update local links and the index in
the same change, then run `check:docs`. Renumbering Document IDs is unnecessary.

### A-07 — Split contracts internally without splitting the seam

**Recommendation: Worth exploring. Dependency category: in-process.**

Files:

- `packages/contracts/src/index.ts`

Problem: Reference transport views, Playground results, Activity views, Judge
reports, Learning Events, commands, queries, and validation share a 956-line
source file. The package is a real seam, but its implementation lacks locality.

Deepen: keep one public package seam while grouping its implementation by
Reference, learning, Judge, events, and transport concerns. A compatibility
export surface prevents a repository-wide migration.

Benefits:

- locality: contracts by domain;
- package seam remains stable;
- schema ownership is clearer;
- reviews see smaller changes;
- generated documentation becomes possible.

## 6. Recommended order

### Phase R0 — Stop semantic drift

1. A-01 central Reference content policy.
2. Add a cross-profile contract-test matrix.
3. Keep behavior unchanged.

An actual A7 defect demonstrated the cost of the current duplication, so A-01 is
the highest-value architecture candidate in this audit. It is **not** the first
work item overall: per [the future development plan](69-FUTURE-DEVELOPMENT-PLAN.md)
and [the security audit](71-CURRENT-SECURITY-AUDIT.md), security-debt
convergence (P1) is executed before this phase begins.

### Phase R1 — Prepare for the Web review Adapter

1. A-02 re-form Reference Authoring lifecycle ownership.
2. A-03 extract shared Reference presentation.
3. Add a minimal read-only Author Review route only after those seams settle.

### Phase R2 — Improve application locality

1. A-04 partition Fastify transport by domain.
2. A-05 partition Web by learner workflow.
3. Add the Author Review Adapter as its own lazy-loaded workflow.

### Phase R3 — Information architecture

1. A-06 move documents with automated link updates and `check:docs` evidence.
2. A-07 split contract source internally while preserving imports.
3. Remove the empty UI package if A-03 does not give it real responsibility.

## 7. Changes explicitly not recommended

- Do not split the repository into microservices or multiple repositories.
- Do not add cloud accounts, remote databases, or multi-user authorization.
- Do not replace the declarative content trees with a database CMS.
- Do not make the Web Author Console the owner of validation rules.
- Do not combine Reference Entry progress with Learning Evidence.
- Do not adopt Judge0's distributed infrastructure before untrusted or remote
  execution becomes a real requirement.

These changes would contradict accepted ADRs without solving a demonstrated
locality or leverage problem.

## 8. Decision requested

Choose one candidate for a detailed design interview before implementation.
The recommended first architecture candidate is A-01, to be scheduled after the
security-debt work that [the future development plan](69-FUTURE-DEVELOPMENT-PLAN.md)
lists as P1. Its interface and physical package placement should be designed only
after confirming whether the quality checker must remain a root script or become
a normal workspace module.

External comparison evidence is recorded in
[External Architecture Benchmarks](66-EXTERNAL-ARCHITECTURE-BENCHMARKS.md).

本架构审计由 **GPT-5.6 Sol** 完成。
