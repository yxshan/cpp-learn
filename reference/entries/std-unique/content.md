# `std::unique`

`std::unique` 原地压缩连续的等价元素组，每组保留第一个，并返回新的“逻辑尾”。它不会真正缩小容器。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::unique`：C++20。
- 返回值：经典接口返回逻辑尾；ranges 接口返回逻辑尾到原尾的 subrange。

## C++20 代表声明

```cpp
template<class ForwardIt>
constexpr ForwardIt unique(ForwardIt first, ForwardIt last);

template<class ForwardIt, class BinaryPred>
constexpr ForwardIt unique(ForwardIt first, ForwardIt last,
                           BinaryPred pred);

template<class ExecutionPolicy, class ForwardIt, class BinaryPred>
ForwardIt unique(ExecutionPolicy&& policy, ForwardIt first,
                 ForwardIt last, BinaryPred pred);

template<std::permutable I, std::sentinel_for<I> S,
         class Proj = std::identity,
         std::indirect_equivalence_relation<
             std::projected<I, Proj>> Comp = std::ranges::equal_to>
constexpr std::ranges::subrange<I>
std::ranges::unique(I first, S last, Comp comp = {}, Proj proj = {});
```

ranges 家族也接受 range，并返回由新逻辑尾和原尾组成的 subrange。

## 精确语义

- 只处理**相邻**的等价元素；不相邻的重复值会保留。
- 每组连续等价元素保留第一个，其余元素通过移动赋值被覆盖。
- 经典接口返回新逻辑尾 `new_end`，有效结果是 `[first, new_end)`。
- `[new_end, last)` 中对象仍存在，但值不受结果合同保证；不要读取它们推断结果。
- 容器的 `size()` 不会变化。

若使用自定义谓词，它必须形成等价关系。对非空范围执行恰好 N−1 次比较；空范围不调用谓词。

## erase–unique 惯用法

```cpp
std::sort(values.begin(), values.end());
const auto new_end = std::unique(values.begin(), values.end());
values.erase(new_end, values.end());
```

先排序会让所有相同值相邻，于是该组合能够进行全局去重。只有相邻重复需要压缩时，不要先排序，因为排序会破坏原始顺序。

## 异常与失效

移动赋值或谓词抛异常时，范围可能已经部分压缩。`unique` 自身不改变容器大小；之后调用 `vector::erase` 才会销毁尾部对象，并按 vector 的擦除规则使相应迭代器和引用失效。

对标准 execution policy，元素访问函数抛出的未捕获异常会触发 `std::terminate`，资源分配失败仍
可抛出 `std::bad_alloc`。policy 重载不应依赖谓词调用顺序或部分结果。

## 示例：理解“只处理相邻重复”

输入 `{1, 1, 2, 2, 3, 2}` 经 `unique` 与 `erase` 后得到 `1 2 3 2`。最后的 `2` 与前一个 `2` 不相邻，因此仍然存在。

另一个示例先对标签排序，再执行 unique–erase，得到全局不重复的 `api cache web`。

## 何时不用

- 要输出到另一个范围：使用 `std::unique_copy`。
- 需要保持顺序的全局去重：考虑辅助 `std::unordered_set`，并明确性能与哈希要求。
- 只删除满足条件的元素：使用 `std::remove_if` 配合 erase。

## 常见错误

### 忘记调用 `erase`

打印整个容器会把逻辑尾之后的对象也打印出来。只遍历 `[begin, new_end)`，或立刻擦除尾部。

### 把它当成 `Set`

它既不保证全局唯一，也不创建集合；它是原地范围算法。

### 使用不满足等价关系的谓词

谓词若不具备自反、对称、传递意义上的等价关系，算法合同不成立。

## 与 JavaScript 的区别

`new Set(array)` 通常删除所有重复值并创建新集合；`std::unique` 只压缩相邻组，原地写入，并用逻辑尾表示结果。

## 相关条目

- `std::sort`：让相同值相邻。
- `std::vector`：常见的 erase–unique 容器。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

当前合同见 Working Draft `[alg.unique]`；policy、ranges 与 constexpr 演进分别由 P0024R2、P0896R4、P0202R3 支撑。
