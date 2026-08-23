# Requirements Traceability Matrix

| Field | Value |
|---|---|
| Document ID | RTM-001 |
| Version | 1.4 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Purpose

This matrix links every SRS requirement group to design ownership, planned verification, and delivery acceptance. Test IDs are stable planning identifiers and become executable-test metadata during implementation.

## 2. Functional traceability

| Requirements | Design owner | Planned verification | Delivery stage |
|---|---|---|---|
| FR-001, FR-002 | ARCH §3; DD §7; IC §6 | T-PLAT-001 loopback startup; T-CONTRACT-001 Web/CLI equivalence | Stage 0–1 |
| FR-003, FR-004 | DD §2; Workspace §4 | T-LEARN-001 deterministic next selection; T-WORK-001 non-destructive resume | Stage 1–3 |
| FR-010, FR-011 | ARCH §4; DD §3; CJS §4 | T-CONTENT-001 schema/catalog validation; T-CONTENT-002 version fixtures | Stage 0–1 |
| FR-012, FR-013 | CJS §5, §10 | T-CONTENT-003 graph-cycle rejection; T-CONTENT-004 block allowlist | Stage 0–1 |
| FR-020, FR-021 | DD §4; IC §2 | T-WORK-002 idempotent init; T-WORK-003 revision conflict | Stage 1–2 |
| FR-022, FR-023 | DD §4; DATA §7 | T-WORK-004 snapshot immutability; T-WORK-005 historical diff | Stage 1–2 |
| FR-030, FR-031 | DD §5; CJS §7 | T-JUDGE-001 Run evidence isolation; T-JUDGE-002 immutable Grade | Stage 1–2 |
| FR-032, FR-033 | CJS §6–7 | T-JUDGE-003 verdict and Judge Profile suite | Stage 2–5 |
| FR-034, FR-035 | DD §5; IC §3–4 | T-CONTRACT-004 event/report adapter; T-JUDGE-004 cancellation | Stage 2 |
| FR-036 | ARCH §9; DD §5 | T-JUDGE-003 process-runner crash isolation and subsequent-job test | Stage 2 |
| FR-040, FR-041 | DD §6; DATA §2–4 | T-RECORD-001 event append; T-LEARN-002 evidence derivation | Stage 1–3 |
| FR-042, FR-043 | DATA §6; CJS §9 | T-LEARN-003 state transitions; T-LEARN-004 assistance constraints | Stage 3 |
| FR-044, FR-045 | DD §2, §6 | T-LEARN-005 review scheduling; T-RECORD-002 rebuild/idempotency | Stage 2–3 |
| FR-050, FR-051 | DD §8; SEC §4 | T-TEACH-001 Teacher Pack completeness; T-TEACH-002 redaction | Stage 3 |
| FR-052, FR-053 | DD §8; CJS §9 | T-TEACH-003 observation policy; T-TEACH-004 pending review | Stage 3 |
| FR-060, FR-061 | ARCH §2; IC §2 | T-E2E-001 primary views; T-E2E-002 diagnostic mapping | Stage 1–3 |
| FR-062, FR-063 | IC §3; DD §7 | T-CONTRACT-002 SSE/replay; T-E2E-003 raw-log disclosure | Stage 1–2 |
| FR-064 | DD §2; Roadmap Stage 1 | T-E2E-004 dashboard session entry and summaries | Stage 1–3 |
| FR-070, FR-071 | DATA §10; DEVOPS §6 | T-DATA-001 export; T-DATA-002 backup/restore | Stage 2 |
| FR-072 | DD §4; CJS §4 | T-WORK-006 content upgrade preservation | Stage 2–4 |

## 3. Non-functional traceability

| Requirements | Design owner | Planned verification | Delivery stage |
|---|---|---|---|
| NFR-001 | CHARTER §3; ARCH §3 | T-OPS-001 offline startup and core flow | Stage 1 |
| NFR-002 | SEC §4 | T-SEC-001 injection/path/origin suite | Stage 1–2 |
| NFR-003 | DATA §8 | T-RECORD-003 interrupted append/recovery | Stage 2 |
| NFR-004 | SRS §4; TQP §6 | T-PERF-001 dashboard latency; T-PERF-002 judge first event | Stage 2–3 |
| NFR-005 | ARCH §8; DEVOPS §1 | T-COMPAT-001 doctor capability matrix | Stage 0–2 |
| NFR-006 | ARCH §4, §7 | T-CONTRACT-001 Web/CLI equivalence | Stage 0–1 |
| NFR-007 | DD §1; TQP §2 | T-MODULE-001 Interface-level Module suites | Stage 0 onward |
| NFR-008 | DEVOPS §5 | T-OBS-001 correlation and log-redaction suite | Stage 1–2 |
| NFR-009 | TQP §6 | T-A11Y-001 keyboard and semantic-label critical flow | Stage 1–3 |
| NFR-010 | SEC §5 | T-PRIV-001 no-remote-traffic default; export consent | Stage 1–2 |
| NFR-011 | DD §5; DATA §4 | T-JUDGE-008 report reproduction metadata | Stage 2 |
| NFR-012 | CJS §10 | T-CONTENT-005 required-field and Review coverage | Stage 1–4 |

## 4. Business-rule traceability

| Requirements | Design owner | Planned verification | Delivery stage |
|---|---|---|---|
| BR-001, BR-002 | SRS §5; CJS §9 | T-LEARN-006 Run/reading Evidence limits | Stage 1–3 |
| BR-003, BR-004 | CJS §9 | T-LEARN-007 public-only and solution-exposure limits | Stage 3 |
| BR-005, BR-006 | DATA §6; CJS §9 | T-LEARN-008 retained/delayed Evidence; review failure policy | Stage 3 |
| BR-007 | SEC §4; CJS §8 | T-SEC-002 private-test concealment wording and redaction | Stage 2 |

## 5. Maintenance rule

No requirement is accepted until its planned verification has an executable test or an approved manual evidence record. A requirement change must update this matrix in the same change set.

## 6. Executable Stage 0 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-CONTRACT-001 | Web, HTTP, and CLI Adapter contract tests under `apps/*/src/*.test.ts` | Passed |
| T-CONTENT-001 | `modules/curriculum/src/curriculum.test.ts` | Passed |
| T-SEC-001 | `modules/workspace/src/workspace.test.ts` | Passed for Stage 0 path scope |
| T-COMPAT-001 | `modules/judge/src/judge.test.ts` and `cpplearn doctor` smoke evidence | Passed on reference macOS environment |
| T-MODULE-001 | Learning Platform and Learning Record Interface tests under `modules/*/src/*.test.ts` | Passed |

See the [Stage 0 Implementation Report](13-STAGE-0-IMPLEMENTATION-REPORT.md) for the complete gate output and explicitly deferred coverage.

## 7. Executable Stage 1 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-LEARN-001 | `modules/learning-platform/src/learning-platform.test.ts`; Activity HTTP and Web Adapter tests | Passed |
| T-CONTENT-003 | Catalog reference and prerequisite-cycle rejection in `modules/curriculum/src/curriculum.test.ts` | Passed |
| T-WORK-001, T-WORK-003, T-WORK-004 | Filesystem restart, conflict, and immutable snapshot tests in `modules/workspace/src/workspace.test.ts` | Passed |
| T-JUDGE-001, T-JUDGE-002 | Native C++20 compile/run report tests and shared Platform execution tests | Passed for Stage 1 public-output scope |
| T-RECORD-001 | JSONL append, checksum, and process-restart recovery in `modules/learning-record/src/learning-record.test.ts` | Passed |
| T-LEARN-002, BR-001, BR-002 | Run/Grade evidence-policy test in `modules/learning-platform/src/learning-platform.test.ts` | Passed |
| T-CONTRACT-002 | HTTP SSE replay and Job Report contract test in `apps/server/src/server.test.ts` | Passed |
| T-CONTRACT-001, NFR-006 | Web/HTTP and CLI Grade the same immutable Source Snapshot and compare digest/verdict | Passed |
| FR-002 CLI next | `apps/cli/src/cli.test.ts` verifies next-Activity selection through `LearningPlatform` | Passed for single-Activity Stage 1 catalog |
| T-OPS-001, NFR-001 | Integrated built-Web hosting test plus local Chromium learning-loop test | Passed |
| T-E2E-001, T-E2E-004 | `e2e/first-learning-loop.spec.ts` | Passed on reference macOS environment |

See the [Stage 1 Implementation Report](14-STAGE-1-IMPLEMENTATION-REPORT.md) for scope boundaries and exact reproduction commands.

## 8. Executable Stage 2 evidence

Stage 2 Judge, record, redaction, recovery, and backup evidence is archived in the [Stage 2 Implementation Report](15-STAGE-2-IMPLEMENTATION-REPORT.md).

## 9. Executable Stage 3 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-CONTENT-005 | Stage 3 learning metadata and Review-link validation in `modules/curriculum/src/curriculum.test.ts` | Passed |
| T-LEARN-003, T-LEARN-004 | Ordered help, solution exposure, reflection, and explainable state tests in `modules/learning-platform/src/learning-loop.test.ts` | Passed |
| T-LEARN-005, T-LEARN-008, BR-003–BR-006 | Delayed Review promotion, public/assistance caps, and failure interval policy in the Learning Platform suite | Passed |
| T-RECORD-002 | Stage 3 atomic event-batch restart, regression rejection, and equivalent SQLite projection rebuild in `modules/learning-record/src/learning-record.test.ts` | Passed |
| T-TEACH-001–T-TEACH-004 | Teacher Pack redaction, observation validation, direct-state prohibition, and pending review tests | Passed |
| T-E2E-001, T-E2E-005 | Real browser reflection → Grade → demonstrated Evidence → Review schedule in `e2e/first-learning-loop.spec.ts` | Passed |

## 10. Executable Stage 4 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-CONTENT-006 | Release scale, Activity Catalog redaction, 27 unsolved starters, 27 Clang reference solutions, and 27 mutation fixtures | Passed |
| T-WORK-001 | Version-aware Workspace upgrade preserves Learner files and adds only missing starter paths | Passed |
| T-E2E-001, T-E2E-005 | Expanded Track catalog plus real-browser/real-Clang learning loop | Passed |

## 11. Executable Stage 5 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-JUDGE-006 | Fixed-seed generated properties record seed, case index, and reproducible counterexample | Passed |
| T-JUDGE-007 | Same-machine baseline/scaled medians produce a relative performance verdict | Passed |
| T-JUDGE-008 | Declarative clean CMake configure, named application/test target build, CTest, and integration run | Passed |
| T-SYSTEM-001 | Per-Grade temporary root is removed; existing timeout/cancellation tests terminate the process group | Passed |
| T-CONTENT-007 | 42 starters, references, and mutations exercise algorithm, hash-index, POSIX, thread, loopback HTTP, SQLite, and CMake profiles | Passed |
| T-WORK-001 | CLI Project Milestones 1–3 share one persistent Workspace identity and preserve Learner files | Passed |
