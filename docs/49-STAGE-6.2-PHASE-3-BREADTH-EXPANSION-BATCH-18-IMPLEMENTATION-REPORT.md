# Stage 6.2 Phase 3 Breadth Expansion Batch 18 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-033 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

## 1. Objective

Extend the concurrency Reference with the C++20 future shared-state model and
the smallest standard path from a callable to a single-consumer asynchronous
result, without presenting `std::async` as a thread pool or continuation API.

## 2. Scope delivered

- Advanced the Reference catalog from version 17 to 18 and from 116 to 119
  Entries.
- Added `<future>`, `std::future`, and `std::async` with six deterministic C++20
  Run examples.
- Increased the catalog from 218 to 224 examples: 222 use C++20 and the two
  existing `std::expected` examples use C++23.
- Preserved the empty structural-debt baseline: 115 of 119 Entries are audited,
  with three landing Entries and one guide intentionally outside the profile.

## 3. Learning and correctness boundaries

| Entry | Primary boundary |
|---|---|
| `<future>` | Direct inclusion, provider/return-object/shared-state facility map, one versus multiple consumers, protocol errors, and the absence of C++20 continuation or cancellation APIs |
| `std::future` | Move-only state ownership, `valid` versus ready, one-shot `get`, all three timed-wait results, stored exceptions, broken promise, invalid-state UB, and narrowly scoped last-release blocking |
| `std::async` | Explicit/default launch policies, C++20 decay-copy, return-type formation, deferred invocation, callable exception transport, synchronization, and temporary-future blocking |

The pages reject three high-impact overclaims: a future is not necessarily a
thread, default `async` does not guarantee parallel execution, and not every
future destructor blocks or avoids blocking.

## 4. Deterministic examples

- A promise is moved to a producer thread and delivers one fixed integer; only
  the main thread prints after consuming the result and joining.
- A packaged task runs in the current thread, demonstrating that the future
  facility itself does not require a new thread.
- A string result records the future's valid state before and after one-shot
  `get`.
- An abandoned promise yields the portable `broken_promise` error code without
  snapshotting implementation-defined numbers or `what()` text.
- Explicit deferred execution reports `deferred`, preserves a decay-copied
  argument, and starts only through `get`.
- Explicit async execution stores a controlled callable exception and rethrows
  it in the consumer thread.
- No example sleeps, measures time, prints from workers, relies on default
  policy selection, or observes thread IDs or scheduling order.

## 5. Source and content model

The Batch 18 research note records N3337 and N4861 baselines, current Working
Draft differences, shared-state ownership and synchronization, N3776's release
rule, launch policies, protocol errors, C++20 decay-copy, the C++23 P0849R8
materialization wording, exact example output, and Apple Clang 15 evidence.
WG21 sources govern normative claims. cppreference Chinese pages are secondary
structure references; all prose, comparisons, tables, and examples are
project-authored.

## 6. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: version 18, 119-entry count, and three stable IDs failed before implementation, then passed |
| Batch example strict compile/run | Passed: 6/6 with `clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread` and exact stdout |
| Reference activation and quality | Passed: catalog version 18, 119 Entries, 115/119 audited, 0 reviewed gaps, no regressions |
| Complete repository check | Pending |
| Standards review | Pending |
| Specification review | Pending |

## 7. Controlled limitations

- `std::jthread` remains the sole 120-Entry candidate until the local libc++
  can compile and execute its real C++20 stop-token contract.
- `std::promise`, `std::shared_future`, `std::packaged_task`, launch/status
  enums, and future error types are mapped but do not receive independent pages.
- Argument materialization exceptions are not over-specified while LWG 3582
  remains an open wording issue.
- Runtime examples do not test default-policy selection, thread-resource
  exhaustion, timeout precision, cancellation, fire-and-forget, or UB.

## 8. Rollback

Revert the three Entry directories, catalog version and stable-ID expectations,
quality baseline and contract counts, research note, backlog/index/plan updates,
and this report together. Catalog version 17 can then reactivate and rebuild
its 218-example verification cache without learner-data migration.
