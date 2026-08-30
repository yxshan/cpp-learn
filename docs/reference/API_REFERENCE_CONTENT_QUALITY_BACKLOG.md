# API Reference Content Quality Backlog

| Field | Value |
|---|---|
| Document ID | REF-BACKLOG-001 |
| Version | 1.6 |
| Status | Active |
| Owner | Project Maintainer |
| Last updated | 2026-08-30 |

## 1. Purpose

This is the controlled editorial backlog for turning the C++ Reference from a
working vertical release into a learning-quality catalog. It prevents catalog
growth from outrunning research and review. An Entry is not complete merely
because it activates, appears in search, and has a compiling example.

The target catalog contains at most 120 Entries. Every expansion batch must
upgrade or preserve the quality baseline; it may not trade away semantic depth
to increase the Entry count.

## 2. Definition of learning-quality content

An ordinary entity Entry is **learning-quality** when all applicable items are
present and source-verified:

1. A plain-language purpose and at least one explicit non-use case.
2. Header, namespace, first standard, and relevant later-version changes.
3. Representative declarations grouped by learner-visible behavior, with
   omitted overloads clearly disclosed.
4. Parameter constraints, preconditions, ownership transfer, and value
   categories that affect correct calls.
5. Return semantics, including object/reference/iterator lifetime.
6. Standard complexity and exception guarantees without invented precision.
7. Invalidation, dangling, thread-safety, and undefined-behavior boundaries
   where relevant.
8. One minimal deterministic example and one realistic deterministic example.
9. Actionable mistakes, corrected alternatives, and a JavaScript/TypeScript
   comparison only when it reduces confusion.
10. Direct primary-source citations for substantive standard facts and an
    explicit verification date.

Landing and header Entries use a reduced form: they organize discovery,
explain inclusion and scope, identify important entities, warn against
transitive includes, and link to precise entity Entries. Their brevity is not
itself a defect.

## 3. Existing-catalog audit

The active catalog contains 61 Entries. All have at least one primary source,
and all 108 examples pass the local toolchain gate. Depth still varies by
editorial role and upgrade status.

| Action | Entries | Reason |
|---|---|---|
| Completed in quality batch 1 | `std::optional`, `std::make_unique`, `std::string_view` | Rewritten to the ordinary-entity learning-quality baseline with two verified examples each |
| Completed in quality batch 2 | `<vector>`, `<array>`, `<deque>`, `<unordered_map>`, choosing a sequence container | Header facility maps, version boundaries, container decision rules, and differentiated invalidation guidance are now source-backed |
| Completed in quality batch 3 | `std::vector`, `std::vector::push_back`, `std::vector::reserve`, `std::array`, `std::deque`, `std::unordered_map`, `std::sort`, `std::find`, `std::string`, `std::unique_ptr`, `std::cin`, `std::cout` | Cleared the ordinary-entity example debt and added explicit selection guidance; later structural gaps remain tracked by the quality ratchet |
| Completed in breadth batch 4 | `std::map`, `std::set`, `std::unordered_set`, `std::queue`, `std::priority_queue`, `std::stack`, `std::transform`, `std::count_if`, `std::all_of`, `std::lower_bound`, `std::remove_if`, `std::accumulate` | Twelve directly searchable entity pages add associative containers, adaptors, and high-frequency algorithms with two verified examples each |
| Completed in breadth batch 5 | `<map>`, `<set>`, `<unordered_set>`, `<queue>`, `<stack>`, `<numeric>`, `std::binary_search`, `std::any_of`, `std::copy`, `std::reverse`, `std::unique`, `std::for_each` | Six facility maps close navigation around batch 4 and six ordinary algorithm pages define classic, policy, and ranges boundaries with verified examples |
| Completed in breadth batch 6 | `<string>`, `<string_view>`, `<charconv>`, `<memory>`, `std::string::substr`, `std::string::find`, `std::string::append`, `std::from_chars`, `std::to_chars`, `std::shared_ptr`, `std::weak_ptr`, `std::make_shared` | Four facility maps and eight ordinary pages close owning/borrowed text, low-level conversion, and shared-ownership learning loops; cppreference informs page structure while WG21 sources govern facts |
| Completed in quality-ratchet batch 7 | `std::vector`, `std::sort`, `std::find`, `std::unique_ptr`, `std::cin`, `std::cout` | Added missing mistakes, complexity, lifetime/invalidation, related-link, and JavaScript comparison coverage; all six now pass their kind profile |
| Keep concise | Standard Library, Containers, Algorithms | Landing role is primarily navigation; review links and scope instead of padding prose |

Quality batches 1 through 3 and breadth batches 4 through 6 are complete. The existing
ordinary-entity example debt remains cleared. The next batch can finish the
remaining sequence-container and algorithm candidates, or move into utility,
I/O, filesystem, or time vocabulary.

### 3.1 Executable debt baseline

The kind-aware audit currently checks 57 of 61 Entries; three landing Entries
and one guide are intentionally reviewed outside the structural profile. After
quality-ratchet batch 7, the checked-in baseline contains 43 known gaps across
27 Entries, down from the initial 58 gaps across 35 Entries.

| Remediation batch | Focus | Current gap areas |
|---|---|---|
| 8 | High-frequency algorithms | parameters, returns, complexity, lifetime |
| 9 | Containers and smart ownership | selection, JavaScript comparison, related links |
| 10 | Header navigation | direct-inclusion guidance, facility maps, related links |
| 11 | String conversion and member operations | selection, parameters, lifetime |

`reference/quality-baseline.json` is debt inventory, not an acceptance waiver.
Every remediation removes the matching baseline rows in the same change. New
Entries and materially rewritten Entries may not introduce new rows.

## 4. Planned 120-Entry catalog

The current 61 Entries remain in scope. The following 59 candidates make the
remaining catalog explicit. “Candidate” means editorially selected, not yet
fact-verified or release-ready.

### 4.1 Containers: 6 candidates

- `<list>`, `std::list`, `<forward_list>`, `std::forward_list`.
- `<span>`, `std::span`.

### 4.2 Algorithms and numeric operations: 5 candidates

- `std::move` (algorithm), `std::count`, `std::none_of`.
- `std::rotate`, `std::remove`.

### 4.3 Strings and conversion: completed

The selected strings and conversion slice was delivered in breadth batch 6.

### 4.4 Memory: 4 candidates

- `std::enable_shared_from_this`, `std::allocator`.
- `std::uninitialized_copy`, `std::destroy`.

### 4.5 Utilities and callable objects: 10 candidates

- `<utility>`, `std::pair`, `std::tuple`, `std::variant`, `std::any`.
- `std::expected`, `std::move` (utility), `std::forward`, `std::swap`.
- `std::function`.

### 4.6 I/O: 7 candidates

- `std::cerr`, `std::getline`.
- `<fstream>`, `std::ifstream`, `std::ofstream`.
- `<sstream>`, `std::stringstream`.

### 4.7 Filesystem: 7 candidates

- `<filesystem>`, `std::filesystem::path`,
  `std::filesystem::directory_entry`, and
  `std::filesystem::directory_iterator`.
- `std::filesystem::exists`, `std::filesystem::create_directories`, and
  `std::filesystem::remove`.

### 4.8 Time: 5 candidates

- `<chrono>`, `std::chrono::duration`, `std::chrono::time_point`.
- `std::chrono::steady_clock`, `std::chrono::system_clock`.

### 4.9 Concurrency: 15 candidates

- `<thread>`, `std::thread`, `std::jthread`.
- `<mutex>`, `std::mutex`, `std::lock_guard`, `std::unique_lock`,
  `std::scoped_lock`.
- `<condition_variable>`, `std::condition_variable`.
- `<atomic>`, `std::atomic`.
- `<future>`, `std::future`, `std::async`.

## 5. Delivery order

1. Upgrade the three current P0 Entries before adding new ones. **Completed.**
2. Deepen the existing container headers and selection guide. **Completed.**
3. Add common associative/container adaptors and high-frequency algorithms.
   **Associative/adaptor entity slice completed in breadth batch 4; its header
   maps and a second algorithm slice completed in breadth batch 5.**
4. Add string conversion, shared ownership, and utility vocabulary.
   **String conversion and shared ownership completed in breadth batch 6;
   utility vocabulary remains.**
5. Add filesystem and time with deterministic examples.
6. Add concurrency last, after its nondeterministic-example and memory-model
   review requirements are explicit.

Each batch receives its own primary-source research note, implementation
report, coverage report, example verification run, and two-axis review.
