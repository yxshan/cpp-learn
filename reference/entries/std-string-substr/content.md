# `std::string::substr`

`substr` 从字符串中复制一个字符区间，返回拥有独立存储的新 `std::string`。它不是零复制视图。

## 快速信息

- 头文件：`<string>`
- 命名空间：`std`
- 所属类型：`std::basic_string` / `std::string`
- 标准：C++98 起；本页声明以 C++20 为基线
- 返回值：新的拥有型字符串

## C++20 代表声明

```cpp
constexpr basic_string substr(size_type pos = 0,
                              size_type count = npos) const;
```

当前 Working Draft 还包含 C++23 起区分 `const&` 与 `&&` 的重载。本项目的 C++20 示例只使用
上面的经典 const 成员，不把后续移动优化写成 C++20 行为。

## 参数

| 参数 | 含义 | 边界 |
|---|---|---|
| `pos` | 子串起点，按 `CharT` 元素索引 | 可以等于 `size()`；大于 `size()` 抛异常 |
| `count` | 最多复制的元素数 | 超过剩余长度时自动截到末尾 |

实际复制长度是 `min(count, size() - pos)`。默认 `count == npos` 表示复制到字符串末尾。

## 返回值与 allocator

返回值拥有自己的字符存储，源字符串随后修改或销毁不会让结果悬空。C++20 的返回对象通过对应
子串构造语义建立，其 allocator 是默认构造的 allocator，并不自动复制源字符串
`get_allocator()` 的状态。使用有状态自定义 allocator 时，这一点会影响内存资源选择。

如果只需要在源字符串有效期间观察子区间，构造 `std::string_view` 并切片可以避免字符复制，
但会引入显式生命周期责任。

## 复杂度

C++20 的 `[string.substr]` 没有为该成员单独规定渐进复杂度上界。它会构造一个新的拥有型
字符串并复制结果字符，且可能动态分配；不要把它当作标准保证为 O(1) 的零复制视图。

## 异常与错误

- `pos > size()` 时抛出 `std::out_of_range`。
- 分配失败可抛出 `std::bad_alloc`。
- `pos == size()` 合法，返回空字符串。

异常不会把一个“部分构造”的返回字符串交给调用者。

## 生命周期与失效

`substr` 是 const 查询，不修改源字符串，因此不会因该调用使源字符串的引用、指针和迭代器
失效。返回值的生命周期独立于源对象。

## 示例

最小示例从 `cpp-learner` 复制后缀 `learner`。工程示例先用 `find` 定位路由段，再用
`substr(start, count)` 提取拥有型 `users`，适合把结果保存到请求对象之外。

## 什么时候使用

`count` 是最大长度，不要求剩余区间恰好包含这么多元素。若 `find` 返回 `npos`，不要直接把它
当作 `pos` 传给 substr；先检查搜索结果，否则会抛 `out_of_range`。

## 常见错误

- 认为返回值仍指向源字符串，或认为它是 O(1) 视图。
- 把字节索引当作 Unicode 用户感知字符索引。
- 忘记检查作为 `pos` 来源的 `find` 结果。
- 期待返回值继承源字符串的有状态 allocator。

## 与 JavaScript 的区别

> JavaScript 的 `String.prototype.slice()` 也产生字符串值，但 JS 字符串不可变且生命周期由
> 垃圾回收器管理。C++ `substr` 明确构造拥有型对象，可能分配并复制；零复制替代方案
> `string_view` 则要求程序员证明底层字符仍然存活。

## 相关内容

`std::string::find` 负责定位边界，`std::string::append` 负责增长拥有型文本；需要非拥有切片时
阅读 `std::string_view`。

## 来源

C++20 声明、边界、构造与 allocator 语义依据 `[string.substr]`、`[string.cons]` 和 N4861；
cppreference 用于二级覆盖与呈现核对。
