# `std::none_of`

`std::none_of` 判断范围中是否没有任何元素让谓词成立。一旦发现匹配项就能返回 `false`；空范围返回 `true`。

## 快速信息

```cpp
#include <algorithm>
```

- 经典接口：C++11。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::none_of`：C++20，支持 projection。
- 返回值：`bool`。

## 什么时候使用

表达“没有失败任务”“没有负数”“没有未授权记录”等整体约束时使用。若需要第一个违规元素的位置，使用 `std::find_if`；若需要数量，使用 `std::count_if`；若要求全部元素满足正向条件，可考虑 `std::all_of`。

## C++20 代表性声明

```cpp
template<class InputIt, class UnaryPred>
constexpr bool none_of(InputIt first, InputIt last, UnaryPred pred);

template<class ExecutionPolicy, class ForwardIt, class UnaryPred>
bool none_of(ExecutionPolicy&& policy, ForwardIt first,
             ForwardIt last, UnaryPred pred);

template<std::input_iterator I, std::sentinel_for<I> S,
         class Proj = std::identity,
         std::indirect_unary_predicate<std::projected<I, Proj>> Pred>
constexpr bool std::ranges::none_of(I first, S last,
                                    Pred pred, Proj proj = {});
```

ranges 家族也接受 range。ranges execution-policy 版本属于 C++26，而非 C++20/23。

## 参数与前置条件

- `[first, last)`：有效输入范围；非 policy 接口允许单遍输入迭代器。
- `pred`：对元素或 projection 结果进行判断的一元谓词，结果可按布尔值解释。
- `proj`：ranges 接口先取出要判断的视图，例如成员字段。
- policy 接口要求前向迭代器。

谓词不应修改输入元素，也不能改变容器结构。算法可能复制谓词，而且普通接口可以提前结束，因此不要依赖精确调用次数或把不可缺少的业务副作用放进谓词。

## 返回值与空范围

若 `[first, last)` 中不存在让谓词为 `true` 的元素，返回 `true`；否则返回 `false`。空范围没有反例，所以结果为 `true`，这是“全称条件的空真”，不是特殊错误。

## 复杂度与短路

对 N 个元素至多调用 N 次谓词与 projection。顺序重载找到首个匹配项后可立即返回 `false`，因此与要求精确数量的 `count_if` 不同。execution policy 可以改变调用顺序、并发方式和实际调用数量，不能依赖哪一项先执行。

## 异常、生命周期与线程

普通接口传播迭代器、predicate 或 projection 抛出的异常。标准 execution policy 下，元素访问函数抛出的未捕获异常会调用 `std::terminate`；临时分配失败可抛 `std::bad_alloc`。

输入范围及谓词捕获的引用必须存活到调用结束。算法不修改容器结构，因此成功返回本身不会使迭代器失效；但其他线程无同步地写入输入，或谓词写共享状态，仍会产生 data race。

## 示例

“检查空范围”明确展示空范围返回 `true`；“检查任务状态”用 ranges projection 读取 `Job::failed`，谓词保持无副作用。

## 常见错误

- 认为空范围应返回 `false`。
- 把 `none_of(pred)` 误解为“所有元素都满足 pred”。
- 依赖谓词恰好执行 N 次或固定顺序。
- 在谓词内累计不可丢失的副作用。
- 需要违规元素位置，却只保留布尔结果。

## 与 JavaScript 的区别

> 语义可写成 `!array.some(predicate)`。现代 JavaScript 的 `every(x => !predicate(x))` 也等价；C++ 额外约束迭代器类别、谓词可调用性、对象生命周期和并行策略下的副作用。

## 相关内容

- `std::all_of`：所有元素都满足条件。
- `std::any_of`：至少一个元素满足条件。
- `std::count`：得到固定值的精确数量。
- `<algorithm>`：本算法所在头文件。

## 规范来源

当前返回语义、空范围和至多 N 次调用见 Working Draft `[alg.none.of]`；引入背景见 N2666，policy、constexpr 与 ranges 演进见 P0024R2、P0202R3、P0896R4。
