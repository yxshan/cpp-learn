# Stage 6 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-008 |
| Version | 1.3 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- Expanded the validated Track from 42 to 70 Activities.
- Added ten career Modules with delayed Reviews: network service design, persistence/query plans, concurrent task queues, production readiness, modern optional/variant/ranges vocabulary, Git/static-analysis/profiling diagnostics, virtual memory/Linux tools, UDP/non-blocking event loops, caching/PostgreSQL boundaries, and deadlock/memory-model reasoning.
- Added four two-Milestone career Projects beside the existing three-Milestone CLI data manager, producing five Projects and eleven persistent Milestones in total.
- Added explicit, schema-validated Project metadata. A Project ID, title, outcome, Milestone sequence, count, and Workspace persistence identity must agree before the Curriculum can load.
- Added a Project overview that groups Milestones, opens the shared Workspace, and counts only passing evidence produced by that Project's own Activities for linked Concepts.
- Upgraded lesson trace blocks from plain fallback text to type-specific network-flow, lifetime/memory, and algorithm step visualizations while retaining the deterministic print fallback.
- Added starter/reference/mutation validation for every Activity, including clean CMake/CTest builds and same-machine relative performance checks on all five final Project Milestones.
- Made the engineering-diagnostics pair executable: the Lesson runs warnings-as-errors, creates an isolated two-commit Git history, executes `git bisect run`, and validates profiling/bisect artifacts; its delayed Review is a concrete code-review lab with three findings, a request-changes decision, focused regression tests, and profile evidence.
- Replaced generic final disclosures in the twelve newly added Required Track Activities with implementation-specific complete solutions while retaining private-input leak validation and compensating Review scheduling.
- Preserved the CLI entry point and all existing Web learning-loop, Review, persistence, and browser-history behavior.

## 2. Project release matrix

| Project | Milestones | Production evidence |
|---|---:|---|
| Modern C++ CLI data manager | 3 | Multi-file model, persistent Workspace, library/application/test target separation, clean CMake/CTest, ingest benchmark, failure retrospective |
| Local log index | 2 | Status-query invariant, CMake/CTest packaging, relative scan benchmark, boundary-regression retrospective |
| C++ HTTP service | 2 | Real loopback HTTP sockets, concurrent clients, SQLite request metrics, relative load benchmark, rollback evidence |
| Concurrent task queue | 2 | Four fixed workers, mutex/condition-variable queue, stop-admission/drain/join state machine, exact-once CTest, relative batch benchmark, shutdown-failure retrospective |
| Web and C++ service contract | 2 | Pinned frontend package/config, clean Vite TSX production build, server-rendered React component mount test, executable TypeScript decoder, real loopback C++ HTTP endpoint, SQLite prepared query and metrics, relative producer benchmark, compatibility retrospective |

The Portfolio checks verify the presence of reproducible build, test, benchmark, and retrospective identifiers. The reference solution is also executed through the real build, CTest, integration, private-test, and relative-performance pipeline. Qualitative completeness remains governed by each Activity's Teacher Rubric and required reflection.

## 3. Acceptance evidence

| Acceptance condition | Evidence | Result |
|---|---|---|
| The Required Track has no known topic gap | Twenty career Lesson/Review Activities cover modern vocabulary, engineering tools, virtual memory, TCP/UDP and event loops, SQL/cache/PostgreSQL boundaries, concurrency/memory model, production, incident, and interview material | Passed |
| Engineering diagnostics and code review are executable | The diagnostics Lesson runs strict compile analysis, a disposable Git bisect fixture, and profile/bisect artifact checks; the Review compiles and tests a corrected candidate plus a machine-checked review record | Passed |
| Five coherent Projects are published | `T-CONTENT-008` checks 5 Project IDs, 11 ordered Milestones, and matching persistence IDs | Passed |
| Projects are reproducible | Content gate Grades unsolved starters, passing references, and known-bad mutations; all final Project Milestones use clean CMake, named targets, CTest, integration tests, and relative performance. The Web final also performs a clean Vite production build and mounts `App.tsx` through its component test | Passed |
| Runtime-dependent Grades are reproducible | Bounded preflight records Node/Git versions and the Web harness SHA-256 with pinned Vite/React versions in the Judge Report; unavailable declared capabilities stop as system errors before configure | Passed |
| Full-solution disclosure is meaningful | Curriculum validation confirms each new Activity has two graded hints followed by an implementation-specific solution and that no tier exposes private Judge values | Passed |
| Project evidence traces to Concepts | `progress.get` returns lightweight persisted Evidence records; Project cards filter passing records by their own Milestone Activity IDs | Passed |
| Portfolio history exports without private Judge definitions | `T-DATA-001` restores one Project's `PORTFOLIO.md`, matching Grade and matching Concept Evidence from the checksum archive, while proving an adjacent private sentinel is absent | Passed |
| Advanced visualization improves comprehension | Network nodes, lifetime/memory timelines, and algorithm steps have distinct semantics and completed/current state; Playwright exercises multiple variants | Passed |

## 4. Reproducible verification

Run the repository gates from the project root:

```bash
npm run check
npm run test:e2e
```

`npm run check` validates documentation links and traceability, the 70-Activity catalog, all starter/reference/mutation Judge fixtures, formatting, lint, TypeScript, module/contract tests, and the production Web build. The content gate also invokes trusted Git and Web-frontend capabilities only for Activities that declare them. Playwright uses the built Web app, local server, Chromium, and the real Clang Judge for the complete learning loop and Project overview.

## 5. Privacy, migration, and rollback

- Project source and Portfolio notes remain in Learner-owned Workspaces; server-side authoring data is mapped to a redacted public Activity model before it reaches HTTP clients.
- Private test payloads and expected values are redacted before reports cross the Judge boundary. The explicit backup collects only the configured learning-data and Workspace roots.
- Existing CLI Project Milestones received additive metadata without changing their stable Activity IDs or shared persistence ID.
- The Workspace upgrade path adds missing starter files without replacing Learner edits, and the existing serialization/concurrency regression suite remains authoritative.
- Rolling back the Web Project view does not alter data. Rolling back the content release leaves existing Workspaces readable because their persistence IDs and learner files are independent from the catalog.

## 6. Controlled limitations

- The platform remains a trusted, single-user local application. Native execution is not an adversarial sandbox.
- Relative benchmarks compare repeated medians on one machine; they are regression evidence, not cross-machine service-level objectives.
- The HTTP and Web integration Projects run real local loopback servers, SQLite queries/metrics, contract tests, and relative checks; they intentionally stop short of a public cloud account, PostgreSQL server, TLS certificate, or production deployment.
- Teacher Rubrics require human judgment. Automated checks prove executable and documentary structure but do not certify interview quality by themselves.
- The long-term curriculum target remains larger than this accepted release; future content expansion must pass the same schema, migration, Judge, privacy, and traceability gates.
