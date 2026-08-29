# `std::unordered_map`

`std::unordered_map<Key, T>` 是无序关联容器：每个等价键至多对应一个值，元素按
哈希结果分配到 bucket 中。

## 快速信息

- 头文件：`<unordered_map>`
- 命名空间：`std`
- 标准：C++11 起
- `value_type`：`std::pair<const Key, T>`

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

## 什么时候使用

需要按唯一键查询、更新或聚合值，并且不要求按键排序或保持插入顺序时使用。需要稳定的
键序遍历、范围查询或最坏情况对数级查找时应比较有序关联容器；需要重复等价键时应选择
`std::unordered_multimap`。

## 哈希与键等价

等价键必须产生相同的哈希值。对于已经存入容器的键，哈希和等价判断结果必须保持
稳定。元素的键是 `const Key`，不能通过迭代器修改 `pair.first`。

## 复杂度

`find` 等查询通常为平均常数复杂度，最坏为线性复杂度。rehash 平均线性，最坏
二次于元素数量，详见 [`[unord.req]`](https://eel.is/c++draft/unord.req)。平均常数时间
不是最坏情况保证；低质量哈希或对抗性输入会降低性能。

## 生命周期与失效规则

rehash 会使所有迭代器失效，也可能改变遍历顺序和 bucket，但不会使元素指针与
引用失效。普通插入若触发 rehash，同样会使所有迭代器失效。删除只使指向被删
元素的迭代器、指针和引用失效。

## 元素访问与异常

`operator[]` 在键不存在时会插入一个元素；它等价于通过 `try_emplace` 取得映射值。
`at()` 不插入，键不存在时抛出 `std::out_of_range`。哈希、等价判断、分配和元素
构造都可能抛异常；具体保证依赖所调用操作。

## 示例

第一个示例使用 `find` 与 `contains` 进行只读查询。第二个示例用 `operator[]` 为事件计数：
缺失键首次出现时创建零值，再递增计数。两个示例都按明确键输出，不依赖无序遍历顺序。

## 常见错误

不要用 `values[key]` 仅仅测试键是否存在，否则缺失键会悄悄插入默认值。只读查询
优先选择 `find`、`contains` 或 `at`。自定义相等关系与哈希必须一致。

## 相关内容

`<unordered_map>` 声明该类型及相关辅助接口。

## 来源

键模型、复杂度、rehash、失效和元素访问规则依据由 Entry manifest 提供。
