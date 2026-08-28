# `<array>`

`<array>` 声明固定大小连续容器 `std::array`，以及比较、交换、创建和 tuple 风格访问
所需的相关接口。它把语言内建数组包装成标准容器模型，但不会让大小在运行时改变。

## 快速信息

- 头文件：`<array>`
- 命名空间：`std`
- 核心类型：`std::array`
- 首次标准：C++11

## 什么时候包含

源文件直接声明 `std::array`，使用针对 array 的 `std::get`、`std::tuple_size`、
`std::tuple_element` 或 `std::to_array` 时，应显式包含 `<array>`。标准要求在首次引用实体
前引入[适当头文件](https://eel.is/c++draft/using.headers)；不能依赖 `<tuple>` 或其他头文件
偶然带入 array 的完整接口。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::array<T, N>` | 保存恰好 `N` 个连续元素 | C++11 |
| `operator==`、`operator<=>` | 逐元素比较 | `==` C++11；`<=>` C++20 |
| `std::swap` | 逐元素交换两个 array | C++11 |
| `std::get<I>` | 使用编译期索引访问元素 | C++11 |
| `tuple_size`、`tuple_element` 特化 | 让 array 参与 tuple 协议和结构化绑定 | C++11 |
| `std::to_array` | 从语言内建数组创建 `std::array` | C++20 |

代表性主模板声明为：

```cpp
namespace std {
template<class T, size_t N>
struct array;
}
```

`N` 是类型的一部分，因此 `array<int, 3>` 与 `array<int, 4>` 是不同类型。当前
[头文件 synopsis](https://eel.is/c++draft/array.syn) 同时包含多个标准版本加入的接口，
不能把整张清单统一标成 C++11。

## 关键边界预览

`std::array` 是聚合并存储恰好 `N` 个元素；初始化方式决定未显式给出的标量元素是否有
确定值。它不使用分配器，也不等于“固定容量、仍可增长的 vector”。详见
[`[array.overview]`](https://eel.is/c++draft/array.overview)。

`N == 0` 是受支持的特例，此时 `begin() == end()`，但 `data()` 返回值未指定，且不能
访问 `front()` 或 `back()`。交换两个 array 会逐元素交换，复杂度线性于 `N`；已有观察
位置仍关联原 array，只是位置中的值已经交换。详见
[`[array.zero]`](https://eel.is/c++draft/array.zero) 和
[`[array.special]`](https://eel.is/c++draft/array.special)。

## 头文件边界

`<array>` 不提供通用排序算法，需要排序时应直接包含 `<algorithm>`。运行时需要改变元素
数量时评估 `std::vector`；“最多 N 个”但实际大小变化，也不等同于“始终恰有 N 个”。

`std::get<I>` 的索引是模板实参并在编译期确定；运行时索引仍使用 `operator[]` 或
`at()`。`std::to_array` 不能直接把元素类型本身为数组的多维内建数组整体转换成嵌套
array，具体约束见 [`[array.creation]`](https://eel.is/c++draft/array.creation)。

## 示例

最小示例遍历三个固定整数并输出总和；第二个示例展示 `<array>` 提供的 tuple 接口与
`std::to_array`，输出只依赖标准规定的元素值和大小。

## 常见错误

- 认为 `std::array<int, 3> values;` 会像 `vector(3)` 一样保证三个零。
- 认为 `array<T, 0>::data()` 必须是空指针。
- 把两个 array 的交换当成 O(1) 句柄交换。
- 在 C++17 项目中调用 C++20 才加入的 `std::to_array`。
- 把 `<array>` 与语言内建数组语法当作同一实体。

## 相关内容

继续阅读 `std::array` 的初始化、连续存储和零长度规则。若大小在运行时决定，比较
`std::vector`；尚未确定类型时阅读“选择顺序容器”。

## 来源

头文件 synopsis、array 概览、tuple 接口、创建函数、零长度和交换规则由 Entry manifest
中的主要来源验证。
