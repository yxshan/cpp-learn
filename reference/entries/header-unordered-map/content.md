# `<unordered_map>`

`<unordered_map>` 声明以哈希值和键等价关系组织元素的映射容器。它同时提供“每个等价键
至多一个元素”的 `std::unordered_map` 和“允许重复等价键”的
`std::unordered_multimap`。

## 快速信息

- 头文件：`<unordered_map>`
- 命名空间：`std`、`std::pmr`
- 核心类型：`std::unordered_map`、`std::unordered_multimap`
- 首次标准：C++11

## 什么时候包含

源文件直接声明任一无序映射、在公开签名中使用它，或调用本头文件声明的相关非成员操作
时，应包含 `<unordered_map>`。头文件只可靠提供自身 synopsis 与明示传递内容，具体规则
见 [`[res.on.headers]`](https://eel.is/c++draft/res.on.headers)。只需要无序集合时使用
`<unordered_set>`；需要按键排序的映射时使用 `<map>`。

```cpp
#include <unordered_map>
```

不要依赖其他容器头文件、预编译头或实现细节对 `<unordered_map>` 的传递包含；直接使用
本头文件声明的实体，就应显式包含它。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::unordered_map<Key, T, ...>` | 每个等价键至多映射一个值 | C++11 |
| `std::unordered_multimap<Key, T, ...>` | 允许多个等价键 | C++11 |
| `operator==` | 比较同类容器是否包含等价元素 | C++11；不提供按键次序比较 |
| `std::swap` | 交换两个同类容器 | C++11 |
| `std::erase_if` | 按谓词擦除元素 | C++20 |
| `std::pmr` 两个映射别名 | 使用 `polymorphic_allocator` | C++17 |

代表性唯一键主模板为：

```cpp
namespace std {
template<class Key, class T,
         class Hash = hash<Key>,
         class Pred = equal_to<Key>,
         class Alloc = allocator<pair<const Key, T>>>
class unordered_map;
}
```

当前 [`<unordered_map>` synopsis](https://eel.is/c++draft/unord.map.syn) 还包含多重映射及
多个标准版本加入的辅助设施，不能把整张清单统一标成 C++11。

## 哈希、等价与复杂度预览

若 `Pred(k1, k2)` 把两个键判为等价，`Hash` 必须为它们产生相同哈希值；反过来，同一
哈希值不表示两个键必然等价。自定义键规则时，哈希函数和等价谓词必须作为一套契约设计。
具体要求见 [`[unord.req.general]`](https://eel.is/c++draft/unord.req.general)。

查找和 unique-key 单元素插入为平均 O(1)、最坏 O(size)，不能缩写成无条件 O(1)。元素
按 bucket 组织，`load_factor` 表示每桶平均元素数；`reserve(n)` 面向预计元素数，而
`rehash(n)` 的参数面向至少桶数。标准不规定默认桶数或具体增长序列，详见
[`[unord.req]`](https://eel.is/c++draft/unord.req)。

## rehash 与失效预览

最重要的导航边界是：rehash 会使所有旧迭代器失效并改变 bucket 归属与可能的遍历顺序，
但指向元素的引用和指针保持有效。插入是否使迭代器失效、删除影响哪些观察位置等操作级
规则，应进入 `std::unordered_map` 类型页核对，不在头文件页维护第二份矩阵。`reserve`
主要用于降低批量插入期间的 rehash 机会，而不是“保护引用”的必要步骤。

## 头文件边界

`<unordered_map>` 不保证排序顺序、插入顺序或“每次运行随机”的顺序。直接使用其他通用
函数对象设施时，应包含它们自己的头文件；例如显式使用 `std::hash` 时包含
`<functional>`。通用算法同样不会因为引入容器头文件而全部可用。

## 示例

最小示例按明确键读取状态码，不遍历整个容器；第二个示例在显式 rehash 后只使用标准仍
保证有效的元素引用，并通过键读取确认结果。两者都不输出桶数或实现相关遍历顺序。

## 常见错误

- 认为哈希相同就代表键相等，或只自定义等价谓词而不调整哈希。
- 把平均 O(1) 误写成严格最坏 O(1)。
- 认为 `reserve(100)` 保证恰好 100 个桶。
- 认为 rehash 会使元素引用和指针一起失效。
- 用 `operator[]` 做只读存在性检查，导致缺失键被插入。
- 需要排序输出却把当前无序遍历顺序写入测试。

## 相关内容

继续阅读 `std::unordered_map` 的元素访问、哈希一致性和异常规则。需要键排序时应比较
`std::map`，而不是依赖无序映射的当前输出顺序；对应的有序映射声明位于 `<map>`。

## 来源

头文件 synopsis、两类映射、哈希与等价、复杂度、负载因子和 rehash 规则由 Entry
manifest 中的主要来源验证。
