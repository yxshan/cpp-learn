# `std::move`（范围算法）

`<algorithm>` 中的 `std::move` 逐项把输入范围移动赋值到目标范围。它与 `<utility>` 中把表达式转换成右值的单参数 `std::move` 同名，但职责不同：本页讨论的是接收三个迭代器的范围算法。

## 快速信息

```cpp
#include <algorithm>
```

- 经典范围算法：C++11。
- execution-policy 重载：C++17。
- 经典接口从 C++20 起为 `constexpr`。
- `std::ranges::move`：C++20。
- 效果：按顺序执行 N 次移动赋值；不会自动扩容目标容器。

## 什么时候使用

需要把一批可移动对象的资源交给另一批已经存在的对象时使用，例如转移一组 `unique_ptr` 或字符串。若仍需保留源值，使用 `std::copy`；只移动一个表达式时，使用 `<utility>` 的 `std::move(value)`；向右移动有重叠的区间时，使用 `std::move_backward`。

## C++20 代表性声明

```cpp
template<class InputIt, class OutputIt>
constexpr OutputIt move(InputIt first, InputIt last, OutputIt result);

template<class ExecutionPolicy, class ForwardIt1, class ForwardIt2>
ForwardIt2 move(ExecutionPolicy&& policy, ForwardIt1 first,
                ForwardIt1 last, ForwardIt2 result);

template<std::input_iterator I, std::sentinel_for<I> S,
         std::weakly_incrementable O>
    requires std::indirectly_movable<I, O>
constexpr std::ranges::move_result<I, O>
std::ranges::move(I first, S last, O result);

template<std::ranges::input_range R, std::weakly_incrementable O>
    requires std::indirectly_movable<std::ranges::iterator_t<R>, O>
constexpr std::ranges::move_result<std::ranges::borrowed_iterator_t<R>, O>
std::ranges::move(R&& range, O result);
```

ranges 家族还接受 range。C++26 才加入 ranges execution-policy 重载，不应把它当成 C++20 或 C++23 接口。

## 参数、约束与重叠规则

- `[first, last)`：有效输入范围；非 policy 接口允许单遍输入迭代器。
- `result`：第一个目标位置。从这里起必须有 N 个可写对象，或使用能插入元素的输出适配器。
- policy 接口要求前向迭代器，以便实现可以多次遍历或并行调度。

普通 `vector` 的 `begin()` 只指向已经存在的元素。目标为空时，应先 `resize`，或写入独立容器的 `std::back_inserter`。算法本身不会创建 N 个目标对象。

非 policy 经典接口要求 `result` 不在 `[first, last)` 内；左移式重叠可按正向移动工作，右移式重叠应使用 `move_backward`。policy 接口要求实际输入范围和目标范围完全不重叠。不能一边遍历 vector，一边通过插入导致同一 vector 扩容并使输入迭代器失效。

## 返回值与复杂度

- 经典接口返回完成最后一次写入后的输出迭代器。
- ranges 接口返回 `move_result`，其中 `.in` 是输入尾对应迭代器，`.out` 是输出尾。
- 对 N 个输入元素恰好执行 N 次移动赋值。

算法不承诺事务性。某次移动赋值抛异常时，目标前缀可能已写入，源前缀也可能已进入移后状态。

## 移后状态、生命周期与失效

移动不会结束源对象的生命周期。对 C++ 标准库类型，标准提供“有效但未指定”的通用移后保证；自定义类型的移后合同则由该类型自己的移动操作决定，范围算法的约束不会额外赋予这一保证。无论哪种类型，都不能凭空假设字符串一定为空或对象一定恢复默认值。教学示例因此只读取目标，不输出源。

range 重载用 `borrowed_iterator_t<R>` 保存 `.in`：lvalue owner 或 borrowed range 可得到输入尾；若传入非 borrowed 临时 range，`.in` 的类型是 `std::ranges::dangling`。`.out` 仍来自调用者提供的目标，但它也只在目标对象及其位置继续有效时可用。

算法不拥有输入和目标。两侧对象、迭代器及目标写入位置必须存活到相应访问结束。向固定大小目标移动不会改变容器结构；若输出适配器引发扩容，则按目标容器的规则使旧迭代器、指针和引用失效。

普通重载传播迭代器或移动赋值抛出的异常。对标准 execution policy，元素访问函数抛出的未捕获异常会调用 `std::terminate`；临时分配失败仍可能抛 `std::bad_alloc`。并行调用中不能让元素操作无同步地读写同一对象。

## 示例

“移动所有权对象”把三个 `unique_ptr` 移入已有 array；“ranges 移动字符串批次”读取 `.out` 计算写入数量。两例都刻意不检查移后源值。

## 常见错误

- 把范围算法理解为只做右值转换的 `<utility>` `std::move`。
- 把数据移动到空 vector 的 `begin()`，以为算法会自动追加。
- 假设所有移后对象都为空或等于默认值。
- 对向右重叠区间仍使用正向 `move`。
- 忽略部分完成与 execution-policy 的终止规则。

## 与 JavaScript 的区别

> JavaScript 数组元素通常是引用或值的赋值，没有 C++ 的可观察移后对象合同。C++ 范围 `move` 更接近“逐槽调用移动赋值”，目标槽必须存在，源对象仍存在；标准库类型的值不可作具体假设，自定义类型则遵守自身合同。

## 相关内容

- `std::move`（值类别工具）：把单个表达式转换为可移动的右值表达式。
- `std::copy`：保留源值并复制到目标。
- `std::vector`：需要区分 `resize`、`reserve` 与插入适配器。
- `<algorithm>`：本算法所在头文件。

## 规范来源

当前合同见 Working Draft `[alg.move]` 与 `[lib.types.movedfrom]`；C++17 policy、C++20 constexpr 与 ranges 演进分别由 P0024R2、P0202R3、P0896R4 支撑，policy 重叠边界由 LWG 2689 澄清。
