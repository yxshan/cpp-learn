# `std::tuple`

`std::tuple<Ts...>` 把固定数量、类型在编译期已知的元素组合成异构积类型。它适合局部位置含义
清楚的返回值和泛型组合，不应替代拥有稳定领域字段名的结构体。

## 快速信息

- 头文件：`<tuple>`
- 命名空间：`std`
- 标准：C++11 起
- 存储：拥有值元素；引用元素只保存别名

## 什么时候使用

当元素数量固定、每个位置的类型已知，而且含义只在很小作用域内使用时选择 tuple。两个元素可
优先考虑 `std::pair`；字段跨越模块、需要验证规则或成员行为时，应定义命名 `struct`，避免远处
代码只能猜测 `get<3>` 的含义。

## C++20 代表接口与版本

```cpp
template<class... Types>
class tuple;

template<std::size_t I, class... Types>
constexpr std::tuple_element_t<I, std::tuple<Types...>>&
get(std::tuple<Types...>& value) noexcept;

template<class T, class... Types>
constexpr T& get(std::tuple<Types...>& value) noexcept;

template<class... Types>
constexpr std::tuple<std::unwrap_ref_decay_t<Types>...>
make_tuple(Types&&... values);
```

上面只展示访问和创建的代表性子集。按类型 `get<T>` 从 C++14 起；CTAD、`apply` 和
`make_from_tuple` 从 C++17 起。C++23 的 tuple-like 泛化不属于本页 C++20 基线。

## 模板参数、参数与约束

`Types...` 的顺序同时决定元素类型和索引。`get<I>` 要求 `I` 在范围内；`get<T>` 要求 `T` 在
元素类型中恰好出现一次，这些错误在编译期诊断，不会转成运行时异常。

`make_tuple` 对普通参数执行 decay，并把 `std::reference_wrapper<T>` 解包为 `T&`。CTAD 表达式
`std::tuple{x}` 通常按值推导，它不复刻 `make_tuple(std::ref(x))` 的引用解包规则。

## 返回值与值类别

`get` 按 tuple 表达式的 const 与值类别返回对应元素的引用，不复制元素。结构化绑定同样受声明
形式控制：`auto [a, b] = value` 绑定到副本，`auto& [a, b] = value` 才保留对原元素的引用语义。

## 复杂度

元素访问直接选择一个子对象，不遍历其他元素。构造、赋值、比较和交换按元素执行，实际成本与
各元素操作有关；标准不保证具体对象布局、无填充或某种空对象优化。

## 异常与错误

tuple 没有 `bad_tuple_access`。非法索引或不唯一类型使程序不良构；构造、复制、移动、赋值、比较
和交换则传播对应元素操作的异常。

## 生命周期与失效规则

值元素由 tuple 拥有，tuple 销毁或替换元素时结束相应子对象生命周期。`tuple<T&...>`、`tie` 和
`forward_as_tuple` 只保存引用，不延长实参生命周期；尤其不要保存包含临时量引用的
`forward_as_tuple(...)` 结果。替换 tuple 后，先前指向旧值元素的引用也可能失效。

## 线程安全

不同 tuple 对象可以独立使用；同一 tuple 的并发只读不会因 tuple 自身产生数据竞争。写元素或
执行整体赋值、交换时，需要同步对相同成员的冲突访问。引用元素可能让多个 tuple 别名同一外部
对象，此时应按该外部对象而不是 tuple 外壳判断竞争。

## 示例

第一个示例用 CTAD 和引用结构化绑定修改任务优先级。第二个示例展示
`make_tuple(std::ref(...))` 会保存外部整数的引用，而字符串仍按值拥有。

## 常见错误

- 用匿名位置承载跨模块业务含义，而不定义命名结构体。
- 认为普通结构化绑定总会修改原 tuple。
- 把 `get<T>` 用于包含重复 `T` 的 tuple。
- 保存引用临时量的 `forward_as_tuple` 结果。
- 认为 CTAD 与 `make_tuple(std::ref(...))` 的引用规则相同。
- 假定元素无填充地连续排列。

## 与 JavaScript 的区别

> TypeScript tuple 可以类比“位置与类型在声明时固定”，但运行时仍是普通 JavaScript Array。
> C++ tuple 的元素类型参与重载、复制、移动和析构；JS 解构也不能推导 C++ 结构化绑定究竟复制
> 还是引用元素。

## 相关内容

两个位置先阅读 `std::pair`；候选类型中只激活一个时阅读 `std::variant`。泛型参数转发到 tuple
构造过程时，还需要理解 `std::forward` 与引用生命周期。

## 来源

C++20 接口、逐元素语义、访问约束、引用生命周期和线程边界由 manifest 中的 Working Draft、
N3337、N4659 与 N4861 验证；cppreference 仅用于二级结构核对。
