# API Reference Phase 3 Batch 1 Research

| Field | Value |
|---|---|
| Document ID | REF-RES-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Scope and evidence policy

This note records the primary-source research for the first ten Phase 3
Reference Entries:

- `<iostream>`, `std::cout`, and `std::cin`;
- `<array>` and `std::array`;
- `<deque>` and `std::deque`;
- `<unordered_map>` and `std::unordered_map`;
- `std::vector::reserve`.

The current C++ Working Draft hosted at `eel.is` is the authority for current
declarations and behavior. The official WG21 [1997 public review
draft](https://www.open-std.org/jtc1/sc22/open/n2356/) and
[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
are used only as historical evidence for first-standard metadata. N3337 is a
post-C++11 working draft, so its presence establishes that an entity was in the
C++11 library but does not, by itself, prove the exact wording of the published
ISO edition.

Each Entry below separates two kinds of statements:

- **Standard facts** paraphrase a cited standard or working-draft requirement.
- **Teaching guidance** is an editorial explanation, recommendation, trap, or
  example design derived from those requirements. It is not normative wording.

Representative declarations intentionally omit unrelated overloads and
exposition-only machinery. The eventual Entry must label them as
representative, not complete. All proposed examples are original, deterministic
C++20 programs; output ordering never depends on an unordered container's
iteration order.

## 2. `<iostream>`

### 2.1 Entry metadata and representative declarations

- Entry kind: `header`.
- First standard: C++98. The official 1997 public review draft already contains
  the `<iostream>` synopsis and the same eight standard stream objects.
- Header: `<iostream>`.
- Namespace: the declared objects are in `std`.

```cpp
namespace std {
extern istream cin;
extern ostream cout;
extern ostream cerr;
extern ostream clog;
extern wistream wcin;
extern wostream wcout;
extern wostream wcerr;
extern wostream wclog;
}
```

### 2.2 Standard facts

- The header declares objects associated with the standard C streams and
  includes the headers required to use those objects.
- The associations are established before the body of `main` starts. The
  standard stream objects are not destroyed during program execution.
- When standard iostream/C stream synchronization is enabled, concurrent
  formatted or unformatted access does not create a data race. Characters can
  still be interleaved, so the guarantee is not an atomic-message guarantee.
- The header itself has no runtime complexity, iterator lifetime, precondition,
  or exception contract independent of the objects and operations it exposes.

### 2.3 Teaching guidance and common traps

- Include `<iostream>` when using the predefined console streams; do not rely on
  another header including it transitively.
- Explain the narrow streams first. Introduce `wcin`/`wcout` only alongside
  character types and locale because they are not automatic Unicode solutions.
- “Thread-safe” must not be taught as “lines cannot mix.” The standard only
  rules out a data race for synchronized access.

### 2.4 Suggested deterministic C++20 example

```cpp
#include <iostream>

int main() {
    std::cout << "streams: cin and cout\n";
}
```

Expected stdout:

```text
streams: cin and cout
```

### 2.5 Primary sources

- Current synopsis: [C++ Working Draft,
  `[iostream.syn]`](https://eel.is/c++draft/iostream.syn).
- Object association and lifetime: [C++ Working Draft,
  `[iostream.objects.overview]`](https://eel.is/c++draft/iostream.objects.overview).
- Historical presence: [1997 public review draft, Clause 27.3,
  `[lib.iostream.objects]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html).

## 3. `std::cout`

### 3.1 Entry metadata and representative declaration

- Entry kind: `object`.
- First standard: C++98.
- Header: `<iostream>`.
- Namespace: `std`.

```cpp
extern std::ostream cout;
```

### 3.2 Standard facts

- `cout` controls output through a stream buffer associated with the C `stdout`
  stream.
- Formatted output constructs an output sentry. If the sentry succeeds, the
  operation attempts to generate the requested output. Generation failure sets
  `failbit`; an exception during output sets `badbit`.
- An operation can throw `ios_base::failure` when the corresponding state bit is
  enabled in the stream's exception mask. Otherwise normal stream use reports
  failures through state bits.
- The standard does not give a general time-complexity guarantee for writing to
  `cout`; cost depends on formatting, buffering, synchronization, and the
  external destination.
- `cout` exists before `main` and is not destroyed during program execution.

### 3.3 Teaching guidance and common traps

- Prefer `\n` when only a newline is required. `std::endl` also flushes the
  stream, which is useful only when that flush is intentional.
- Do not claim that a successful `operator<<` means bytes have already reached a
  terminal or file; buffering is part of the I/O model.
- After an output failure, chained insertions return the same stream object but
  should not be treated as successful merely because the expression compiled.
- Avoid assertions about interleaving when multiple threads write to `cout`.

### 3.4 Suggested deterministic C++20 example

```cpp
#include <iostream>

int main() {
    const int items{3};
    std::cout << "items=" << items << '\n';
}
```

Expected stdout:

```text
items=3
```

### 3.5 Primary sources

- Object association: [C++ Working Draft,
  `[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects).
- Output state and exception behavior: [C++ Working Draft,
  `[ostream.formatted.reqmts]`](https://eel.is/c++draft/ostream.formatted.reqmts)
  and [`[iostate.flags]`](https://eel.is/c++draft/iostate.flags).
- Newline and flush manipulators: [C++ Working Draft,
  `[ostream.manip]`](https://eel.is/c++draft/ostream.manip).
- Historical presence: [1997 public review draft, Clause 27.3,
  `[lib.iostream.objects]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html).

## 4. `std::cin`

### 4.1 Entry metadata and representative declaration

- Entry kind: `object`.
- First standard: C++98.
- Header: `<iostream>`.
- Namespace: `std`.

```cpp
extern std::istream cin;
```

### 4.2 Standard facts

- `cin` controls input through a stream buffer associated with the C `stdin`
  stream.
- After initialization, `cin.tie()` returns `&cout`. Input sentry preparation
  can therefore flush the tied output stream before reading.
- Formatted input normally skips leading whitespace when `skipws` is set. This
  classification uses the stream's current locale.
- Reaching end-of-file while obtaining formatted input sets `eofbit`. Parsing or
  range failure can set `failbit`; an exception while reading sets `badbit`.
- `operator bool()` is equivalent to `!fail()`, and `fail()` tests `failbit` or
  `badbit`. This is why `if (std::cin >> value)` is the canonical success check.
- State-setting functions can throw `ios_base::failure` when the relevant bit is
  enabled in `exceptions()`.
- The standard gives no general time-complexity guarantee for console
  extraction.

### 4.3 Teaching guidance and common traps

- Never use an extracted value without testing whether extraction succeeded.
- After a format error, `clear()` resets state but does not remove the offending
  input. Recovery generally needs both state repair and input consumption.
- Mixing token extraction (`>>`) with line extraction (`getline`) commonly
  leaves the delimiter newline for the next operation; teach the input model,
  not a cargo-cult `ignore()` call.
- Treat input text and locale as dependencies. The catalog example should
  declare bounded stdin rather than wait for interactive input.

### 4.4 Suggested deterministic C++20 example

```cpp
#include <iostream>

int main() {
    int left{};
    int right{};

    if (std::cin >> left >> right) {
        std::cout << left + right << '\n';
    } else {
        std::cout << "invalid input\n";
    }
}
```

Declared stdin:

```text
7 5
```

Expected stdout:

```text
12
```

### 4.5 Primary sources

- Object association and tie: [C++ Working Draft,
  `[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects).
- Prefix work and whitespace handling: [C++ Working Draft,
  `[istream.sentry]`](https://eel.is/c++draft/istream.sentry).
- Formatted input state transitions: [C++ Working Draft,
  `[istream.formatted.reqmts]`](https://eel.is/c++draft/istream.formatted.reqmts),
  [`[istream.formatted.arithmetic]`](https://eel.is/c++draft/istream.formatted.arithmetic),
  and [`[iostate.flags]`](https://eel.is/c++draft/iostate.flags).
- Historical presence: [1997 public review draft, Clause 27.3,
  `[lib.iostream.objects]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html).

## 5. `<array>`

### 5.1 Entry metadata and representative declarations

- Entry kind: `header`.
- First standard: C++11. The class and header are present in official WG21
  draft N3337, which records the C++11 library state.
- Header: `<array>`.
- Namespace: declarations are in `std`.

```cpp
namespace std {
template<class T, size_t N>
struct array;

template<size_t I, class T, size_t N>
constexpr T& get(array<T, N>&) noexcept;
}
```

### 5.2 Standard facts

- The header provides the fixed-size `array` class template, comparisons,
  specialized `swap`, array creation functions, and a tuple interface.
- The header has no independent runtime complexity, invalidation, precondition,
  or exception behavior; those contracts belong to its declarations.

### 5.3 Teaching guidance and common traps

- `<array>` is not the built-in array syntax; it exposes a standard container
  interface around a compile-time element count.
- Do not describe every declaration as “available since C++11.” For example,
  later standards added facilities and expanded `constexpr` support. The Entry
  should version individual additions if it teaches them.

### 5.4 Suggested deterministic C++20 example

```cpp
#include <array>
#include <iostream>

int main() {
    const std::array<int, 3> values{1, 2, 3};
    int sum{};
    for (const int value : values) {
        sum += value;
    }
    std::cout << sum << '\n';
}
```

Expected stdout:

```text
6
```

### 5.5 Primary sources

- Current header inventory: [C++ Working Draft,
  `[array.syn]`](https://eel.is/c++draft/array.syn).
- Historical presence: [WG21 N3337, Clause 23.3.2,
  `[array]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf).

## 6. `std::array`

### 6.1 Entry metadata and representative declaration

- Entry kind: `type`.
- First standard: C++11.
- Header: `<array>`.
- Namespace: `std`.

```cpp
template<class T, std::size_t N>
struct std::array;
```

### 6.2 Standard facts

- `array<T, N>` stores exactly `N` elements of `T`; `size() == N` is an
  invariant. It is an aggregate, a contiguous container, and supports the
  container and reversible-container interfaces with documented exceptions for
  its fixed size.
- `size()` returns `N`. For a non-empty array, `data()` equals the address of
  `front()`, and `[data(), data() + size())` is a valid range.
- Element access and iterator arithmetic are constant time. `fill` and
  element-wise `swap` are linear in `N`.
- The container never reallocates or changes size. References, pointers, and
  iterators remain tied to the same `array` object for its lifetime. During
  `swap`, element values are exchanged; iterators do not migrate to the other
  container.
- `at(n)` throws `out_of_range` when `n >= size()`. `operator[]` has the
  hardened precondition `n < size()`.
- For `N == 0`, `begin() == end()` and `data()` is unspecified. Accessing an
  element is therefore not valid.
- Element construction, assignment, comparison, fill, or swap can propagate
  exceptions from `T`; there is no allocation failure inherent to `array`
  storage.

### 6.3 Teaching guidance and common traps

- Choose `std::array` when the element count is part of the type and cannot
  change at runtime. Use `std::vector` for a runtime-sized sequence.
- Prefer brace initialization. For scalar elements, `std::array<int, N> a{};`
  clearly value-initializes the elements; a bare default-initialized aggregate
  is easy to misuse.
- The size participates in the type: `std::array<int, 3>` and
  `std::array<int, 4>` are different types.
- Do not call `front()`, `back()`, or index access on `std::array<T, 0>`.

### 6.4 Suggested deterministic C++20 example

```cpp
#include <array>
#include <iostream>

int main() {
    constexpr std::array<int, 3> scores{4, 7, 9};
    std::cout << scores.size() << ' '
              << scores.front() << ' '
              << scores.back() << '\n';
}
```

Expected stdout:

```text
3 4 9
```

### 6.5 Primary sources

- Type role and declaration: [C++ Working Draft,
  `[array.overview]`](https://eel.is/c++draft/array.overview).
- Data, fill, and swap: [C++ Working Draft,
  `[array.members]`](https://eel.is/c++draft/array.members).
- Zero-size rules: [C++ Working Draft,
  `[array.zero]`](https://eel.is/c++draft/array.zero).
- Common sequence element-access contracts: [C++ Working Draft,
  `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts).
- Historical presence: [WG21 N3337, Clause 23.3.2,
  `[array]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf).

## 7. `<deque>`

### 7.1 Entry metadata and representative declarations

- Entry kind: `header`.
- First standard: C++98. The 1997 public review draft contains the `<deque>`
  synopsis.
- Header: `<deque>`.
- Namespace: declarations are in `std`.

```cpp
namespace std {
template<class T, class Allocator = allocator<T>>
class deque;

template<class T, class Allocator>
void swap(deque<T, Allocator>&, deque<T, Allocator>&);
}
```

### 7.2 Standard facts

- The header declares `std::deque`, its comparison and swap operations, erasure
  helpers, and the `std::pmr::deque` alias in the current draft.
- The header has no independent runtime complexity, lifetime, exception, or
  precondition contract.

### 7.3 Teaching guidance and common traps

- The English name “deque” means double-ended queue, but the type is a general
  random-access sequence container, not the `std::queue` adaptor.
- Version individual helper APIs. The core container is C++98, while free
  `erase`, ranges integration, `pmr`, and broad `constexpr` support arrived
  later.

### 7.4 Suggested deterministic C++20 example

```cpp
#include <deque>
#include <iostream>

int main() {
    std::deque<int> values{2};
    values.push_front(1);
    values.push_back(3);
    std::cout << values.front() << ' ' << values.back() << '\n';
}
```

Expected stdout:

```text
1 3
```

### 7.5 Primary sources

- Current header inventory: [C++ Working Draft,
  `[deque.syn]`](https://eel.is/c++draft/deque.syn).
- Historical presence: [1997 public review draft, Clause 23.2,
  `<deque>` synopsis](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html).

## 8. `std::deque`

### 8.1 Entry metadata and representative declaration

- Entry kind: `type`.
- First standard: C++98.
- Header: `<deque>`.
- Namespace: `std`.

```cpp
template<class T, class Allocator = std::allocator<T>>
class std::deque;
```

### 8.2 Standard facts

- `deque` is a sequence container with random-access iterators. It supports
  constant-time insertion and erasure at either end; insertion and erasure in
  the middle are linear.
- Inserting one element at either end is constant time. General insertion is
  linear in the number inserted plus the lesser distance to either end.
- The standard does not classify `deque` as a contiguous container and exposes
  no `data()` member. Random access must not be confused with one contiguous
  allocation.
- Middle insertion invalidates all iterators and references. End insertion
  invalidates all iterators but leaves references to existing elements valid.
- Erasing the last element invalidates the past-the-end iterator and handles to
  erased elements. Erasing only the first element leaves handles to other
  elements valid. Erasing strictly in the middle invalidates the past-the-end
  iterator and all iterators and references to all elements.
- A single-element insertion at either end has no effects if it throws. For
  other insertions, the precise guarantee depends on whether the exception came
  from element copy/move/assignment; a throwing move of a non-copy-insertable
  element can leave effects unspecified.
- `at(n)` throws `out_of_range` when the index is outside the sequence;
  `operator[]`, `front()`, `back()`, `pop_front()`, and `pop_back()` require the
  documented valid-index or non-empty condition.

### 8.3 Teaching guidance and common traps

- Use `deque` when both ends change frequently and indexed access is still
  useful. Prefer `vector` when contiguous storage and cache-friendly traversal
  matter more.
- A reference to an existing element can survive `push_front` or `push_back`,
  but an iterator cannot. Keep those two invalidation rules separate.
- Do not pass `&deque[0]` plus `size()` to an API that expects one contiguous
  buffer; contiguity is not guaranteed.
- The proposed example avoids printing after direct unordered or
  implementation-specific storage observations.

### 8.4 Suggested deterministic C++20 example

```cpp
#include <deque>
#include <iostream>

int main() {
    std::deque<int> jobs{20, 30};
    jobs.push_front(10);
    jobs.push_back(40);
    jobs.pop_front();

    std::cout << jobs.front() << ' '
              << jobs.back() << ' '
              << jobs.size() << '\n';
}
```

Expected stdout:

```text
20 40 3
```

### 8.5 Primary sources

- Container role and representative declaration: [C++ Working Draft,
  `[deque.overview]`](https://eel.is/c++draft/deque.overview).
- Complexity, invalidation, and exception guarantees: [C++ Working Draft,
  `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers).
- Common sequence preconditions: [C++ Working Draft,
  `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts).
- Historical presence: [1997 public review draft, Clause 23.2,
  `<deque>` synopsis](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html).

## 9. `<unordered_map>`

### 9.1 Entry metadata and representative declarations

- Entry kind: `header`.
- First standard: C++11. WG21 N3337 contains the header synopsis and the
  `unordered_map`/`unordered_multimap` class templates.
- Header: `<unordered_map>`.
- Namespace: declarations are in `std`.

```cpp
namespace std {
template<class Key, class T,
         class Hash = hash<Key>,
         class Pred = equal_to<Key>,
         class Alloc = allocator<pair<const Key, T>>>
class unordered_map;

template<class Key, class T,
         class Hash = hash<Key>,
         class Pred = equal_to<Key>,
         class Alloc = allocator<pair<const Key, T>>>
class unordered_multimap;
}
```

### 9.2 Standard facts

- The current header synopsis declares both unordered map templates,
  comparisons, swap, erasure helpers, and polymorphic-allocator aliases.
- The header has no independent runtime complexity, lifetime, exception, or
  precondition contract.

### 9.3 Teaching guidance and common traps

- Teach `unordered_map` before `unordered_multimap`: the former has unique
  keys, while the latter permits equivalent keys.
- “Unordered” means iteration order is not specified. It does not mean random,
  sorted, insertion ordered, or stable across rehashing.
- Do not attach C++11 to every modern declaration in the current synopsis;
  helper functions, overloads, `pmr`, and `constexpr` support have separate
  version histories.

### 9.4 Suggested deterministic C++20 example

```cpp
#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    const std::unordered_map<std::string, int> codes{
        {"ok", 200},
        {"not-found", 404},
    };
    std::cout << codes.at("ok") << '\n';
}
```

Expected stdout:

```text
200
```

### 9.5 Primary sources

- Current header inventory: [C++ Working Draft,
  `[unord.map.syn]`](https://eel.is/c++draft/unord.map.syn).
- Historical presence: [WG21 N3337, Clause 23.5.2,
  `[unord.map.syn]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf).

## 10. `std::unordered_map`

### 10.1 Entry metadata and representative declaration

- Entry kind: `type`.
- First standard: C++11.
- Header: `<unordered_map>`.
- Namespace: `std`.

```cpp
template<class Key, class T,
         class Hash = std::hash<Key>,
         class Pred = std::equal_to<Key>,
         class Allocator = std::allocator<std::pair<const Key, T>>>
class std::unordered_map;
```

### 10.2 Standard facts

- `unordered_map` is an unordered associative container with at most one
  element per equivalent key. It maps `Key` to `T`, and its `value_type` is
  `pair<const Key, T>`.
- Keys are grouped into buckets. Equivalent keys must receive the same hash
  value. For keys stored in a container, hash and equality results must remain
  stable.
- Lookup such as `find` is average constant time and worst-case linear in
  `size()`. The standard summarizes most unordered operations as linear in the
  worst case and faster on average.
- Absolute iteration order is unspecified. Rehashing invalidates iterators and
  can change order and bucket placement, but does not invalidate pointers or
  references to elements.
- `operator[]` is equivalent to `try_emplace(...).first->second`, so a missing
  key causes insertion. `at` does not insert and throws `out_of_range` if the
  key is absent.
- Hashing, equality, allocation, and construction can throw. A single-element
  insertion has no effect for exceptions other than one thrown by the hash
  function. `clear()` does not throw; the standard gives more specific
  guarantees for erase, swap, and rehash.

### 10.3 Teaching guidance and common traps

- Use `find`, `contains`, or `at` for a read-only lookup. Using `operator[]` to
  test membership silently creates a default-mapped element when absent.
- Never write an example whose expected output depends on direct iteration
  order. Look up named keys or sort copied results before printing.
- A saved iterator can become invalid after an insertion that triggers rehash.
  A pointer or reference to an existing element survives that rehash, but not
  erasure of its element or destruction of the container.
- A custom equality relation and custom hash must agree: equivalent keys need
  equal hashes. Violating this is not merely a performance issue; it breaks the
  container requirements.
- Average constant time is not a worst-case or security guarantee. Poor hashes
  or adversarial keys can produce linear behavior.

### 10.4 Suggested deterministic C++20 example

```cpp
#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    std::unordered_map<std::string, int> inventory{
        {"book", 2},
        {"pen", 5},
    };

    if (const auto found = inventory.find("pen"); found != inventory.end()) {
        std::cout << found->first << '=' << found->second << '\n';
    }
    std::cout << std::boolalpha << inventory.contains("eraser") << '\n';
}
```

Expected stdout:

```text
pen=5
false
```

### 10.5 Primary sources

- Type identity and value type: [C++ Working Draft,
  `[unord.map.overview]`](https://eel.is/c++draft/unord.map.overview).
- Hash/equality requirements, complexity, order, and rehash invalidation: [C++
  Working Draft, `[unord.req]`](https://eel.is/c++draft/unord.req).
- `operator[]` and `at`: [C++ Working Draft,
  `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem).
- Exception guarantees: [C++ Working Draft,
  `[unord.req.except]`](https://eel.is/c++draft/unord.req.except).
- Historical presence: [WG21 N3337, Clauses 23.5.2 and 23.5.4,
  `[unord.map.syn]` and `[unord.map]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf).

## 11. `std::vector::reserve`

### 11.1 Entry metadata and representative declaration

- Entry kind: `member`.
- First standard: C++98. The 1997 public review draft contains both the member
  declaration and its capacity contract.
- Header: `<vector>`.
- Owning type and namespace: `std::vector<T, Allocator>` in `std`.

```cpp
// constexpr since C++20; non-constexpr in earlier standards.
constexpr void reserve(size_type n);
```

### 11.2 Standard facts

- `reserve(n)` does not change `size()`. If `n` is greater than the current
  capacity, it reallocates and leaves capacity at least `n`; otherwise it does
  not reallocate and capacity remains unchanged.
- Complexity is linear in the current sequence size.
- Reallocation invalidates every reference, pointer, iterator, and the
  past-the-end iterator. If no reallocation occurs, all remain valid.
- After the call, insertions do not reallocate until an insertion would make
  `size()` greater than `capacity()`.
- `T` must satisfy the draft's move-insertable precondition. `length_error` is
  thrown when `n > max_size()`. Allocation can throw an allocator-specific
  exception.
- Except for a move-constructor exception from a non-copy-insertable element,
  an exception leaves the vector unchanged. The exceptional non-copyable,
  throwing-move case has the weaker behavior described by the standard.

### 11.3 Teaching guidance and common traps

- `reserve` changes capacity, not size. Indexing `values[0]` after
  `values.reserve(10)` is still invalid while `size() == 0`.
- Reserve when there is a credible lower bound on upcoming growth, chiefly to
  avoid repeated reallocations and invalidation. It is not a requirement before
  `push_back`.
- Avoid calling `reserve(size() + 1)` before every insertion. That can defeat
  the container's geometric growth strategy and turn a normally efficient
  append pattern into repeated linear work.
- Do not assert that `capacity() == n`; the guarantee is `capacity() >= n` when
  growth occurs.
- Call `reserve` before taking pointers, references, or iterators that must
  survive the planned insertions, and still ensure the planned size does not
  exceed the resulting capacity.

### 11.4 Suggested deterministic C++20 example

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> values;
    values.reserve(3);

    std::cout << values.size() << ' '
              << std::boolalpha << (values.capacity() >= 3) << '\n';

    values.push_back(10);
    values.push_back(20);
    values.push_back(30);
    std::cout << values.size() << '\n';
}
```

Expected stdout:

```text
0 true
3
```

### 11.5 Primary sources

- Current behavior, complexity, invalidation, preconditions, and exceptions:
  [C++ Working Draft, `[vector.capacity]`](https://eel.is/c++draft/vector.capacity).
- Historical presence: [1997 public review draft, Clause 23.2.4.2,
  `[lib.vector.capacity]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html).

## 12. Editorial decisions for implementation

The following decisions are recommended for the Entry-writing pass; they are
teaching policy, not standard requirements:

1. Keep header Entries brief and use them as searchable inventories. Put
   behavioral detail on the object, type, or member Entry.
2. Add `object` to the Reference Entry-kind contract before authoring
   `std::cin` and `std::cout`. The current project kind set contains landing,
   header, type, function, member, concept, and guide; classifying these standard
   objects as a type or function would be technically false.
3. Use the current draft section in each manifest as the primary source and add
   a historical WG21 source only where the `since` field needs evidence.
4. For I/O examples, declare exact stdin and stdout. Do not depend on terminal
   interactivity, locale-specific formatting, or flush timing.
5. For unordered containers, never validate raw iteration order.
6. For `std::array`, `std::deque`, and `std::unordered_map`, put invalidation and
   storage-model guidance before broad member inventories; those rules prevent
   higher-impact beginner bugs.
7. Keep current-draft additions out of C++20 representative signatures unless
   the page labels their later standard version.

## 13. Known limits and verification notes

- `eel.is/c++draft` is a rolling working draft, not a frozen C++20 text. Current
  declarations can include post-C++20 additions. The implementation pass must
  avoid presenting those additions as C++20 APIs.
- “First standard” is established here through presence in official WG21
  historical drafts plus the project's standard-version taxonomy. Published
  ISO texts are not reproduced in this repository.
- The missing `object` Entry kind is an implementation prerequisite, not a
  source uncertainty. It should be resolved as a schema/contract change before
  the two object Entries are activated.
- I/O complexity is intentionally recorded as “not generally specified.” A
  measured terminal or file-system result must not be promoted to a portable
  standard guarantee.
- No standard-library vendor documentation was needed for this batch because no
  implementation difference is asserted.
