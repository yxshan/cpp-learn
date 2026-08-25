# Roadmap and Acceptance Plan

| Field | Value |
|---|---|
| Document ID | ROADMAP-001 |
| Version | 1.8 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Delivery policy

Delivery is capability-gated, not calendar-gated. A stage is complete only when its acceptance evidence is reproducible on the reference environment and linked in the traceability matrix.

## 2. Stage 0: Engineering baseline

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 0 Implementation Report](13-STAGE-0-IMPLEMENTATION-REPORT.md).

Deliver:

- npm-workspaces repository skeleton.
- Shared contracts and JSON Schemas.
- Learning Platform, Curriculum, Workspace, Judge, and Learning Record Module shells.
- Web/server/CLI composition roots.
- CI quality gates and document checks.

Acceptance:

- Modules compile and are testable through declared Interfaces.
- Web and CLI execute a shared health/query fixture.
- Invalid content and invalid paths fail contract tests.
- Documentation and ADR index are current.

## 3. Stage 1: Web vertical slice

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 1 Implementation Report](14-STAGE-1-IMPLEMENTATION-REPORT.md).

Deliver:

```text
Dashboard → first Lesson → Monaco edit → save → Run → Grade
→ Judge Report → learning event → dashboard refresh
```

Also deliver `serve`, `check`, `status`, and `doctor` CLI operations and migrate the existing first Lesson.

Acceptance:

- Same Source Snapshot has equivalent Web and CLI verdict.
- Run never changes Concept State.
- Grade survives server restart with history intact.
- Workspace save conflicts do not overwrite code.
- Playwright covers the complete path.

## 4. Stage 2: Reliable Judge and records

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 2 Implementation Report](15-STAGE-2-IMPLEMENTATION-REPORT.md).

Deliver:

- Multi-file Workspaces and immutable Source Snapshots.
- Public/private tests, timeout, output limit, ASan, and UBSan.
- Structured diagnostics, cancellation, worker crash handling.
- Append-only events, SQLite projections, rebuild, export, and restore.

Acceptance:

- Every required Judge verdict has a golden fixture.
- Worker crash does not stop the server or append false Evidence.
- Duplicate report ingestion is idempotent.
- Rebuilt projections match pre-rebuild state.
- Private material is absent from browser payloads, logs, and Teacher Packs.

## 5. Stage 3: Learning loop

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 3 Implementation Report](16-STAGE-3-IMPLEMENTATION-REPORT.md).

Deliver:

- Ordered hints and assistance tracking.
- Reflections and Teacher Observations.
- Concept Evidence, state explanations, Review scheduling, and variants.
- Knowledge Map and Review Queue.

Acceptance:

- Full-solution exposure cannot create `demonstrated` Evidence.
- Public-test pass alone remains `practiced` or lower.
- Independent delayed Review can create `retained`.
- Every state transition links to supporting Evidence and explanation.

## 6. Stage 4: Modern C++ curriculum release

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 4 Implementation Report](17-STAGE-4-IMPLEMENTATION-REPORT.md).

Deliver initially:

- 10–12 Lessons.
- 15–20 Exercises/Review variants.
- One progressive Project.
- Core reference documents and interactive blocks.

Then expand through types, references, pointers, lifetime, RAII, classes, STL, copy/move, smart pointers, templates, tests, and CMake.

Acceptance:

- All required content passes lint and reference-solution checks.
- Known incorrect solutions exercise intended failure categories.
- Every core Concept has an Evidence policy and delayed Review.
- Existing Learner Workspaces survive content upgrades.

## 7. Stage 5: Algorithms and systems

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 5 Implementation Report](18-STAGE-5-IMPLEMENTATION-REPORT.md).

Deliver:

- Deterministic property tests and relative performance checks.
- Data-structure and algorithm Modules.
- Files, processes, threads, loopback sockets, HTTP, and SQLite labs.
- CMake/CTest project workflows.
- Optional Linux/container verification.

Acceptance:

- Random failures reproduce from recorded seeds.
- System labs clean up files, processes, ports, and databases.
- Performance checks are same-machine relative comparisons.
- Linux-only outcomes are labeled and not inferred from macOS.

## 8. Stage 5.1: Web learning experience stabilization

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 5.1 Implementation Report](19-STAGE-5.1-IMPLEMENTATION-REPORT.md).

Deliver:

- A responsive overview with semantic navigation, Activity filtering, and durable URL state.
- Direct Activity links and ordered previous/next navigation across the complete Track.
- A desktop training layout where Lesson content scrolls independently while the code editor and Judge actions remain visible.
- A single-column narrow-screen layout without horizontal overflow.
- Keyboard-visible controls, semantic labels, skip navigation, and unsaved-work confirmation.

Acceptance:

- Opening, filtering, and navigating Activities preserves a meaningful URL and browser history.
- Previous/next controls expose boundary states and switch both Activity content and Workspace.
- Scrolling long Lesson content does not move the desktop editor or the browser viewport.
- A 390-pixel viewport has no document-level horizontal overflow.
- The complete real-browser learning loop still passes with no browser errors.

## 9. Stage 6: Career track completion

**Status:** Accepted on 2026-08-23. Reproducible evidence is recorded in the [Stage 6 Implementation Report](20-STAGE-6-IMPLEMENTATION-REPORT.md).

Deliver:

- Network, database, concurrency, performance, and deployment Modules.
- 4–5 progressive Projects.
- Project rubrics, load testing, incident exercises, and interview review.
- Advanced visualizations that materially improve understanding.

Acceptance:

- Projects have reproducible builds, tests, documentation, benchmarks, and failure retrospectives.
- Knowledge Map traces Project evidence back to Concepts.
- Export contains a coherent learner-owned portfolio history without private judge material.

## 10. Stage 6.1: C++ editor ergonomics

**Status:** Accepted on 2026-08-25. Reproducible evidence is recorded in the [Stage 6.1 Implementation Report](21-STAGE-6.1-IMPLEMENTATION-REPORT.md).

Deliver:

- Conventionally formatted C++ starter code in the Lesson editor.
- Active-file Format and confirmed Reset controls.
- A read-only starter baseline without silent replacement of learner work.

Acceptance:

- String and comment contents survive deterministic formatting.
- Previously edited learner files are not automatically formatted or reset.
- Format and Reset remain buffer-only until Save, Run, or Grade persists them.
- The real-browser regression covers initial formatting, explicit formatting, and confirmed reset.

## 11. Stage 6.2: C++ API Reference

**Status:** Planned. Design and acceptance sources are the [Reference Module
Design](22-API-REFERENCE-MODULE-DESIGN.md) and [Implementation
Plan](24-API-REFERENCE-IMPLEMENTATION-PLAN.md).

Deliver the read-only vertical release:

- Separate Reference Module, schema, filesystem and in-memory Adapters, shared
  contracts, and degraded readiness.
- Deterministic navigation, lookup, search, aliases, categories, C++ standard
  filters, and stable Entry URLs.
- Lazy-loaded Web Reference with accessible desktop and narrow-screen layouts.
- 15 original, source-backed Entries across at least five categories.
- Content gates for relationships, sources, licensing, terminology, and example
  compilation.
- Reference-to-Activity navigation without learner-state mutation.

Then expand through 80–120 core standard-library Entries and bidirectional
Activity links. A temporary non-Activity Playground and grounded AI assistance
remain separately gated later phases.

Acceptance:

- Exact symbol, header, alias, Chinese title, prefix, and filtered searches are
  deterministic and contract-tested.
- Direct Entry/anchor URLs, browser history, keyboard operation, and a
  390-pixel viewport pass Playwright coverage.
- Ordinary examples compile under their declared standard with the warning
  profile enabled.
- Reading, searching, and copying Reference content produce no Workspace,
  Attempt, Evidence, Concept, Review, or Project mutation.
- Installed content works without external network access.
- Invalid Reference content cannot activate, while Reference degradation does
  not disable existing learning flows.
- Sources and any reused-material attribution pass content validation.

## 12. Global definition of done

- Requirement implemented and traced.
- Module/contract/integration/E2E tests pass as applicable.
- Security and privacy impacts reviewed.
- Migration and rollback considered.
- User-facing errors and documentation updated.
- No known S1/S2 defects in the released scope.
- Acceptance evidence is reproducible and archived with the release.

## 13. Deferred decisions

- Desktop packaging.
- Specific SQLite Node Adapter.
- Container runtime and remote Linux runner.
- Specific AI provider versus MCP-only integration.
- Multi-user/cloud support.
- Public curriculum plugin ecosystem.
- External Reference synchronization or import pipeline.
- The provider and interaction contract for grounded Reference AI assistance.

These remain behind defined seams and are decided only when a concrete second Adapter or product requirement exists.
