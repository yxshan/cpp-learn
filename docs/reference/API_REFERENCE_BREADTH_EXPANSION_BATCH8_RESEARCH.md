# C++ Reference 第八批：异构值、和类型与可调用对象扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-08-31
>
> 精确范围：`std::tuple`、`std::variant`、`std::any`、`std::expected`、
> `std::function`
>
> 事实基线：C++11 最终工作草案 N3337、C++17 最终工作草案 N4659、C++20
> 最终工作草案 N4861、C++23 最终工作草案 N4950、当前 C++ Working Draft 和
> WG21 原始提案。zh.cppreference 只作为二级信息架构与覆盖检查参考。

## 1. 批次目标与版本边界

本批恰好增加五个 Entry，形成一条从“固定异构记录”到“运行时类型擦除”的学习路径：

1. `tuple<Ts...>`：编译期已知、固定长度的异构积类型；
2. `variant<Ts...>`：编译期列举全部候选、运行时只激活一个候选的和类型；
3. `any`：候选集合不写在类型中，但取值必须做精确运行时类型检查；
4. `expected<T, E>`：业务值或错误二选一，并显式管理两者生命周期；
5. `function<R(Args...)>`：把不同可调用对象擦除为固定调用签名。

默认教学基线仍是 C++20，只有 `std::expected` 必须使用 C++23。禁止为了统一示例版本把
`expected` 标为 C++20，也禁止用第三方 polyfill 冒充 `std::expected`。C++20 页面也不能把当前
草案中的下列后续接口回写成既有能力：

- `tuple-like` 泛化、更多 const-qualified tuple 操作来自 C++23 及以后；
- `variant::visit` 成员是 C++26；C++20/C++23 应使用非成员 `std::visit`；
- `expected::has_error()` 是 C++26 演进，不在 N4950；
- `std::move_only_function` 是 C++23 的另一类型，不是 `std::function` 的成员或模式；
- 当前草案中的修复若未作为缺陷报告追溯适用，不应默认为 C++20 合同。

## 2. 可直接用于 manifest 的身份矩阵

| 建议 ID | kind | symbol | direct header | namespace | `since` | 建议示例标准 | 主规范锚点 |
|---|---|---|---|---|---|---|---|
| `std-tuple` | `type` | `std::tuple` | `<tuple>` | `std` | `c++11` | `c++20` | [`[tuple]`](https://eel.is/c++draft/tuple) |
| `std-variant` | `type` | `std::variant` | `<variant>` | `std` | `c++17` | `c++20` | [`[variant]`](https://eel.is/c++draft/variant) |
| `std-any` | `type` | `std::any` | `<any>` | `std` | `c++17` | `c++20` | [`[any]`](https://eel.is/c++draft/any) |
| `std-expected` | `type` | `std::expected` | `<expected>` | `std` | `c++23` | `c++23` | [`[expected]`](https://eel.is/c++draft/expected) |
| `std-function` | `type` | `std::function` | `<functional>` | `std` | `c++11` | `c++20` | [`[func.wrap.func]`](https://eel.is/c++draft/func.wrap.func) |

建议分类均为 `utilities`；`std-function` 还可通过 aliases 和 related entries 连接到 callable、
lambda 与 callback 搜索意图。每个 manifest 都应直接列出所属最终工作草案，不能只引用当前草案。

## 3. 跨条目选择矩阵

| 需求 | 首选 | 不应误选 |
|---|---|---|
| 固定字段数量、每个位置类型已知 | `tuple`；若字段有稳定业务名称，优先普通 `struct` | `any` |
| 候选类型有限且希望访问时穷举处理 | `variant` | 以 `any` 隐藏本来已知的候选集合 |
| 插件/属性袋等确实无法预列所有类型 | `any` | 把 `any` 当动态语言变量并期待隐式转换 |
| 同步计算需要携带可检查的错误值 | `expected` | 把它说成 Promise、Future 或异步任务 |
| 需要拥有并复制不同类型的回调 | `function` | 用它保存 move-only callable；C++23 应另看 `move_only_function` |

这五种类型都不是垃圾回收句柄。它们拥有的子对象随外层对象销毁；其中显式存储的引用、
`reference_wrapper`、引用捕获或原始指针仍然是非拥有关系。

## 4. `std::tuple`

### 4.1 C++20 代表接口

```cpp
template<class... Types>
class tuple;

template<std::size_t I, class... Types>
constexpr tuple_element_t<I, tuple<Types...>>& get(tuple<Types...>&) noexcept;

template<class T, class... Types>
constexpr T& get(tuple<Types...>&) noexcept; // T 必须恰好出现一次

template<class... TTypes>
constexpr tuple<unwrap_ref_decay_t<TTypes>...>
make_tuple(TTypes&&...);
```

- `tuple` 从 C++11 起可用；按类型 `get<T>` 从 C++14 起；类模板实参推导（CTAD）、
  `apply` 与 `make_from_tuple` 从 C++17 起。
- `tuple<Ts...>` 是固定长度异构集合；模板参数顺序就是元素索引顺序。
- `get<I>` 的 `I` 必须在范围内；`get<T>` 要求 `T` 在元素类型中恰好出现一次，否则程序不良构。
- CTAD 的 `tuple{x}` 通常推导并按值存储；它不采用 `make_tuple` 对
  `reference_wrapper` 的特殊解包规则。`make_tuple(std::ref(x))` 则产生引用元素。

### 4.2 返回、错误、复杂度与生命周期

- `get` 按 tuple 的 cv/ref 类别返回对应元素引用；不会复制元素，也不延长外部对象生命期。
- tuple 构造、复制、移动、赋值和 swap 按元素执行；异常来自相应元素操作。没有专用
  `bad_tuple_access` 异常，越界索引或不唯一类型是编译期错误。
- 标准以逐元素效果规定构造/赋值成本；元素访问是直接返回某个子对象引用。正文可写“访问不遍历
  其他元素”，不要把实现布局或空基类优化写成保证。
- 值元素的生命期由 tuple 管理；tuple 销毁时结束。`tuple<T&...>`、`tie`、
  `forward_as_tuple` 只保存引用，外部对象或临时量先结束就悬空。当前草案也明确
  `forward_as_tuple` 的结果不得比实参活得更久。

线程安全沿用 [`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)：不同 tuple
对象可独立使用；同一对象并发只读可以，任何元素写入或 tuple 赋值需要同步。引用元素可能让不同
tuple 别名到同一外部对象，此时仍按该外部对象判断竞争。

### 4.3 常见误区与 JS/TS 对照

- 字段拥有长期稳定语义时仍用匿名 `get<3>`，降低可读性；这种情况优先 `struct`。
- 误以为 structured binding 一定产生引用；`auto [a, b] = tuple` 是绑定到副本，
  `auto& [a, b] = tuple` 才保留对原 tuple 元素的引用语义。
- 存储 `forward_as_tuple(temporary...)` 的结果。
- 误以为 CTAD 与 `make_tuple(std::ref(x))` 都会产生 `T&`。

TypeScript tuple（如 `[string, number]`）适合类比“位置和类型在声明时固定”；运行时仍是普通 JS
Array，而 C++ tuple 的元素类型影响重载、对象布局和析构。JS 解构可帮助理解 structured binding，
不能推出 C++ 的复制/引用与生命期规则。

### 4.4 两个确定性示例

1. `structured-record.cpp`：CTAD 构造 `tuple<string, int, bool>`，用 `auto&` structured
   binding 修改 priority。精确 stdout：

   ```text
   name=compile priority=3 cached=true
   ```

2. `make-tuple-reference.cpp`：`make_tuple(ref(counter), string("ready"))`，通过 `get<0>`
   修改外部整数。精确 stdout：

   ```text
   counter=5 status=ready
   ```

推荐关系：`std-pair`、`std-forward`、`std-apply`（未来）、`std-variant`。

## 5. `std::variant`

### 5.1 C++20 代表接口与状态

```cpp
template<class... Types>
class variant;

template<class T, class... Types>
constexpr bool holds_alternative(const variant<Types...>&) noexcept;

template<std::size_t I, class... Types>
constexpr variant_alternative_t<I, variant<Types...>>& get(variant<Types...>&);

template<std::size_t I, class... Types>
constexpr add_pointer_t<variant_alternative_t<I, variant<Types...>>>
get_if(variant<Types...>*) noexcept;

template<class Visitor, class... Variants>
constexpr decltype(auto) visit(Visitor&&, Variants&&...);
```

- `<variant>` 与 `variant` 从 C++17 起；原始标准化设计见
  [P0088R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0088r3.html)。
- 每个对象通常持有且管理一个 active alternative。默认构造选择索引 0，因此第一个类型必须可默认
  构造；可用 `monostate` 提供空样占位。
- 类型可以重复；按类型的 `get<T>`/`holds_alternative<T>` 只在 `T` 恰好出现一次时成立，按索引
  接口没有此限制。
- `index()` 返回当前索引；若处于 valueless-by-exception 状态则返回 `variant_npos`。

### 5.2 错误、复杂度与 `valueless_by_exception`

- `get` 的索引/类型不匹配时抛 `bad_variant_access`；`get_if` 在空指针或不匹配时返回 `nullptr`；
  `visit` 遇到 valueless variant 也抛 `bad_variant_access`。
- 当前草案对一个或零个 variant 的 `visit` 调用要求相对候选数量为常数时间；多个 variant 的
  调用没有同样的复杂度要求。不要承诺具体 jump table 或代码尺寸。
- 类型切换赋值或 `emplace` 先后需要结束旧 alternative、构造新 alternative；若新构造抛异常，
  variant **可能** `valueless_by_exception()`。规范允许实现通过备份避免该状态，因此不能编写断言
  “一次抛出后一定 valueless”的跨实现示例。
- alternative 切换会结束旧子对象生命期；此前指向旧 alternative 的引用/指针立即失效。仅修改
  当前 alternative 内部值而不结束其生命期时，普通引用规则仍适用。

不同 variant 对象独立；同一对象只读观察可并发，切换/赋值 alternative 或修改 active value 需要
同步。若 active value 自身含共享状态，仍由该类型的线程安全合同决定。

### 5.3 常见误区与 JS/TS 对照

- 把 `variant` 当“永不为空”；它没有用户可选 empty 状态，但存在罕见的异常失值状态。
- 先 `holds_alternative` 再跨越可能切换状态的调用使用旧判断；并发下这更不是同步方案。
- 用 `get<T>` 访问重复类型。
- 只写一个 catch-all visitor，失去新增 alternative 时的编译期提示。
- 在 C++20 内容中写 `v.visit(...)`；应写 `std::visit(visitor, v)`。

TypeScript discriminated union 是最接近的类比：都用 tag 决定当前分支。C++ variant 的候选是对象
表示的一部分、管理析构且可能抛 `bad_variant_access`；TS narrowing 是静态分析，不等于 C++ visitor
的值类别、重载和生命周期。

### 5.4 两个确定性示例

1. `visit-response.cpp`：依次访问 `variant<int, string>` 的两个正常状态。精确 stdout：

   ```text
   status=200
   message=ready
   ```

2. `checked-access.cpp`：先用 `get_if<int>` 成功读取，再故意 `get<string>` 并捕获
   `bad_variant_access`。精确 stdout：

   ```text
   value=42
   wrong alternative
   ```

推荐关系：`std-optional`、`std-any`、`std-expected`、`std-tuple`。

## 6. `std::any`

### 6.1 C++20 代表接口与精确类型规则

```cpp
class any {
public:
  constexpr any() noexcept;
  any(const any&);
  any(any&&) noexcept;
  template<class T> any(T&&);
  template<class T, class... Args> decay_t<T>& emplace(Args&&...);
  void reset() noexcept;
  bool has_value() const noexcept;
  const type_info& type() const noexcept;
};

template<class T> T any_cast(const any&);
template<class T> T* any_cast(any*) noexcept;
```

- `<any>` 与 `any` 从 C++17 起；设计源流见
  [N3804](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3804.html)。
- `any` 本身不是类模板，但转换构造器保存 `decay_t<T>` 的一个值；所存类型必须满足
  CopyConstructible 要求，所以不能直接保存只可移动对象。
- 类型匹配是精确的：存入 `int` 后 `any_cast<double>` 不做数值转换，字符串字面量经 decay 后也
  不是 `std::string`。
- 值/引用形式 `any_cast` 失败抛 `bad_any_cast`；指针形式失败返回 `nullptr` 且 `noexcept`。

### 6.2 分配、复杂度与生命周期

- 规范建议实现对小对象避免动态分配，但这是 recommended practice，不保证 buffer 大小，也不保证
  任意“小类型”不分配。SBO 只能用于 nothrow-move-constructible 的类型。页面不得依据
  `sizeof(T)` 承诺无分配。
- 构造、复制、赋值或 `emplace` 的成本与 contained value 的相应操作以及可能的分配有关；
  规范没有给出可用于容量规划的固定 SBO/复杂度阈值。
- `reset`、替换、成功 `emplace` 和析构会结束旧 contained value 的生命期，使先前
  `any_cast<T&>`/`any_cast<T*>` 的结果失效。move 后源 `any` 有效但状态未指定，不能假设必为空。
- `emplace` 构造失败时，旧值已经销毁且 `any` 变为空；这一点应与 variant 的“可能 valueless”
  分开说明。

同一 `any` 的 `has_value`/`type` 只读观察可并发；reset、赋值、emplace 或经引用修改 contained
value 时需要同步。复制出的两个 `any` 拥有两个值，但值内部仍可能共享指针状态。

### 6.3 常见误区与 JS/TS 对照

- 认为 `any_cast<T>` 会像 JS 一样做隐式转换。
- 用异常作为日常分支，而本来可用指针形式探测。
- 把实现观察到的 SBO 尺寸当 ABI/标准保证。
- 保存 `any_cast<T&>` 后替换 `any`。
- 用 `any` 代替候选集合已经明确的 `variant`，丢失穷举检查。

TypeScript 的 `unknown` 比 `any` 更接近：读取前需要缩窄/验证；TS `any` 反而关闭类型检查。
但 C++ `std::any` 拥有一个复制出的具体对象并按精确 RTTI 类型取值，不是 JS 对象引用变量，也不是
结构类型检查。

### 6.4 两个确定性示例

1. `exact-type-check.cpp`：保存 `int`，值 cast 成功，`any_cast<double>(&value)` 返回 null。
   精确 stdout：

   ```text
   int=42
   double=false
   ```

2. `replace-and-catch.cpp`：`emplace<string>("ready")` 后读值，再错误 cast 并捕获
   `bad_any_cast`，最后 reset。精确 stdout：

   ```text
   value=ready
   bad cast
   has_value=false
   ```

推荐关系：`std-variant`、`std-optional`、`std-function`。

## 7. `std::expected`

### 7.1 C++23 身份与代表接口

```cpp
template<class T, class E>
class expected;

template<class E>
class unexpected;

template<class E>
class bad_expected_access;

// 代表观察接口
constexpr bool has_value() const noexcept;
constexpr T& value() &;
constexpr E& error() & noexcept;

// C++23 monadic operations，各有 &, const&, &&, const&& 版本
template<class F> constexpr auto and_then(F&&) &;
template<class F> constexpr auto or_else(F&&) &;
template<class F> constexpr auto transform(F&&) &;
template<class F> constexpr auto transform_error(F&&) &;
```

- `std::expected` 只从 C++23 起，direct header 是 `<expected>`。核心提案是
  [P0323R12](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p0323r12.html)，最终
  C++23 合同见 [N4950](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/n4950.pdf)
  `[expected]`。
- `and_then`、`or_else`、`transform`、`transform_error` 同样属于 C++23，而不是 C++26；由
  [P2505R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2505r5.html) 加入并已在
  N4950。基础实现的 feature-test 值为 `202202L`，包含 monadic operations 的实现应达到
  `__cpp_lib_expected >= 202211L`。
- N4950 有 `error_or`，但没有 `has_error()`；后者是后续演进，C++23 写 `!result.has_value()`。
- `expected<T,E>` 永远处于 value 或 error 二选一状态，不存在 variant 式
  valueless-by-exception 状态。`unexpected(error)` 或 `unexpect` 标签用于明确构造错误分支。

### 7.2 返回、错误、复杂度与生命周期

- `value()` 在错误分支抛携带当前错误的 `bad_expected_access<E>`；`operator*`/`operator->`
  要求当前有值，不提供相同的抛异常检查。
- `error()` 要求当前是错误分支；不要把 `noexcept` 误解为它会在 value 分支返回默认错误。
- monadic operations 只调用对应分支：`and_then`/`transform` 处理 value，`or_else`/
  `transform_error` 处理 error；回调的返回类型和错误类型受各 overload 的约束。
- 观察接口不遍历；状态切换的工作和异常取决于 T/E 的构造、移动、赋值与析构。标准通过约束维持
  “总有一个分支”的不变量，页面不应虚构动态分配或固定大小保证。
- 切换分支会结束旧 contained object 的生命期；此前由 `value()`、`error()`、`operator*` 得到的
  引用/指针失效。单纯读取不会延长外部对象通过引用成员所引用的对象生命期。

不同 expected 对象独立；同一对象并发只读可行，切换状态或修改 contained value/error 需要同步。

### 7.3 常见误区与 JS/TS 对照

- 把 expected 当异常机制的自动替代；它适合可预期、调用者需要显式处理的错误值。
- 未检查就用 `*result`，误以为会抛 `bad_expected_access`。
- 写 C++23 不存在的 `has_error()`。
- 误以为 `and_then` 返回裸值；它要求返回另一个 expected，裸值映射通常用 `transform`。
- 把 expected 当异步 Promise；它只是当前已完成计算的同步值对象。

TS 最接近的模型是
`{ ok: true; value: T } | { ok: false; error: E }` 这样的 discriminated union，或用户态 Result。
Promise 解决的是未来完成与调度，不能类比 expected 的核心合同。

### 7.4 两个确定性 C++23 示例

1. `parse-positive.cpp`：返回 `expected<int, string>`，分别处理 `42` 和 `-3`。精确 stdout：

   ```text
   value=42
   error=not positive
   ```

2. `transform-result.cpp`：成功值经 `transform` 加倍，失败值跳过 transform 并保留错误。
   精确 stdout：

   ```text
   answer=42
   error=invalid
   ```

### 7.5 本机工具链与验证策略

本机 `/usr/bin/clang++` 是 Apple Clang 15：

- `-std=c++23` 被驱动程序拒绝，提示使用 `-std=c++2b`；
- 同一编译器以 `-std=c++2b` 可以编译 `<expected>` 基础用法；
- 以 `-std=c++2b` 也可以编译 `expected::transform`，说明本机 libc++ 已提供所需 monadic API。

因此当前 checker 中把 manifest 的 `c++23` 固定映射为 `-std=c++23` 会产生**工具选项误报**，不是
标准库不支持。实施顺序应是：先让 toolchain probe 为 C++23 选择编译器实际支持的
`-std=c++23` 或 `-std=c++2b`，再把两个示例按 manifest `standard: "c++23"` 正常验证。若暂时不能
修改 checker，应把该工具链状态显式记为 unsupported，不能改成 C++20、删除 monadic 事实、或用
polyfill 降低标准。当前 schema 每个 Entry 至少需要一个示例，故“先省略 expected 示例”也不是
干净的长期方案。

推荐关系：`std-optional`、`std-variant`、`std-string-view`。

## 8. `std::function`

### 8.1 C++20 代表接口与所有权

```cpp
template<class R, class... ArgTypes>
class function<R(ArgTypes...)> {
public:
  function() noexcept;
  function(nullptr_t) noexcept;
  function(const function&);
  function(function&&) noexcept;
  template<class F> function(F); // C++20 形式

  explicit operator bool() const noexcept;
  R operator()(ArgTypes...) const;
  const type_info& target_type() const noexcept;
  template<class T> T* target() noexcept;
};
```

- `<functional>` 与 `std::function` 从 C++11 起；原始多态调用包装器设计见
  [N1402](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2002/n1402.html)。
- 类型参数是完整调用签名，不是 callable 类型。包装器通常拥有 callable 的 decayed copy，因此
  callable 必须 CopyConstructible；move-only lambda 不能存入 `std::function`。
- 从 `reference_wrapper<F>` 构造时包装器非拥有地引用 F；lambda 的引用捕获也继续引用外部对象，
  这些对象必须活过所有调用。
- 空包装器可由默认构造、nullptr 或空 function 得到；先用显式 bool 检查是否有 target。

### 8.2 错误、分配、复杂度与生命周期

- 调用空 function 抛 `bad_function_call`；非空调用传播 target 抛出的异常。
- 构造/复制可能抛 `bad_alloc` 或 callable copy/initialization 的异常。对 function pointer 和
  `reference_wrapper` 的相关构造/复制，规范保证不抛；对一般小 callable 只建议避免动态分配，
  未规定通用 SBO 大小。
- `operator()` 的成本包括一次类型擦除分派和 target 本身工作，但标准不给固定纳秒、内联或分配
  保证。性能敏感热路径应测量，不能仅凭“小 lambda”断言零开销。
- reset/赋值/析构结束 owned target 的生命期；`target<T>()` 返回的指针随后失效。复制 function
  通常复制 target，但引用捕获、指针字段或 reference_wrapper 仍可能让副本共享外部状态。
- C++23 起，若 function 的引用返回类型会绑定到 target 调用产生的临时量，构造应为不良构；
  这条防线来自
  [P2255R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2255r2.html)。
  在 C++20 中该写法可能编译却立即产生悬空引用，因此页面必须展示安全的显式引用返回目标，不能
  运行 UB 示例。

`operator()` 虽为 const，却可能调用会修改状态的 target。并发调用同一个 function 只有在 target
及其捕获状态自身支持并发时才安全；包装器赋值、swap、销毁或与调用并发都需要外部同步。

### 8.3 常见误区与 JS/TS 对照

- 认为 `std::function` 接受任意 callable，包括 move-only callable。
- 未检查空状态就调用。
- 把复制 function 误认为深复制所有捕获对象；引用/指针捕获仍然别名。
- 返回引用的 function 包装返回 prvalue 的 lambda，在 C++20 留下悬空引用。
- 假设所有小 lambda 都不会分配或一定内联。

JS 函数是一等值，TS 函数类型也能描述签名，适合类比“统一回调形状”；`std::function` 额外执行
C++ 类型擦除、拥有/复制 target，并受确定析构和引用生命周期约束，不由 GC 自动延长引用捕获对象。

### 8.4 两个确定性示例

1. `replace-operation.cpp`：同一个 `function<int(int,int)>` 先保存加法 lambda，再替换为乘法。
   精确 stdout：

   ```text
   add=5
   multiply=6
   ```

2. `empty-and-capture.cpp`：捕获空调用的 `bad_function_call`，再安全地引用捕获仍在作用域内的
   counter 并调用。精确 stdout：

   ```text
   empty call
   count=1
   ```

推荐关系：`std-any`、`std-forward`、lambda/callable 教程、`std-move-only-function`（未来）。

## 9. 一级来源与二级覆盖参考

| 范围 | 一级来源 |
|---|---|
| C++11 tuple/function 基线 | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) `[tuple]`、`[func.wrap]` |
| C++17 tuple/variant/any | [N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) `[tuple]`、`[variant]`、`[any]` |
| C++20 页面基线 | [N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) 对应条款 |
| C++23 expected 与边界 | [N4950](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/n4950.pdf) `[expected]`、`[func.wrap.func]` |
| 当前演进检查 | [C++ Working Draft](https://eel.is/c++draft/) 对应稳定锚点 |
| variant 原始设计 | [P0088R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0088r3.html) |
| any 原始设计 | [N3804](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3804.html) |
| expected 原始设计 | [P0323R12](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p0323r12.html) |
| expected monadic ops | [P2505R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2505r5.html) |
| function 原始设计 | [N1402](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2002/n1402.html) |
| C++23 临时量引用防线 | [P2255R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2255r2.html) |

二级页面只用于检查读者预期的栏目和别名：

- [zh.cppreference: tuple](https://zh.cppreference.com/w/cpp/utility/tuple)
- [zh.cppreference: variant](https://zh.cppreference.com/w/cpp/utility/variant)
- [zh.cppreference: any](https://zh.cppreference.com/w/cpp/utility/any)
- [zh.cppreference: expected](https://zh.cppreference.com/w/cpp/utility/expected)
- [zh.cppreference: function](https://zh.cppreference.com/w/cpp/utility/functional/function)

正文必须自行组织和表述，不复制 cppreference 页面；参数、返回、异常、复杂度和版本结论最终都应
回指上述草案或提案。

## 10. 实施与审查清单

- Catalog 本批只增加上述五个 ID；版本和总数由实现阶段统一更新。
- 每项恰好准备两个确定性示例，共新增 10 个；variant 不用跨实现不确定的 valueless 状态作为
  expected stdout，function 不运行悬空引用示例。
- 前四个 C++20 条目分别以 N4861 为签名基线；expected 以 N4950/C++23 为基线。
- `std::expected` 示例落地前先修正 toolchain 对 C++23 的 flag 选择，并以 feature-test macro 或
  实际编译 probe 验证 monadic support。
- 页面至少含：直接头文件、since、代表声明、参数/约束、返回、错误、复杂度、生命周期/失效、
  线程安全、常见误区、两个示例、JS/TS 对照、版本演进和一级来源。
- 终审显式搜索并拒绝：C++20 expected、C++20 `variant::visit` 成员、C++23 `has_error()`、
  “any SBO 保证”、"variant 抛异常后一定 valueless"、"function 能保存 move-only lambda"、
  “CTAD 与 make_tuple 的 reference_wrapper 规则相同”。
