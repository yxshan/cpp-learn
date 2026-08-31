# C++ Reference 第七批：Utility 值类别与二元词汇类型扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-08-31
>
> 精确范围：`<utility>`、`std::move`（utility cast，不是算法）、
> `std::forward`、`std::swap`、`std::pair`
>
> 规范事实来源：C++20 最终工作草案 N4861、当前 C++ Working Draft 和 WG21
> 历史草案/提案。zh.cppreference 仅作为二级信息架构与覆盖检查参考。

## 1. 研究目标与边界

本批恰好增加五个 Entry，把 `<utility>` 中最常用的四个实体连成一条学习路径：先理解
`std::pair` 的二元值语义，再用 `std::swap` 交换值，用 `std::move` 显式产生可被消费的 xvalue，
最后在泛型包装器中用 `std::forward` 保留调用者的值类别。

所有可运行示例固定为 C++20。精确声明以
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) 为基线；
当前 Working Draft 只用于稳定锚点和发现后续演进，不能把下列晚于 C++20 的接口写进 C++20
声明：

- `std::forward_like` 是 C++23 的 [P2445R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2445r1.pdf)；
- `std::to_underlying`、`std::unreachable` 以及更多 `<utility>` 设施晚于 C++20；
- `pair-like` 构造/赋值、`const pair` 赋值与交换等当前 `pair` overload 来自 C++23 及以后，
  其中 tuple-like 互操作的主提案是
  [P2165R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2165r4.pdf)；
- 当前草案允许异构 `pair<T1,T2>` 与 `pair<U1,U2>` 的比较；N4861 的 C++20 比较重载两侧是同一
  `pair<T1,T2>` 特化，不能回写当前签名。

“move”在本批只指 `<utility>` 中把表达式转换为 xvalue 的 `std::move`。它不是
`std::move(first, last, result)` 范围算法；算法版本属于 `<algorithm>`，接收三个迭代器并逐元素
移动赋值，未来若增加必须使用不同 Entry ID。

## 2. 条目身份、版本与主锚点

| 建议 ID | 符号 | kind | direct header | namespace | `since` | 分类 | 当前草案主锚点 |
|---|---|---|---|---|---|---|---|
| `header-utility` | `<utility>` | `header` | `<utility>` | `std` 设施集合 | `c++98` | `utilities` | [`[utility.syn]`](https://eel.is/c++draft/utility.syn) |
| `std-move` | `std::move` | `function` | `<utility>` | `std` | `c++11` | `utilities` | [`[forward]`](https://eel.is/c++draft/forward) |
| `std-forward` | `std::forward` | `function` | `<utility>` | `std` | `c++11` | `utilities` | [`[forward]`](https://eel.is/c++draft/forward) |
| `std-swap` | `std::swap` | `function` | `<utility>`（C++20） | `std` | `c++98` | `utilities` | [`[utility.swap]`](https://eel.is/c++draft/utility.swap) |
| `std-pair` | `std::pair` | `type` | `<utility>` | `std` | `c++98` | `utilities` | [`[pairs.pair]`](https://eel.is/c++draft/pairs.pair) |

[N2356 的 `<utility>` 与 pair 条款](https://www.open-std.org/jtc1/sc22/open/n2356/lib-utilities.html)
直接证明 `<utility>`、`pair` 和 `make_pair` 的 C++98 身份；N2356 的
[`[lib.alg.swap]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html)
证明通用 `std::swap` 已是 C++98 算法。C++11 将通用 `swap` 的直接声明入口放进 `<utility>`，并加入
array overload、`move` 与 `forward`；这些边界可由
[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) 的
`[utility]`、`[forward]` 与 `[pairs]` 复核。因此 `std::swap` Entry 的 `since` 是 C++98，
但本站 C++20 页面必须要求直接 `#include <utility>`，不能依赖历史 `<algorithm>` 位置或传递包含。

## 3. 跨条目 C++20 语义防线

### 3.1 `std::move` 和 `std::forward` 都只是 cast helper

N4861 `[forward]` 把两者分别规定为返回
`static_cast<remove_reference_t<T>&&>(t)` 与 `static_cast<T&&>(t)`。它们不分配、不销毁、
不调用对象的移动构造，也不延长任何对象的生命周期。真正的复制或移动发生在后续重载决议选中了某个
构造/赋值操作之后。因此页面不能写“调用 `std::move` 就清空源对象”，也不能把移动后状态套到只做
cast、尚未被消费的表达式上。

### 3.2 forwarding reference、类型推导与引用折叠必须一起解释

当前与 C++20 `[temp.deduct.call]` 都规定：forwarding reference 是指向 cv-unqualified 函数模板
参数的 rvalue reference；当实参为 lvalue 时，模板参数按 lvalue reference 推导。
[`[dcl.ref]`](https://eel.is/c++draft/dcl.ref) 的引用折叠规则随后使 `T&&` 在 `T = U&` 时折叠为
`U&`。于是：

| 调用包装器 `template<class T> relay(T&& x)` | 推导 `T` | 参数类型 | `std::forward<T>(x)` |
|---|---|---|---|
| `relay(value)`，`value` 是 lvalue | `U&` | `U&` | lvalue `U&` |
| `relay(U{})`，实参是 prvalue | `U` | `U&&` | xvalue `U&&` |

命名变量表达式 `x` 自身始终是 lvalue，即使其声明类型是 `T&&`；这正是包装器内部需要
`std::forward<T>(x)` 的原因。`const T&&` 不是 forwarding reference；类模板已经固定的 `T&&`
也不自动成为 forwarding reference。

### 3.3 `swap` 的自定义协议依赖 ADL

泛型代码应使用：

```cpp
using std::swap;
swap(a, b);
```

这使候选集同时包含标准 fallback 和由 argument-dependent lookup 找到的关联命名空间 overload。
直接写 `std::swap(a, b)` 会绕开 ADL 定制。当前
[`[swappable.requirements]`](https://eel.is/c++draft/swappable.requirements) 明确用这两组候选定义
Swappable；不能把“给 `std::swap` 添加任意用户 overload”教成定制方法。

### 3.4 引用结果与引用成员都不拥有对象

`move`/`forward` 返回引用，`pair<T&, U&>` 的两个成员也只是别名。它们不会延长被引用对象生命期，
也不使悬空访问安全。C++20 中把 temporary 传给 reference-element `pair` 构造器可能在完整表达式
结束后留下 dangling reference；当前草案中基于 `reference_constructs_from_temporary` 的删除规则
不能假装是 C++20 已有防线。

## 4. `<utility>` 头文件页

### 4.1 C++20 reduced facility map 与版本

| 学习目的 | C++20 代表设施 | 首次标准 / 演进 | 页面分流 |
|---|---|---|---|
| 二元异构值 | `pair`、`make_pair`、`get`、`piecewise_construct` | pair/make_pair C++98；其余主要为 C++11 | 进入 `std::pair` |
| 值交换 | 通用与 array `swap` | 通用函数 C++98；`<utility>` 入口与 array overload C++11；C++20 `constexpr` | 进入 `std::swap` |
| 值类别转换 | `move`、`move_if_noexcept` | C++11 | cast 与异常安全分流 |
| 完美转发 | `forward` | C++11 | 进入 `std::forward` |
| 替换并取旧值 | `exchange` | C++14，[N3668](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3668.html) | 状态机/句柄更新 |
| 编译期索引序列 | `integer_sequence`、`index_sequence` 家族 | C++14，[N3658](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3658.html) | 参数包展开 |
| 只读 lvalue view | `as_const` | C++17，[N4380](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4380.html) 与 N4659 | 不复制地选择 const overload |
| 原位构造标签 | `in_place`、`in_place_type`、`in_place_index` | C++17 | `optional` / `variant` / `any` 构造 |
| 安全整数比较 | `cmp_equal`、`cmp_less` 等与 `in_range` | C++20，[P0586R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0586r2.html) | 有/无符号整数比较 |

`std::swap` 的 C++20 `constexpr` 来自
[P0879R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0879r0.html)；pair 的
C++20 `<=>` 集成由
[P1614R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1614r2.html) 复核。
页面只展示能帮助学习者选路的 facility family，不复制整个 synopsis。

### 4.2 参数、返回、错误、复杂度与生命周期

头文件本身没有调用参数、返回值或运行时错误合同；这些属于分流后的实体页。它只提供声明，必须在
首次使用相应标准实体前直接 `#include <utility>`。头文件不取得任何对象所有权，也没有独立复杂度。
页面应明确：另一个标准头“碰巧”使某个 utility 名字可见不是可移植保证。

### 4.3 选择、常见误区与 JS/TS 对照

- 用于通用值操作、值类别 helper、pair 与编译期小工具；算法范围移动仍去 `<algorithm>`。
- 不要把 `<utility>` 当“杂物箱”并一次讲完整 synopsis；应按 learner intent 跳转实体页。
- 不要因为某个容器头当前能编译就省略直接 include。
- JavaScript/TypeScript 没有对应的标准头：ES module import 是运行/模块依赖关系，而 C++
  `#include <utility>` 在翻译阶段提供声明。TS 类型擦除也没有 C++ 值类别 helper 的运行语义。

推荐 `relatedEntryIds`：`std-move`、`std-forward`、`std-swap`、`std-pair`、
`header-memory`、`algorithms`。

### 4.4 两个确定性示例构想

1. `exchange-state.cpp`：`std::exchange(state, "running")` 同时输出旧值和新值。
   精确 stdout：`old=idle\ncurrent=running\n`。
2. `utility-family.cpp`：构造 `std::pair<std::string, int>{"ok", 200}`，交换两个整数，固定输出
   pair 字段与交换结果。精确 stdout：`ok=200\nleft=2 right=1\n`。

## 5. `std::move`（utility cast）

### 5.1 C++20 代表声明与参数

```cpp
template<class T>
constexpr std::remove_reference_t<T>&& move(T&& t) noexcept;
```

- direct header：`<utility>`；namespace：`std`；首次标准：C++11；C++14 起 `constexpr`。
  C++11 身份由 N1856 与 N3337 复核，C++14 `constexpr` 演进由 N3471 和 N3647 的采纳记录复核。
- `t` 是 forwarding reference，可接受 lvalue 或 rvalue；模板推导后先移除 `T` 的引用部分，再返回
  指向同一对象的 rvalue reference。
- 目标对象必须仍在 lifetime 内；函数不要求类型真的具有 move constructor。

### 5.2 返回、错误、复杂度与生命周期

返回 `static_cast<remove_reference_t<T>&&>(t)`，即引用同一对象的 xvalue。返回值不拥有对象，
不复制、不移动、不分配且函数为无条件 `noexcept`；标准没有单列复杂度，因为其规范效果只是 cast。
消费该结果的构造/赋值才可能抛异常，并决定源对象是否进入 valid-but-unspecified 或类型专门规定的
状态。对标准库类型，真正被移动后的通用基线见 N4861 `[lib.types.movedfrom]`：除非对应组件另有
规定，源对象处于有效但未指定状态；这条规则不由 `std::move` cast 本身触发。

对 const 对象，结果通常是 `const T&&`；常见 move constructor 接受 `T&&` 而不能绑定 const，
因此后续重载往往退回复制。把 temporary 送入 `std::move` 再把返回引用保存到更长作用域不会延长
temporary 生命周期。

### 5.3 选择、常见误区与 JS/TS 对照

在明确把一个仍有名字的对象交给消费型 API、之后不再依赖其旧值时使用。不要为了“优化”所有 return
表达式都加 `std::move`；它可能妨碍 copy elision/NRVO。不要把“可析构、可赋值”的 moved-from
基本保证误写成每个类型都为空；具体可调用操作由该类型合同决定。

常见错误：

- 认为 `std::move(x);` 单独一行已经移动或清空 `x`；
- move 后读取没有被该类型保证的值；
- 对 const 对象 move 后惊讶于发生复制；
- 保存 `std::move(temporary)` 的引用并跨过完整表达式使用；
- 与 `<algorithm>` 的三迭代器 `std::move` 混淆。

JavaScript 对象变量复制的是 GC 引用，没有语言级 xvalue 或 move constructor；把变量赋给新变量并不
使旧变量进入 moved-from 状态。更接近的心智模型是“把资源句柄交给一个消费型 API”，但 JS 本身
不会通过 `std::move` 这种 cast 选择重载。

推荐关系：`header-utility`、`std-forward`、`std-swap`、`std-unique-ptr`、
`std-make-unique`。

### 5.4 两个确定性 C++20 示例

1. `transfer-string.cpp`：把字符串 move 进 `std::vector<std::string>`，只输出目标元素，不断言
   moved-from 字符串内容。精确 stdout：`queued=compile\n`。
2. `transfer-owner.cpp`：把 `unique_ptr<int>` move 给新 owner，输出源/目标布尔状态和值。
   精确 stdout：`source=false\ndestination=42\n`。

## 6. `std::forward`

### 6.1 C++20 代表声明、参数与前置条件

```cpp
template<class T>
constexpr T&& forward(std::remove_reference_t<T>& t) noexcept;

template<class T>
constexpr T&& forward(std::remove_reference_t<T>&& t) noexcept;
```

- direct header：`<utility>`；namespace：`std`；首次标准：C++11；C++14 起 `constexpr`。
  C++11 身份由 N1856 与 N3337 复核，C++14 `constexpr` 演进由 N3471 和 N3647 的采纳记录复核。
- `T` 通常必须是外层 forwarding-reference 参数推导出的原始模板参数，不能在调用点随意猜测。
- 第二个 overload 要求 `is_lvalue_reference_v<T>` 为 false；它防止把 rvalue 作为 lvalue 错误转发。
- 两个 overload 都返回 `static_cast<T&&>(t)`。若 `T = U&`，引用折叠得到 `U&`；若 `T = U`，
  得到 `U&&`。

### 6.2 返回、错误、复杂度与生命周期

返回引用并保留调用者原始值类别，不创建对象、不取得所有权、无条件 `noexcept`，标准没有独立复杂度
条款。错误的显式 `T` 可能导致编译失败，或把本应保留的 lvalue 错转为 xvalue；被转发目标函数的
构造、调用和异常不属于 `forward` 自身保证。

返回引用只在原对象存活期间有效。包装器不得存储这个引用并假设 rvalue 实参会活到以后；若需要跨越
调用保存，应明确取得所有权或复制。转发同一参数多次给消费型操作也可能在第一次后再次使用
moved-from 对象。

### 6.3 选择、常见误区与 JS/TS 对照

只在泛型包装器把参数继续交给另一个调用时使用；普通业务代码已经知道要消费一个命名对象时用
`std::move`。常见错误包括：省略模板实参写 `std::forward(x)`；写成
`std::forward<decltype(x)>(x)` 而没有理解 `decltype`；把 `const T&&` 当 forwarding reference；
在非转发上下文滥用；多次消费同一转发参数。

JavaScript 的 `fn(...args)` 与 TypeScript 参数包可以保留参数顺序，却没有 lvalue/xvalue 分类、引用
折叠或基于值类别的重载。spread syntax 因而只能帮助理解“包装器把参数继续传下去”，不能类比
`std::forward` 的核心合同。

推荐关系：`header-utility`、`std-move`、`std-make-unique`、`std-make-shared`、
`std-pair`。

### 6.4 两个确定性 C++20 示例

1. `preserve-value-category.cpp`：`relay(T&&)` 分别把命名字符串和临时字符串转发到 lvalue/rvalue
   overload。精确 stdout：`lvalue\nrvalue\n`。
2. `forward-constructor-args.cpp`：实现小型 `make_box<T>(Args&&...)`，将两个不同类型参数完美转发
   给构造器并输出字段。精确 stdout：`job=compile priority=2\n`。

## 7. `std::swap`

### 7.1 C++20 代表 overload、参数与约束

```cpp
template<class T>
constexpr void swap(T& a, T& b)
  noexcept(std::is_nothrow_move_constructible_v<T> &&
           std::is_nothrow_move_assignable_v<T>);

template<class T, std::size_t N>
constexpr void swap(T (&a)[N], T (&b)[N])
  noexcept(std::is_nothrow_swappable_v<T>);
```

- direct header：`<utility>`；namespace：`std`；通用函数首次标准 C++98，array overload C++11，
  两者 C++20 起 `constexpr`。
- 通用 overload 约束 `T` 可 move construct 且可 move assign，并要求满足对应语义要求。
- array overload 要求每一对 `a[i]`、`b[i]` 可互换；数组长度在类型中相同。
- 返回 `void`；效果是交换两个对象的值，array overload 按元素交换。

### 7.2 错误、复杂度与生命周期/失效

通用 overload 的 `noexcept` 精确取决于 `T` 的 move construction 与 move assignment；array
overload 取决于元素是否 nothrow-swappable。某一步抛异常时没有事务回滚保证；对象必须仍满足已完成
操作和自身类型保证允许的状态。array swap 中已交换的早期元素可能保留交换结果。

N4861 `[utility.swap]` 没有为通用 overload 单列渐进复杂度；不要发明“标准精确规定三次移动”这一
措辞。array overload 的效果 as-if `swap_ranges(a, a + N, b)`，对应算法复杂度是恰好 `N` 次
元素交换，即 O(N)。

交换对象本身通常不结束对象 lifetime；已有引用/指针仍指向原来的对象身份，但观察到的是交换后的
值。容器专用 `swap` 的 iterator/reference 保证由各容器条款决定，不能从通用 `std::swap` 页面
一概而论。

### 7.3 选择、ADL、常见误区与 JS/TS 对照

具体已知内置/标准类型可以调用 `std::swap`；泛型代码使用 `using std::swap; swap(a,b);` 让 ADL
发现用户类型的高效 overload。为用户类型提供同命名空间非成员 `swap`，通常转发到 member
`swap`；不要向 `namespace std` 添加普通 overload。

常见错误：泛型代码写死 `std::swap` 而失去 ADL；交换不同类型或不同长度数组；假设所有 swap
均不抛；把容器 swap 的 iterator 规则推广到任意类型；认为交换对象也交换了变量身份或引用绑定。

JavaScript 的 `[a, b] = [b, a]` 可以交换两个变量当前绑定的值，但会构造/求值一个数组式右侧，
也没有 ADL、类型定制和条件 `noexcept`。C++ 引用仍绑定原对象；swap 改的是对象持有的值。

推荐关系：`header-utility`、`std-move`、`std-pair`、`std-vector`、`std-array`（未来）。

### 7.4 两个确定性 C++20 示例

1. `swap-values-and-arrays.cpp`：交换两个整数与两个 `int[3]`，固定索引输出。
   精确 stdout：`left=2 right=1\na=4,5,6 b=1,2,3\n`。
2. `adl-swap.cpp`：自定义 `Buffer` 提供同命名空间 `swap`，泛型 helper 采用 using + unqualified
   call，输出交换后的名字。精确 stdout：`first=cache\nsecond=api\n`。

## 8. `std::pair`

### 8.1 C++20 代表声明与版本边界

```cpp
template<class T1, class T2>
struct pair {
  using first_type = T1;
  using second_type = T2;

  T1 first;
  T2 second;

  pair(const pair&) = default;
  pair(pair&&) = default;
  constexpr explicit(/* see standard */) pair();
  constexpr explicit(/* see standard */) pair(const T1& x, const T2& y);

  template<class U1, class U2>
  constexpr explicit(/* see standard */) pair(U1&& x, U2&& y);

  template<class U1, class U2>
  constexpr explicit(/* see standard */) pair(const pair<U1, U2>& p);

  template<class U1, class U2>
  constexpr explicit(/* see standard */) pair(pair<U1, U2>&& p);

  template<class... Args1, class... Args2>
  constexpr pair(std::piecewise_construct_t,
                 std::tuple<Args1...> first_args,
                 std::tuple<Args2...> second_args);

  constexpr void swap(pair& p)
    noexcept(std::is_nothrow_swappable_v<T1> &&
             std::is_nothrow_swappable_v<T2>);
};

template<class T1, class T2>
pair(T1, T2) -> pair<T1, T2>; // C++17 deduction guide
```

direct header 为 `<utility>`，namespace 为 `std`，首次标准为 C++98。主要演进边界：

| 能力 | 首次标准 / 证据 | C++20 页面边界 |
|---|---|---|
| `pair`、`first/second`、基本构造、同类型关系比较、`make_pair` | C++98，N2356 | 历史基础 |
| move/forwarding 构造、piecewise construction、成员/非成员 swap、tuple-like `get` | C++11，N3337 | C++20 均可用 |
| CTAD `pair(T1,T2)->pair<T1,T2>` | C++17，[P0433R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0433r2.html) | `std::pair p{1, 2.0}` 可用 |
| `operator==` + lexicographic `<=>`，替代六个独立关系声明 | C++20，P1614R2 | 两侧为同一 `pair<T1,T2>` 特化 |
| 赋值、成员/非成员 swap 等进一步 `constexpr` 化 | C++20，[P1032R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1032r1.html) | 必须逐个按 N4861 声明核对 |
| pair-like 构造/赋值、更多 const 操作与当前异构签名 | C++23+，P2165R4 等 | 不进入 C++20 declaration grid |

### 8.2 参数、返回/比较、错误与复杂度

- `T1`、`T2` 是两个公开子对象的静态类型；`first`、`second` 分别直接持有它们。
- 双参数构造分别以 `x`、`y` 初始化两个成员；forwarding 构造要求对应子对象可从 `U1`、`U2`
  构造，并按可隐式转换性决定构造器是否 `explicit`。
- converting pair 构造按对应成员转换；piecewise overload 用两个 tuple 分别提供两个子对象的构造
  参数，适合不能先构造临时值的场景。
- `make_pair` 在 C++20 返回 `pair<unwrap_ref_decay_t<T1>, unwrap_ref_decay_t<T2>>`；直接 CTAD
  `pair{x,y}` 按 by-value deduction guide decay，但不会像 `make_pair` 那样 unwrap
  `reference_wrapper`。
- 比较先比较 `first`，仅在等价时比较 `second`，形成 lexicographic ordering。C++20
  `operator==` 和 `<=>` 的两个参数是同一 pair 特化；不要展示当前草案的四类型参数版本。
- 构造器和成员函数只有在对应逐元素操作抛异常时才抛；move assignment 的 `noexcept` 是两个成员
  nothrow-move-assignable 的合取，swap 类似取两成员 nothrow-swappable 的合取。
- 标准没有为 `pair` 页面规定统一渐进复杂度；普通构造/赋值固定处理两个子对象。相等比较因短路进行
  一次或两次元素相等比较，三路比较先处理 `first`，仅相等时处理 `second`。

### 8.3 所有权、生命周期与失效

普通 `pair<T,U>` 直接拥有两个子对象，pair 销毁时两者随之销毁；复制/移动 pair 的行为逐元素决定。
但 `pair<T&,U&>` 不拥有 referent，也不延长其 lifetime。C++20 中以下模式会在语句结束后悬空，
实现页面应作为错误示意而不是可运行示例：

```cpp
std::pair<const std::string&, const std::string&> bad(
    std::string{"api"}, std::string{"cache"});
```

成员引用、指针或迭代器的失效由其 referent/所属容器决定；pair 本身不会修复它们。移动 pair 后，
两个源成员各自处于其类型 move 合同规定的状态，不能笼统声称都为空。

### 8.4 选择、常见误区与 JS/TS 对照

适合轻量返回两个值、标准 API 既有 pair 合同、或两个位置的含义在局部上下文非常清晰的场景。
若字段有稳定业务语义、需要三个以上成员或需要不变量，优先命名 `struct`；不要让 `.first/.second`
把领域含义隐藏在远距离代码中。

常见错误：把 pair 当动态容器；误以为 CTAD 与 `make_pair(std::ref(x), ...)` 的引用处理完全相同；
引用元素绑定 temporary；以为 C++20 可比较任意不同 pair 特化；忘记 lexicographic ordering 先看
`first`；使用 piecewise construction 却错误配对两个参数 tuple。

JavaScript `[value, error]` 数组和 TypeScript tuple `[string, number]` 能表达两个位置；但 TS tuple
只在类型检查阶段约束，运行时仍是可变长 Array。`std::pair<T,U>` 是固定两个公开子对象的静态 C++
类型，复制、移动、析构与比较都逐元素发生。业务含义不清时，两边都应优先具名对象/struct。

推荐关系：`header-utility`、`std-move`、`std-forward`、`std-swap`、`std-map`、
`header-tuple`（未来）。

### 8.5 两个确定性 C++20 示例

1. `return-status.cpp`：函数返回 `std::pair<std::string, int>`，以 structured binding 解包。
   精确 stdout：`status=ok code=200\n`。
2. `lexicographic-order.cpp`：比较 `{1, "cache"}`、`{1, "web"}`，只输出固定布尔结果。
   精确 stdout：`first-less=true\nequal=false\n`。

## 9. 确定性 C++20 stdout 实现矩阵

| Entry | 示例文件 | 核心路径 | 精确 stdout | 风险防线 |
|---|---|---|---|---|
| `<utility>` | `exchange-state.cpp` | exchange old/new | `old=idle\ncurrent=running\n` | 不依赖地址 |
| `<utility>` | `utility-family.cpp` | pair + scalar swap | `ok=200\nleft=2 right=1\n` | 只用 C++20 设施 |
| `std::move` | `transfer-string.cpp` | move into vector | `queued=compile\n` | 不读取源字符串值 |
| `std::move` | `transfer-owner.cpp` | unique ownership transfer | `source=false\ndestination=42\n` | move 后只检查规定状态 |
| `std::forward` | `preserve-value-category.cpp` | lvalue/rvalue overload | `lvalue\nrvalue\n` | 原始 T 传给 forward |
| `std::forward` | `forward-constructor-args.cpp` | variadic construction | `job=compile priority=2\n` | 不存转发引用 |
| `std::swap` | `swap-values-and-arrays.cpp` | scalar + array overload | `left=2 right=1\na=4,5,6 b=1,2,3\n` | 相同长度数组 |
| `std::swap` | `adl-swap.cpp` | using + ADL | `first=cache\nsecond=api\n` | 不向 std 加 overload |
| `std::pair` | `return-status.cpp` | owning pair + binding | `status=ok code=200\n` | 不存引用成员 |
| `std::pair` | `lexicographic-order.cpp` | C++20 comparison | `first-less=true\nequal=false\n` | 同一 pair 特化 |

所有 manifest 的 example 必须声明 `standard: "c++20"`、完整 `expectedStdout` 并直接包含
所需头文件。源文件不使用 `using namespace std;`，不输出地址、moved-from string 内容、类型实现名或
未规定的布局。

## 10. zh.cppreference 二级结构基线

下列页面只用于检查 learner-facing 槽位与相关链接，不支持规范事实，也不复制其正文、示例或表格：

| Entry | Secondary baseline | 覆盖检查 |
|---|---|---|
| `<utility>` | [`<utility>`](https://zh.cppreference.com/w/cpp/header/utility) | facility 分组与版本徽标 |
| `std::move` | [`std::move`](https://zh.cppreference.com/w/cpp/utility/move) | cast 语义、参数、返回、notes |
| `std::forward` | [`std::forward`](https://zh.cppreference.com/w/cpp/utility/forward) | overload、值类别、示例与 see-also |
| `std::swap` | [`std::swap`](https://zh.cppreference.com/w/cpp/algorithm/swap) | 通用/数组 overload、复杂度、ADL 关系 |
| `std::pair` | [`std::pair`](https://zh.cppreference.com/w/cpp/utility/pair) | 构造/成员/比较/tuple-like 导航 |

普通实体页固定覆盖：用途与非用途；C++20 代表声明与版本；参数/约束；返回或值类别；错误与
`noexcept`；标准精度的复杂度；lifetime/失效；两个原创示例；常见误区；JS/TS 对照；related
Entries。任何与 N4861 冲突的 secondary 展示以 WG21 primary 为准。

## 11. 每条目 primary source manifest 建议

以下矩阵可直接拆为 Entry manifest 的 `sources`；current contract、C++20 baseline 与历史边界应保留
为独立 source record，不能只留一个聚合主页。

| Entry | C++20 / first-version primary | current contract anchors | evolution guard | secondary（可选） |
|---|---|---|---|---|
| `<utility>` | N2356 `[lib.utility]`；N3337 `[utility]`；N4861 `[utility.syn]` | `[utility.syn]`、`[using.headers]` | N3658、N3668、N4380、P0586R2、P2445R1、P2165R4 | zh.cppreference `<utility>` |
| `std::move` | N1690、N1856；N3337 `[forward]`；N4861 `[forward]` | `[forward]`、`[dcl.ref]`、`[class.temporary]`、`[lib.types.movedfrom]` | N3471/N3647（C++14 constexpr）；当前 `[forward]` | zh.cppreference `move` |
| `std::forward` | N1690、N1856；N3337 `[forward]`；N4861 `[forward]` | `[forward]`、`[temp.deduct.call]`、`[dcl.ref]` | N3471/N3647（C++14 constexpr）；P2445R1（C++23） | zh.cppreference `forward` |
| `std::swap` | N2356 `[lib.alg.swap]`；N3337 `[utility.swap]`；N4861 `[utility.swap]` | `[utility.swap]`、`[swappable.requirements]`、`[alg.swap]` | P0879R0（C++20 constexpr） | zh.cppreference `swap` |
| `std::pair` | N2356 `[lib.pairs]`；N3337 `[pairs]`；N4861 `[pairs.pair]`/`[pairs.spec]` | `[pairs.pair]`、`[pairs.spec]`、`[pair.astuple]` | P0433R2、P1032R1、P1614R2、P2165R4、P1951R1 | zh.cppreference `pair` |

建议 manifest source URL：

- N4861：`https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf`
- N4861 HTML anchors：
  `https://timsong-cpp.github.io/cppwp/n4861/utility.syn`、
  `.../forward`、`.../utility.swap`、`.../pairs.pair`、`.../pairs.spec`
- 当前锚点：
  `https://eel.is/c++draft/utility.syn`、`.../forward`、`.../utility.swap`、
  `.../swappable.requirements`、`.../pairs.pair`、`.../pairs.spec`、
  `.../temp.deduct.call`、`.../dcl.ref`、`.../lib.types.movedfrom`
- C++98：
  `https://www.open-std.org/jtc1/sc22/open/n2356/lib-utilities.html` 与
  `https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html`
- C++11：`https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf`
- rvalue-reference 起源：
  `https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2004/n1690.html`

## 12. 实现验收清单

- [ ] catalog 恰好新增本文五个 ID；没有顺手加入 `exchange`、`move_if_noexcept`、tuple 或算法
      `std::move` 的实体页。
- [ ] 五个 Entry 都以 `<utility>` 为 direct header；`std::swap` 的 `since` 保持 C++98，并解释
      C++20 应直接包含 `<utility>`。
- [ ] `<utility>` 使用 reduced facility map，逐行标出 C++98/11/14/17/20 边界，并排除 C++23+
      设施。
- [ ] header 页有直接 include 与 anti-transitive-include 提示、两个确定性示例和明确 outgoing links。
- [ ] `std::move` 明确是 cast、不触发移动，不读取未受类型保证的 moved-from 值，且与算法重载分开。
- [ ] `std::move` 返回同一对象的 xvalue reference，`noexcept`，不延长 lifetime；const move 可能复制。
- [ ] `std::forward` 同时解释 forwarding-reference 推导、引用折叠、命名参数是 lvalue 与显式 `T`。
- [ ] `std::forward` 不包含 C++23 `forward_like`，示例不会保存 temporary 的转发引用。
- [ ] `std::swap` 同时展示通用与 array overload，写明条件 `noexcept` 与 array 的 N 次元素交换。
- [ ] 泛型 swap 示例采用 `using std::swap; swap(a,b);`，用户定制放在关联命名空间而非普通注入 std。
- [ ] `std::pair` declaration grid 以 N4861 为准，不泄漏 pair-like/const/异构 current overload。
- [ ] `std::pair` 标出 C++98 基础、C++11 move/piecewise/get、C++17 CTAD、C++20 `<=>` 边界。
- [ ] pair 比较写成 lexicographic，并明确 C++20 两侧同一特化；不以当前四类型签名冒充 C++20。
- [ ] pair 页面区分 owning element 与 reference element，明确 C++20 temporary-reference dangling 风险。
- [ ] 每个普通实体都有参数/约束、返回/值类别、错误/noexcept、复杂度、lifetime/失效、常见误区、
      两个 C++20 确定性示例、JS/TS 对照与 related links。
- [ ] 所有十个示例 exact stdout 可重复，不断言 moved-from string、地址、布局或实现类型名。
- [ ] substantive 标准事实由 WG21 primary source 支持；zh.cppreference 仅标 `secondary`。

## 13. 一级来源索引

### 13.1 标准版本与历史

- [N2356：1997 public review draft，utilities](https://www.open-std.org/jtc1/sc22/open/n2356/lib-utilities.html)
- [N2356：1997 public review draft，algorithms/swap](https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html)
- [N1690：A Proposal to Add an Rvalue Reference to the C++ Language](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2004/n1690.html)
- [N1856：Rvalue reference library additions](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2005/n1856.html)
- [N2979：Moving Swap Forward](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2009/n2979.html)
- [N3337：C++11 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- [N3471：Making `<utility>` and pair helpers constexpr](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3471.html)
- [N3647：2013 library motions and adoption record](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3647.pdf)
- [N4659：C++17 final working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
- [N4861：C++20 final working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

### 13.2 Utility 与 pair 演进

- [N3658：Compile-time integer sequences](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3658.html)
- [N3668：`exchange()` utility function](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3668.html)
- [N4380：`as_const` helper proposal](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4380.html)
- [P0433R2：标准库 CTAD 集成](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0433r2.html)
- [P0586R2：Safe integral comparisons](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0586r2.html)
- [P0879R0：Constexpr for swap and swap related functions](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0879r0.html)
- [P1032R1：Misc constexpr bits](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1032r1.html)
- [P1614R2：Adding `<=>` to the Library](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1614r2.html)
- [P1951R1：pair forwarding constructor 后续演进](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p1951r1.html)
- [P2445R1：`forward_like`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2445r1.pdf)
- [P2165R4：tuple/pair/tuple-like compatibility](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2165r4.pdf)

### 13.3 C++20 与当前条款锚点

- [N4861 `[utility.syn]`](https://timsong-cpp.github.io/cppwp/n4861/utility.syn)
- [N4861 `[forward]`](https://timsong-cpp.github.io/cppwp/n4861/forward)
- [N4861 `[utility.swap]`](https://timsong-cpp.github.io/cppwp/n4861/utility.swap)
- [N4861 `[pairs.pair]`](https://timsong-cpp.github.io/cppwp/n4861/pairs.pair)
- [N4861 `[pairs.spec]`](https://timsong-cpp.github.io/cppwp/n4861/pairs.spec)
- [N4861 `[lib.types.movedfrom]`](https://timsong-cpp.github.io/cppwp/n4861/lib.types.movedfrom)
- [当前 `[utility.syn]`](https://eel.is/c++draft/utility.syn)
- [当前 `[forward]`](https://eel.is/c++draft/forward)
- [当前 `[utility.swap]`](https://eel.is/c++draft/utility.swap)
- [当前 `[swappable.requirements]`](https://eel.is/c++draft/swappable.requirements)
- [当前 `[pairs.pair]`](https://eel.is/c++draft/pairs.pair)
- [当前 `[pairs.spec]`](https://eel.is/c++draft/pairs.spec)
- [当前 `[temp.deduct.call]`](https://eel.is/c++draft/temp.deduct.call)
- [当前 `[dcl.ref]`](https://eel.is/c++draft/dcl.ref)
- [当前 `[lib.types.movedfrom]`](https://eel.is/c++draft/lib.types.movedfrom)
- [当前 `[using.headers]`](https://eel.is/c++draft/using.headers)

## 14. 研究结论

五个条目形成一个边界清晰的 utility 切片。实现中的最高风险不是漏掉冷门 overload，而是把
表达式 cast 误写成实际资源转移、把 `forward` 脱离推导与引用折叠、把 qualified `std::swap`
误教成泛型定制、把 `pair<T&,U&>` 当拥有对象，以及把 current draft 的 C++23+ overload 回写到
C++20。

本文已为这些风险提供 N4861 声明、历史版本证据、current-draft 防线、精确 stdout 和可复制的
source manifest 矩阵。内容实现应保持原创教学语言，并让每个普通 Entry 独立满足参数、返回、错误、
复杂度、生命周期、误区、示例、JS/TS 对照和一级来源要求。
