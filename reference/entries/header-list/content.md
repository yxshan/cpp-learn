# `<list>`

`<list>` 声明拥有元素的双向链式序列 `std::list`，以及比较、交换和 C++20
非成员擦除接口。它不是通用“列表”抽象，也不提供连续存储或随机访问。

## 快速信息

- 直接包含：`#include <list>`
- 命名空间：`std`
- 核心类型：`std::list`
- 首次标准：C++98；本页示例基线为 C++20

## 直接包含

使用 `std::list`、为它提供的 `std::erase` 或 `std::erase_if` 时直接包含 `<list>`。
输出另含 `<iostream>`，使用 `std::next` 另含 `<iterator>`；不要依赖其他容器头文件的
传递包含。

## C++20 主要设施

| 实体组 | 用途 | 版本边界 |
|---|---|---|
| `std::list<T, Allocator>` | 拥有双向链接节点 | C++98 |
| 比较运算符 | 按元素词典序比较 | `operator<=>` 为 C++20 |
| `std::swap` | 交换容器状态 | C++98 起，具体 `noexcept` 随版本演进 |
| `std::erase`、`std::erase_if` | 按值或谓词删除并返回数量 | C++20 |
| ranges-aware 构造与插入 | 从 range 批量导入 | C++23，不属于本页示例 |

当前草案中大量成员可用于常量求值来自 C++26，不能把整份最新 synopsis 统一标成
C++20。

## 什么时候选择

已经持有位置、需要稳定节点身份、双向遍历或不移动其他元素的 splice 时可考虑
`list`。若主要工作是索引、顺序扫描或缓存敏感处理，通常先评估 `vector`；为了找到
插入点先走过半张链表，仍要付线性查找成本。

只需要单向遍历并能围绕前驱节点修改时比较 `forward_list`。只借用调用方已有的连续
存储时使用 `span`，它不拥有节点或元素。

## 共同复杂度、失效与错误边界

已知位置处的单节点插入和擦除为常数复杂度，但构造、遍历、查找、反转和范围操作并非
都为 O(1)。插入不使已有元素的 iterator/reference 失效；擦除只使被擦节点对应者失效。

跨容器 `splice`/`merge` 要求 allocator 相等；`merge` 还要求两边已按同一比较关系排序。
违反这些前置条件不是可捕获的业务异常。节点稳定也不允许无同步地并发修改链结构。

## 示例

第一个示例从两端加入固定整数，观察首尾、大小和顺序。第二个示例使用 C++20
`std::erase_if` 删除偶数并读取返回数量。两者都不输出节点地址、allocator 或实现布局。

## 常见错误

- 认为 `std::list` 有 `operator[]` 或 random-access iterator。
- 认为所有 list 操作都为 O(1)，忽略寻找位置的成本。
- 把 `std::sort` 用在 list iterator 上；链表应使用成员 `sort()`。
- 认为 splice 会复制元素，或认为 erased iterator 仍有效。
- 把 C++23 ranges 成员或 C++26 constexpr 支持当成 C++20 接口。

## 与 JavaScript 的区别

> JavaScript `Array` 是按索引工作的动态序列，不是双链表；
> `Array.prototype.splice()` 与 `std::list::splice()` 只是名称相似。后者重接节点并受
> allocator、iterator 和对象生命周期合同约束。

## 相关内容

具体成员、参数和失效规则阅读 `std::list`；单向节点结构比较 `<forward_list>`；连续
借用视图比较 `<span>`。

## 来源

头文件 synopsis、序列容器要求和版本边界由 manifest 中的 Working Draft、N3337、
N4861、P0646R1、P1206R7 与 P3372R3 验证；cppreference 仅用于二级覆盖核对。
