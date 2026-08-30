# `std::copy`

`std::copy` 按顺序把一个范围中的元素赋值到调用者提供的目标位置。算法不会自动为普通输出迭代器分配空间。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典接口：C++98。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::copy`：C++20。
- 返回值：经典接口返回输出尾；ranges 接口返回输入尾与输出尾。

## C++20 代表声明

```cpp
template<class InputIt, class OutputIt>
constexpr OutputIt copy(InputIt first, InputIt last, OutputIt result);

template<class ExecutionPolicy, class ForwardIt1, class ForwardIt2>
ForwardIt2 copy(ExecutionPolicy&& policy, ForwardIt1 first,
                ForwardIt1 last, ForwardIt2 result);

template<std::input_iterator I, std::sentinel_for<I> S,
         std::weakly_incrementable O>
    requires std::indirectly_copyable<I, O>
constexpr std::ranges::copy_result<I, O>
std::ranges::copy(I first, S last, O result);
```

ranges 家族也接受 range，返回对象同时保存输入尾与输出尾。

## 目标范围与前置条件

若输入含 N 个元素，从 `result` 开始必须有 N 个可写位置，或者 `result` 必须是会自行追加的输出适配器，例如 `std::back_inserter`。

```cpp
std::vector<int> target(source.size());
std::copy(source.begin(), source.end(), target.begin());
```

对非 policy 经典接口，`result` 不能位于 `[first, last)` 内。向右移动重叠区间时使用 `std::copy_backward`。policy 重载要求完整输入范围与输出范围不重叠。

不要从一个 `std::vector` 读取，同时通过 `back_inserter` 追加回同一个 vector；扩容可能使正在使用的输入迭代器失效。

## 返回值与复杂度

- 经典接口返回最后写入元素之后的输出迭代器，即输出尾。
- ranges 接口返回 `{输入尾, 输出尾}`。
- 恰好执行 N 次赋值。
- 算法不提供事务性：复制或赋值中途抛异常时，目标前缀可能已经写入。

普通重载中，读取、复制或赋值抛出的异常向调用者传播。对标准 execution policy，元素访问函数
抛出的未捕获异常会触发 `std::terminate`；资源分配失败仍可抛出 `std::bad_alloc`。两种家族都不
回滚已写入的目标前缀。

输出尾只在目标对象仍存活且没有按容器规则失效时有效。

## 示例：复制到固定大小目标

```cpp
const std::array<int, 3> source{10, 20, 30};
std::array<int, 3> destination{};
std::copy(source.begin(), source.end(), destination.begin());
```

另一个示例用 `std::back_inserter` 把一批日志追加到独立的 vector。这里的容量增长由输出适配器调用的 `push_back` 完成，并不是 `copy` 自身分配空间。

## 何时不用

- 要转移可移动对象的资源：使用算法 `std::move`。
- 每个输入要经过变换：使用 `std::transform`。
- 向右复制重叠区间：使用 `std::copy_backward`。
- 只想创建容器副本：直接使用容器拷贝构造通常更清楚。

## 常见错误

### 复制到空 vector 的 `begin()`

空 vector 没有可写元素。先 `resize`，或使用 `std::back_inserter`。

### 忽略重叠方向

错误的重叠会让输入在尚未读取前被覆盖。先判断区间关系，再选择 `copy` 或 `copy_backward`。

### 忽略返回的输出尾

连续拼接多个范围时，返回值能作为下一次复制的起点，避免手算偏移。

## 与 JavaScript 的区别

JavaScript 的 spread 和 `slice()` 通常创建新数组。`std::copy` 写入已有目标位置；是否分配内存取决于目标容器与输出迭代器。

## 相关条目

- `std::vector`：常见目标容器。
- `std::transform`：复制并变换。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

当前合同见 Working Draft `[alg.copy]`；policy、ranges 与 constexpr 演进分别由 P0024R2、P0896R4、P0202R3 支撑。
