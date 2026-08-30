# `std::string::append`

`append` 把字符序列追加到字符串末尾，并返回 `*this` 的引用。它会修改拥有型字符串，必要时
重新分配字符存储。

## 快速信息

- 头文件：`<string>`
- 命名空间：`std`
- 所属类型：`std::basic_string` / `std::string`
- 标准：C++98 起；主要重载 C++20 起可用于常量求值
- 返回值：`basic_string&`

## C++20 重载分组

| 输入形态 | 代表调用 | 关键边界 |
|---|---|---|
| 整个 string | `target.append(source)` | 自追加受支持 |
| string 子区间 | `append(source, pos, count)` | pos 越界可抛异常 |
| 指针与长度 | `append(pointer, count)` | 区间必须有效，可包含空字符 |
| C 字符串 | `append(pointer)` | 扫描空字符终止符 |
| 重复字符 | `append(count, character)` | 增长 count 个元素 |
| 迭代器范围 | `append(first, last)` | 输入范围必须有效 |
| string_view-like | `append(view)` | C++17 起的模板入口 |

当前草案含晚于 C++20 的范围重载，本页不把它们列入 C++20 声明。

## 参数与容量

追加前后的新长度不得超过 `max_size()`。`reserve()` 可以提前减少重新分配，但 capacity 不是
可写字符数；append 会负责改变 size 并构造新增字符。

`append(source)` 允许 `source` 就是 `*this`。标准 string 操作按规定处理来自自身字符范围的
别名；不要把这种保证外推到任意悬空或无效指针区间。

## 返回值

返回当前字符串引用，因此可以链式调用：

```cpp
text.append("/").append(resource);
```

链式调用不会创建中间 string，但每次增长仍可能触发容量检查或重新分配。

## 复杂度

`[string.append]` 没有为整个重载组单独规定统一的渐进复杂度上界。追加需要写入新增字符，发生
重新分配时还要迁移已有字符；不要把某个实现的 small-string optimization 或增长策略当成
标准保证。已知最终大小时，`reserve` 可以减少实际分配次数，但不改变 append 的语义合同。

## 异常与保证

- 结果长度无法表示时可抛 `std::length_error`。
- 动态分配失败可抛 `std::bad_alloc`。
- string 子区间重载的起点越界可抛 `std::out_of_range`。
- 标准 string 修改器在规定异常下提供无效果保证；无效指针或范围属于前置条件违例，不能靠
  异常恢复。

## 生命周期与失效

append 可能重新分配，因此此前指向 string 字符的指针、引用、迭代器和 string_view 可能失效。
即使本次实现未重新分配，也不要让长期借用依赖未承诺的容量状态。

## 示例

最小示例追加 `, C++!`。第二个示例执行 `service.append(service)`，展示受支持的自追加，结果为
`apiapi`；它不输出 capacity 或地址。

## Notes

`operator+=` 适合简单追加，append 重载更适合显式长度、子区间或重复字符。需要大量结构化
格式化时，应比较专门格式化设施，而不是建立难以审查的长链。

## 常见错误

- 追加后继续使用旧 `data()` 指针或 string_view。
- 把 `reserve(n)` 当成已经增加 size。
- 向无效或不足长度的裸指针区间读取 count 个字符。
- 认为返回值是新字符串而忽略原对象已被修改。

## 与 JavaScript 的区别

> JavaScript 字符串不可变，`text + suffix` 产生新的字符串值；C++ append 原地修改
> `std::string`，返回自身引用，并可能使旧字符地址与视图失效。

## 相关内容

`std::string` 解释容量与拥有模型；`substr` 复制子区间。对于容器尾部加入一个元素，可比较
`std::vector::push_back`，但字符串的输入重载与字符语义不同。

## 来源

重载等价行为、别名处理、异常与失效以 `[string.append]`、`[string.require]` 和 N4861 为准；
cppreference 作为二级呈现参考。
