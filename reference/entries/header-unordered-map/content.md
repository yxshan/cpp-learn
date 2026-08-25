# `<unordered_map>`

`<unordered_map>` 声明 `std::unordered_map`、`std::unordered_multimap` 和相关比较、
交换、删除辅助接口。

## 快速信息

- 头文件：`<unordered_map>`
- 命名空间：`std`
- 核心类型：`std::unordered_map`、`std::unordered_multimap`
- 标准：C++11 起

## 什么时候使用

代码直接声明或操作无序映射时包含此头文件。需要每个等价键至多一个元素时先学习
`std::unordered_map`；允许等价键重复时才考虑 `std::unordered_multimap`。

## 代表性声明

```cpp
namespace std {
template<class Key, class T,
         class Hash = std::hash<Key>,
         class Pred = std::equal_to<Key>,
         class Allocator = std::allocator<std::pair<const Key, T>>>
class unordered_map;
}
```

## 示例

示例按明确的键读取状态码，不依赖无序容器的遍历顺序。

## 常见错误

“无序”不表示随机、有序、保持插入顺序或跨 rehash 稳定。不要把直接遍历顺序写入
期望输出。当前头文件的部分辅助接口晚于 C++11，需分别判断版本。

## 相关内容

继续阅读 `std::unordered_map` 的哈希要求、平均复杂度和 rehash 失效规则。

## 来源

头文件实体清单依据由 Entry manifest 提供。
