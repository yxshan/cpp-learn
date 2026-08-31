# `std::for_each`

`std::for_each` 对范围中的每个元素调用一个函数对象。它适合表达逐项副作用或原地修改；若目标是生成新值，`std::transform` 通常更明确。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::for_each`：C++20。
- 返回值：经典接口返回函数对象；policy 接口返回 `void`；ranges 接口返回输入尾与函数对象。

## C++20 代表声明

```cpp
template<class InputIt, class Function>
constexpr Function for_each(InputIt first, InputIt last, Function f);

template<class ExecutionPolicy, class ForwardIt, class Function>
void for_each(ExecutionPolicy&& policy, ForwardIt first,
              ForwardIt last, Function f);

template<std::input_iterator I, std::sentinel_for<I> S,
         class Proj = std::identity,
         std::indirectly_unary_invocable<std::projected<I, Proj>> Fun>
constexpr std::ranges::for_each_result<I, Fun>
std::ranges::for_each(I first, S last, Fun f, Proj proj = {});
```

三个家族的返回值不同：经典接口返回执行后的 `f`，policy 重载返回 `void`，ranges 接口返回包含输入尾和函数对象的结果对象。

## 参数与前置条件

- `first`、`last`：待遍历的有效半开范围。
- `f`：对每个解引用元素可调用的函数对象；经典重载按值接收并要求它可移动构造，policy
  重载为分发调用还要求可复制构造。
- `policy`：决定执行策略；并行策略下函数对象对共享状态的访问必须同步。
- `proj`：ranges 家族可选的投影，在调用 `f` 前转换观察值。

若 `f` 修改当前元素，迭代器必须提供相应可写访问。函数对象不能通过结构修改使算法正在使
用的范围失效。

## 行为与要求

- 普通经典接口按从 `first` 到 `last` 的顺序，恰好调用函数 N 次。
- 经典接口的 `Function` 需要可移动构造；policy 重载为了分发副本，要求函数对象可复制构造。
- ranges 接口以 `indirectly_unary_invocable` 约束投影后的元素与函数对象能否合法调用。
- 函数调用本身的返回值会被忽略。
- 若迭代器可写，函数可以通过引用修改当前元素。
- 不要在函数中对正在遍历的容器做会使迭代器失效的结构修改，例如向同一 vector `push_back`。
- policy 家族可能并行或无序执行，不能用共享的无同步状态累加结果。

经典接口返回函数对象，适合取回它内部积累的状态；不要假定最初传入的函数对象实例会被就地修改，因为算法可以复制或移动函数对象。

## 复杂度与异常

- 对 N 个元素恰好应用函数 N 次。
- 普通重载中，函数抛异常后，异常向调用者传播，后续元素不再由该调用处理，已完成的副作用不回滚。
- policy 重载遵循并行算法异常规则：元素访问函数抛出的未捕获异常会触发 `std::terminate`，分配失败可抛 `std::bad_alloc`。

## 生命周期与失效规则

算法不拥有输入范围。它按值接收本次调用使用的函数对象，ranges 家族也按值接收
projection；这些副本内部保存的引用、指针及回调捕获对象仍是非拥有关系，算法不会延长其
目标的生命周期。所有输入迭代器和这类引用目标必须在本次调用期间有效。算法本身不改变范
围大小；允许的当前元素赋值通常不使容器结构失效，但在回调中向同一 vector 插入等结构修
改可能立即使算法持有的迭代器失效。经典重载返回的函数对象是一个值，其内部若仍保存引
用，引用目标仍须存活。

## 示例：原地修改元素

```cpp
std::array<int, 3> values{1, 2, 3};
std::for_each(values.begin(), values.end(),
              [](int& value) { value *= 2; });
```

结果为 `2 4 6`。另一个示例传入保存请求数、慢请求数与总延迟的函数对象，并从经典 `for_each` 的返回值读取累计状态。

## 何时不用

- 一一生成输出范围：使用 `std::transform`。
- 聚合为一个值：使用 `std::accumulate` 或合适的 reduction。
- 只查询是否存在：使用 `std::any_of`。
- 简单的顺序副作用：range-for 有时更易读，也更容易写 `break` 或 `continue`。

## 常见错误

### 期待回调返回值组成新容器

回调返回值被忽略。需要映射结果时使用 `transform`。

### 从原函数对象读取累计状态

经典接口按值接收函数对象。使用算法返回的函数对象，或显式、安全地捕获外部状态。

### 在 policy 重载中无同步写共享变量

这会产生数据竞争。并行归约应选择专门的归约算法和满足要求的运算。

## 与 JavaScript 的区别

它接近 `Array.prototype.forEach()` 的逐项调用，但经典 C++ 接口会返回函数对象，并可作用于任意满足要求的迭代器范围。C++ 的 policy 和 ranges 家族还有不同的返回与约束模型。

## 相关条目

- `std::transform`：把输入映射为输出。
- `std::accumulate`：顺序聚合。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

当前合同见 Working Draft `[alg.foreach]`；policy、ranges 与 constexpr 演进分别由 P0024R2、P0896R4、P0202R3 支撑。
