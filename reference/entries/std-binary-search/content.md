# `std::binary_search`

`std::binary_search` 判断一个已经按指定顺序排列的范围中，是否存在与目标值等价的元素。它只回答“有或没有”，不返回元素位置。

## 快速信息

```cpp
#include <algorithm>
```

- 头文件：`<algorithm>`
- 命名空间：`std`
- 经典迭代器接口：C++98。
- 经典接口从 C++20 起可在常量求值中使用。
- `std::ranges::binary_search`：C++20，需要 `<algorithm>`。
- 标准没有为 `binary_search` 提供 execution-policy 重载。
- 返回值：表示是否存在等价元素的 `bool`。

## 什么时候使用

范围已经按查询使用的同一关系排序或正确分区，并且调用者只需要“是否存在”的布尔答案时
使用。需要首个位置、插入位置或等价区间时，直接选择 `lower_bound`、`upper_bound` 或
`equal_range`，避免得到 `true` 后再次扫描。无序数据只查询一次时，线性查找通常比先排序
更直接；`map`、`set` 等关联容器应优先使用自身成员查询。

## C++20 代表声明

```cpp
template<class ForwardIt, class T>
constexpr bool binary_search(ForwardIt first, ForwardIt last,
                             const T& value);

template<class ForwardIt, class T, class Compare>
constexpr bool binary_search(ForwardIt first, ForwardIt last,
                             const T& value, Compare comp);

template<std::forward_iterator I, std::sentinel_for<I> S,
         class T, class Proj = std::identity,
         std::indirect_strict_weak_order<const T*,
             std::projected<I, Proj>> Comp = std::ranges::less>
constexpr bool std::ranges::binary_search(I first, S last,
                                          const T& value,
                                          Comp comp = {}, Proj proj = {});
```

声明经过简化，用于展示家族差异。ranges 版本还接受 range 对象，并支持 projection。

## 前置条件

范围必须相对于目标值和比较器保持分区：所有“在目标之前”的元素在前，所有“在目标之后”的元素在后。通常这意味着范围已用同一排序关系排好序。

对比较器 `comp`，等价指：

```cpp
!comp(element, value) && !comp(value, element)
```

经典 C++20 合同要求上述两个方向一致；不满足分区或比较关系要求会导致未定义行为。不要先用一种比较器排序，再用另一种比较器搜索。

## 返回值与复杂度

- 找到等价元素时返回 `true`，否则返回 `false`。
- 最多进行对数量级的比较。
- 对随机访问迭代器，定位步骤也是对数量级；对 `std::list` 等非随机访问范围，迭代器移动可能是线性的。

普通比较器、投影或元素比较抛出的异常会向调用者传播；算法不捕获或改写异常。因为该算法没有
execution-policy 重载，所以不存在本算法自己的 policy 异常分支。

如果需要元素的位置，使用 `std::lower_bound` 或 `std::equal_range`；它们会返回可继续使用的迭代器。

## 生命周期与失效规则

算法不拥有范围、比较器或 projection，也不会延长捕获对象的生命周期。经典和 ranges 重载
只读范围且自身不会使迭代器或引用失效；但调用期间范围必须保持有效且分区关系不能被并发
或回调破坏。返回的 `bool` 是独立值，范围在调用结束后销毁不会影响已经取得的结果。

## 示例：查询状态码

```cpp
const std::array<int, 4> supported_codes{200, 201, 204, 503};
const bool supported = std::binary_search(supported_codes.begin(),
                                          supported_codes.end(), 200);
```

示例同时查询存在的 `200` 与不存在的 `404`。另一个示例查询已经按字典序排列的路由表。

## 常见错误

### 在未排序数据中搜索

`binary_search` 不会先替你排序，也不会退化为线性扫描。数据不是有序/正确分区时，不应调用它。

### 想得到索引却只拿到 `bool`

`true` 不携带位置。需要定位、插入点或重复区间时分别考虑 `lower_bound`、`upper_bound` 和 `equal_range`。

### 把“对数比较”理解为任意容器都对数耗时

在链表中推进到中点仍然要逐步移动。需要频繁二分查询时，连续存储的有序容器通常更合适。

## 与 JavaScript 的区别

JavaScript 数组没有同名标准二分 API，常见做法是手写循环。C++ 接口通过迭代器和比较器复用同一算法，但把有序性责任明确交给调用者。

## 相关条目

- `std::sort`：建立有序范围。
- `std::find`：无序范围中的线性查找。
- `<algorithm>`：本算法所在头文件。
- Algorithms：算法主题总览。

## 规范来源

具体声明、前置条件、返回值和复杂度见 Working Draft `[binary.search]`；C++20 ranges 家族来自 P0896R4，constexpr 演进见 P0202R3。完整链接列在页面来源区。
