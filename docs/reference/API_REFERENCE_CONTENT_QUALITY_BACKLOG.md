# API Reference Content Quality Backlog

| Field | Value |
|---|---|
| Document ID | REF-BACKLOG-001 |
| Version | 3.0 |
| Status | Active |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

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

The active catalog contains 119 Entries. All have at least one primary source,
and all 224 examples pass the local toolchain gate. Depth still varies by
editorial role and upgrade status.

| Action | Entries | Reason |
|---|---|---|
| Completed in quality batch 1 | `std::optional`, `std::make_unique`, `std::string_view` | Rewritten to the ordinary-entity learning-quality baseline with two verified examples each |
| Completed in quality batch 2 | `<vector>`, `<array>`, `<deque>`, `<unordered_map>`, choosing a sequence container | Header facility maps, version boundaries, container decision rules, and differentiated invalidation guidance are now source-backed |
| Completed in quality batch 3 | `std::vector`, `std::vector::push_back`, `std::vector::reserve`, `std::array`, `std::deque`, `std::unordered_map`, `std::sort`, `std::find`, `std::string`, `std::unique_ptr`, `std::cin`, `std::cout` | Cleared the ordinary-entity example debt and added explicit selection guidance; later structural gaps remain tracked by the quality ratchet |
| Completed in breadth batch 4 | `std::map`, `std::set`, `std::unordered_set`, `std::queue`, `std::priority_queue`, `std::stack`, `std::transform`, `std::count_if`, `std::all_of`, `std::lower_bound`, `std::remove_if`, `std::accumulate` | Twelve directly searchable entity pages add associative containers, adaptors, and high-frequency algorithms with two verified examples each |
| Completed in breadth batch 5 | `<map>`, `<set>`, `<unordered_set>`, `<queue>`, `<stack>`, `<numeric>`, `std::binary_search`, `std::any_of`, `std::copy`, `std::reverse`, `std::unique`, `std::for_each` | Six facility maps close navigation around batch 4 and six ordinary algorithm pages define classic, policy, and ranges boundaries with verified examples |
| Completed in breadth batch 6 | `<string>`, `<string_view>`, `<charconv>`, `<memory>`, `std::string::substr`, `std::string::find`, `std::string::append`, `std::from_chars`, `std::to_chars`, `std::shared_ptr`, `std::weak_ptr`, `std::make_shared` | Four facility maps and eight ordinary pages close owning/borrowed text, low-level conversion, and shared-ownership learning loops; cppreference informs page structure while WG21 sources govern facts |
| Completed in breadth batch 7 | `<utility>`, `std::move`, `std::forward`, `std::swap`, `std::pair` | One versioned facility map and four ordinary pages establish value-category casts, perfect forwarding, ADL-aware exchange, and binary value semantics with ten verified examples |
| Completed in breadth batch 8 | `std::tuple`, `std::variant`, `std::any`, `std::expected`, `std::function` | Five ordinary pages establish heterogeneous product/sum values, runtime value and callable erasure, and C++23 explicit result handling; ten deterministic examples include two locally verified C++23 expected runs |
| Completed in breadth batch 9 | `std::cerr`, `std::getline`, `<fstream>`, `std::ifstream`, `std::ofstream`, `<sstream>`, `std::stringstream` | Seven I/O pages establish diagnostic streams, line extraction, file mode/error boundaries, and in-memory stream state; fourteen deterministic C++20 examples include isolated relative-path file fixtures |
| Completed in breadth batch 10 | `<filesystem>`, `std::filesystem::path`, `std::filesystem::directory_entry`, `std::filesystem::directory_iterator`, `std::filesystem::exists`, `std::filesystem::create_directories`, `std::filesystem::remove` | Seven filesystem pages establish path values, optional attribute caching, unordered single-pass traversal, query semantics, recursive creation, and single-object deletion; fourteen deterministic C++20 examples use isolated relative roots and sorted directory output |
| Completed in breadth batch 11 | `<chrono>`, `std::chrono::duration`, `std::chrono::time_point`, `std::chrono::steady_clock`, `std::chrono::system_clock` | Five time pages distinguish typed intervals, clock-relative points, monotonic measurement, and system civil time; ten deterministic C++20 examples use fixed values without calling `now()`, sleeping, consulting time zones, or depending on locale |
| Completed in breadth batch 12 | `<list>`, `std::list`, `<forward_list>`, `std::forward_list`, `<span>`, `std::span` | Six pages contrast owning bidirectional/singly-linked sequences with a borrowed contiguous view; twelve deterministic C++20 examples avoid addresses, allocator/layout output, invalid ranges, dangling owners, and unspecified behavior |
| Completed in breadth batch 13 | `std::move` (range algorithm), `std::count`, `std::none_of`, `std::rotate`, `std::remove` (range algorithm) | Five pages complete the selected algorithm slice with explicit classic/policy/ranges boundaries; ten deterministic C++20 examples avoid moved-from source values, unspecified remove tails, predicate side effects, and policy scheduling |
| Completed in breadth batch 14 | `std::enable_shared_from_this`, `std::allocator`, `std::uninitialized_copy`, `std::destroy` | Four pages connect shared control-block access with allocation, construction, destruction, and deallocation; eight deterministic C++20 examples avoid addresses, allocation counts, dead-object reads, unspecified cleanup order, and policy scheduling |
| Completed in breadth batch 15 | `<thread>`, `std::thread`, `<mutex>`, `std::mutex`, `std::lock_guard` | Five pages establish thread-handle ownership, join visibility, non-recursive mutex synchronization, header-level once/multi-lock discovery, and scope-bound release; ten deterministic C++20 examples avoid worker output, timing, scheduling order, thread-ID representations, detach, and invalid lock ownership |
| Completed in breadth batch 16 | `std::unique_lock`, `std::scoped_lock`, `<condition_variable>`, `std::condition_variable` | Four pages establish movable lock state, deadlock-avoiding multi-lock ownership, header-level condition-variable discovery, and predicate waiting; eight deterministic C++20 examples avoid sleep, timing, wake order, lost-notification assumptions, and invalid release/adopt ownership |
| Completed in breadth batch 17 | `<atomic>`, `std::atomic` | Two pages establish atomic facility discovery, memory-order selection, release/acquire publication, compare-and-exchange, wait/notify, and lock-free boundaries; four deterministic C++20 examples avoid polling, timing, worker output, schedule order, and implementation-defined snapshots |
| Completed in breadth batch 18 | `<future>`, `std::future`, `std::async` | Three pages establish future facility discovery, single-consumer shared-state ownership, launch policy, deferred execution, exception propagation, and narrowly scoped destructor blocking; six deterministic C++20 examples avoid sleep, timing, worker output, default-policy assumptions, and implementation-defined error text |
| Completed in quality-ratchet batch 7 | `std::vector`, `std::sort`, `std::find`, `std::unique_ptr`, `std::cin`, `std::cout`, `<iostream>`, `<charconv>` | Added missing mistakes, complexity, lifetime/invalidation, related-link, JavaScript comparison, direct-inclusion, facility-map, and per-facility version coverage; all eight now pass their kind profile |
| Completed in quality-ratchet batch 8 | `std::accumulate`, `std::all_of`, `std::any_of`, `std::binary_search`, `std::copy`, `std::for_each`, `std::lower_bound`, `std::remove_if`, `std::reverse`, `std::unique` | Added explicit parameter/precondition, return, complexity, selection, and lifetime/invalidation coverage where the audit identified gaps; all ten now pass the callable profile |
| Completed in quality-ratchet closure batch | `std::array`, `std::deque`, `std::unordered_map`, `std::vector::reserve`, `std::optional`, `std::make_shared`, `std::shared_ptr`, `std::weak_ptr`, `<algorithm>`, `<unordered_map>`, `std::from_chars`, `std::to_chars`, `std::string::append`, `std::string::find`, `std::string::substr` | Three internal remediation slices cleared every remaining JavaScript comparison, related-link, selection, return, complexity, direct-inclusion, facility-map, parameter, and lifetime finding; the structural debt baseline is now empty |
| Keep concise | Standard Library, Containers, Algorithms | Landing role is primarily navigation; review links and scope instead of padding prose |

Quality batches 1 through 3 and breadth batches 4 through 18 are complete. The
existing ordinary-entity example debt remains cleared. Concurrency is now in
progress under explicit determinism, ownership, and memory-model requirements.

### 3.1 Executable debt baseline

The kind-aware audit currently checks 115 of 119 Entries; three landing Entries
and one guide are intentionally reviewed outside the structural profile. After
the quality-ratchet closure batch, the checked-in baseline contains no known gaps,
down from the initial 58 gaps across 35 Entries.

| Closure slice | Focus | Result |
|---|---|---|
| Prerequisite batch 8 | High-frequency algorithms | **Completed:** parameters, returns, complexity, selection, and lifetime |
| A | Containers and smart ownership | **Completed:** selection, JavaScript comparison, return, complexity, and related links |
| B | Header navigation | **Completed:** direct-inclusion guidance, facility maps, and related links |
| C | String conversion and member operations | **Completed:** selection, parameters, and lifetime |

`reference/quality-baseline.json` is now an empty reviewed debt inventory, not
an acceptance waiver. It retains the approval fixed point and schema support
for reasoned, dated `notApplicable` decisions if a future profile requirement
is genuinely irrelevant. New Entries and materially rewritten Entries may not
introduce debt; any new structural finding fails the gate immediately.

## 4. Planned 120-Entry catalog

The current 119 Entries remain in scope. The following candidate makes the
remaining catalog explicit. “Candidate” means editorially selected, not yet
fact-verified or release-ready.

### 4.1 Containers: completed

The selected linked-sequence and contiguous-view slice was delivered in
breadth batch 12.

### 4.2 Algorithms and numeric operations: completed

The selected range movement, counting, quantifier, rotation, and logical
removal slice was delivered in breadth batch 13.

### 4.3 Strings and conversion: completed

The selected strings and conversion slice was delivered in breadth batch 6.

### 4.4 Memory: completed

The selected control-block access, default-allocation, raw-storage copy, and
explicit destruction slice was delivered in breadth batch 14.

### 4.5 Utilities and callable objects: completed

The selected product, sum, erased-value, result, and callable vocabulary was
delivered in breadth batch 8.

### 4.6 I/O: completed

The selected diagnostic, line-input, file-stream, and in-memory text-stream
slice was delivered in breadth batch 9.

### 4.7 Filesystem: completed

The selected path, directory observation, traversal, creation, query, and
single-object deletion slice was delivered in breadth batch 10.

### 4.8 Time: completed

The selected duration, time-point, monotonic-clock, and system-clock slice was
delivered in breadth batch 11.

### 4.9 Concurrency: 14 delivered, 1 candidate

- Delivered in breadth batch 15: `<thread>`, `std::thread`, `<mutex>`,
  `std::mutex`, `std::lock_guard`.
- Delivered in breadth batch 16: `std::unique_lock`, `std::scoped_lock`,
  `<condition_variable>`, `std::condition_variable`.
- Delivered in breadth batch 17: `<atomic>`, `std::atomic`.
- Delivered in breadth batch 18: `<future>`, `std::future`, `std::async`.
- Remaining thread lifecycle: `std::jthread`; retain until the local libc++ can
  compile and execute its real C++20 stop-token contract.

## 5. Delivery order

1. Upgrade the three current P0 Entries before adding new ones. **Completed.**
2. Deepen the existing container headers and selection guide. **Completed.**
3. Add common associative/container adaptors and high-frequency algorithms.
   **Associative/adaptor entity slice completed in breadth batch 4; its header
   maps and a second algorithm slice completed in breadth batch 5; the
   remaining linked-sequence and contiguous-view slice completed in breadth
   batch 12; the final selected algorithm slice completed in breadth batch
   13.**
4. Add string conversion, shared ownership, and utility vocabulary.
   **String conversion and shared ownership completed in breadth batch 6;
   foundational utility vocabulary completed in breadth batch 7; callable,
   product, sum, and result vocabulary completed in breadth batch 8; the
   remaining allocator and raw-storage lifecycle slice completed in breadth
   batch 14.**
5. Add I/O, filesystem, and time with deterministic examples.
   **I/O completed in breadth batch 9; filesystem completed in breadth batch
   10; time completed in breadth batch 11.**
6. Add concurrency last, after its nondeterministic-example and memory-model
   review requirements are explicit. **In progress:** breadth batches 15 through
   18 deliver thread/mutex foundations, lock ownership, condition-variable
   waiting, atomic operations, and future-based result transport; the sole
   remaining candidate is the toolchain-gated `std::jthread` page.

Each batch receives its own primary-source research note, implementation
report, coverage report, example verification run, and two-axis review.
