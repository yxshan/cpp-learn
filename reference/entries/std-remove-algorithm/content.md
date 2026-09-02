# `std::remove`（范围算法）

`<algorithm>` 中的 `std::remove` 不会删除容器元素。它把“不等于目标值”的元素稳定压缩到范围前部，并返回新的逻辑末尾；真正缩短容器通常还要调用容器的 `erase`。

## 快速信息

```cpp
#include <algorithm>
```

- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::remove`：C++20，支持 projection。
- 不同于 `<cstdio>` 文件删除，也不同于 `std::filesystem::remove`。

## 什么时候使用

要从 vector、string 等连续序列中按固定值移除元素时，先用范围 `remove` 得到逻辑尾，再 erase 尾部。C++20 对整个容器也可用 `std::erase(container, value)`。对 `list` 和 `forward_list`，优先使用容器 member `remove`，它会真正摘除节点。

## C++20 代表性声明

```cpp
template<class ForwardIt, class T>
constexpr ForwardIt remove(ForwardIt first, ForwardIt last,
                           const T& value);

template<class ExecutionPolicy, class ForwardIt, class T>
ForwardIt remove(ExecutionPolicy&& policy, ForwardIt first,
                 ForwardIt last, const T& value);

template<std::permutable I, std::sentinel_for<I> S,
         class T, class Proj = std::identity>
constexpr std::ranges::subrange<I>
std::ranges::remove(I first, S last,
                    const T& value, Proj proj = {});
```

ranges 家族也接受 range。值参数的默认模板类型和 ranges execution-policy 重载属于 C++26，不属于 C++20/23。

## 参数与前置条件

- `[first, last)`：有效可写范围；经典接口要求前向迭代器及可移动赋值元素。
- `value`：要排除的比较值。
- `proj`：ranges 接口先投影元素字段，再与 `value` 比较。
- ranges 接口用 `permutable` 及可比较约束表达原地压缩要求。

不要让 `value` 引用范围内部的某个元素。压缩过程的移动赋值可能改变这个被引用对象，使后续比较目标意外变化；先把目标值复制到范围外更稳妥。

## 返回值与尾部状态

- 经典接口返回 `new_end`，即保留前缀 `[first, new_end)` 的逻辑末尾。
- ranges 接口返回待擦除的 subrange `{new_end, last}`，而不是保留前缀。
- 算法保持保留元素的相对顺序，但不改变容器 `size()`。
- `[new_end, last)` 中的对象仍有效，其值未指定。不得读取、打印或借它恢复被删元素。

随后可执行：

```cpp
auto new_end = std::remove(values.begin(), values.end(), target);
values.erase(new_end, values.end());
```

## 复杂度

对 N 个元素恰好执行 N 次相等比较；ranges 接口也恰好执行 N 次 projection。实际移动赋值次数不超过需要压缩的保留元素数量。算法稳定保留前缀次序，但不保证尾部次序或值。

## 异常、错误与部分完成

普通接口传播比较、projection 或移动赋值抛出的异常；此时范围可能已部分压缩，没有统一 rollback。标准 execution policy 下，元素访问函数抛出的未捕获异常会调用 `std::terminate`；分配失败可抛 `std::bad_alloc`。

## 生命周期、失效与并发

remove 阶段不改变 vector 容量和 size，已有迭代器仍指向物理位置，但该位置的值可能已改变。随后 `erase(new_end, end)` 会使 vector 在擦除点及其后的迭代器和引用失效，包括旧 `new_end` 与 ranges 返回的 tail。应在 erase 前计算删除数或保留数，erase 后只使用新容器状态。

算法会原地写元素；调用期间不能由其他线程无同步地读取或写入同一范围。predicate/projection 或元素操作也不能引入共享 data race。

## 示例

“erase 移除值”先保存删除数量，再擦除尾部；“按 archived 字段移除”使用 ranges projection，并只输出 erase 后的保留项。两例都不读取未指定尾部。

## 常见错误

- 认为调用后 vector 的 `size()` 已缩小。
- 把返回值理解为删除数量。
- 读取 `[new_end, end)` 并假设其中仍是被删元素。
- erase 后继续使用旧 `new_end` 或 ranges tail。
- 让 `value` 引用待压缩范围内部元素。
- 把范围算法误认成文件删除函数。

## 与 JavaScript 的区别

JavaScript 的 `filter(x => x !== value)` 创建新数组，`splice` 会立即改变 length。C++ 范围 `remove` 在原存储中建立稳定保留前缀，只返回逻辑边界；容器缩短是第二步。ranges projection 类似按 `item.archived` 比较，但不创建映射数组。

## 相关内容

- `std::remove_if`：按谓词逻辑移除。
- `std::vector`：erase-remove 最常见的拥有型容器之一。
- `std::filesystem::remove`：删除文件或空目录，与本算法无关。
- `<algorithm>`：本算法所在头文件。

## 规范来源

当前压缩、返回、复杂度与 ranges 合同见 Working Draft `[alg.remove]`；C++98、policy、constexpr 与 ranges 演进见 N2356、P0024R2、P0202R3、P0896R4，尾部移后状态由 LWG 2110 澄清。
