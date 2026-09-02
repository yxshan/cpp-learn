# `std::rotate`

`std::rotate` 把 `[first, last)` 按迭代器 `middle` 左旋：原来的 `[middle, last)` 移到前面，原来的 `[first, middle)` 保持相对顺序并移到后面。

## 快速信息

```cpp
#include <algorithm>
```

- 经典接口：C++98；C++11 起返回旧首元素的新位置，C++98 原接口返回 `void`。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::rotate`：C++20。
- 效果：原地重新排列，不改变容器大小。

## 什么时候使用

轮换队列、把选中项移到开头、把前 K 项搬到末尾且保持两段内部顺序时使用。只想镜像反转整个顺序时用 `std::reverse`；想非修改地循环访问时，优先考虑索引或 view 组合。

## C++20 代表性声明

```cpp
template<class ForwardIt>
constexpr ForwardIt rotate(ForwardIt first, ForwardIt middle,
                           ForwardIt last);

template<class ExecutionPolicy, class ForwardIt>
ForwardIt rotate(ExecutionPolicy&& policy, ForwardIt first,
                 ForwardIt middle, ForwardIt last);

template<std::permutable I, std::sentinel_for<I> S>
constexpr std::ranges::subrange<I>
std::ranges::rotate(I first, I middle, S last);

template<std::ranges::forward_range R>
    requires std::permutable<std::ranges::iterator_t<R>>
constexpr std::ranges::borrowed_subrange_t<R>
std::ranges::rotate(R&& range, std::ranges::iterator_t<R> middle);
```

ranges 家族也接受 range 加一个 `middle` 迭代器。C++26 才有 ranges policy 接口。

## 参数与前置条件

- `first`、`last`：定义有效半开范围。
- `middle`：同一范围中的迭代器，不是“旋转次数”。它同时定义 `[first, middle)` 与 `[middle, last)` 两个有效子范围。
- 元素必须可按接口要求交换或移动，ranges 用 `permutable` 表达该约束。

`middle == first` 或 `middle == last` 都是有效边界，结果序列不变。不要由不相关容器构造 `middle`，也不要传越过 `last` 的迭代器。

## 返回值

经典 C++11 及之后接口返回旋转后指向“原 `*first` 所在位置”的迭代器；它通常不是新的 `begin()`。ranges 接口返回 subrange `{该位置, 末尾迭代器}`。若 `first == middle`，返回 `last`；若 `middle == last`，返回 `first`。

## 复杂度

令 N 为 `distance(first, last)`，至多执行 N 次元素交换。具体实现可根据迭代器类别和元素类型选择更高效的块移动或交换策略，但调用者不能依赖某个内部算法。

## 异常、生命周期与失效规则

交换或移动抛异常时，范围可能已部分重新排列，不会自动回滚。标准 execution policy 下，元素访问函数的未捕获异常会调用 `std::terminate`，分配失败可抛 `std::bad_alloc`。

算法不增删元素，因此不会仅因旋转使 vector 的迭代器失效；但迭代器表示的是物理位置，旋转后该位置可能持有不同的逻辑值。返回迭代器只在容器仍存活且没有后续结构修改时有效。range 重载返回 `borrowed_subrange_t<R>`：非 borrowed 临时 owner 不会把可悬空迭代器暴露给调用者，结果类型会退化为 `std::ranges::dangling`。调用期间不能与其他线程无同步地访问被写入的元素。

## 示例

“左旋并定位旧首元素”把前两个整数搬到末尾；ranges 示例把固定工作队列轮换一位，并从返回 subrange 的 `.begin()` 得到旧首任务的新位置。

## 常见错误

- 把 `middle` 传成整数偏移，而不是 `first + offset` 等迭代器。
- 认为返回值是新的首迭代器。
- 忘记 C++98 的历史接口返回 `void`，把现代代码结论反推到旧标准。
- 认为容器迭代器未失效就仍指向原来的逻辑元素。
- 把循环移位与完全反转混为一谈。

## 与 JavaScript 的区别

> JavaScript 常用 `array.push(...array.splice(0, k))`，会通过 splice 改变数组长度并创建中间数组。`std::rotate` 在既有 C++ 范围内原地重排，不改变 size，并用迭代器表达分割位置。

## 相关内容

- `std::reverse`：镜像反转范围。
- `std::vector`：常见随机访问容器。
- `std::remove`（范围算法）：同样返回逻辑边界，但语义完全不同。
- `<algorithm>`：本算法所在头文件。

## 规范来源

当前效果、返回和复杂度见 Working Draft `[alg.rotate]`；C++98 起点与 C++11 返回变化分别见 N2356、N3337，policy、constexpr 与 ranges 边界见 P0024R2、P0202R3、P0896R4。
