# Stage 4 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-005 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- An initial Modern C++ Track containing 10 Lessons, 10 delayed Reviews, 5 synthesis Exercises, and one progressive Project with 2 Milestones: 27 Activities in total.
- Coverage from the JS/TS mental-model transition through types, functions, references, pointers, lifetime, classes, RAII, copy/move, smart pointers, STL containers/algorithms, templates/concepts, and multi-file build/test boundaries.
- Activity objectives, victory conditions, primary/reference sources, typed interactive blocks, print fallbacks, reference files, and known-incorrect mutation fixtures in the versioned content contract.
- A real content release gate that compiles every starter and Grades every reference and mutation with the native Clang Judge. It rejects already-solved starters and invalid starter executions. Private and solution material remains outside the public Activity Catalog response.
- A serialized, version-aware Workspace migration that adds newly introduced starter files while preserving all Learner edits and incrementing the optimistic revision. Project Milestones share one persistent Workspace identity.
- A public Activity Catalog query and Web Track grid. Lesson, Exercise, Review, and Project Milestone cards open the shared local Workspace.
- Three controlled local Reference units for Modern C++ mental models, ownership/lifetime, and build/test/debug, plus an interactive stepper for every declared learning block and deterministic print fallbacks.

## 2. Curriculum release inventory

| Kind | Count | Representative capability |
|---|---:|---|
| Lesson | 10 | Modern C++ language and engineering mental models |
| Exercise | 5 | Cross-Concept executable synthesis |
| Review | 10 | Delayed retrieval and transfer |
| Project Milestone | 2 | One persistent CLI data manager evolved from formatter to record store |

Every Lesson has a linked delayed Review. Exercises reuse the applicable Review variant, and both Project Milestones link to applicable Reviews. Every Activity declares two graded hints before the explicitly confirmed complete solution.

## 3. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Required content passes lint and reference checks | `npm run check:content` validates 27 manifests, 27 unsolved starters, and 27 reference implementations with Clang | Passed |
| Incorrect solutions exercise intended failure categories | The same gate Grades 27 mutation fixtures across compile, public, private, runtime, and Sanitizer failures | Passed |
| Every core Concept has Evidence policy and delayed Review | Catalog graph validation plus `T-CONTENT-006` release inventory | Passed |
| Existing Workspaces survive content upgrades | `T-WORK-001` serializes concurrent migration/save, preserves edited `main.cpp`, adds `support.cpp`, and advances the revision | Passed |
| Public catalog excludes private authoring material | HTTP and Web `T-CONTENT-006` contract tests prove `referenceFiles` are absent | Passed |
| Browser can enter the expanded Track | `T-E2E-001/T-E2E-005` loads the Track catalog and completes the real-Clang learning loop | Passed |

Reproduce the gates with:

```bash
npm run check
npm run test:e2e
```

## 4. Content safety and migration

Activity JSON remains declarative: it selects fixed Judge capabilities and cannot execute shell hooks. Reference and mutation source is local authoring material consumed only by the content gate. The public catalog exposes IDs, kinds, titles, time estimates, Concepts, and prerequisite IDs; lesson details expose learner-facing content but not reference files or private test values.

Workspace state records the content version. On an upgrade, existing files win byte-for-byte; only missing starter paths are added. Migration, open, snapshot, and save are serialized by persistent Workspace identity, and the revision advances so stale browser saves cannot overwrite migrated state. The two CLI data manager Milestones deliberately share that identity, proving that the second increment extends rather than replaces Learner work.

## 5. Known limitations

- Interactive blocks provide a generic stepper and deterministic print fallback; specialized lifetime, memory, and build-graph visualizations remain later UI enhancements.
- The Project has two independently verifiable Milestones sharing one Workspace. Later milestones add disk persistence, commands, tests, and CMake/CTest without replacing the Learner's files.
- Native Judge compilation covers multi-file translation units, while a dedicated CMake/CTest Judge profile remains part of the next engineering expansion.
- Prerequisite IDs are visible in the catalog, but locked/unlocked navigation and explicit `introduced` exposure events remain future learning-policy work.
- Source links are schema-validated URLs but are not fetched during offline CI; the platform remains usable without network access.

## 6. Next controlled increment

Stage 5 adds deterministic algorithms and systems labs: property-generated cases, complexity and relative performance checks, files/processes/threads, loopback networking, SQLite fixtures, and CMake/CTest workflows.
