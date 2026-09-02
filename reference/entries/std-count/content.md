# `std::count`

`std::count` 完整扫描范围，统计与给定值相等的元素数量，不修改元素。

## 快速信息

```cpp
#include <algorithm>
```

- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::count`：C++20，支持 projection。
- 返回类型是迭代器的有符号 `difference_type`，不是固定的 `int` 或 `size_t`。

## 什么时候使用

需要得到某个值的精确出现次数时使用。只判断“是否存在”时，`std::find`、`std::any_of` 或 `!std::none_of` 能提前停止；按条件而不是按固定值统计时，使用 `std::count_if`。

## C++20 代表性声明

```cpp
template<class InputIt, class T>
constexpr typename std::iterator_traits<InputIt>::difference_type
count(InputIt first, InputIt last, const T& value);

template<class ExecutionPolicy, class ForwardIt, class T>
typename std::iterator_traits<ForwardIt>::difference_type
count(ExecutionPolicy&& policy, ForwardIt first,
      ForwardIt last, const T& value);

template<std::input_iterator I, std::sentinel_for<I> S,
         class T, class Proj = std::identity>
    requires std::indirect_binary_predicate<std::ranges::equal_to,
                                             std::projected<I, Proj>,
                                             const T*>
constexpr std::iter_difference_t<I>
std::ranges::count(I first, S last, const T& value, Proj proj = {});
```

ranges 家族也接受 range。值参数的 C++26 默认类型和 ranges policy 接口都不属于 C++20/23。

## 参数与约束

- `[first, last)`：有效输入范围；普通接口只要求输入迭代器，能够处理单遍输入。
- `value`：比较目标，在调用期间必须保持有效。
- `proj`：ranges 接口先对每个元素应用 projection，再把结果与 `value` 用 `ranges::equal_to` 比较。
- `policy`：execution-policy 接口要求前向迭代器。

相等比较和 projection 不应修改正在遍历的容器、使迭代器失效，或依赖跨线程的无同步副作用。

## 返回值

返回匹配元素数量，类型为对应迭代器的 `difference_type`。它通常是有符号整数；与 `container.size()` 比较或转成较窄整数前，应先确认范围大小和转换安全。

## 复杂度

对 N 个元素恰好进行 N 次相等比较；ranges 接口也恰好调用 N 次 projection。因此 `count` 不会在首次命中后短路。总成本还包括每次比较和 projection 自身的成本。

## 异常、错误与并发

普通接口会传播迭代器、相等比较或 projection 抛出的异常，并且没有部分计数返回。对标准 execution policy，元素访问函数抛出的未捕获异常会调用 `std::terminate`；临时分配失败可抛 `std::bad_alloc`。

算法本身只读，但“只读算法”不等于对象天然线程安全：遍历期间不能有无同步写入，也不能让比较或 projection 产生 data race。

## 生命周期与失效规则

算法不保存迭代器、元素或 projection。输入范围及 `value` 必须在调用期间存活；成功返回后没有由 `count` 自身造成的容器结构变化或迭代器失效。若比较器内部修改了外部状态，则其生命周期和同步责任仍由调用者承担。

## 示例

“固定值计数”统计 array 中的 `2`；“按状态字段计数”用 ranges projection `&Request::status`，避免先建立状态码中间数组。

## 常见错误

- 只需要存在性，却用 `count(...) > 0` 完整扫描。
- 假设返回值是无符号 `size_t`。
- 认为找到一个匹配后会短路。
- 误以为 projection 是先生成一个新容器。
- 在相等运算或 projection 中修改输入容器。

## 与 JavaScript 的区别

> JavaScript 常写 `array.filter(x => x === value).length`，会创建匹配数组；C++ `count` 直接累加。ranges projection 类似先读取 `item.status` 再比较，但不构造 `map()` 结果。

## 相关内容

- `std::count_if`：按一元谓词统计。
- `std::find`：返回第一个匹配位置并可提前结束。
- `std::none_of`：只判断是否完全没有匹配。
- `<algorithm>`：本算法所在头文件。

## 规范来源

当前返回、比较次数和 ranges projection 合同见 Working Draft `[alg.count]`；C++98 起点、policy、constexpr 与 ranges 边界分别由 N2356、P0024R2、P0202R3、P0896R4 支撑。
