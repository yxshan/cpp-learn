# Stage 6.2 Phase 3 Breadth Expansion Batch 7 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-022 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Last updated | 2026-08-31 |

## 1. Objective

Deliver the foundational `<utility>` vocabulary at the existing zero-debt
learning-quality baseline. The batch teaches value-category conversion,
perfect forwarding, ADL-aware exchange, and binary value semantics without
mixing in the range `std::move` algorithm or post-C++20 overloads.

## 2. Scope delivered

- Advanced the Reference catalog from version 6 to 7 and from 61 to 66 Entries.
- Added `<utility>`, `std::move`, `std::forward`, `std::swap`, and `std::pair`.
- Added ten deterministic C++20 Run examples, increasing the catalog from 108
  to 118 examples.
- Preserved the empty structural-debt baseline: 62 of 66 Entries are audited,
  with three landing Entries and one guide intentionally outside the profile.
- Updated catalog-level and CLI version contracts for the rebuildable
  verification cache.

## 3. Learning boundaries

| Entry | Primary boundary |
|---|---|
| `<utility>` | Direct include, C++98–C++20 facility versions, and navigation to entity contracts |
| `std::move` | A cast to xvalue, not an operation that moves by itself and not the range algorithm |
| `std::forward` | Forwarding-reference deduction, reference collapsing, and preservation of caller value category |
| `std::swap` | Conditional `noexcept`, array behavior, and the `using std::swap; swap(a, b);` ADL protocol |
| `std::pair` | Owning versus reference members, lexicographic comparison, CTAD, and when to prefer a named struct |

## 4. Source and content model

The 562-line Batch 7 research note records current Working Draft anchors,
C++20 N4861 declarations, historical WG21 evidence, evolution guards, example
stdout, and manifest-ready source matrices. cppreference is retained only as a
secondary information-architecture and coverage reference; prose and examples
are project-authored.

## 5. Verification record

| Gate | Result |
|---|---|
| Catalog RED/GREEN test | Passed: expected version 7 and five stable IDs failed before implementation, then passed |
| Reference activation | Passed: catalog version 7, 66 Entries |
| Reference quality ratchet | Passed: 62/66 audited, 0 reviewed gaps, no regressions |
| Example verification | Passed: 118 total C++20 examples |
| Complete repository check | Passed: docs, curriculum, 66-entry Reference, 118 examples, formatting, lint, types, 194 tests, and production build |
| Standards review | Pending |
| Spec review | Pending |

## 6. Controlled limitations

- The `<utility>` page is a reduced learning map, not a copied synopsis.
- `std::tuple`, `std::variant`, `std::any`, `std::expected`, and
  `std::function` remain separate planned Entries.
- C++23 `forward_like`, pair-like construction, and later heterogeneous pair
  comparison are mentioned only as version guards.
- Examples do not inspect unspecified moved-from strings, addresses, object
  layouts, or implementation type names.

## 7. Rollback

Revert the five Entry directories, catalog version and relationships, version
contract tests, research note, backlog/index updates, and this report together.
Catalog version 6 can then reactivate and rebuild its 108-example verification
cache without learner-data migration.
