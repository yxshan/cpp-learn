# Stage 6.2 Phase 3 Breadth Expansion Batch 19 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-034 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

## 1. Objective

Complete the controlled 120-Entry Reference catalog with `std::jthread`, while
verifying its real C++20 stop-token contract on a capable local standard
library and keeping the verification fingerprint consistent in every adapter.

## 2. Scope delivered

- Advanced the catalog from version 18 to 19 and from 119 to 120 Entries.
- Added one learning-quality `std::jthread` type page and two deterministic
  C++20 Run examples, increasing the catalog from 224 to 226 examples.
- Raised the structural audit from 115/119 to 116/120 with zero known gaps.
- Added a Reference compiler selector: `CPP_LEARN_REFERENCE_COMPILER`
  overrides an installed Homebrew LLVM preference, with `/usr/bin/clang++` as
  fallback; explicit paths must be absolute and exist.
- Kept that selection shared by Reference verification, coverage reporting,
  and server composition so cached results remain fingerprint-bound, while the
  native Judge retains its Apple Clang integration baseline.

## 3. Learning and correctness boundaries

The page distinguishes a stop request from forced termination and from join.
It covers token-first callable selection, decay-copied parameters, ignored
return values, uncaught worker exceptions, one-shot stop state, callback cost,
destructor request-then-join order, move-assignment blocking, detach lifetime
risk, join and stop synchronization, wrapper thread safety, unspecified
complexity, and the difference between `joinable()` and `stop_possible()`.

The JavaScript comparison uses AbortController/AbortSignal, Worker, Promise,
and `await` only as learner bridges. It explicitly rejects equivalence between
`request_stop()` and `Worker.terminate()`, and between blocking `join()` and
event-loop-friendly `await`.

## 4. Deterministic examples

- `request-cooperative-stop.cpp` uses an atomic wait/notify handshake, observes
  the first and repeated `request_stop()` results, joins, and prints only from
  the main thread.
- `stop-and-join-on-destruction.cpp` proves that scope exit requests stop and
  waits before the main thread observes the worker result.
- Neither example sleeps, measures time, prints thread IDs or scheduling order,
  emits worker output, detaches, or relies on implementation-defined text.

## 5. Toolchain capability

The real `jthread` plus `stop_token` probe fails on Apple Clang 15 with the
system libc++, and succeeds under strict C++20 with Homebrew LLVM 22.1.6 and
GCC 15.2.0. The release uses the installed Homebrew LLVM rather than masking
the missing library feature with a `std::thread` fallback or an empty probe.

## 6. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: version 19, 120-entry count, and `std-jthread` failed before implementation, then passed |
| Toolchain selection tests | Passed: validated absolute override, missing/relative rejection, Homebrew LLVM discovery, and system fallback |
| Batch example cross-check | Passed with Homebrew LLVM 22.1.6 and GCC 15.2.0 under strict C++20 with exact stdout |
| Reference activation and quality | Passed: catalog version 19, 120 Entries, 116/120 audited, zero reviewed gaps |
| Complete repository check | Passed: docs, 70 curriculum cases, 120-entry Reference, 226 examples, formatting, lint, types, 198 tests, and production build |
| Standards review | Pending |
| Specification review | Pending |

## 7. Controlled limitations

- `std::stop_token`, `std::stop_source`, and `std::stop_callback` remain mapped
  within the page rather than receiving independent Entries.
- The page does not cover stop-aware condition-variable overloads, thread
  attributes from later standards, thread pools, coroutines, or sender/receiver.
- Automatic toolchain discovery checks conventional Homebrew LLVM paths; other
  installations use `CPP_LEARN_REFERENCE_COMPILER`.
- Cooperative stopping cannot guarantee prompt exit from arbitrary blocking
  work, and no example claims such a guarantee.

## 8. Rollback

Revert the `std-jthread` directory, reciprocal related links, catalog version
and stable-ID expectations, quality baseline, compiler selector and tests,
research note, plan/backlog/index/operations updates, and this report together.
Catalog version 18 can then rebuild its 224-example verification cache.
