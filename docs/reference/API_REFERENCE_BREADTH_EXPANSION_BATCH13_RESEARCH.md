# C++ Reference 第十三批：常用算法补齐研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-02
>
> 精确范围：`std::move`（范围算法）、`std::count`、`std::none_of`、
> `std::rotate`、`std::remove`（范围算法）
>
> 事实基线：C++98 公共审查稿 N2356、C++11 工作草案 N3337、C++20
> 工作草案 N4861、C++23 工作草案 N4950、当前 C++ Working Draft，以及相关
> WG21 原始提案和 LWG 缺陷报告。cppreference 与 zh.cppreference 只作二级信息
> 架构和覆盖核对，正文、表格和示例不得复制。

## 1. 批次目标与版本边界

本批恰好增加五个普通 Function Entry，补齐内容质量 backlog 中剩余的高频经典算法：
范围移动、按值计数、全范围否定判断、循环移位和按值逻辑删除。五页都直接归类现有
`algorithms`，不增加 Header Entry，也不改变已经存在的 `std::move` 值类别转换页、
`std::remove_if` 页或 `std::filesystem::remove` 页的身份。

- `std::count`、`std::rotate` 和范围算法 `std::remove` 来自 C++98 算法库；
  N2356 的 `[lib.alg.count]`、`[lib.alg.rotate]`、`[lib.alg.remove]` 可用于核对
  首版合同。
- 范围算法 `std::move` 随移动语义在 C++11 加入；它是接收三个 iterator 的算法，
  不是 `<utility>` 中把表达式转换成 xvalue 的一参数 `std::move`。
- `std::none_of` 随 C++11 加入。N2666 提出了 `all_of`、`any_of`、`none_of`，
  N3337 已包含最终经典 iterator-pair 形式。
- `std::rotate` 的经典版本在 C++98 返回 `void`，自 C++11 起返回 iterator；页面
  `since` 仍应是 `c++98`，并把返回值版本变化放进接口表。
- P0024R2 把五个算法的 execution-policy overload 纳入 C++17。它们要求至少
  forward iterator；不能把普通串行版本的 input iterator 下限误套给 policy 版本。
- P0202R3 使不接 execution policy 的经典算法在 C++20 成为 `constexpr`；policy
  overload 不是本批 C++20 示例的 constexpr 基线。
- P0896R4 在 C++20 加入 `std::ranges` overload。Ranges 版本使用 concepts、sentinel、
  range overload、projection（适用时）和结构化返回类型；它们不是“经典算法只多收一个
  range 参数”。
- P2248R8 为 C++26 的若干 value-taking 算法加入默认模板值类型；当前草案中
  `count`、`remove` 的 `T = ...` 不能倒灌为 C++20 接口保证。
- P3179R9 将 execution-policy overload 扩展到 `std::ranges`，并已进入 C++26 Working
  Draft。当前草案已出现这些声明，但 C++20/C++23 只有串行 ranges overload，页面必须
  单列版本徽标。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|
| `std-move-algorithm` | `function` | `std::move` | `<algorithm>` | `c++11` | `c++20` | [`[alg.move]`](https://eel.is/c++draft/alg.move) |
| `std-count` | `function` | `std::count` | `<algorithm>` | `c++98` | `c++20` | [`[alg.count]`](https://eel.is/c++draft/alg.count) |
| `std-none-of` | `function` | `std::none_of` | `<algorithm>` | `c++11` | `c++20` | [`[alg.none.of]`](https://eel.is/c++draft/alg.none.of) |
| `std-rotate` | `function` | `std::rotate` | `<algorithm>` | `c++98` | `c++20` | [`[alg.rotate]`](https://eel.is/c++draft/alg.rotate) |
| `std-remove-algorithm` | `function` | `std::remove` | `<algorithm>` | `c++98` | `c++20` | [`[alg.remove]`](https://eel.is/c++draft/alg.remove) |

`std-move-algorithm` 与 `std-remove-algorithm` 是必要的消歧 ID：前者避免和现有
`std-move`（`<utility>` xvalue cast）冲突；后者避免和现有 `std-filesystem-remove`
以及 `<cstdio>` 文件删除函数混淆。页面标题仍使用标准拼写 `std::move`、`std::remove`，
summary 和搜索别名明确“范围算法”。

### 1.2 Manifest-ready 关系

| ID | 建议 `relatedEntryIds` |
|---|---|
| `std-move-algorithm` | `header-algorithm`、`std-copy`、`std-move`、`std-vector` |
| `std-count` | `header-algorithm`、`std-count-if`、`std-find`、`std-none-of` |
| `std-none-of` | `header-algorithm`、`std-all-of`、`std-any-of`、`std-count` |
| `std-rotate` | `header-algorithm`、`std-reverse`、`std-vector`、`std-remove-algorithm` |
| `std-remove-algorithm` | `header-algorithm`、`std-remove-if`、`std-vector`、`std-filesystem-remove` |

所有 related ID 都已存在或在本批同时落库；不引用尚未创建的 ranges 专页。

## 2. 五页共享的算法合同

### 2.1 Classic、execution policy 与 ranges 不是同一层接口

C++20 教学页应先给最常用的串行接口，再用版本表解释另外两族：

```cpp
// classic iterator-pair：C++20 中非 policy overload 为 constexpr
std::count(first, last, value);

// C++17 execution policy：仍在 namespace std
std::count(policy, first, last, value);

// C++20 ranges：算法 function object，可收 iterator/sentinel 或 range
std::ranges::count(range, value, projection);
```

Classic overload 的未约束模板参数名承载旧式 iterator/type requirements；ranges
overload 用 `input_iterator`、`sentinel_for`、`permutable`、`indirectly_movable`、
`indirect_unary_predicate` 等 concepts 表达约束。Ranges function objects 不通过普通
ADL 找到，也不应教用户显式指定模板参数。来源：
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)、
[P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)。

Execution-policy overload 的 callable 不得经参数直接或间接修改对象，也不得依赖参数
对象身份；`par`/`par_unseq` 下调用次序、线程和并行度不可假定。调用方仍负责避免 callable
捕获共享可变状态造成 data race 或 deadlock。来源：
[`[algorithms.parallel.user]`](https://eel.is/c++draft/algorithms.parallel.user)、
[`[algorithms.parallel.exec]`](https://eel.is/c++draft/algorithms.parallel.exec)。

### 2.2 异常与终止边界

无 policy 的串行调用没有统一 `noexcept` 保证：元素比较、predicate、projection、move
assignment、swap 或 iterator 操作抛出的异常通常向调用者传播；一旦原地修改算法已经完成
部分赋值/交换，不能凭空承诺事务式回滚。具体类型自己的操作如果 `noexcept`，相应路径才不会
从该操作抛出。

对本批 C++17/C++20 标准 execution policies（`seq`、`par`、`par_unseq`；C++20 另有
`unseq`）而言，element access function 逃逸出的异常导致 `std::terminate`；并行化所需临时
内存不足仍可抛 `std::bad_alloc`。自定义 policy 的行为由实现规定。此处以 C++20 N4861 和
P0394R4 的最终设计为基线，不能沿用早期 Parallelism TS 聚合 `exception_list` 的旧方案。
来源：[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、
[P0394R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0394r4.html)、
[`[algorithms.parallel.exceptions]`](https://eel.is/c++draft/algorithms.parallel.exceptions)、
[`[except.terminate]`](https://eel.is/c++draft/except.terminate)。

当前 Working Draft 将异常结果表述为“由 execution policy 决定”，并已接收 C++26 parallel
ranges。实现 C++20 页面时应描述所选标准版本，不应只复制滚动草案的一句话而丢失
C++17/C++20 的终止行为。

### 2.3 Predicate、projection、短路与调用次数

经典 predicate 必须能对 iterator 解引用结果返回 boolean-testable 值，且不得经参数调用
non-const 操作。实现可复制 function object；不要依赖 predicate 内部 `counter` 的对象身份。
Ranges 的 predicate/projection 约束通过 `projected` 与 indirect callable concepts 表达。

- `count` 做恰好 N 次比较；ranges projection 也恰好 N 次。
- `none_of` 至多做 N 次 predicate/projection，可在第一次为 true 时提前返回 false。
- `remove` 恰好做 N 次 equality/projection 判断，但 move assignment 次数取决于需要压缩的
  元素位置。
- `move` 恰好做 N 次赋值。
- `rotate` 至多做 N 次 swap；实现策略和实际交换次数不固定。

因此示例不得输出 predicate 的具体调用顺序、线程、复制次数，或把 `none_of` 的调用次数固定
为 N。来源：各算法条款及
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)。

### 2.4 Iterator/reference、对象寿命与 data race

算法本身不拥有容器，也不延长 iterator/reference 或 range owner 的寿命。调用期间所有输入、
输出范围必须保持有效；不能一边执行算法一边让另一线程 reallocate/erase 同一容器。标准库只
承诺不修改规范未要求修改的 iterator 所指对象，这不替调用者同步共享数据。来源：
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)、
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)。

`move`、`rotate`、`remove` 原地改变元素值，但通常不改变容器大小或分配，因此 iterator 仍指向
同一**位置**，不代表它还指向原来那个逻辑值。真正调用 `vector::erase` 后，擦除点及其后的
iterator/reference 按容器合同失效；算法返回的逻辑末尾必须在 erase 前使用或传给 erase。
`count`/`none_of` 不修改元素，但这不允许其他线程无同步地并发写同一非原子对象。

### 2.5 确定性示例红线

本批 10 个示例必须遵守：

- 全部编译为 C++20；不用 C++26 ranges policy overload 或默认算法值类型；
- 每个标准设施直接包含声明它的 header，不依赖传递包含；
- 不输出 move 后普通 `string` 等对象的内容、capacity 或地址；
- 不访问 `remove` 返回逻辑末尾之后的值，因为尾部是 valid but unspecified；
- 不使用重叠但不满足算法前置条件的 source/destination；
- 不以 execution policy 演示，因为调用顺序、线程与库后端会造成教学噪音；
- 不输出 iterator/pointer 地址、耗时、locale、随机数、未指定容器顺序或实现布局；
- predicate 无共享副作用，不抛异常，不依赖调用次数或短路点；
- range owner 覆盖算法和全部结果使用期，erase 后不再使用已失效 iterator。

## 3. `std::move`（范围算法）

### 3.1 C++20 代表接口与直接包含

```cpp
// <algorithm>
template<class InputIterator, class OutputIterator>
constexpr OutputIterator move(InputIterator first,
                              InputIterator last,
                              OutputIterator result);

template<class ExecutionPolicy, class ForwardIterator1,
         class ForwardIterator2>
ForwardIterator2 move(ExecutionPolicy&& exec,
                      ForwardIterator1 first,
                      ForwardIterator1 last,
                      ForwardIterator2 result); // C++17

template<std::input_iterator I, std::sentinel_for<I> S,
         std::weakly_incrementable O>
  requires std::indirectly_movable<I, O>
constexpr std::ranges::move_result<I, O>
  std::ranges::move(I first, S last, O result); // C++20

template<std::ranges::input_range R, std::weakly_incrementable O>
  requires std::indirectly_movable<std::ranges::iterator_t<R>, O>
constexpr std::ranges::move_result<
  std::ranges::borrowed_iterator_t<R>, O>
  std::ranges::move(R&& range, O result); // C++20
```

必须直接 `#include <algorithm>`。示例若使用 `std::unique_ptr`、`std::array`、
`std::vector`、`std::string`、`std::cout`，分别直接包含 `<memory>`、`<array>`、
`<vector>`、`<string>`、`<iostream>`。不能因为内部表达式使用 `std::move(*it)` 就只含
`<utility>`；三参数范围算法由 `<algorithm>` 声明。

Current draft 另有 C++26 ranges execution-policy overload，它要求 random-access iterator
与 sized sentinel/output boundary，且可以截断到输出范围大小；不要放进 C++20 代表接口。

### 3.2 参数、返回、复杂度与重叠规则

串行经典与 C++20 ranges 版本从 `first` 向 `last` 正向处理，把每个源元素 move-assign 到
`result` 起始的现存输出对象。经典版本返回 `result + N`；ranges 版本返回
`{last, result + N}`，类型为 `in_out_result`/`move_result`。Range overload 对 non-borrowed
临时 range 的 `.in` 类型可能是 `dangling`，但 `.out` 仍可用；本批示例使用 lvalue owner。

串行版本前置条件是 `result` 不在 `[first,last)`；因此某些“目标整体位于源左侧”的正向重叠
可以工作，但目标起点落入源范围不允许。需要向右重叠搬移时使用 `move_backward` 并满足它的
反向前置条件。Execution-policy `std::move` 要求 source 与 destination 的实际 N 元素范围完全
不重叠；LWG 2689 修正了并行版本不能承诺从前到后的问题。

复杂度恰好 N 次 assignment。它不分配 destination，也不扩容普通 iterator 输出容器；输出
必须已经拥有足够可写位置，或显式使用满足 output iterator 合同的插入 iterator。
来源：[`[alg.move]`](https://eel.is/c++draft/alg.move)、
[LWG 2689](https://cplusplus.github.io/LWG/issue2689)。

### 3.3 移后状态、异常、生命周期、线程与 JS 对照

对 ranges 版本，每一步使用 `ranges::iter_move`，它允许 iterator 通过 ADL 定制移动读取；默认
在 `*it` 为 lvalue 时近似 `std::move(*it)`。`indirectly_movable` 只表达能读出 rvalue-like 值并
写入输出，并不为任意用户类型额外规定统一的源值。标准库类型的一般 moved-from 规则保证
valid but unspecified，除非具体类型给出更强后置条件；更强的泛型中间存储关系由
`indirectly_movable_storable` 描述。来源：
[`[iterator.cust.move]`](https://eel.is/c++draft/iterator.cust.move)、
[`[alg.req.ind.move]`](https://eel.is/c++draft/alg.req.ind.move)、
[`[lib.types.movedfrom]`](https://eel.is/c++draft/lib.types.movedfrom)。

赋值中途抛异常时，已经处理的 destination 已改变、对应 source 可能已被 move-from，后续元素
未处理；算法没有统一 rollback。源和目标不得由其他线程无同步读写。并行 overload 还要求元素
操作之间不存在 data race，不能让多个 destination iterator alias 同一对象。

JS 没有直接等价的“按 iterator 对对象逐项 move assignment”：JS 赋值对象通常复制引用，GC
管理对象寿命。最接近的业务类比是把数组槽位中的资源句柄转交到另一组槽位，但 C++ move 是否
真正转移资源由元素类型决定；算法只是对每项发出移动赋值，不能类比成 JS `splice()`。

常见误区：三参数 `std::move` 只是 cast；调用后源一定为空；destination 自动增长；所有重叠
都安全；ranges 与 classic 返回同一个 iterator；移动算法会销毁源元素；iterator 仍跟随原逻辑
值；policy 版本仍严格从左到右。

### 3.4 两个示例

1. `move-owned-values.cpp`：把三个 `unique_ptr<int>` 从固定大小 source array 移动赋值到
   已存在的 destination array，只输出返回位置和 destination 值，不观察 source。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`、`<memory>`。

   ```text
   written=3
   values=4,7,9
   ```

2. `move-string-batch-with-ranges.cpp`：lvalue `vector<string>{"api","worker"}` 与
   `vector<string>(2)`，调用 `std::ranges::move(source, destination.begin())`，只输出
   `result.out` 距离及 destination，绝不打印 moved-from source。

   直接包含：`<algorithm>`、`<iostream>`、`<string>`、`<vector>`。

   ```text
   written=2
   values=api,worker
   ```

## 4. `std::count`

### 4.1 C++20 代表接口与版本

```cpp
// <algorithm>
template<class InputIterator, class T>
constexpr typename std::iterator_traits<InputIterator>::difference_type
count(InputIterator first, InputIterator last, const T& value);

template<class ExecutionPolicy, class ForwardIterator, class T>
typename std::iterator_traits<ForwardIterator>::difference_type
count(ExecutionPolicy&& exec, ForwardIterator first,
      ForwardIterator last, const T& value); // C++17

template<std::input_iterator I, std::sentinel_for<I> S,
         class Proj = std::identity, class T>
  requires std::indirect_binary_predicate<
    std::ranges::equal_to, std::projected<I, Proj>, const T*>
constexpr std::iter_difference_t<I>
  std::ranges::count(I first, S last,
                     const T& value, Proj proj = {}); // C++20

template<std::ranges::input_range R,
         class Proj = std::identity, class T>
constexpr std::ranges::range_difference_t<R>
  std::ranges::count(R&& range,
                     const T& value, Proj proj = {}); // C++20
```

直接包含 `<algorithm>`。以上 C++20 教学轮廓故意不展示 current draft 中由 P2248 加入的
默认 `T`，也不展示 P3179 的 C++26 ranges policy overload。

### 4.2 参数、返回、复杂度、错误与线程

Classic 对 `[first,last)` 中每项计算 `*i == value`，返回满足者数量，返回类型是 iterator 的
signed `difference_type`。Ranges 先 `invoke(proj,*i)` 再与 `value` 使用 `ranges::equal_to`
比较，返回 `iter_difference_t` 或 `range_difference_t`。它不是 `size_t`，也不返回 iterator。

恰好 N 次比较；ranges 同时恰好 N 次 projection。算法不短路，因为必须得到总数。输入 iterator
足够支持串行 classic/ranges，因此 single-pass range 可以计数一次，但不能假设之后仍可从原
iterator 再遍历。Policy overload 为并行分割要求 forward iterator；C++26 policy ranges 进一步
要求 sized random-access range/iterator。

比较或 projection 抛异常时，串行版本传播；算法自身不修改输入，但 callable 仍不得通过参数
修改对象。若另一个线程同时写被读取元素，普通 data-race 规则仍适用。结果可能溢出吗？有效
范围的距离必须可由 iterator difference type 表示；不要通过构造超出 iterator 合同的伪范围
测试极限。

来源：[`[alg.count]`](https://eel.is/c++draft/alg.count)、
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)。

### 4.3 JS 对照与误区

JS 常写 `array.filter(x => x === target).length`，但它会创建中间数组；更贴近 C++ `count` 的
实现是 `reduce` 累加匹配数。C++ classic `==` 不等于 JS `===`：比较语义由 C++ 类型的
`operator==` 决定。Ranges projection 类似先读取 `item.status` 再比较，但不创建映射数组。

常见误区：返回首个位置；找不到返回 `-1`；可以短路；返回 `size_t`；predicate 版本仍叫
`count`（条件计数是 `count_if`）；ranges projection 是 predicate；policy overload 接受 input
iterator；C++20 支持 `std::count(first,last,{...})` 的默认 T 推导。

### 4.4 两个示例

1. `count-fixed-value.cpp`：在 `array<int,7>{2,1,2,3,2,4,5}` 中统计值 `2`。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`。

   ```text
   twos=3
   ```

2. `count-status-with-projection.cpp`：固定 `Request{status}` 数组包含两个 500，调用
   `std::ranges::count(requests, 500, &Request::status)`，展示 projection。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`。

   ```text
   server_errors=2
   ```

## 5. `std::none_of`

### 5.1 C++20 代表接口与来源

```cpp
// <algorithm>
template<class InputIterator, class Predicate>
constexpr bool none_of(InputIterator first,
                       InputIterator last,
                       Predicate pred);

template<class ExecutionPolicy, class ForwardIterator, class Predicate>
bool none_of(ExecutionPolicy&& exec,
             ForwardIterator first,
             ForwardIterator last,
             Predicate pred); // C++17

template<std::input_iterator I, std::sentinel_for<I> S,
         class Proj = std::identity,
         std::indirect_unary_predicate<std::projected<I, Proj>> Pred>
constexpr bool std::ranges::none_of(
  I first, S last, Pred pred, Proj proj = {}); // C++20

template<std::ranges::input_range R,
         class Proj = std::identity,
         std::indirect_unary_predicate<
           std::projected<std::ranges::iterator_t<R>, Proj>> Pred>
constexpr bool std::ranges::none_of(
  R&& range, Pred pred, Proj proj = {}); // C++20
```

直接包含 `<algorithm>`。N2666 的设计动机是为数学上的“没有元素满足条件”提供可读名字；
尽管可用 `!any_of(...)` 或 `find_if(...) == last` 表达，独立 API 能直接表达意图。C++11
N3337 是首次标准基线；C++17、C++20、C++26 边界与本批共享矩阵一致。

### 5.2 返回、短路、空范围、异常与并发

若范围内存在任一 `pred(*i)` 为 true 的元素，返回 false；否则返回 true。Ranges 先应用
projection 再调用 predicate。复杂度至多 N 次 predicate 和 projection；允许首次命中即短路，
不保证遍历到最后。

空范围没有反例，因此 `none_of(empty,pred)` 返回 true，且 predicate 调用零次。这是逻辑上的
vacuous truth，不是“空输入错误”。Predicate 必须对相应元素稳定地 boolean-testable，不得经
参数修改元素；实现可复制 predicate。需要知道命中位置时用 `find_if`，因为 `none_of` 只返回
bool。

串行 predicate/projection 抛异常则传播。Policy 版本按共享异常边界处理，且短路不提供跨线程
确定调用次数。只读算法不等于自动同步：另一个线程无同步修改同一元素仍可能 data race。
来源：[`[alg.none.of]`](https://eel.is/c++draft/alg.none.of)、
[N2666](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2666.pdf)、
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)。

### 5.3 JS 对照与误区

JS `Array.prototype.some(predicate)` 的否定 `!array.some(predicate)` 与 `none_of` 最接近；
两者都可短路，空数组也得到 true。不要类比 `every(x => !predicate(x))` 的回调身份或异常模型：
C++ predicate 可被复制，ranges 还可单独传 projection，execution policy 可改变调用线程与顺序。

常见误区：返回“未命中个数”；空范围返回 false；一定调用 N 次；predicate 可用内部计数判断
第 k 项；并行调用会在第一次命中后精确停止所有工作；ranges 第三个 callable 一定是另一个
predicate（它是 projection）；`none_of` 能返回失败位置。

### 5.4 两个示例

1. `check-empty-range.cpp`：对 `array<int,0>` 检查“没有负数”，显式 `boolalpha` 输出空范围
   规则。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`。

   ```text
   empty_has_no_negative=true
   ```

2. `check-jobs-with-projection.cpp`：固定 `Job{failed}` 数组全为 false，调用
   `std::ranges::none_of(jobs, predicate, &Job::failed)`，predicate 只接收投影后的 bool。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`。

   ```text
   all_healthy=true
   ```

## 6. `std::rotate`

### 6.1 C++20 代表接口与版本

```cpp
// <algorithm>
template<class ForwardIterator>
constexpr ForwardIterator rotate(ForwardIterator first,
                                 ForwardIterator middle,
                                 ForwardIterator last);

template<class ExecutionPolicy, class ForwardIterator>
ForwardIterator rotate(ExecutionPolicy&& exec,
                       ForwardIterator first,
                       ForwardIterator middle,
                       ForwardIterator last); // C++17

template<std::permutable I, std::sentinel_for<I> S>
constexpr std::ranges::subrange<I>
  std::ranges::rotate(I first, I middle, S last); // C++20

template<std::ranges::forward_range R>
  requires std::permutable<std::ranges::iterator_t<R>>
constexpr std::ranges::borrowed_subrange_t<R>
  std::ranges::rotate(R&& range,
                      std::ranges::iterator_t<R> middle); // C++20
```

必须直接包含 `<algorithm>`。Classic `std::rotate` 自 C++98 存在但 C++98 返回 `void`；
C++11 起返回 iterator。Ranges C++20 返回 subrange；C++26 current draft 另有 policy ranges。
`permutable` 组合 forward iterator、`indirectly_movable_storable` 与
`indirectly_swappable`，准确表达原地重排要求。来源：
[`[alg.req.permutable]`](https://eel.is/c++draft/alg.req.permutable)。

### 6.2 参数、返回、复杂度与有效范围

前置条件是 `[first,middle)` 与 `[middle,last)` 都是有效范围；`middle` 必须位于同一整体范围
边界内。效果为左旋：原来的 `[middle,last)` 放到前面，原来的 `[first,middle)` 接到后面，
各子范围内部相对顺序保持。

Classic 返回旋转后“原 first 元素”的新位置，即 `first + (last-middle)`；ranges 返回
`{first + (last-middle), last}`。特殊情况：`middle==first` 时不改变序列并返回 `last`；
`middle==last` 时不改变序列并返回 `first`。Ranges range overload 对 non-borrowed 临时 owner
返回 `dangling`，本批只用 lvalue array。

复杂度至多 N 次 swaps，而不是固定三次 reverse，也不是 O(1) 元素操作。不同 iterator category
与 element traits 可使实现选择不同策略；不能依赖交换顺序。Classic 要求 Cpp17ValueSwappable、
解引用类型 Cpp17MoveConstructible 与 Cpp17MoveAssignable；ranges 用 `permutable`。
来源：[`[alg.rotate]`](https://eel.is/c++draft/alg.rotate)。

### 6.3 异常、引用语义、容器失效、线程与 JS 对照

串行 swap/move/iterator 操作抛异常时，范围可能已部分重排，标准没有统一 rollback；对普通
`int` array/vector 示例这些元素操作不抛。Rotate 不改变容器 size/capacity，也不创建或销毁
元素，所以普通 array/vector iterator/reference 仍指向相同物理位置，但该位置的值可能已经
不同。若调用方先保存“某个值”的 iterator，旋转后不能把它当作跟随值移动的 handle。

原地写整个范围与任何并发读写该范围冲突，除非调用方提供合适同步。Policy overload 还不能让
swaps alias 或让用户自定义 swap 访问无同步共享状态。

JS 没有原生 `rotate`；常见写法 `arr.push(...arr.splice(0,k))` 会改变数组结构、创建中间数组，
也有不同的引用/异常/复杂度合同。更好的概念类比是“把前 k 项切到尾部并保留两段内部顺序”，
但 C++ `rotate` 在现有范围内原地重排，不改变容器长度。

常见误区：`middle` 是旋转次数而非 iterator；右旋 k 直接传 `begin()+k`（这表示左旋 k）；返回
新 begin；所有 iterator 跟随元素；只能用于 random-access iterator；一定用三次 reverse；
允许来自另一容器的 middle；ranges 返回单 iterator。

### 6.4 两个示例

1. `rotate-left-and-find-old-first.cpp`：`vector<int>{1,2,3,4,5}` 以 `begin()+2`
   左旋，输出返回 iterator 相对位置及全部值。

   直接包含：`<algorithm>`、`<iostream>`、`<vector>`。

   ```text
   old_first_index=3
   values=3,4,5,1,2
   ```

2. `rotate-array-with-ranges.cpp`：`array<int,4>{10,20,30,40}` 以 `begin()+1`
   调用 ranges overload，输出 `result.begin()` 相对位置和值序列。

   直接包含：`<algorithm>`、`<array>`、`<iostream>`。

   ```text
   old_first_index=3
   values=20,30,40,10
   ```

## 7. `std::remove`（范围算法）

### 7.1 C++20 代表接口与直接包含

```cpp
// <algorithm>
template<class ForwardIterator, class T>
constexpr ForwardIterator remove(ForwardIterator first,
                                 ForwardIterator last,
                                 const T& value);

template<class ExecutionPolicy, class ForwardIterator, class T>
ForwardIterator remove(ExecutionPolicy&& exec,
                       ForwardIterator first,
                       ForwardIterator last,
                       const T& value); // C++17

template<std::permutable I, std::sentinel_for<I> S,
         class Proj = std::identity, class T>
constexpr std::ranges::subrange<I>
  std::ranges::remove(I first, S last,
                      const T& value, Proj proj = {}); // C++20

template<std::ranges::forward_range R,
         class Proj = std::identity, class T>
  requires std::permutable<std::ranges::iterator_t<R>>
constexpr std::ranges::borrowed_subrange_t<R>
  std::ranges::remove(R&& range,
                      const T& value, Proj proj = {}); // C++20
```

必须直接 `#include <algorithm>`。`std-remove-algorithm` 的搜索别名应包含“逻辑删除”、
“erase-remove”和“范围 remove”，并明确不是 `<cstdio>` 的文件删除，也不是
`std::filesystem::remove`。C++20 轮廓不展示 P2248 的 C++26 默认 T 或 P3179 的 ranges
policy overload。

### 7.2 效果、返回、复杂度与尾部状态

算法稳定地把“不等于 value”的元素压缩到范围前部，返回新的**逻辑末尾**：

- classic 返回 iterator `new_end`；
- ranges 返回 subrange `{new_end,last}`，即待擦除 tail，而不是 `{first,new_end}`；
- 容器 size 不变，算法不调用容器 erase，不销毁元素；
- `[first,new_end)` 中保留元素的相对顺序不变；
- `[new_end,last)` 中每个元素 valid but unspecified，因为压缩可以从尾部元素 move-assign；
  不得打印或依赖这些值。

恰好 N 次 equality/projection 判断，且 stable。Classic 要求 `*first` 的类型满足
Cpp17MoveAssignable；ranges 要求 `permutable` 及 projection 后值与 `value` 可用
`ranges::equal_to` 比较。LWG 2110 澄清尾部 unspecified 来自 moving，不是算法可以任意 swap。
来源：[`[alg.remove]`](https://eel.is/c++draft/alg.remove)、
[LWG 2110](https://cplusplus.github.io/LWG/issue2110)。

### 7.3 Erase、引用别名、异常、失效与线程

对 `vector`/`string` 等 owning sequence，常见两阶段写法是：

```cpp
auto new_end = std::remove(values.begin(), values.end(), target);
values.erase(new_end, values.end());
```

C++20 也可考虑对应容器的 `std::erase(container,value)`；它把算法和容器 erase 合并。对
`list`/`forward_list` 应优先容器 member `remove`，因为 node-based member 真正摘除节点，避免
对节点 payload 做无意义的移动压缩。

`value` 以 `const T&` 传入。若它引用待处理范围内某个元素，前面的 move assignment 可能改变
该被引用对象，后续比较目标随之改变；即便不必然 UB，也极易产生意外结果。教学页应要求目标值
独立存储或先复制出来。

Move assignment 或 equality/projection 抛异常时，前缀可能已部分压缩，算法无统一 rollback。
算法阶段不改变 vector capacity，因此 iterator 仍指位置；随后 `erase(new_end,end)` 会使擦除点
及其后的 vector iterator/reference 失效。必须先计算 removed count 或读取 prefix，再 erase；
erase 后不可继续使用旧 `new_end`/ranges tail。

原地压缩写入范围，不能与任何无同步读取/写入同一元素并发。Execution policy 下元素操作与
projection 不得引入共享副作用或 aliasing destination。

### 7.4 JS 对照与误区

JS `array.filter(x => x !== value)` 返回新数组而不修改原数组；更接近 `remove` 的概念结果是
“把保留项稳定压到原数组前缀，返回逻辑长度，再由容器缩短”。JS `splice` 会立即改变 length，
C++ 范围算法不会。Ranges projection 可类比按 `item.archived` 选值，但不会构造中间映射数组。

常见误区：函数名表示立即缩短 vector；返回删除数量；尾部保持原值；可以读取尾部来找被删项；
任意 element 都无需 move assignment；所有 iterator 在算法返回时失效；erase 后 `new_end` 仍
有效；value 引用范围内部总是安全；它是文件删除 API；`std::remove_if` 和按值 `remove` 的参数
相同。

### 7.5 两个示例

1. `erase-removed-values.cpp`：`vector<int>{1,2,2,3,2,4}` 先调用 classic remove，
   在 erase 前计算 removed count，再 erase tail 并输出剩余值；不读取 tail 内容。

   直接包含：`<algorithm>`、`<iostream>`、`<vector>`。

   ```text
   removed=3
   values=1,3,4
   ```

2. `remove-archived-with-projection.cpp`：固定四个 `Task{id,archived}`，用
   `std::ranges::remove(tasks, true, &Task::archived)` 得到 tail，在 erase 前计算保留数，
   erase 后只输出剩余 id。

   直接包含：`<algorithm>`、`<iostream>`、`<vector>`。

   ```text
   kept=2
   ids=1,3
   ```

## 8. 十个示例的确定性清单

| # | Entry / 文件名 | 数据来源 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `std-move-algorithm` / `move-owned-values.cpp` | 固定 unique owners | 只读 destination | `written=3\nvalues=4,7,9\n` |
| 2 | `std-move-algorithm` / `move-string-batch-with-ranges.cpp` | 固定 strings | 不读 moved-from source | `written=2\nvalues=api,worker\n` |
| 3 | `std-count` / `count-fixed-value.cpp` | 固定整数 array | equality count | `twos=3\n` |
| 4 | `std-count` / `count-status-with-projection.cpp` | 固定 records | member projection | `server_errors=2\n` |
| 5 | `std-none-of` / `check-empty-range.cpp` | empty array | vacuous truth | `empty_has_no_negative=true\n` |
| 6 | `std-none-of` / `check-jobs-with-projection.cpp` | 固定 records | 无副作用 predicate | `all_healthy=true\n` |
| 7 | `std-rotate` / `rotate-left-and-find-old-first.cpp` | 固定 vector | 规范 sequence order | `old_first_index=3\nvalues=3,4,5,1,2\n` |
| 8 | `std-rotate` / `rotate-array-with-ranges.cpp` | 固定 array | lvalue borrowed range | `old_first_index=3\nvalues=20,30,40,10\n` |
| 9 | `std-remove-algorithm` / `erase-removed-values.cpp` | 固定 vector | erase 前计数、不读 tail | `removed=3\nvalues=1,3,4\n` |
| 10 | `std-remove-algorithm` / `remove-archived-with-projection.cpp` | 固定 records | projection + erase tail | `kept=2\nids=1,3\n` |

实现要求：

- ASCII stdout，bool 使用显式 `std::boolalpha`；所有分隔符与换行逐字匹配上表；
- 所有 container/range 都是 main 内 lvalue owner，活过算法返回值的使用；
- move 两例只输出 destination；remove 两例只输出逻辑前缀或 erase 后容器；
- 计数与 iterator distance 只使用同一 array/vector 的 random-access iterator subtraction，
  不打印平台相关的 iterator difference type 名称；
- 不加入 `std::execution` 示例、异常演示、地址、耗时、随机值或未指定状态；
- 编译配置固定 C++20，ranges 示例只用 C++20 已标准化 overload。

## 9. 版本与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| C++98 `count`/`rotate`/`remove` 起点 | [WG21 1997 public review draft N2356](https://www.open-std.org/jtc1/sc22/open/n2356/) 的 `[lib.alg.count]`、`[lib.alg.rotate]`、`[lib.alg.remove]` |
| C++11 `move` 算法、`none_of` 与 rotate 返回值基线 | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、[N2666 More STL algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2666.pdf) |
| C++17 execution-policy overload | [P0024R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0024r2.html)、[P0394R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0394r4.html) |
| C++20 constexpr classic algorithms | [P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html) |
| C++20 ranges algorithms与最终基线 | [P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)、[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) |
| C++23 核对基线 | [N4950](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/n4950.pdf) |
| C++26 value 参数默认类型 | [P2248R8](https://isocpp.org/files/papers/P2248R8.html) |
| C++26 parallel ranges | [P3179R9](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3179r9.html) |
| 当前算法共享要求 | [`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)、[`[algorithms.parallel]`](https://eel.is/c++draft/algorithms.parallel)、[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races) |
| move 范围算法 | [`[alg.move]`](https://eel.is/c++draft/alg.move)、[`[iterator.cust.move]`](https://eel.is/c++draft/iterator.cust.move)、[`[alg.req.ind.move]`](https://eel.is/c++draft/alg.req.ind.move)、[LWG 2689](https://cplusplus.github.io/LWG/issue2689) |
| count | [`[alg.count]`](https://eel.is/c++draft/alg.count) |
| none_of | [`[alg.none.of]`](https://eel.is/c++draft/alg.none.of)、[N2666](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2666.pdf) |
| rotate | [`[alg.rotate]`](https://eel.is/c++draft/alg.rotate)、[`[alg.req.permutable]`](https://eel.is/c++draft/alg.req.permutable) |
| remove 范围算法 | [`[alg.remove]`](https://eel.is/c++draft/alg.remove)、[LWG 2110](https://cplusplus.github.io/LWG/issue2110) |
| moved-from 状态 | [`[lib.types.movedfrom]`](https://eel.is/c++draft/lib.types.movedfrom) |

二级页面只用于核对搜索别名、重载栏目和学习导航：
[`std::move` algorithm](https://zh.cppreference.com/w/cpp/algorithm/move)、
[`std::count`](https://zh.cppreference.com/w/cpp/algorithm/count)、
[`std::none_of`](https://zh.cppreference.com/w/cpp/algorithm/all_any_none_of)、
[`std::rotate`](https://zh.cppreference.com/w/cpp/algorithm/rotate)、
[`std::remove`](https://zh.cppreference.com/w/cpp/algorithm/remove)。正文、接口摘要与示例必须原创。

## 10. 每个 Entry 的 manifest-ready 来源建议

### `std-move-algorithm`

- Current: `[alg.move]`、`[algorithms.requirements]`、`[iterator.cust.move]`、
  `[alg.req.ind.move]`、`[lib.types.movedfrom]`
- Historical/WG21: N3337、P0024R2、P0394R4、P0202R3、P0896R4、N4861、
  P3179R9、LWG 2689
- Secondary: zh.cppreference `std::move` algorithm

### `std-count`

- Current: `[alg.count]`、`[algorithms.requirements]`、
  `[algorithms.parallel.exceptions]`、`[res.on.data.races]`
- Historical/WG21: N2356、N3337、P0024R2、P0202R3、P0896R4、N4861、
  P2248R8、P3179R9
- Secondary: zh.cppreference `std::count`

### `std-none-of`

- Current: `[alg.none.of]`、`[algorithms.requirements]`、
  `[algorithms.parallel.user]`、`[res.on.data.races]`
- Historical/WG21: N2666、N3337、P0024R2、P0202R3、P0896R4、N4861、
  P3179R9
- Secondary: zh.cppreference `all_of/any_of/none_of`

### `std-rotate`

- Current: `[alg.rotate]`、`[alg.req.permutable]`、`[algorithms.requirements]`、
  `[algorithms.parallel.exec]`
- Historical/WG21: N2356、N3337、P0024R2、P0202R3、P0896R4、N4861、
  P3179R9
- Secondary: zh.cppreference `std::rotate`

### `std-remove-algorithm`

- Current: `[alg.remove]`、`[alg.req.permutable]`、`[algorithms.requirements]`、
  `[res.on.data.races]`
- Historical/WG21/DR: N2356、N3337、P0024R2、P0202R3、P0896R4、N4861、
  P2248R8、P3179R9、LWG 2110
- Secondary: zh.cppreference `std::remove` algorithm

## 11. 实施与终审清单

- 只新增五个建议 ID；每页两个 deterministic C++20 run 示例，共 10 个。
- 两个重名算法必须使用消歧 ID、算法类 slug 与清楚 summary；不得覆盖现有 `std-move`、
  `std-filesystem-remove` 或 `std-remove-if`。
- 五页均覆盖：直接包含、C++20 代表接口、classic/policy/ranges 版本边界、参数与 concepts、
  返回形状、复杂度、异常/终止、生命周期/失效、线程/data race、常见误区、JS 对照和一级来源。
- `std-move-algorithm` 明确：逐项 move assignment、destination 已存在、正向重叠前置条件、
  policy 全范围不重叠、ranges `in_out_result`、源 valid but unspecified；不打印 source。
- `std-count` 明确：返回 signed difference type、恰好 N 次比较、projection 是先取比较键、
  input iterator 与 policy forward iterator 的差异。
- `std-none-of` 明确：存在命中即 false、空范围 true、至多 N 次、可短路、只返回 bool；
  predicate 无副作用且不可依赖复制/调用次数。
- `std-rotate` 明确：`middle` 为 iterator、左旋、两个子范围有效、C++11 返回值变化、ranges
  subrange、至多 N swaps、iterator 保留位置而非逻辑值。
- `std-remove-algorithm` 明确：稳定逻辑删除、不缩短容器、classic new_end/ranges tail、尾部
  valid but unspecified、随后 erase 的失效边界、value 不应 alias 范围元素。
- execution-policy 部分以所述标准版本为准：标准 policy element-access exception 导致
  terminate，临时内存失败可 bad_alloc；不复制早期 TS 的 exception_list 设计。
- current draft 中 P2248/P3179 接口必须标 C++26；不能教成 C++20/C++23 可用。
- expected stdout 与第 8 节逐字一致；直接 include 完整，不输出 source moved-from 值、remove
  tail、地址、timing、predicate 调用次数、线程或实现相关信息。
- 终审拒绝：范围 move 只是 cast；destination 自动扩容；move 后源一定为空；所有重叠合法；
  count 会短路或返回 size_t；none_of 空范围 false；rotate middle 是次数或返回新 begin；remove
  会缩短 vector、返回删除数或保留稳定尾值；erase 后继续使用 new_end；ranges policy overload
  属于 C++20；算法只读/节点稳定等于线程安全。
