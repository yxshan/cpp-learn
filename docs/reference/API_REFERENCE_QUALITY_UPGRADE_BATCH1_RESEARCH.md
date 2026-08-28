# API Reference Content Quality Upgrade — Batch 1 Research

| Field | Value |
|---|---|
| Document ID | REF-RES-002 |
| Version | 1.0 |
| Status | Research baseline |
| Scope | `std::optional`, `std::make_unique`, `std::string_view` |
| Last updated | 2026-08-28 |

## 1. Purpose and evidence policy

This note is the factual and editorial baseline for upgrading three existing
Reference Entries. It does not replace the Entry pages. It records what the
pages must say, which overloads are representative, where the current content
is incomplete, and what deterministic examples should be implemented.

All normative facts below are paraphrased from primary sources:

- the current public C++ Working Draft at `eel.is` for current declarations and
  behavior;
- official WG21/open-std papers and historical working drafts for adoption and
  standard-version history.

Teaching recommendations, non-use cases, traps, and example designs are marked
as editorial guidance. They are original project material, not standard
wording. Representative declarations deliberately omit overloads that do not
change a learner-visible behavior; an upgraded Entry must label them as
representative rather than complete.

The stable teaching baseline remains C++20 unless a section explicitly labels
a later facility. The current Working Draft contains facilities newer than
C++20, so current-draft syntax must not be presented as if it were available in
the Entry's minimum standard.

## 2. `std::optional`

### 2.1 Scope and standard history

`std::optional<T>` was present in the C++17 working draft N4659 and belongs to
`<optional>`; N4659 describes an optional object as storage that manages the
lifetime of a contained object, if any ([N4659, `[optional]`, page
567](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)). The
current draft further states that the contained value is nested within the
`optional` object and that `optional` tracks whether that value is alive
([current draft, `[optional.general]` and
`[optional.optional.general]`](https://eel.is/c++draft/optional)).

The C++20 teaching page should cover construction, observation, replacement,
and value/lifetime semantics. `and_then`, `transform`, and `or_else` are useful
follow-up material, but they were added after the C++20 baseline: their adopted
design and constraints are recorded in
[P0798R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0798r8.html),
and their current wording is in
[`[optional.monadic]`](https://eel.is/c++draft/optional.monadic). They must be
labelled as C++23 material if included.

### 2.2 Representative declarations and overload groups

The upgraded page should show this C++17/C++20-oriented subset and explicitly
say that constraints and comparison overloads are omitted:

```cpp
#include <optional>

namespace std {
template<class T>
class optional {
public:
    constexpr optional() noexcept;
    constexpr optional(nullopt_t) noexcept;
    constexpr optional(const optional&);
    constexpr optional(optional&&)
        noexcept(is_nothrow_move_constructible_v<T>);

    template<class... Args>
    constexpr explicit optional(in_place_t, Args&&... args);

    template<class U = T>
    constexpr explicit(/* see constraints */) optional(U&& value);

    constexpr explicit operator bool() const noexcept;
    constexpr bool has_value() const noexcept;

    constexpr T& operator*() & noexcept;
    constexpr const T& operator*() const& noexcept;
    constexpr T&& operator*() && noexcept;

    constexpr T& value() &;
    constexpr const T& value() const&;
    constexpr T&& value() &&;

    template<class U>
    constexpr T value_or(U&& default_value) const&;

    template<class U>
    constexpr T value_or(U&& default_value) &&;

    template<class... Args>
    constexpr T& emplace(Args&&... args);

    constexpr void reset() noexcept;
};
} // namespace std
```

The current synopsis confirms the four value-category families for
dereference/value access, the lvalue and rvalue `value_or` overloads, and the
modifier set ([current draft,
`[optional.optional.general]`](https://eel.is/c++draft/optional.optional.general)).
The converting and in-place constructors participate only when `T` is
constructible from the corresponding arguments; copy and move operations are
likewise conditional on the relevant operations of `T` ([current draft,
`[optional.ctor]`](https://eel.is/c++draft/optional.ctor)).

Editorial scope decision: the first upgraded page should explain value
categories in prose but need not enumerate every converting constructor and
assignment constraint. It should link the overload group and show the
constraints that change normal use.

### 2.3 Normal use and non-use cases

**Normal use — editorial guidance**

- Return `optional<T>` when “a value was not found” or “the input omitted this
  value” is an expected, reason-free outcome. This matches the standard model:
  the object has either an active nested `T` or no active `T`
  ([`[optional.general]`](https://eel.is/c++draft/optional.general)).
- Store `optional<T>` when the enclosing object itself owns a `T` whose
  lifetime may start later or end earlier than the enclosing object. `reset()`
  destroys the active value, and `emplace()` destroys any prior value before
  constructing the replacement ([`[optional.mod]`](https://eel.is/c++draft/optional.mod),
  [`[optional.optional]`, `emplace`](https://eel.is/c++draft/optional.optional)).
- Use `if (result)` / `has_value()` before `*result` when absence is a normal
  branch; use `value()` when absence should be converted into
  `bad_optional_access` ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).

**Do not use — editorial guidance**

- Do not use `optional` when the caller needs a failure reason, error category,
  or diagnostic payload; the type represents presence, not an error channel.
- Do not substitute it for ownership or polymorphic identity. An
  `optional<T>` contains its `T` inside itself, while a `unique_ptr<T>` owns a
  separate object through a pointer ([`[optional.optional.general]`](https://eel.is/c++draft/optional.optional.general),
  [`[unique.ptr.general]`](https://eel.is/c++draft/unique.ptr.general)).
- Do not wrap a mandatory value merely to postpone validation. If “empty” is
  invalid in the domain, construction should establish the invariant instead.
- For the project’s C++20 baseline, do not teach the current draft’s later
  `optional<T&>` partial specialization as a C++17 feature. N4659's C++17
  `optional` wording requires an object type, whereas the current draft has a
  distinct reference specialization ([N4659, `[optional]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf),
  [current draft, `[optional.optional.ref]`](https://eel.is/c++draft/optional.optional.ref)).

### 2.4 Constraints and preconditions

- A C++17/C++20 `optional<T>` value type must be a valid complete non-array
  object type and satisfy destruction requirements; the current general wording
  also excludes `in_place_t` and `nullopt_t` as contained object types
  ([`[optional.optional.general]`](https://eel.is/c++draft/optional.optional.general)).
- `operator->` and every `operator*` overload require that a value is present.
  They do not perform the checked `value()` behavior
  ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- `value_or(default_value) const&` requires a copy-constructible `T`, while the
  `&&` overload requires a move-constructible `T`; in both cases the default
  must be convertible to `T` ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- `emplace(args...)` participates only when `T` is constructible from the
  forwarded arguments ([`[optional.optional]`, `emplace`](https://eel.is/c++draft/optional.optional)).

### 2.5 Return, value, ownership, and lifetime semantics

- `operator bool()` and `has_value()` report only whether the contained `T` is
  alive; both are `noexcept` ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- Lvalue `operator*` and `value()` return references to the contained object;
  rvalue overloads return rvalue references. Neither operation transfers an
  independently allocated resource merely by accessing it
  ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- `value_or` returns a `T` by value. The lvalue overload copies the contained
  value when engaged; the rvalue overload moves it. It never returns a reference
  to either the contained value or the fallback
  ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- Moving an engaged `optional` does not make the source disengaged: the source's
  `has_value()` state is unchanged, while the contained `T` has been used as a
  move-construction source ([`[optional.ctor]`](https://eel.is/c++draft/optional.ctor)).
- `reset()`, assignment to `nullopt`, destruction, and a successful or failed
  `emplace()` end the lifetime of the old contained object when one exists
  ([`[optional.mod]`](https://eel.is/c++draft/optional.mod),
  [`[optional.assign]`](https://eel.is/c++draft/optional.assign),
  [`[optional.optional]`, `emplace`](https://eel.is/c++draft/optional.optional)).
  Consequently, a pointer or reference previously obtained from that old value
  cannot be used after replacement; the core lifetime rules restrict use of a
  glvalue after the referred object's lifetime has ended
  ([`[basic.life]`](https://eel.is/c++draft/basic.life)).

### 2.6 Complexity

The `optional` clauses do not state collection-style asymptotic complexity for
the core operations. The Effects clauses provide the useful engineering model:

- state observers test the engagement state and return a Boolean;
- `reset()` destroys at most one `T`;
- `emplace()` destroys at most one existing `T` and constructs one new `T`;
- `value_or` copies or moves one `T`, or converts one fallback into `T`.

These operation counts follow directly from
[`[optional.observe]`](https://eel.is/c++draft/optional.observe),
[`[optional.mod]`](https://eel.is/c++draft/optional.mod), and the `emplace`
wording in [`[optional.optional]`](https://eel.is/c++draft/optional.optional).
The upgraded page should therefore say “constant optional-state overhead plus
the cost of the selected `T` operation,” not claim that copying or replacement
is universally cheap.

### 2.7 Exceptions

- `value()` throws `std::bad_optional_access` when no value is present
  ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)); unchecked
  dereference has a precondition instead of this exception.
- Constructors and assignment can propagate exceptions from the selected
  constructor or assignment operator of `T`
  ([`[optional.ctor]`](https://eel.is/c++draft/optional.ctor),
  [`[optional.assign]`](https://eel.is/c++draft/optional.assign)).
- `emplace()` first destroys the previous value and then constructs the new
  one. If construction throws, the `optional` is disengaged and the old value
  is already gone ([`[optional.optional]`, `emplace`](https://eel.is/c++draft/optional.optional)).
- `reset()` is `noexcept` and leaves the `optional` disengaged
  ([`[optional.mod]`](https://eel.is/c++draft/optional.mod)).

### 2.8 Invalidation and dangling hazards

1. A reference from `*opt`, `opt.value()`, `opt.operator->()`, or `emplace()` is
   tied to the currently active contained object. `reset`, disengaging
   assignment, replacement, or destruction ends that object's lifetime.
2. Moving an `optional` is not equivalent to `reset()`: the source generally
   remains engaged but contains a moved-from `T`
   ([`[optional.ctor]`](https://eel.is/c++draft/optional.ctor)).
3. If `T` is itself a non-owning handle such as `string_view`, `optional<T>`
   only owns that handle; it does not extend the lifetime of the resource the
   handle observes. This is an editorial deduction from `optional` nesting `T`
   and `string_view` storing a pointer/range
   ([`[optional.optional.general]`](https://eel.is/c++draft/optional.optional.general),
   [`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).

### 2.9 Common teaching traps

- “Empty dereference throws.” It does not use the checked `value()` contract;
  dereference has an engagement precondition
  ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- “`value_or` returns a reference to whichever value wins.” It returns a new
  `T` by value ([`[optional.observe]`](https://eel.is/c++draft/optional.observe)).
- “Moving clears the source.” The source engagement state is unchanged
  ([`[optional.ctor]`](https://eel.is/c++draft/optional.ctor)).
- “`emplace` gives the strong guarantee and restores the old value.” It destroys
  the old value first; a throwing constructor leaves the optional empty
  ([`[optional.optional]`, `emplace`](https://eel.is/c++draft/optional.optional)).
- “`optional<Handle>` owns the handle's target.” It owns only the `Handle`
  object; target ownership follows `Handle`'s own semantics.
- “C++23 monadic operations are available in C++20.” They are later additions;
  the page must version-label them
  ([P0798R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0798r8.html)).

### 2.10 Deterministic original example designs

#### Minimal example: parse an optional port

Goal: demonstrate normal absence, checked branching, and `value_or` returning a
value. Avoid exceptions and locale-dependent parsing.

```cpp
#include <charconv>
#include <iostream>
#include <optional>
#include <string_view>
#include <system_error>

std::optional<int> parse_port(std::string_view text) {
    int port{};
    const auto result = std::from_chars(text.data(), text.data() + text.size(), port);
    if (result.ec != std::errc{} || result.ptr != text.data() + text.size() ||
        port < 1 || port > 65535) {
        return std::nullopt;
    }
    return port;
}

int main() {
    std::cout << parse_port("8080").value_or(80) << '\n';
    std::cout << parse_port("invalid").value_or(80) << '\n';
}
```

Expected stdout:

```text
8080
80
```

#### Engineering example: optional configuration override

Goal: distinguish “not configured” from a valid zero value, show ownership
inside a configuration object, and demonstrate invalidation after `reset`
without executing a dangling access.

```cpp
#include <iostream>
#include <optional>

struct RetryPolicy {
    int attempts;
    int delay_ms;
};

int effective_attempts(const std::optional<RetryPolicy>& override_policy) {
    return override_policy ? override_policy->attempts : 3;
}

int main() {
    std::optional<RetryPolicy> policy;
    std::cout << effective_attempts(policy) << '\n';

    RetryPolicy& installed = policy.emplace(RetryPolicy{5, 200});
    std::cout << installed.attempts << ':' << policy->delay_ms << '\n';

    policy.reset(); // installed must not be used after this point.
    std::cout << std::boolalpha << policy.has_value() << '\n';
}
```

Expected stdout:

```text
3
5:200
false
```

### 2.11 Audit of the current Entry

Current files: `reference/entries/std-optional/entry.json`, `content.md`, and
`examples/parse-port.cpp`.

**Accurate but incomplete**

- The summary correctly presents the two-state model and correctly says the
  `optional` manages the contained object's lifetime.
- It correctly distinguishes checked `value()` from unchecked dereference and
  correctly recommends a richer result type when a reason is required.
- It correctly warns that object identity and ownership are different problems.

**Missing or potentially misleading through omission**

- The representative declaration omits `operator bool`, `operator*`, rvalue
  `value()`/`value_or`, `reset`, and `emplace`, despite the prose relying on
  several of them.
- There is no parameter/constraint explanation and no return-category section;
  a learner can incorrectly assume `value_or` returns a reference.
- It does not state that moving an engaged optional leaves the source engaged.
- It says `emplace()` replaces the value but omits its important throwing case:
  the old value is already destroyed and the optional becomes empty.
- It does not explicitly connect replacement/reset/destruction to dangling
  references obtained from the previous value.
- It has no complexity section and no explanation that costs follow `T`.
- The example function name `configured_port(bool enabled)` does not actually
  parse anything despite the manifest ID `parse-port`; it demonstrates only
  `value_or`. Replace it with a real deterministic parse or rename the example.
- The page does not distinguish its C++20 baseline from C++23 monadic additions.

## 3. `std::make_unique`

### 3.1 Scope and standard history

`std::make_unique` was proposed for the C++14 working paper by
[N3656](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3656.htm),
which supplied the single-object overload, unknown-bound array overload, and
deleted known-bound array overload. The current declarations and specified
return expressions are in
[`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create).

The function declarations are `constexpr` in the current draft, but that is a
later evolution and must not be shown as part of the original C++14 signature
without a version annotation. The quality-upgraded C++20 page should show the
C++14/C++20 signatures without `constexpr`, then optionally note the later
change.

### 3.2 Representative declarations and overload groups

```cpp
#include <memory>

namespace std {
// T is not an array.
template<class T, class... Args>
unique_ptr<T> make_unique(Args&&... args);

// T is an array of unknown bound, such as Widget[].
template<class T>
unique_ptr<T> make_unique(size_t count);

// T is an array of known bound, such as Widget[4].
template<class T, class... Args>
unspecified make_unique(Args&&...) = delete;
} // namespace std
```

For a non-array `T`, the result is specified as
`unique_ptr<T>(new T(std::forward<Args>(args)...))`. For an unknown-bound array,
it is specified as `unique_ptr<T>(new remove_extent_t<T>[count]())`, and the
known-bound form is deleted
([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).

The page may mention `make_unique_for_overwrite`, but it must be a separately
versioned contrast rather than another `make_unique` overload. The current
draft specifies it with `new T` / `new U[n]`, while `make_unique` uses
parenthesized initialization and value-initializes array elements
([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).

### 3.3 Normal use and non-use cases

**Normal use — editorial guidance**

- Use `make_unique<T>(args...)` for ordinary dynamic construction with sole
  ownership. The returned `unique_ptr` owns the separately allocated object,
  disposes of it on destruction, can be moved, and cannot be copied
  ([`[unique.ptr.general]`](https://eel.is/c++draft/unique.ptr.general)).
- Use `make_unique<T[]>(count)` when a runtime-sized dynamic array is genuinely
  required and its elements should be value-initialized
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Return or pass the resulting `unique_ptr` by value when ownership is being
  transferred; a moved-from `unique_ptr` becomes null
  ([`[unique.ptr.single.ctor]`](https://eel.is/c++draft/unique.ptr.single.ctor)).

**Do not use — editorial guidance**

- Do not allocate dynamically when automatic storage, a direct member, or a
  standard container expresses the lifetime and size better.
- Do not use `make_unique` when the `unique_ptr` needs a custom deleter. The
  function returns `unique_ptr<T>` (whose default deleter type is
  `default_delete<T>`), while `unique_ptr<T, D>` is the form that stores a
  client-supplied deleter ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create),
  [`[unique.ptr.single.general]`](https://eel.is/c++draft/unique.ptr.single.general)).
- Do not use it for allocator-aware or placement construction: its specified
  expression is an ordinary `new` expression, so a dedicated factory is needed
  for another allocation protocol
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Do not choose `unique_ptr<T[]>` as a default substitute for `vector<T>` when
  size tracking, iteration facilities, and resizing are required. This is an
  API-design recommendation rather than a standard rule.

### 3.4 Constraints and preconditions

- The variadic object overload is constrained to non-array `T`; the count
  overload is constrained to unknown-bound arrays; the known-bound array form
  is deleted ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- The object form is well-formed only when `T` can be initialized from the
  forwarded arguments, because the specified return expression performs that
  exact construction ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- The array form requires element construction/destruction to be well-formed;
  the returned array specialization uses `default_delete<T[]>`, which invokes
  `delete[]` and requires a complete element type at deletion
  ([`[unique.ptr.dltr.dflt1]`](https://eel.is/c++draft/unique.ptr.dltr.dflt1)).
- The template argument `T` is not deduced from constructor arguments; callers
  select it explicitly as in `make_unique<Widget>(...)`. This follows from `T`
  appearing only in the explicit template argument/result construction in the
  declared signature
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).

### 3.5 Return, value, ownership, and lifetime semantics

- A successful object call returns a `unique_ptr<T>` owning the `new T(...)`
  result; the array call returns `unique_ptr<T[]>` owning the `new U[count]()`
  result ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- The default deleter calls `delete` for the object specialization and
  `delete[]` for the array specialization
  ([`[unique.ptr.dltr.dflt]`](https://eel.is/c++draft/unique.ptr.dltr.dflt),
  [`[unique.ptr.dltr.dflt1]`](https://eel.is/c++draft/unique.ptr.dltr.dflt1)).
- The owner disposes of its object when destroyed; ownership transfer is by
  move, and copying is disabled
  ([`[unique.ptr.general]`](https://eel.is/c++draft/unique.ptr.general),
  [`[unique.ptr.single.dtor]`](https://eel.is/c++draft/unique.ptr.single.dtor)).
- `make_unique` does not extend the lifetime of objects merely referenced by
  the constructor arguments. If `T` stores a pointer, reference, or view into an
  argument, that borrowed target still needs its own valid lifetime. This is an
  editorial consequence of the function constructing exactly `T` from those
  arguments ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).

### 3.6 Complexity

`[unique.ptr.create]` gives no separate asymptotic complexity clause. Its
specified expressions give the defensible operation model:

- the object overload performs one dynamic allocation and constructs one `T`;
- the array overload performs one array allocation and value-initializes
  `count` elements.

This follows directly from the two return expressions in
[`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create). The upgraded
Entry should avoid an unconditional “O(1)” claim: object construction can do
arbitrary work, and array initialization scales with the element count.

### 3.7 Exceptions

- Allocation failure from the ordinary throwing allocation path is reported by
  an exception such as `std::bad_alloc`; an invalid array length can produce
  `std::bad_array_new_length` under the new-expression rules
  ([`[expr.new]`](https://eel.is/c++draft/expr.new)).
- Exceptions from `T`'s selected constructor or from array-element construction
  propagate through the specified new-expression. When initialization throws
  and a suitable deallocation function is found, the new-expression releases
  the storage before the exception continues
  ([`[expr.new]`](https://eel.is/c++draft/expr.new)).
- No `unique_ptr` result exists until the allocation and initialization in the
  return expression complete; therefore the function does not return a
  half-owning smart pointer
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).

The page should avoid claiming that `make_unique` catches exceptions itself.
The safety comes from the specified new-expression and the fact that ownership
is established in the returned `unique_ptr` only after successful construction.

### 3.8 Invalidation and dangling hazards

1. Raw pointers or references obtained from the result remain valid only while
   the owned object remains alive. Destruction or `reset()` invokes the deleter
   and ends that lifetime ([`[unique.ptr.general]`](https://eel.is/c++draft/unique.ptr.general),
   [`[unique.ptr.single.dtor]`](https://eel.is/c++draft/unique.ptr.single.dtor)).
2. Moving the `unique_ptr` transfers the stored pointer and leaves the source
   null, so borrowed aliases remain aliases to the same object but the new owner
   now controls its lifetime
   ([`[unique.ptr.single.ctor]`](https://eel.is/c++draft/unique.ptr.single.ctor)).
3. Calling `release()` abandons ownership without deleting the object; the
   caller becomes responsible for disposition. This hazard belongs to
   `unique_ptr` rather than `make_unique`, but the Entry should link it because
   learners often immediately manipulate the returned pointer
   ([`[unique.ptr.single.modifiers]`](https://eel.is/c++draft/unique.ptr.single.modifiers)).
4. A `unique_ptr<T>` created through the ordinary overload uses the default
   deleter; a resource that requires `fclose`, a pool release, or another custom
   operation needs a matching custom-deleter owner from the beginning.

### 3.9 Common teaching traps

- Omitting the array brackets: `make_unique<int>(n)` creates one `int` initialized
  with `n`; `make_unique<int[]>(n)` creates `n` value-initialized integers
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Assuming a known-bound form works: `make_unique<int[4]>()` selects a deleted
  form ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Saying the array overload leaves scalar elements uninitialized. Its specified
  expression includes `()`, so elements are value-initialized; the separate
  `make_unique_for_overwrite` form uses initialization without those
  parentheses ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Assuming `make_unique` supports a custom deleter argument. Its return type is
  `unique_ptr<T>`, not `unique_ptr<T, D>`
  ([`[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)).
- Assuming type deduction works like `make_pair`: `T` must be explicitly named.
- Treating `make_unique` as proof that dynamic allocation is required. It is a
  safe ownership factory for cases where dynamic lifetime is already the right
  model, not a reason to heap-allocate every object.
- Describing it as universally constant time. The cost includes allocation and
  all selected construction work.

### 3.10 Deterministic original example designs

#### Minimal example: construct and own one value

Goal: show explicit type selection, constructor forwarding, and automatic
destruction without unrelated class machinery.

```cpp
#include <iostream>
#include <memory>
#include <string>

int main() {
    auto label = std::make_unique<std::string>(4, 'C');
    std::cout << *label << '\n';
}
```

Expected stdout:

```text
CCCC
```

#### Engineering example: factory with ownership transfer

Goal: show a production-shaped factory that constructs a polymorphic service,
returns sole ownership, and transfers that ownership into a consumer.

```cpp
#include <iostream>
#include <memory>
#include <string>
#include <utility>

class Formatter {
public:
    virtual ~Formatter() = default;
    virtual std::string format(int value) const = 0;
};

class PrefixedFormatter final : public Formatter {
public:
    explicit PrefixedFormatter(std::string prefix)
        : prefix_(std::move(prefix)) {}

    std::string format(int value) const override {
        return prefix_ + std::to_string(value);
    }

private:
    std::string prefix_;
};

std::unique_ptr<Formatter> make_formatter() {
    return std::make_unique<PrefixedFormatter>("request-");
}

int main() {
    std::unique_ptr<Formatter> formatter = make_formatter();
    std::cout << formatter->format(42) << '\n';
}
```

Expected stdout:

```text
request-42
```

### 3.11 Audit of the current Entry

Current files: `reference/entries/std-make-unique/entry.json`, `content.md`, and
`examples/make-counter.cpp`.

**Accurate but incomplete**

- The summary correctly identifies immediate exclusive ownership and forwarding
  construction.
- The ownership paragraph correctly says the result moves but does not copy.
- The exception paragraph points in the right direction: a construction failure
  does not yield a half-initialized result.
- The recommendation to construct a `unique_ptr` differently when a custom
  deleter or allocation protocol is required is sound.

**Missing or potentially misleading through omission**

- The representative declarations omit the deleted known-bound array overload,
  which is a key compile-time boundary.
- The page does not explain that `make_unique<T[]>(count)` value-initializes
  elements or contrast this with `make_unique_for_overwrite`.
- It lacks a constraints/preconditions section and does not say that `T` must be
  explicitly supplied.
- It has no return-value section explaining the exact returned specialization
  and default deleter.
- It has no complexity discussion; learners could infer that a small factory
  call is always cheap.
- The exception wording is too general and does not name allocation failure,
  constructor propagation, or the new-expression cleanup rule.
- It does not explicitly explain that `make_unique` cannot create a
  `unique_ptr<T, CustomDeleter>`.
- The current example allocates an `int`, a case where dynamic lifetime is not
  motivated. It proves syntax but teaches no reason to allocate. Replace or
  supplement it with an ownership-transfer factory example.
- The `release()` warning is valid but belongs primarily on the `unique_ptr`
  page; this page should prioritize overload and construction traps, then link
  to the ownership page for modifiers.

## 4. `std::string_view`

### 4.1 Scope and standard history

`std::string_view` is the `char` alias of `basic_string_view` in
`<string_view>`. It was present in the C++17 working draft N4659, whose
`[string.view]` clause describes a view over a constant contiguous character
sequence ([N4659, `[string.view]`, page
779](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)). The
original WG21 design motivation was a non-owning string reference usable across
different owning string representations without forcing a copy
([N3921](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n3921.html)).

The current draft makes `basic_string_view` a trivially copyable type and states
that its member functions are O(1) unless another complexity is specified
([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
This is a stronger and more portable teaching statement than claiming that
every implementation is literally “two fields,” even though the synopsis uses
an exposition-only pointer and size.

### 4.2 Representative declarations and overload groups

```cpp
#include <string_view>

namespace std {
template<class CharT, class Traits = char_traits<CharT>>
class basic_string_view {
public:
    constexpr basic_string_view() noexcept;
    constexpr basic_string_view(const CharT* text);
    constexpr basic_string_view(const CharT* text, size_type count);

    constexpr const CharT* data() const noexcept;
    constexpr size_type size() const noexcept;
    constexpr bool empty() const noexcept;

    constexpr const_reference operator[] (size_type pos) const;
    constexpr const_reference at(size_type pos) const;

    constexpr void remove_prefix(size_type count);
    constexpr void remove_suffix(size_type count);
    constexpr basic_string_view substr(
        size_type pos = 0,
        size_type count = npos) const;
    constexpr size_type find(
        basic_string_view needle,
        size_type pos = 0) const noexcept;
};

using string_view = basic_string_view<char>;
} // namespace std
```

The current synopsis also has iterator/sentinel and explicit contiguous-range
constructors, plus comparison and additional string operations
([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
Those later overloads should be omitted from the C++20 quick declaration or
carefully version-labelled; the pointer and pointer-length constructors teach
the core lifetime model without conflating later range conversions.

### 4.3 Normal use and non-use cases

**Normal use — editorial guidance**

- Pass read-only string-like input by `string_view` value when the callee only
  needs a character span during the call. The type refers to a constant
  contiguous sequence and is trivially copyable
  ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- Use it for substrings and parsing cursors where a pointer/length slice avoids
  an owning substring allocation. `substr` returns another view over the
  selected range; `remove_prefix`/`remove_suffix` adjust only the view's range
  ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops),
  [`[string.view.modifiers]`](https://eel.is/c++draft/string.view.modifiers)).
- String literals are convenient sources because their arrays have static
  storage duration ([`[lex.string]`](https://eel.is/c++draft/lex.string)).

**Do not use — editorial guidance**

- Do not store a view, return it, queue it for asynchronous work, or capture it
  for later unless the API can prove that the underlying characters outlive
  every later access.
- Do not use it when ownership is required; copy into `std::string` at the
  ownership boundary.
- Do not pass `view.data()` alone to an API that requires a null-terminated C
  string. The current draft explicitly notes that the viewed buffer need not be
  null-terminated ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- Do not treat `string_view` as Unicode text processing. It is a view of code
  units of `CharT`; encoding and user-perceived character boundaries are
  separate concerns.

### 4.4 Constraints and preconditions

- `basic_string_view(const CharT* text)` requires the range measured by
  `Traits::length(text)` to be valid; passing a null pointer does not create an
  empty view. The current synopsis additionally deletes the `nullptr_t`
  constructor ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons),
  [`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- The pointer-length constructor requires `[text, text + count)` to be a valid
  range. It does not scan for a null terminator
  ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).
- The iterator/sentinel constructor requires a contiguous iterator, a sized
  sentinel, matching character value type, and a valid range
  ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).
- `operator[]` requires `pos` to be smaller than `size()`, while `at(pos)` checks the position and
  throws when it is outside the view
  ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- `front()` and `back()` require a non-empty view
  ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- `remove_prefix(count)` and `remove_suffix(count)` require
  `count <= size()` ([`[string.view.modifiers]`](https://eel.is/c++draft/string.view.modifiers)).

### 4.5 Return, value, ownership, and lifetime semantics

- `string_view` does not own the character sequence. The current synopsis
  models it with an exposition-only `const CharT*` and `size_type`, and all
  element access returns references into that sequence
  ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general),
  [`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- Copying a view copies view state; the type is trivially copyable. It does not
  copy the referred characters
  ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- `substr` returns another `basic_string_view` constructed from the current
  `data()` plus an offset and a bounded length; it does not create an owning
  string ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops)).
- `remove_prefix` and `remove_suffix` change only which portion this view
  denotes; they do not mutate the underlying characters
  ([`[string.view.modifiers]`](https://eel.is/c++draft/string.view.modifiers)).
- A `const` view prevents mutation through the view, but another owner may still
  mutate the underlying storage. A later read can therefore observe changed
  characters even when pointers remain valid. This is an editorial consequence
  of non-ownership and const element access, not an immutability guarantee.

### 4.6 Complexity

- Unless a member states otherwise, `basic_string_view` member functions are
  O(1) ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- The null-terminated pointer constructor is O(`Traits::length(text)`) because
  it scans to determine the length; the pointer-plus-length constructor stores
  the supplied extent without that scan
  ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).
- `substr` is O(1) under the general rule and returns another view
  ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops),
  [`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- `copy` and `compare` are linear in the effective compared/copied length
  ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops)).
- Search members have worst-case complexity O(`size() * needle.size()`), though
  implementations are encouraged to do better
  ([`[string.view.find]`](https://eel.is/c++draft/string.view.find)).

### 4.7 Exceptions

- `at(pos)` throws `std::out_of_range` when `pos >= size()`; unchecked
  `operator[]` instead has a precondition
  ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- `substr(pos, count)` throws `std::out_of_range` when `pos > size()`
  ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops)).
- `copy(destination, count, pos)` throws `std::out_of_range` when
  `pos > size()` and otherwise copies the bounded effective length
  ([`[string.view.ops]`](https://eel.is/c++draft/string.view.ops)).
- The current iterator/sentinel constructor propagates exceptions from
  `end - begin`; the explicit range constructor propagates exceptions from
  `ranges::data` and `ranges::size`
  ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).

The page should not give the impression that the type can detect a dangling
source. Lifetime errors generally occur later during access and are not
reported as a library exception.

### 4.8 Invalidation and dangling hazards

- Any operation that invalidates a pointer in the viewed range also invalidates
  the view's pointers, iterators, and element references
  ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- Destroying an owning local `std::string`, replacing its buffer, or triggering
  a reallocation can therefore leave an existing view dangling. The exact
  invalidation event is governed by the owning type; `string_view` does not
  register with or extend that owner.
- A temporary `std::string` can safely supply a view used only during a function
  call whose accesses finish before the full expression ends, but storing or
  returning that view for later use is unsafe. Temporary objects are destroyed
  as the last step in evaluating their full expression
  ([`[class.temporary]`](https://eel.is/c++draft/class.temporary)).
- A view returned from a function may be safe when it refers to static storage
  or caller-owned storage, and unsafe when it refers to a local owning string.
  “Never return `string_view`” is therefore too broad; the contract must state
  the source lifetime.
- `data()` can point at a non-null-terminated buffer, and a substring view can
  end before the owner's null terminator. Length-aware APIs must receive both
  `data()` and `size()` ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).

### 4.9 Common teaching traps

- “A view owns a small copied string.” It copies only view state and remains
  non-owning ([`[string.view.template.general]`](https://eel.is/c++draft/string.view.template.general)).
- “`data()` is a C string.” The buffer is not required to be null-terminated at
  the view boundary ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).
- “Constructing from `nullptr` gives an empty view.” The pointer constructor
  requires a valid measured range, and the current synopsis deletes the
  `nullptr_t` overload ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).
- “The pointer constructor and pointer-length constructor are equivalent.” The
  first scans for a terminator and stops at an embedded null; the second uses
  the exact supplied length ([`[string.view.cons]`](https://eel.is/c++draft/string.view.cons)).
- “A `const string_view` means the source text cannot change.” It only prevents
  mutation through the view.
- “Returning any view is wrong.” Returning a view is correct when the referred
  storage has a documented sufficient lifetime; returning a view into a local
  owner is the error.
- “All operations are O(1).” The default rule has explicit exceptions for
  construction from a C string, comparison, copy, and searching.
- “`operator[]` throws on an invalid index.” It has a precondition; `at()` is
  the checked operation ([`[string.view.access]`](https://eel.is/c++draft/string.view.access)).

### 4.10 Deterministic original example designs

#### Minimal example: split without allocating

Goal: show by-value input, `find`, and two O(1) view slices while the literal
source has static lifetime.

```cpp
#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view record{"alice:admin"};
    const std::size_t separator = record.find(':');

    const std::string_view name = record.substr(0, separator);
    const std::string_view role = record.substr(separator + 1);
    std::cout << name << ' ' << role << '\n';
}
```

Expected stdout:

```text
alice admin
```

#### Engineering example: parse a request target during the call

Goal: accept both `std::string` and literals without copying, return owned
results rather than leaking a view beyond the input lifetime, and demonstrate
length-aware slicing.

```cpp
#include <iostream>
#include <optional>
#include <string>
#include <string_view>

struct RequestTarget {
    std::string path;
    std::optional<std::string> query;
};

RequestTarget parse_target(std::string_view target) {
    const std::size_t marker = target.find('?');
    if (marker == std::string_view::npos) {
        return {std::string{target}, std::nullopt};
    }

    return {
        std::string{target.substr(0, marker)},
        std::string{target.substr(marker + 1)}
    };
}

int main() {
    const std::string input{"/search?q=cpp"};
    const RequestTarget parsed = parse_target(input);
    std::cout << parsed.path << '\n';
    std::cout << parsed.query.value_or("<none>") << '\n';
}
```

Expected stdout:

```text
/search
q=cpp
```

### 4.11 Audit of the current Entry

Current files: `reference/entries/std-string-view/entry.json`, `content.md`, and
`examples/view-prefix.cpp`.

**Accurate but incomplete**

- The summary correctly identifies a non-owning view over contiguous
  characters.
- It correctly warns about local strings, temporary strings, owner
  reallocation, and non-null-terminated `data()`.
- Its complexity distinction between pointer/length and null-terminated-pointer
  construction is correct.
- The current `substr` example is deterministic and demonstrates a safe literal
  lifetime.

**Missing or potentially misleading through omission**

- “Usually copies two descriptor values” is plausible but implementation-shaped.
  Replace it with the normative, portable facts that the type is trivially
  copyable and member functions are O(1) unless specified otherwise.
- “The view must live less long than the characters” is directionally correct
  but too coarse. State the operational rule: every access requires the entire
  viewed range to remain valid; a dangling view object can exist without being
  able to diagnose itself.
- The declaration omits `data`, `empty`, indexed/checked access, slicing,
  modifiers, and search, leaving the page too thin for actual lookup.
- There is no constraints/preconditions section for null pointers, valid
  pointer ranges, index bounds, or prefix/suffix removal.
- It does not distinguish observation of source mutation from pointer
  invalidation.
- It does not explain embedded null characters or the semantic difference
  between the pointer and pointer-length constructors.
- It omits exception contracts for `at`, `substr`, and `copy`.
- Its complexity paragraph says comparison and search depend on lengths but
  does not give the standard guarantees: linear compare/copy and worst-case
  product for search.
- It should distinguish a temporary view used only during a call from a stored
  view that outlives the full expression; treating every temporary source as
  immediately invalid is too imprecise.
- The example is a good minimal slice but no engineering example demonstrates
  the crucial ownership boundary. Add a parser that accepts a view transiently
  and returns owned data.

## 5. Cross-entry editorial requirements

The implementation batch should apply these rules consistently:

1. Keep the three manifest summaries short; put formal detail in the Markdown
   body.
2. Add explicit “when not to use” content to prevent vocabulary types from
   becoming cargo-cult defaults.
3. Label representative declarations and standard-version differences beside
   the relevant overload, not only in a footnote.
4. Separate checked operations from precondition-based operations:
   `optional::value` versus `operator*`, and `string_view::at` versus
   `operator[]`.
5. State what is owned and what is borrowed before showing convenience syntax.
6. Do not invent complexity guarantees where the standard gives only an Effects
   expression. For `optional` and `make_unique`, describe operation counts and
   dependence on `T`; for `string_view`, state its explicit general and
   operation-specific bounds.
7. Give every Entry one compact syntax example and one engineering example that
   makes the abstraction's lifetime boundary visible.
8. Keep examples deterministic, warning-clean, and C++20-compatible. Do not use
   dangling behavior as a runtime demonstration; show the invalidation point in
   a comment and avoid the invalid access.
9. Preserve direct primary-source links in the manifest and add narrower source
   sections where the upgraded page relies on observers, modifiers,
   constructors, or core-language lifetime rules.

## 6. Primary-source index

### `std::optional`

- [Current Working Draft: optional objects, `[optional]`](https://eel.is/c++draft/optional)
- [Current Working Draft: constructors, `[optional.ctor]`](https://eel.is/c++draft/optional.ctor)
- [Current Working Draft: assignment, `[optional.assign]`](https://eel.is/c++draft/optional.assign)
- [Current Working Draft: observers, `[optional.observe]`](https://eel.is/c++draft/optional.observe)
- [Current Working Draft: modifiers, `[optional.mod]`](https://eel.is/c++draft/optional.mod)
- [Current Working Draft: monadic operations, `[optional.monadic]`](https://eel.is/c++draft/optional.monadic)
- [WG21 P0798R8: monadic operations for `std::optional`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0798r8.html)
- [WG21 N4659: 2017 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)

### `std::make_unique`

- [Current Working Draft: unique pointer creation, `[unique.ptr.create]`](https://eel.is/c++draft/unique.ptr.create)
- [Current Working Draft: unique pointer model, `[unique.ptr.general]`](https://eel.is/c++draft/unique.ptr.general)
- [Current Working Draft: single-object destructor, `[unique.ptr.single.dtor]`](https://eel.is/c++draft/unique.ptr.single.dtor)
- [Current Working Draft: new-expression, `[expr.new]`](https://eel.is/c++draft/expr.new)
- [WG21 N3656: `make_unique` Revision 1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3656.htm)

### `std::string_view`

- [Current Working Draft: string view classes, `[string.view]`](https://eel.is/c++draft/string.view)
- [Current Working Draft: class template, `[string.view.template]`](https://eel.is/c++draft/string.view.template)
- [Current Working Draft: construction, `[string.view.cons]`](https://eel.is/c++draft/string.view.cons)
- [Current Working Draft: element access, `[string.view.access]`](https://eel.is/c++draft/string.view.access)
- [Current Working Draft: modifiers, `[string.view.modifiers]`](https://eel.is/c++draft/string.view.modifiers)
- [Current Working Draft: operations, `[string.view.ops]`](https://eel.is/c++draft/string.view.ops)
- [Current Working Draft: searching, `[string.view.find]`](https://eel.is/c++draft/string.view.find)
- [WG21 N3921: `string_view`, revision 7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n3921.html)
- [WG21 N4659: 2017 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
