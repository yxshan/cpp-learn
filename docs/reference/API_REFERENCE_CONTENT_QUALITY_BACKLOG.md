# API Reference Content Quality Backlog

| Field | Value |
|---|---|
| Document ID | REF-BACKLOG-001 |
| Version | 1.0 |
| Status | Active |
| Owner | Project Maintainer |
| Last updated | 2026-08-28 |

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

The active catalog contains 25 Entries. All have at least one primary source
and the 22 examples pass the local toolchain gate, but depth is uneven.

| Action | Entries | Reason |
|---|---|---|
| Upgrade now | `std::optional`, `std::make_unique`, `std::string_view` | Accurate but missing several standard contract sections, source granularity, and realistic examples |
| Deepen next | `<vector>`, `<array>`, `<deque>`, `<unordered_map>`, choosing a sequence container | Useful navigation, but important selection rules and boundaries remain compressed |
| Add second example | `std::vector`, `std::vector::push_back`, `std::vector::reserve`, `std::array`, `std::deque`, `std::unordered_map`, `std::sort`, `std::find`, `std::string`, `std::unique_ptr`, `std::cin`, `std::cout` | Core semantics are present; realistic transfer examples are still missing |
| Keep concise | Standard Library, Containers, Algorithms, `<algorithm>`, `<iostream>` | Landing/header role is primarily navigation; review links and scope instead of padding prose |

The first upgrade batch is accepted only when the three “Upgrade now” Entries
meet the definition in section 2, their examples compile and run, and their
claims are reviewed against the accompanying primary-source research note.

## 4. Planned 120-Entry catalog

The current 25 Entries remain in scope. The following 95 candidates make the
remaining catalog explicit. “Candidate” means editorially selected, not yet
fact-verified or release-ready.

### 4.1 Containers: 17 candidates

- `<map>`, `std::map`, `<set>`, `std::set`.
- `<unordered_set>`, `std::unordered_set`.
- `<list>`, `std::list`, `<forward_list>`, `std::forward_list`.
- `<span>`, `std::span`.
- `<queue>`, `std::queue`, `std::priority_queue`.
- `<stack>`, `std::stack`.

### 4.2 Algorithms and numeric operations: 18 candidates

- `<numeric>`, `std::accumulate`.
- `std::for_each`, `std::transform`, `std::copy`, `std::move` (algorithm).
- `std::count`, `std::count_if`, `std::all_of`, `std::any_of`, `std::none_of`.
- `std::lower_bound`, `std::binary_search`.
- `std::reverse`, `std::rotate`, `std::remove`, `std::remove_if`, `std::unique`.

### 4.3 Strings and conversion: 8 candidates

- `<string>`, `<string_view>`, `<charconv>`.
- `std::string::substr`, `std::string::find`, `std::string::append`.
- `std::from_chars`, `std::to_chars`.

### 4.4 Memory: 8 candidates

- `<memory>`, `std::shared_ptr`, `std::weak_ptr`, `std::make_shared`.
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

1. Upgrade the three current P0 Entries before adding new ones.
2. Deepen the existing container headers and selection guide.
3. Add common associative/container adaptors and high-frequency algorithms.
4. Add string conversion, shared ownership, and utility vocabulary.
5. Add filesystem and time with deterministic examples.
6. Add concurrency last, after its nondeterministic-example and memory-model
   review requirements are explicit.

Each batch receives its own primary-source research note, implementation
report, coverage report, example verification run, and two-axis review.
