# `<vector>`

`<vector>` 是动态连续序列的标准头文件。它不仅声明主模板 `std::vector`，还声明
`vector<bool>` 特化、比较与交换操作、C++20 擦除辅助函数以及内存资源别名。

## 快速信息

- 头文件：`<vector>`
- 命名空间：`std`、`std::pmr`
- 核心类型：`std::vector`
- 首次标准：C++98

## 什么时候包含

只要当前源文件直接声明 `std::vector`、调用该头文件声明的非成员操作，或公开接口把
vector 写进函数签名，就应显式包含 `<vector>`。不要因为 `<string>`、某个框架头文件或
预编译头间接带入了声明就省略它；传递包含不是当前文件可以依赖的接口契约。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::vector<T, Allocator>` | 可动态改变大小的序列容器 | C++98 |
| `std::vector<bool, Allocator>` | 面向位存储的标准特化 | C++98；不能照搬普通元素引用模型 |
| `operator==`、`operator<=>` | 按容器值比较 | `==` C++98；`<=>` C++20 |
| `std::swap` | 交换两个 vector | C++98 |
| `std::erase`、`std::erase_if` | 按值或谓词擦除元素 | C++20 |
| `std::pmr::vector<T>` | 使用 `polymorphic_allocator` 的别名 | C++17 |

表格是学习导航，不是当前
[`<vector>` synopsis](https://eel.is/c++draft/vector.syn) 的逐字副本。阅读历史代码时，
应按项目采用的 C++ 版本确认某个辅助函数是否可用。

## 核心行为预览

普通 `vector<T>` 在尾端插入和删除为摊销常数时间，中间修改为线性；当 `T` 不是
`bool` 时，它还是连续容器。`vector<bool>` 是单独规定的特化，不能假定元素引用就是
`bool&` 或存在连续的 bool 元素对象。详见
[`[vector.overview]`](https://eel.is/c++draft/vector.overview) 与
[`[vector.bool]`](https://eel.is/c++draft/vector.bool)。

最重要的导航边界是“重分配”：一旦发生，所有旧元素引用、指针和迭代器都会失效；
`reserve` 不改变 `size()`，而 `shrink_to_fit()` 是非约束请求。插入、删除和旧 `end()`
仍有操作级差异，应进入类型及成员页核对，不在头文件页维护第二份矩阵。完整规则见
[`[vector.capacity]`](https://eel.is/c++draft/vector.capacity) 和
[`[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)。

## 头文件边界

`<vector>` 提供容器和紧密相关的非成员接口，但不会因此声明所有可作用于 vector 的算法。
例如排序仍应包含 `<algorithm>` 并调用 `std::sort`。需要非拥有连续视图时，使用
`std::span` 还要直接包含 `<span>`。

头文件可移植性要求见
[`[using.headers]`](https://eel.is/c++draft/using.headers) 与
[`[res.on.headers]`](https://eel.is/c++draft/res.on.headers)。实现偶然暴露的其他名字不属于
`<vector>` 的可靠契约。

## 示例

最小示例只包含 `<vector>` 并验证容器能够自包含编译；第二个示例调用 C++20
`std::erase_if` 删除偶数，展示该头文件不仅声明类模板。运行示例只输出剩余元素的确定
顺序。

## 常见错误

- 依赖另一个头文件碰巧传递包含 `<vector>`。
- 认为 `<vector>` 同时提供 `std::sort` 等通用算法。
- 把 `vector<bool>` 的元素当成普通 `bool&`，忽略它是单独规定的特化。
- 认为 `reserve(n)` 会创建 n 个元素，或每次调用都会使观察位置失效。
- 认为 `shrink_to_fit()` 必定把容量缩到大小。
- 看到当前 synopsis 中的声明，就假定它们全部自 C++98 起可用。

## 相关内容

先阅读 `std::vector` 的整体模型，再根据需要进入 `std::vector::push_back`、
`std::vector::reserve` 和 `std::sort`。容器尚未确定时，先看“选择顺序容器”。

## 来源

头文件实体、版本边界和关联语义由 Entry manifest 中的 C++ Working Draft 与历史草案
来源验证。
