# Stage 3 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-004 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- Versioned, ordered hint disclosures with durable pre-return recording, Activity-scoped Attempt IDs, explicit full-solution confirmation, `independent`/`assisted`/`solution_exposed` classification, and a compensating Review after solution exposure.
- Required reflection prompts and immutable local reflection events.
- Evidence and Concept-state events with supporting IDs and human-readable transition explanations for `practiced`, `demonstrated`, and `retained`.
- Explainable Review scheduling, due-Review selection, independent delayed Review promotion, and shorter retry intervals without erasing prior Evidence.
- Teacher Packs containing approved lesson/rubric context, learner diffs, public diagnostics, recent Attempts, and Concept explanations while excluding solution hints and private Judge material.
- Validated Teacher Observations that cannot assign state directly. Activities requiring qualitative review return `pending_teacher_review`; the rules engine may combine an applicable observation with independent automated Evidence and reflection.
- Atomic checksummed JSONL event batches, transactional and rebuildable SQLite projections, persistent command replay, Attempt inspection, Knowledge Map, and Review Queue queries.
- Shared HTTP, CLI, and Web adapters. The Web workspace supports hints and reflection; the dashboard exposes scheduled Reviews and an explainable Knowledge Map.
- A first delayed Review variant, `source-to-program-review`, with separate starter code and Judge Profile.

## 2. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Full-solution exposure cannot create `demonstrated` | `T-LEARN-003` reveals the solution with confirmation, passes reflection/private Grade, and remains `practiced` | Passed |
| Public-only pass remains `practiced` or lower | `T-LEARN-003` requires a passing private stage before demonstration | Passed |
| Independent delayed Review can create `retained` | `T-LEARN-008` starts from demonstrated Evidence, waits past the scheduled instant, and passes a separate Review variant independently | Passed |
| Every state transition is explainable and evidence-linked | `T-LEARN-003`, `T-LEARN-008`, Knowledge Map contract tests, and `concept.state.changed` projection assertions | Passed |
| Ordered assistance is recorded before disclosure | `T-LEARN-004` verifies order, pre-return append, and explicit solution confirmation | Passed |
| Teacher input cannot write state directly | `T-TEACH-003` accepts/rejects rubric-scoped observations and verifies observation-only state isolation | Passed |
| Open-ended work can remain pending | `T-TEACH-004` verifies `pending_teacher_review`, followed by rule-derived demonstration only after applicable qualitative Evidence | Passed |
| Teacher Pack excludes private and solution material | `T-TEACH-001/T-TEACH-002` injects private sentinels and a solution marker and proves neither crosses the pack boundary | Passed |
| Stage 3 history survives rebuild | `T-RECORD-002` compares pre-rebuild and restarted projections for Evidence, state, and Review schedule | Passed |
| One learning action cannot leave partial derived history | `T-RECORD-002` verifies a multi-event action occupies one checksummed JSONL line; `T-LEARN-003/T-TEACH-003` verify Grade and Teacher Observation batches and restart replay | Passed |
| Browser completes the explainable loop | `T-E2E-001/T-E2E-005` uses Chromium and real Clang for reflection, Grade, Knowledge Map, and Review Queue | Passed |

Reproduce the controlled gates with:

```bash
npm run check
npm run test:e2e
```

## 3. Deterministic learning policy

The Learning Platform is the only owner of state transitions. A successful Grade always requires immutable Judge Evidence. Demonstration additionally requires a private-stage pass, required reflection, sufficient independence, and—when declared—an applicable Teacher Observation. Solution exposure caps that Attempt at `practiced`. Retention requires a different Review Activity after its scheduled due time and the same independent/private/reflection constraints.

State never decreases. Both the policy engine and Learning Record projection reject regressions. A failed Review records negative Evidence and schedules an earlier retry; prior demonstrated or retained Evidence remains visible. The Knowledge Map shows the latest state explanation and supporting Evidence identifiers rather than an opaque mastery score.

## 4. Privacy and trust boundary

Hints, reflection text, learner source, and Teacher Observations remain local unless the Learner explicitly exports data. Normal logs contain identifiers and summaries, not those payloads. Teacher Pack creation is an explicit local action and filters private Judge stages before building its diagnostic view. Teacher observations are untrusted qualitative inputs validated against an existing Attempt and the content-authored rubric.

## 5. Known limitations

- Review intervals use a deterministic authored day count and half-interval retry; adaptive spaced-repetition tuning is deferred until more curriculum and learner history exist.
- The initial Knowledge Map is a list-oriented projection; graph edges and prerequisite visualization arrive with the larger Stage 4 curriculum.
- Explicit Activity-start exposure and the `introduced` Concept-state UI are not yet emitted; the current first durable state is `practiced`. This lifecycle step is required before the Stage 4 curriculum expands prerequisite navigation.
- Teacher Packs are returned as local structured payloads. A file adapter and optional MCP/AI-provider adapter remain future seams.
- Teacher Observation text is retained in the learner-owned event log; field-level deletion is intentionally unavailable in the append-only model and requires a future privacy redaction workflow.
- The project currently contains one introductory Activity and one Review variant. Stage 4 expands this to the first complete Modern C++ curriculum release.
- Project View and project-level progress remain Stage 6 deliverables; Stage 3 exposes attempt history, the Knowledge Map, and Review Queue.
- Node.js still reports `node:sqlite` as experimental, and the lazy Monaco bundle retains the documented non-blocking size warning.

## 6. Next controlled increment

Stage 4 publishes the first coherent Modern C++ curriculum: 10–12 Lessons, 15–20 Exercises/Review variants, one progressive Project, reference material, mutation fixtures, and delayed Review coverage for every core Concept.
