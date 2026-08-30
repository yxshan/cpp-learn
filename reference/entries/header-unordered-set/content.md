# `<unordered_set>`

`<unordered_set>` 声明使用哈希和等价谓词组织值的集合：唯一键
`std::unordered_set` 与允许等价键重复的 `std::unordered_multiset`。

## 快速信息

- 头文件：`<unordered_set>`
- 命名空间：`std`
- 首次标准：C++11
- 核心选择：是否只需要平均常数成员查询且不要求遍历顺序

## 什么时候包含

直接声明 unordered_set/unordered_multiset，或使用它们的非成员比较、交换与
`std::erase_if` 时，应显式包含 `<unordered_set>`。不要依赖 `<unordered_map>` 传递包含。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::unordered_set<Key>` | 保存哈希等价意义下的唯一值 | C++11 |
| `std::unordered_multiset<Key>` | 允许哈希等价值重复 | C++11 |
| `std::pmr` 对应别名 | 使用多态分配器 | C++17 |
| `operator==`、`std::swap` | 比较或交换完整容器 | C++11 |
| `std::erase_if` | 按谓词删除元素 | C++20 |

C++20 的 `contains` 是容器成员。当前 draft 中的更晚范围构造和插入接口不应反推为 C++20
能力。

## 关键选择边界

两个容器都不承诺排序或插入顺序。等价谓词判断相等的键必须产生相同哈希值；哈希碰撞则
不代表键相等。unordered_multiset 会保存等价键的多个元素，但等价组之外的整体遍历次序仍
不能写入协议或判题期望。

需要有序范围、稳定最坏对数查找或最小/最大值时，转到 `<set>`。

## 头文件边界

`<unordered_set>` 声明容器接口，不声明 `std::hash` 的所有标准特化，也不把自定义类型自动
变成可哈希。自定义键需要提供一致的 Hash 与 Pred。

## 示例

示例只对固定能力名调用 C++20 `contains`，不遍历容器，因此输出不依赖桶布局。

## 常见错误

- 把遍历顺序当成插入顺序。
- 自定义相等谓词却没有同步设计哈希函数。
- 认为“平均常数”就是最坏情况 O(1)。
- 保存迭代器后触发 rehash。
- 依赖 `<unordered_map>` 间接包含此头文件。

## 相关内容

继续阅读 `std::unordered_set` 的负载、rehash 和失效规则。有序唯一值阅读 `std::set`；哈希
键值对阅读 `std::unordered_map`。

## 来源

头文件 synopsis、两个容器族和 C++11/C++20 边界由 Entry manifest 中的一手资料验证。
