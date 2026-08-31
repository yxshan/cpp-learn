# `std::reverse`

`std::reverse` 原地交换范围中的对称元素，使元素顺序完全反转。它改变值所在的位置，但不改变容器大小。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::reverse`：C++20。
- 返回值：经典接口返回 `void`；ranges 接口返回尾迭代器。

## C++20 代表声明

```cpp
template<class BidirectionalIt>
constexpr void reverse(BidirectionalIt first, BidirectionalIt last);

template<class ExecutionPolicy, class BidirectionalIt>
void reverse(ExecutionPolicy&& policy, BidirectionalIt first,
             BidirectionalIt last);

template<std::bidirectional_iterator I, std::sentinel_for<I> S>
    requires std::permutable<I>
constexpr I std::ranges::reverse(I first, S last);
```

经典接口返回 `void`；ranges 接口返回原始尾哨兵对应的迭代器。两者不要混为一个返回模型。

## 参数与前置条件

- `first`、`last`：定义要原地反转的有效半开范围；经典接口要求双向迭代器。
- `policy`：仅执行策略重载存在，决定调度与异常规则。

经典接口要求范围元素能通过 `iter_swap` 交换；ranges 接口用
`bidirectional_iterator` 与 `permutable` 概念表达相应约束。范围必须在整个调用期间有
效，也不能被并发结构修改或别名操作破坏。

## 复杂度与行为

- 空范围和单元素范围不进行交换。
- 对长度 N 的范围，恰好执行 `N / 2` 次交换。

除这些交换及其内部成本外，算法不分配与 N 成比例的结果范围。经典、policy 和 ranges 家
族都必须完成相同数量的元素交换；执行策略可以改变交换的调度方式，但不把操作变成创建副
本的算法。

算法不新增或销毁元素，因此不会仅因 `reverse` 自身造成容器结构性迭代器失效。不过，原来指向某个位置的迭代器现在观察到的是反转后位于该位置的值。

## 异常与部分完成

元素交换抛异常时，范围可能已经部分反转，不会自动恢复。标准 execution policy 重载遵守并行算法异常规则：元素访问函数抛出的未捕获异常会触发 `std::terminate`，分配失败可抛 `std::bad_alloc`。

## 示例：原地反转

```cpp
std::array<int, 4> values{1, 2, 3, 4};
std::reverse(values.begin(), values.end());
// values: 4, 3, 2, 1
```

另一个示例把 `api / users / details` 的路径片段反转，用于按“当前位置到根”顺序展示导航层级。

## 何时不用

- 要保留原范围并写入副本：使用 `std::reverse_copy`。
- 只想逆序访问：使用反向迭代器或 reverse view，避免修改数据。
- 需要循环移位而非镜像反转：使用 `std::rotate`。
- 容器只提供前向迭代器：它不满足 `reverse` 的双向要求。

## 常见错误

### 误以为返回新的容器

经典 `std::reverse` 返回 `void`，并直接修改输入范围。

### 把交换次数写成 N

每对元素只交换一次，因此精确复杂度是 `N / 2` 次交换。

### 在回调或并发代码中依赖中间状态

异常或并行执行时可能只完成部分交换。除非操作成功返回，不要把中间排列当成稳定结果。

## 与 JavaScript 的区别

它更接近会修改数组的 `Array.prototype.reverse()`，而不是创建新数组的 `toReversed()`。C++ 接口对可交换性和迭代器类别有静态约束。

## 相关条目

- `std::copy`：把元素复制到另一范围。
- `std::vector`：常见的随机访问范围。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

当前合同见 Working Draft `[alg.reverse]`；C++17 policy、C++20 ranges 与 constexpr 演进分别见 P0024R2、P0896R4 和 P0202R3。
