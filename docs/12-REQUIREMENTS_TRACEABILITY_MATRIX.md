# Requirements Traceability Matrix

| Field | Value |
|---|---|
| Document ID | RTM-001 |
| Version | 2.3 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-06 |

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
| FR-060, FR-061 | ARCH §2; IC §2 | T-E2E-001 primary views; T-E2E-002 diagnostic mapping | Stage 1–5.1 |
| FR-062, FR-063 | IC §3; DD §7 | T-CONTRACT-002 SSE/replay; T-E2E-003 raw-log disclosure | Stage 1–2 |
| FR-064 | DD §2; Roadmap Stage 1 | T-E2E-004 dashboard session entry and summaries | Stage 1–5.1 |
| FR-070, FR-071 | DATA §10; DEVOPS §6 | T-DATA-001 export; T-DATA-002 backup/restore | Stage 2 |
| FR-072 | DD §4; CJS §4 | T-WORK-006 content upgrade preservation | Stage 2–4 |
| FR-080, FR-083 | REF-DES §4–7, §13; DD §11 | T-REF-001 schema/catalog activation; T-REF-002 relationship/navigation integrity | Stage 6.2 |
| FR-081, FR-082 | REF-DES §8–10 | T-REF-003 deterministic search/filters; T-REF-005 query contracts; T-REF-006 Reference browser flow | Stage 6.2 |
| FR-084 | REF-DES §11 | T-REF-007 no Workspace, record, or Evidence mutation | Stage 6.2 |
| FR-085 | REF-DES §12; REF-AUTH §7 | T-REF-004 declared-standard example compilation | Stage 6.2 |
| FR-086 | REF-DES §12; REF-PLAN §7 | T-REF-009 Playground identity, bounded execution, cancellation, isolation, and cleanup | Stage 6.2 Phase 4 |
| FR-087 | REF-DES §14; REF-AUTH §9 | T-REF-010 source, attribution, and reused-material policy | Stage 6.2 |

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
| NFR-009 | TQP §6 | T-A11Y-001 keyboard and semantic-label critical flow | Stage 1–5.1 |
| NFR-010 | SEC §5 | T-PRIV-001 no-remote-traffic default; export consent | Stage 1–2 |
| NFR-011 | DD §5; DATA §4 | T-JUDGE-008 report reproduction metadata | Stage 2 |
| NFR-012 | CJS §10 | T-CONTENT-005 required-field and Review coverage | Stage 1–4 |
| NFR-013 | REF-DES §9, §16; TQP §6 | T-REF-PERF-001 1,000-Entry warm search and lookup benchmark | Stage 6.2 |
| NFR-014 | REF-DES §10, §15; TQP §6 | T-REF-008 offline production serving and outbound-request block | Stage 6.2 |
| NFR-015 | REF-AUTH §2–10; AUTHOR-TOOLS §4–10; TQP §4 | T-REF-001 schema/version checks; T-REF-010 source/attribution checks; T-AUTH-001 deterministic authoring profiles; T-AUTH-SCHEMA-001 authoring artifact contracts; T-AUTH-A1-CHECK-001 draft checks; T-AUTH-A1-FS-001 confined persistence; T-AUTH-A1-NATIVE-001 example execution; T-AUTH-A1-CLI-001 operator flow | Stage 6.2–6.3 |

## 4. Business-rule traceability

| Requirements | Design owner | Planned verification | Delivery stage |
|---|---|---|---|
| BR-001, BR-002 | SRS §5; CJS §9 | T-LEARN-006 Run/reading Evidence limits | Stage 1–3 |
| BR-003, BR-004 | CJS §9 | T-LEARN-007 public-only and solution-exposure limits | Stage 3 |
| BR-005, BR-006 | DATA §6; CJS §9 | T-LEARN-008 retained/delayed Evidence; review failure policy | Stage 3 |
| BR-007 | SEC §4; CJS §8 | T-SEC-002 private-test concealment wording and redaction | Stage 2 |
| BR-008 | REF-DES §11; SRS §5 | T-REF-007 read/search/copy learning-state isolation | Stage 6.2 |
| BR-009 | REF-DES §12; SRS §5 | T-REF-009 Reference Example Run evidence isolation | Stage 6.2 Phase 4 |

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

## 12. Executable Stage 5.1 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-E2E-001 | `e2e/first-learning-loop.spec.ts` opens the Track, navigates ordered Activities, and completes the real Chromium/Clang learning loop without browser errors | Passed |
| T-E2E-004 | Dashboard entry, Activity query state, direct Workspace URLs, and return-to-overview behavior | Passed |
| T-A11Y-001 | Playwright verifies keyboard skip navigation and keyboard activation for catalog filtering, Activity opening, and next-Activity navigation; semantic labels and focus states remain implementation-reviewed | Passed |
| T-UI-001 | Desktop Lesson scrolling keeps `window.scrollY` and editor position fixed; 390-pixel viewport has no document-level horizontal overflow | Passed |
| T-UI-002 | Playwright edits source, rejects browser Back, verifies the Workspace remains, then accepts Back and returns to overview | Passed |
| T-UI-003 | Playwright delays an obsolete Activity/Workspace response during rapid next navigation and verifies it cannot replace the current Workspace | Passed |

## 13. Executable Stage 6 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-CONTENT-008 | `modules/curriculum/src/curriculum.test.ts` requires 70 Activities, all Required Track career Modules, 5 coherent Projects, 11 ordered Milestones, Project/Workspace identity agreement, and a relative performance check on every final Project Milestone | Passed |
| T-JUDGE-007, T-JUDGE-008 | `scripts/check-content.ts` Grades every starter, reference, and mutation through direct or CMake/CTest profiles; all five final Project Milestones also execute same-machine relative performance checks; the Web final performs a clean Vite TSX build and mounts its React component test through the allowlisted harness | Passed |
| T-CONTENT-009 | Engineering diagnostics CTest executes warnings-as-errors, a disposable two-commit `git bisect run`, and profile/bisect artifact checks; the delayed Review compiles the revised candidate and verifies concrete code-review findings and closure evidence | Passed |
| T-CONTENT-010 | Curriculum validation enforces two ordered graded hints, a final implementation-specific solution, and private-input/output leak rejection for all Hint tiers | Passed |
| T-JUDGE-009 | Judge tests bound runtime-tool preflight, persist Node/Git/Web dependency fingerprints, and classify a missing declared tool as `judge_system_error` before configure | Passed |
| T-E2E-001, T-E2E-004 | `e2e/first-learning-loop.spec.ts` verifies the 70-Activity catalog, five Project cards, Project-to-Workspace navigation, and the existing real Chromium/Clang learning loop | Passed |
| T-LEARN-002 | `progress.get` returns persisted Evidence with its source Activity ID, and the Project view counts only passing evidence from that Project's Milestones | Passed |
| T-DATA-001 | `modules/learning-record/src/learning-record.test.ts` round-trips a Project `PORTFOLIO.md` and learning history through a checksummed archive while excluding a private-Judge sentinel outside learner roots | Passed |
| T-UI-004 | Playwright verifies narrow-screen Project anchor visibility, zero horizontal overflow, Project-to-Workspace navigation, and distinct network/lifetime interactive traces | Passed |

## 14. Executable Stage 6.1 evidence

| Test ID | Executable evidence | Status |
|---|---|---|
| T-EDITOR-001 | `apps/web/src/cpp-format.test.ts` verifies deterministic C++ formatting, literal/comment and literal-suffix preservation, `for`-header handling, ordinary and ternary-expression `switch` labels, unary operators, inline scalar/aggregate/container list initialization, block-brace classification, idempotence, and source-path detection | Passed |
| T-WORK-001 | `modules/workspace/src/workspace.test.ts` verifies the immutable starter baseline remains distinct from saved learner files and follows the current Activity version | Passed |
| T-UI-005 | Playwright verifies formatted starter presentation, active-file Format, confirmed Reset, and buffer-only persistence messaging in the real Monaco editor | Passed |
| T-E2E-006 | `apps/server/src/config.test.ts`, the dedicated E2E composition root, and `e2e/first-learning-loop.spec.ts` verify explicit temporary storage roots and a pristine revision-zero starter without reading or mutating default learner data | Passed |

## 15. Planned Stage 6.2 evidence

| Test ID | Planned executable evidence | Status |
|---|---|---|
| T-REF-001 | `packages/reference-schema/src/reference-schema.test.ts` rejects unsupported standards and schema drift; `modules/reference/src/reference.test.ts` independently covers duplicate IDs/slugs, full-catalog activation, activation duration, confined paths, and content/catalog symlink escape | Passed |
| T-REF-002 | `modules/reference/src/reference.test.ts` independently rejects unknown relationships, invalid redirects, and category cycles; `apps/server/src/composition.test.ts` validates Activity-to-Reference integration | Passed |
| T-REF-003 | `modules/reference/src/reference.test.ts` covers exact symbol/header/title/alias/Chinese/heading ranking, explicit symbol prefixes, positive filters, local verification, standard availability intervals, and stable tie-breaking | Passed |
| T-REF-004 | `npm run check:reference` compiles and runs release examples under their declared standard and warning profile | Passed |
| T-REF-005 | `apps/server/src/server.test.ts` exercises bootstrap readiness, Reference navigation/search/resolve/detail, repeated scalar query rejection, and 400/404/503 responses through real Fastify injection | Passed |
| T-REF-006 | `e2e/reference-browser.spec.ts` covers symbol/header/Chinese search, URL-backed category filters, canonical and historical slugs, replacement history, unobscured mobile anchors, keyboard navigation, bidirectional Activity links, status semantics, and 390-pixel layout | Passed |
| T-REF-007 | `e2e/reference-browser.spec.ts` snapshots an Activity Workspace and Dashboard before/after browsing and copying, while also asserting that the browser emits no non-GET request | Passed |
| T-REF-008 | `npm run test:e2e:production` serves the real Vite `dist` through Fastify, opens a deep Reference URL, and aborts every non-loopback browser request; the build emits a lazy Reference chunk | Passed |
| T-REF-009 | Runner, HTTP, Web API, and browser tests cover fixed-profile temporary execution, compatible standard flags, lifecycle errors and cleanup, strict input, active-ID conflict, single-run admission, HTTP cancellation, compile/runtime/timeout/output-limit outcomes, reset/discard, 390-pixel layout, Entry-isolated editor state, and unchanged Dashboard state | Passed |
| T-REF-010 | `packages/reference-schema/src/reference-schema.test.ts` and release activation require a primary source and complete attribution for reused material | Passed |
