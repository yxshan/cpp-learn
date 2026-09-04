# Stage 6.2 Phase 3 Breadth Expansion Batch 17 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-032 |
| Version | 1.1 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-04 |

## 1. Objective

Extend the concurrency Reference with atomic-object and memory-order contracts
that distinguish indivisible access, cross-thread publication, blocking
waiting, and implementation-dependent lock-free progress.

## 2. Scope delivered

- Advanced the Reference catalog from version 16 to 17 and from 114 to 116
  Entries.
- Added `<atomic>` and `std::atomic` with four deterministic C++20 Run examples.
- Increased the catalog from 214 to 218 examples: 216 use C++20 and the two
  existing `std::expected` examples use C++23.
- Preserved the empty structural-debt baseline: 112 of 116 Entries are audited,
  with three landing Entries and one guide intentionally outside the profile.

## 3. Learning and correctness boundaries

| Entry | Primary boundary |
|---|---|
| `<atomic>` | Direct inclusion, C++20 facility/version map, legal memory orders, release/acquire publication, atomic wait/notify, flag state, initialization history, and lock-free macros |
| `std::atomic` | Type constraints, specialization capabilities, initialization, load/store/RMW returns, CAS expected mutation, wait ABA risk, lifetime/alignment, volatile deprecation, and lock-free queries |

The pages explicitly reject three common overclaims: atomicity does not create
a multi-operation transaction, relaxed access does not publish adjacent
ordinary data, and an atomic specialization is not necessarily lock-free or
faster than a mutex.

## 4. Deterministic examples

- A release store plus acquire wait publishes a fixed ordinary payload; notify
  only wakes the waiter and does not supply the synchronization edge.
- Atomic-flag state is observed in one thread without presenting a spinlock as
  a general mutex replacement.
- Two workers perform a fixed total of relaxed fetch-add operations; only the
  atomic counter is observed after join.
- Strong compare-and-exchange deterministically fails once, updates expected,
  then succeeds without relying on weak-CAS spurious behavior.
- No example polls, sleeps, measures time, prints from workers, observes
  scheduling order, or snapshots an implementation-defined lock-free result.

## 5. Source and content model

The Batch 17 research note records N3337 and N4861 baselines, current Working
Draft differences, initialization and wait/notify proposals, CAS failure-order
history, volatile deprecation, exact example output, and local Apple Clang 15
capability evidence. WG21 sources govern normative claims. cppreference Chinese
pages are secondary structure and coverage references; all prose, comparisons,
tables, and examples are project-authored.

## 6. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: version 17, 116-entry count, and two stable IDs failed before implementation, then passed |
| Batch example strict compile/run | Passed: 4/4 with `clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread` and exact stdout |
| Reference activation and quality | Passed: catalog version 17, 116 Entries, 112/116 audited, 0 reviewed gaps, no regressions |
| Complete repository check | Passed: docs, curriculum, 116-entry Reference, 218 examples, formatting, lint, types, 196 tests, and production build |
| Standards review | Accepted after direct wait/specialization/version sources were added, the P1135R6 title was corrected, and Header/Entity responsibilities were separated |
| Specification review | Accepted after initialization history, operation contracts, specialization capabilities, and C++20 CAS failure-order wording were corrected |

The review repair pass also removed a C++11-only compare-exchange restriction
that had accidentally been stated as a C++20 rule. The accepted C++20 contract
for the two-order overload forbids `release` and `acq_rel` as the failure order;
it does not retain the removed "failure no stronger than success" wording.

## 7. Controlled limitations

- `std::jthread` remains planned until the local libc++ can compile and execute
  the real C++20 stop-token contract.
- Future/task facilities remain in the three-Entry content backlog.
- `memory_order`, `atomic_flag`, `atomic_ref`, fences, and smart-pointer atomic
  specializations are mapped but do not receive independent pages in this
  two-Entry batch.
- Runtime examples do not demonstrate broken memory orders, data races,
  spinlocks, ABA failures, lock-free performance, or undefined behavior.

## 8. Rollback

Revert the two Entry directories, catalog version and stable-ID expectations,
quality baseline and contract counts, research note, backlog/index/plan
updates, and this report together. Catalog version 16 can then reactivate and
rebuild its 214-example verification cache without learner-data migration.
