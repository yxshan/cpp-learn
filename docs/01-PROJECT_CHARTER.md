# Project Charter

| Field | Value |
|---|---|
| Document ID | CHARTER-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Purpose

Build a local, Web-first C++ learning platform that turns an existing front-end developer's knowledge into modern C++ and Internet software-engineering capability. The platform must support guided lessons, executable practice, automated judging, durable learning records, spaced review, realistic projects, and AI teacher collaboration.

## 2. Business outcome

The Learner should be able to use the platform during graduate study to acquire demonstrable C++ backend and infrastructure capability suitable for internship applications. Evidence should include tested code, project milestones, explanations, performance reports, and delayed recall—not only course completion.

## 3. Product principles

- Learning effectiveness over content volume.
- Evidence over self-reported confidence.
- Web experience first; CLI remains a first-class Adapter.
- Local ownership and offline-first operation.
- Real C++ tools and engineering practices are progressively revealed.
- AI accelerates feedback but does not replace learner reasoning or objective checks.
- Content, learner work, private judge material, and records remain separate.

## 4. Scope

### In scope

- Modern C++20 career track and selected later-standard features when justified.
- Data structures and algorithms.
- Git, CMake, CTest, testing, debugging, Sanitizers, static analysis, profiling.
- Operating systems, Linux fundamentals, files, processes, threads, networking, HTTP, SQL, databases, concurrency, and performance.
- Browser editor, lesson reader, judge feedback, dashboard, review queue, knowledge map, and project milestones.
- Local event history, rebuildable projections, export, and backup.
- Native macOS judge plus later optional Linux/container Adapter.

### Out of scope for the initial product

- Multi-user accounts, cloud synchronization, public hosting, billing, and leaderboards.
- Formal exam anti-cheat guarantees.
- Arbitrary untrusted code sandboxing.
- SSR, SEO, and mobile-first code editing.
- Embedded systems and hardware development as a required track.

## 5. Stakeholders

- **Learner**: owns goals, code, history, and final decisions.
- **AI Teacher**: proposes activities, hints, reviews, and observations through controlled interfaces.
- **Project Maintainer**: owns architecture, content quality, migrations, and release acceptance.
- **Future Content Author**: adds versioned Activities under content contracts.

## 6. Success measures

- A complete Web flow exists from dashboard to Grade and recorded Evidence.
- Web and CLI return equivalent results for the same command and source snapshot.
- Records survive restart and can rebuild all projections.
- Every required Concept has an explicit Evidence policy and at least one Review variant.
- Core content passes automated content lint and reference-solution checks.
- The Learner completes staged Projects with reproducible builds, tests, and explanations.

## 7. Constraints and assumptions

- Development environment is initially Apple Silicon macOS with Node, npm, Apple Clang, CMake, Git, and Python available.
- The platform runs for one trusted local Learner and listens only on loopback by default.
- Current development may proceed before formal study begins, but delivery is gated by verifiable capabilities rather than elapsed time.
- Internet C++ work commonly requires Linux; Linux verification must be added before claiming production-equivalent system coverage.

## 8. Governance

- The SRS owns externally observable requirements.
- ADRs own hard-to-reverse decisions.
- The traceability matrix links requirements, design, tests, and delivery stages.
- Archived proposals are historical context and cannot override the baseline.

