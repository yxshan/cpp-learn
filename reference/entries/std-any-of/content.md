# `std::any_of`

`std::any_of` 检查范围中是否至少有一个元素满足谓词。它适合表达“是否存在”，而不是查找位置或统计数量。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典接口：C++11。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::any_of`：C++20。
- 返回值：是否至少有一个元素满足谓词的 `bool`。

## C++20 代表声明

```cpp
template<class InputIt, class UnaryPred>
constexpr bool any_of(InputIt first, InputIt last, UnaryPred pred);

template<class ExecutionPolicy, class ForwardIt, class UnaryPred>
bool any_of(ExecutionPolicy&& policy, ForwardIt first, ForwardIt last,
            UnaryPred pred);

template<std::input_iterator I, std::sentinel_for<I> S,
         class Proj = std::identity,
         std::indirect_unary_predicate<std::projected<I, Proj>> Pred>
constexpr bool std::ranges::any_of(I first, S last, Pred pred,
                                   Proj proj = {});
```

ranges 家族也接受一个 range，并可在调用谓词前应用 projection。

## 行为与返回值

- 若存在元素 `e` 使 `pred(e)` 为 `true`，返回 `true`。
- 空范围返回 `false`，谓词不会被调用。
- 普通顺序重载可以在得到结果后停止，但合同只保证谓词至多调用 N 次。
- 不要依赖谓词调用次数、顺序或副作用来完成业务逻辑，尤其不要对 policy 重载这样做。

普通接口只读取元素，不改变范围结构；谓词不应通过参数修改元素，也不应使遍历范围失效。

## 复杂度与异常

- 最多调用谓词 N 次。
- 普通重载中，谓词抛出的异常向调用者传播；此前发生的外部副作用不会回滚。
- 对标准 execution policy，元素访问函数抛出的未捕获异常会触发 `std::terminate`；资源分配失败仍可抛出 `std::bad_alloc`。

## 示例：检测异常值

```cpp
const std::array<int, 4> balances{12, 4, -3, 8};
const bool has_negative = std::any_of(
    balances.begin(), balances.end(), [](int value) { return value < 0; });
```

第二个示例检查一页 HTTP 状态中是否存在 `500` 及以上的服务端错误。两者都只使用返回的布尔结果。

## 何时不用

- 需要第一个匹配元素的位置：使用 `std::find_if`。
- 需要匹配数量：使用 `std::count_if`。
- 要求所有元素满足条件：使用 `std::all_of`。
- 要求没有元素满足条件：使用 `std::none_of`。

## 常见错误

### 用副作用统计谓词调用次数

算法可以提前结束，policy 家族还可能并行执行。需要统计时直接使用 `count_if`，不要把计数藏进谓词。

### 忘记空范围语义

“至少一个满足”在空集合上是 false；它与 `all_of` 的空范围结果不同。

### 把布尔查询写成手动循环

当循环的唯一结果就是“是否存在”，`any_of` 更直接地表达意图，也更容易审查前置条件。

## 与 JavaScript 的区别

它接近 `Array.prototype.some()`：空数组同样返回 false。C++ 版本作用于迭代器或 ranges，并在编译期约束谓词、投影和可读取元素类型。

## 相关条目

- `std::find`：返回匹配位置。
- `std::count_if`：统计匹配数量。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

当前合同见 Working Draft `[alg.any.of]`；C++17 policy 家族来自 P0024R2，C++20 ranges 家族来自 P0896R4，constexpr 演进见 P0202R3。
