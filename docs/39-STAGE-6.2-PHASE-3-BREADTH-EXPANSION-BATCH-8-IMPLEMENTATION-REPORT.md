# Stage 6.2 Phase 3 Breadth Expansion Batch 8 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-023 |
| Version | 1.1 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-09-01 |

## 1. Objective

Complete the planned callable and heterogeneous-value vocabulary without
flattening C++11, C++17, C++20, and C++23 into one misleading version. The
batch teaches product, sum, runtime value erasure, explicit result, and
callable erasure as separate design choices.

## 2. Scope delivered

- Advanced the Reference catalog from version 7 to 8 and from 66 to 71 Entries.
- Added `std::tuple`, `std::variant`, `std::any`, `std::expected`, and
  `std::function`.
- Added ten deterministic Run examples, increasing the catalog from 118 to 128
  examples: 126 use C++20 and the two `std::expected` examples use C++23.
- Added a tested manifest-standard-to-compiler-flag probe that prefers the
  canonical spelling and lets Apple Clang 15 fall back from `c++23` to its
  supported `c++2b` spelling.
- Preserved the empty structural-debt baseline: 67 of 71 Entries are audited,
  with three landing Entries and one guide intentionally outside the profile.

## 3. Learning boundaries

| Entry | Primary boundary |
|---|---|
| `std::tuple` | Fixed heterogeneous product; CTAD does not reproduce `make_tuple(std::ref(...))` reference unwrapping |
| `std::variant` | Finite tagged alternatives; exceptions may, but do not always, produce valueless state |
| `std::any` | Exact runtime type matching; small-object optimization has no portable threshold guarantee |
| `std::expected` | C++23 synchronous value/error result; monadic operations are C++23 while `has_error()` is later |
| `std::function` | Copyable callable erasure; empty calls throw and reference captures/returns retain lifetime hazards |

## 4. Source and content model

The Batch 8 research note records N3337, N4659, N4861, N4950, current Working
Draft anchors, original WG21 proposals, compiler probes, version guards,
manifest-ready source matrices, and exact example output. cppreference remains
a secondary information-architecture and coverage reference; all prose and
examples are project-authored.

## 5. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: version 8 and five stable IDs failed before implementation, then passed |
| Compiler flag RED/GREEN test | Passed: probes canonical `c++23`, falls back to `c++2b`, and reports no supported spelling |
| Reference activation | Passed: catalog version 8, 71 Entries |
| Reference quality ratchet | Passed: 67/71 audited, 0 reviewed gaps, no regressions |
| Example verification | Passed: 128 total examples; 126 C++20 and 2 C++23 |
| Focused tests | Passed: 43 tests across Reference, quality, verification, and CLI contracts |
| Complete repository check | Passed: docs, curriculum, 71-entry Reference, 128 examples, formatting, lint, types, 196 tests, and production build |
| Standards review | Passed against `c53252d...3934e37`; no remaining standard violation or smell finding |
| Spec review | Passed against `c53252d...3934e37`; scope, versions, counts, and acceptance behavior match |

The initial reviews found imprecise tuple assignment lifetime wording, an
over-broad variant default-construction condition, incomplete expected
declarations and template constraints, a fixed rather than probed compiler
flag alias, and an over-specific function dispatch description. Commits
`4d5953f` and `3934e37` resolve all findings; `3934e37` is the reviewed fixed
point recorded by the zero-debt quality baseline.

## 6. Controlled limitations

- Pages present representative learner-visible interfaces, not copied complete
  synopses.
- `std::expected` is not backported to C++20 and no third-party polyfill is
  presented as the standard facility.
- Examples do not depend on variant becoming valueless, any allocation choices,
  unspecified moved-from states, dangling references, or implementation type
  names.
- `variant::visit` member, `expected::has_error()`, and other post-baseline
  facilities are mentioned only as version guards.

## 7. Rollback

Revert the five Entry directories, catalog version and relationships, compiler
flag mapping and its test, version contract tests, research note, backlog/index
updates, and this report together. Catalog version 7 can then reactivate and
rebuild its 118-example verification cache without learner-data migration.
