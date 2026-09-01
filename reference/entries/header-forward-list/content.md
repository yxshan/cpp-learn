# `<forward_list>`

`<forward_list>` 声明拥有元素的单向链式序列 `std::forward_list`。它围绕“某节点之后”
提供修改接口，以接近手写单链表的空间和时间常数；名称中的 forward 不表示能向后遍历。

## 快速信息

- 直接包含：`#include <forward_list>`
- 命名空间：`std`
- 核心类型：`std::forward_list`
- 首次标准：C++11；本页示例基线为 C++20

## 直接包含

使用 forward_list 及其 non-member `erase`/`erase_if` 时直接包含 `<forward_list>`。
输出另含 `<iostream>`，使用 `std::distance` 或 `std::next` 另含 `<iterator>`；不要依赖
其他容器头文件间接声明它。

## C++20 主要设施

| 实体组 | 用途 | 关键边界 | 版本 |
|---|---|---|---|
| `std::forward_list<T, Allocator>` | 拥有单向链接节点 | 只有 forward iterator | C++11 |
| `before_begin()` | 表示首元素之前的位置 | 可以递增，不可解引用 | C++11 |
| after-family modifiers | 在已知前驱后插入、擦除或迁移 | 参数常指向待处理元素的前驱 | C++11 |
| `sort`、`merge`、`reverse` | 节点级重排 | 不提供 reverse iterator | C++11 |
| `std::erase`、`std::erase_if` | 删除并返回数量 | non-member 擦除 | C++20 |

C++23 才加入 ranges-aware 构造/插入；当前草案的广泛 constexpr 成员来自 C++26。

## 什么时候选择

算法只向前遍历、能稳定保存 predecessor，并希望减少双向节点的额外链接时考虑
forward_list。需要反向遍历、尾端访问或更直观的位置模型时选择 list；需要随机访问、连续
存储或缓存友好扫描时优先评估 vector。

## 为什么没有 `size()`、`back()` 和 `push_back()`

单链表只从节点到后继保存链接。为了不额外保存大小或尾指针，标准类型没有这些接口。
需要元素数时可以线性遍历；需要频繁访问两端、反向遍历或在节点前直接修改时比较 list。

## 复杂度、失效与前置条件

已知前驱后的单节点 insert/erase 为常数时间；寻找前驱仍为线性。整表
`splice_after` 对源距离为线性，不能照抄 list 整表 splice 的复杂度。插入不使已有节点
iterator/reference 失效；擦除只使被擦节点对应者失效。

跨容器 splice/merge 要求 allocator 相等，merge 前两边必须排序。范围
`splice_after(first,last)` 和 `erase_after(first,last)` 围绕开区间 `(first,last)` 工作，
不是常见的 `[first,last)`。违反 iterator、范围或 allocator 前置条件不是异常通道。

## 示例

第一个示例从 `before_begin()` 后逐个建立 1、2、3。第二个示例维护 predecessor，删除
其后的偶数节点；没有调用不存在的 size，也没有解引用 before_begin/end。

## 常见错误

- 认为 forward_list 能向前和向后遍历。
- 寻找 `back()`、`push_back()`、`size()` 或 reverse iterator。
- 解引用 `before_begin()`，或在没有后继时调用 `erase_after()`。
- 把 after-range 误读为 `[first,last)`。
- 因节点更少就断言它一定比 vector 更快。

## 与 JavaScript 的区别

> JS 标准库没有单链表容器；手写 `{value, next}` 节点比较接近。
> `before_begin()` 可类比不存业务值的 sentinel head，但 C++ 还定义 allocator、析构、
> iterator category 和失效合同，JS 对象类比不能替代这些规则。

## 相关内容

成员参数和 after-range 规则阅读 `std::forward_list`；需要双向节点操作比较 `<list>`；
借用连续数组或 vector 时比较 `<span>`。

## 来源

头文件 synopsis、N2543 的设计目标、C++20 擦除返回值及后续版本边界由 manifest 中的
Working Draft 与 WG21 提案验证；cppreference 仅用于二级覆盖核对。
