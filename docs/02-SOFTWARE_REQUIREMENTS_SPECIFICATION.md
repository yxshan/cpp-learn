# Software Requirements Specification

| Field | Value |
|---|---|
| Document ID | SRS-001 |
| Version | 1.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. System context

The system is a local single-user Web application with a CLI Adapter. It manages versioned curriculum content and learner Workspaces, executes trusted local C++ code through an isolated Worker process, records immutable learning events, derives Concept state, and supports AI Teacher observations.

## 2. Actors

- **Learner**: reads content, edits code, runs, grades, requests hints, answers reflections, and reviews progress.
- **AI Teacher**: reads approved context, proposes observations and assignments, and reviews open-ended work.
- **Maintainer**: validates content, operates migrations, diagnoses the toolchain, and releases the platform.

## 3. Functional requirements

### Platform and sessions

- **FR-001** The system shall start as a local process and expose the Web Adapter only on a configured loopback address by default.
- **FR-002** The system shall expose equivalent CLI operations for serving, selecting the next Activity, grading the active Activity, viewing status, and diagnosing the environment.
- **FR-003** The system shall recommend an Activity using due Reviews, unfinished work, prerequisites, Concept state, and available time.
- **FR-004** The system shall resume an unfinished Activity without overwriting Learner changes.

### Curriculum

- **FR-010** The system shall load versioned Tracks, Modules, Concepts, Activities, Projects, and Milestones from declarative content.
- **FR-011** The system shall validate content schemas, stable identifiers, versions, prerequisite graphs, references, starter files, judge specifications, hints, and Evidence policies.
- **FR-012** The system shall prevent invalid or cyclic required prerequisite graphs from entering the active catalog.
- **FR-013** The system shall render Markdown content and an allowlist of typed interactive blocks without executing arbitrary curriculum code.

### Workspace and editing

- **FR-020** The system shall initialize a Workspace from starter files without giving curriculum content write access to Learner-owned files.
- **FR-021** The Web Adapter shall support multi-file editing, revision-aware saves, and conflict reporting.
- **FR-022** The system shall create an immutable Source Snapshot for every Run and Grade.
- **FR-023** The system shall preserve Attempt history and show source differences between snapshots.

### Run and Grade

- **FR-030** A Run shall compile and execute with learner-provided input but shall not change Concept state.
- **FR-031** A Grade shall execute the configured pipeline against an immutable Source Snapshot.
- **FR-032** The Judge shall support compile contracts, public tests, private property tests, timeouts, output limits, exit-code checks, and ASan/UBSan stages.
- **FR-033** The Judge shall support function-harness, stdin/stdout, expected compile-failure, algorithm, filesystem, loopback-network, SQLite, CMake, and project-integration Activities.
- **FR-034** The Judge shall emit structured events and a categorized Judge Report without exposing private test inputs or reference solutions.
- **FR-035** The Learner shall be able to cancel an active Run or Grade.
- **FR-036** A Judge Worker failure shall not terminate the Web server or corrupt learning history.

### Learning evidence

- **FR-040** The system shall append immutable events for Activity starts, Runs, Grades, hints, reflections, Teacher Observations, Evidence changes, and content migrations.
- **FR-041** The system shall derive Concept State from Evidence and never from page completion alone.
- **FR-042** The system shall distinguish `unseen`, `introduced`, `practiced`, `demonstrated`, and `retained`.
- **FR-043** Hint usage and full-solution exposure shall reduce Attempt independence and constrain resulting Evidence.
- **FR-044** The system shall schedule Reviews using an explainable interval policy and adjust it using independence and outcome.
- **FR-045** The system shall rebuild all projections from the event log and detect duplicate Evidence ingestion.

### Teacher collaboration

- **FR-050** The system shall generate a Teacher Pack containing approved content, learner diff, public diagnostics, recent Attempts, and relevant Concept state.
- **FR-051** A Teacher Pack shall exclude private judge material and reference solutions.
- **FR-052** The AI Teacher may submit a structured Teacher Observation but shall not directly write Concept State.
- **FR-053** Open-ended design and explanation Activities may remain `pending_teacher_review` after automated checks pass.

### User experience

- **FR-060** The Web Adapter shall provide Dashboard, Lesson Workspace, Exercise Result, Review Queue, Knowledge Map, and Project views.
- **FR-061** Compile diagnostics shall map to source file, line, and column when the toolchain provides them.
- **FR-062** Judge progress shall stream to the browser without polling as the primary mechanism.
- **FR-063** Raw compiler, runtime, and Sanitizer logs shall remain available behind a progressive-disclosure control.
- **FR-064** The Dashboard shall offer time-boxed entry points and display due Reviews, active work, recent error patterns, and Project progress.

### Portability and ownership

- **FR-070** The system shall export curriculum-independent learning history and human-readable Learning Records.
- **FR-071** The system shall support backup and restoration of Workspaces, events, projections, and configuration.
- **FR-072** Platform and content upgrades shall not overwrite Learner Workspaces.

### C++ API Reference

- **FR-080** The system shall load and atomically activate versioned Reference Entries from validated declarative manifests, Markdown, and example files.
- **FR-081** The Web Adapter shall provide Reference navigation and deterministic search by exact symbol, header, title, alias, Chinese term, category, Entry kind, and C++ standard filter.
- **FR-082** A Reference Entry shall expose applicable header, namespace, standard availability, representative signatures, constraints, complexity, exception behavior, lifetime or invalidation rules, examples, related content, sources, and verification date.
- **FR-083** The system shall maintain valid links among Reference Entries and from Reference Entries to Activities using stable identifiers.
- **FR-084** Browsing, searching, and copying Reference content shall not initialize or modify an Activity Workspace, Attempt, Evidence, Concept state, Review, or Project state.
- **FR-085** Ordinary Reference examples shall be compiled by content quality gates using their declared standard and the supported warning profile.
- **FR-086** A later Reference Playground shall run selected examples through a temporary non-Activity identity without private tests or learning Evidence.
- **FR-087** Every Reference Entry shall identify factual sources and any reused material shall carry compatible license, attribution, and modification metadata.

## 4. Non-functional requirements

- **NFR-001 Locality**: default operation shall not require a cloud account or remote execution.
- **NFR-002 Security**: command arguments shall not be assembled through a shell; paths shall be confined to validated roots; server binding shall default to loopback.
- **NFR-003 Reliability**: the event log shall remain append-only and recoverable after an interrupted write; projections shall be rebuildable.
- **NFR-004 Performance**: ordinary dashboard queries should complete within 200 ms on the reference machine; Run/Grade progress shall begin streaming within one second after queue admission, excluding toolchain startup constraints.
- **NFR-005 Compatibility**: the initial supported platform is Apple Silicon macOS with C++20-capable Apple Clang; capability detection shall gate optional checks.
- **NFR-006 Maintainability**: Web, CLI, tests, and future MCP shall call the same Learning Platform Interface.
- **NFR-007 Testability**: each deep Module shall be testable through its Interface using production and test Adapters where behavior varies.
- **NFR-008 Observability**: each command, job, Attempt, and event shall carry correlation identifiers; logs shall not contain private judge inputs by default.
- **NFR-009 Accessibility**: primary Web flows shall be keyboard operable and expose semantic labels; color alone shall not convey verdicts.
- **NFR-010 Privacy**: learner code and history shall remain local unless the Learner explicitly exports or enables a remote Adapter.
- **NFR-011 Reproducibility**: a Judge Report shall include activity version, judge version, toolchain fingerprint, source digest, and deterministic seed where applicable.
- **NFR-012 Content quality**: required Activities shall define objectives, prerequisites, estimated time, victory conditions, sources, hints, Evidence policy, and Review variants.
- **NFR-013 Reference performance**: for a 1,000-Entry activated catalog, warm Reference search should complete within 100 ms at p95 and Entry lookup within 50 ms on the reference machine.
- **NFR-014 Reference locality**: installed Reference navigation, search, and content rendering shall not require remote network access.
- **NFR-015 Reference maintainability**: Reference content shall use stable IDs, explicit versions, deterministic validation, original content by default, and a documented authoring workflow.

## 5. Business rules

- **BR-001** A Run never produces mastery Evidence.
- **BR-002** Reading a Lesson may produce exposure Evidence only.
- **BR-003** A public-test pass alone cannot produce `demonstrated`.
- **BR-004** Full-solution exposure prevents the same Activity Attempt from producing `demonstrated` Evidence.
- **BR-005** `retained` requires delayed Evidence from a different context or Review variant.
- **BR-006** One failed Review shortens the interval but does not erase older Evidence.
- **BR-007** Private local tests are pedagogical concealment, not an anti-cheat security control.
- **BR-008** Reading or searching Reference content never produces learning Evidence or Activity completion.
- **BR-009** Running a Reference Example is operational feedback only and cannot change Concept state or Review scheduling.

## 6. External constraints

- Browser code cannot directly invoke the native compiler; all execution crosses the local HTTP and Judge seams.
- Native execution cannot be represented as a strong sandbox.
- Linux-specific behavior requires a later Linux or container Adapter.

## 7. Acceptance

Requirement acceptance is defined in [Roadmap and Acceptance Plan](11-ROADMAP_AND_ACCEPTANCE_PLAN.md) and linked in the [Requirements Traceability Matrix](12-REQUIREMENTS_TRACEABILITY_MATRIX.md).
