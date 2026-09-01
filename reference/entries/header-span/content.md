# `<span>`

`<span>` 声明连续、非拥有视图 `std::span`，固定/动态 extent 标记，以及把有效对象区域
观察为 `std::byte` 序列的工具。它不分配存储、不拥有元素，也不会延长 owner 生命周期。

## 快速信息

- 直接包含：`#include <span>`
- 命名空间：`std`
- 核心类型：`std::span`
- 首次标准：C++20

## 直接包含

使用 span、`dynamic_extent`、`as_bytes` 或 `as_writable_bytes` 时直接包含 `<span>`。
使用 `std::array`、`std::vector`、ranges concepts、`std::byte` 或输出时，仍分别直接包含
拥有声明的头文件；不要依赖 `<span>` 的传递包含。

## C++20 主要设施

| 实体 | 用途 | 边界 | 版本 |
|---|---|---|---|
| `std::dynamic_extent` | 表示对象在运行时保存长度 | 不等于未知/无限长度 | C++20 |
| `std::span<T, Extent>` | 借用连续对象序列 | 复制 view 不复制元素 | C++20 |
| `std::as_bytes` | 建立只读对象表示视图 | 不是可移植序列化 | C++20 |
| `std::as_writable_bytes` | 建立可写对象表示视图 | 不能从 const element span 建立 | C++20 |
| `enable_view` | 所有 extent 的 span 都是 view | P2325R3 追溯修正 | C++20 DR |
| `enable_borrowed_range` | iterator 不依赖 wrapper 自身存活 | 不保证底层 owner 存活 | C++20 |

## 什么时候选择

调用方已经拥有原生数组、array、vector 或其他连续范围，而被调函数只需在调用期间观察或修改
一段元素时选择 span。需要独立保存、增长或销毁元素时选择 owning container；来源不连续或
owner 生命周期无法覆盖 view 时不应使用 span。

## Static 与 dynamic extent

`span<int, 4>` 把长度 4 写入类型；`span<int>` 等价于 dynamic extent 并在对象中保存运行时
长度。从动态范围显式构造 fixed span 并不执行自动 bounds check，源大小仍必须等于 Extent。
static extent 为非零时不能默认构造。

## 版本边界

C++20 的下标、front/back 和 subview 依赖前置条件，没有 bounds-checked `at()`；`at()` 是
C++26。C++23 增加 constant iterator 成员并明确 trivially-copyable wording。曾加入的
initializer_list 构造后来又被移除，当前页面不把它作为可用接口。

## 生命周期、线程与错误模型

span 只借用 `[data(), data()+size())`。owner 析构、clear 或 vector reallocation 等让底层
pointer 失效的操作，也会使相关 span、iterator 和 reference 失效。borrowed_range 只解除
iterator 对 span wrapper 生命周期的依赖，不能防止 owner 悬空。

多个 span 可以 alias 同一元素；普通 C++ data-race 规则照常生效。const `span<int>` 只约束
view 对象，经它仍可改 int；只读元素需要 `span<const int>`。

## 示例

第一个示例验证 fixed span 的 extent、size、view 和 borrowed_range 合同。第二个示例只检查
`as_bytes` 大小关系，不打印依赖 endianness 或对象表示的字节值。

## 常见错误

- 把 span 当成小 vector，认为它拥有或复制元素。
- 认为 borrowed_range 会延长 array/vector 的生命周期。
- 认为 fixed extent 会自动检查任何运行时来源的大小。
- 认为 `const span<int>` 等于 `span<const int>`。
- 在 C++20 调用 `at()`，或把 as_bytes 当成网络序列化。
- 试图从 list/forward_list iterator 构造 span；它们不是 contiguous iterator。

## 与 JavaScript 的区别

> JS `TypedArray.prototype.subarray()` 也创建共享底层存储的窗口，适合类比 subspan；但
> TypedArray 与 ArrayBuffer 的关联及 GC 生命周期不同。C++ span 不持有 owner，离开明确的
> C++ 对象生命周期后就可能悬空。

## 相关内容

构造、访问和 subview 规则阅读 `std::span`；owning 节点序列比较 `<list>` 与
`<forward_list>`。需要拥有并增长连续元素时应比较 vector。

## 来源

synopsis、view/borrowed_range、构造修正和 C++20/23/26 边界由 manifest 中的 Working Draft、
N4861、P0122R7、P1394R4、P1976R2、P2325R3、P2251R1、P2278R4、P2821R5 与 P4144R1
验证；cppreference 仅用于二级覆盖核对。
