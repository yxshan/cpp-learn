# `std::string::find`

`find` 从指定位置开始搜索字符或字符序列，找到时返回起始索引，找不到时返回
`std::string::npos`。

## 快速信息

- 头文件：`<string>`
- 命名空间：`std`
- 所属类型：`std::basic_string` / `std::string`
- 标准：C++98 起；经典重载 C++20 起可用于常量求值
- 未找到哨兵：`std::string::npos`

## C++20 代表声明

```cpp
constexpr size_type find(const basic_string& text,
                         size_type pos = 0) const noexcept;
constexpr size_type find(const CharT* text,
                         size_type pos,
                         size_type count) const;
constexpr size_type find(const CharT* text,
                         size_type pos = 0) const;
constexpr size_type find(CharT character,
                         size_type pos = 0) const noexcept;
```

另有接受可转换为 string_view 的模板重载。选择指针重载时，只有指针加长度形式能安全处理嵌入
空字符；只传 C 字符串指针会扫描到第一个终止符。

## 参数与匹配

`pos` 是允许匹配开始的第一个位置。空 needle 可以在 `pos <= size()` 时匹配；非空 needle
只有完整落在源字符串范围内才算成功。

字符比较使用 `Traits::eq`。find 不解释 Unicode 规范等价、大小写折叠或区域设置。

## 返回值

- 成功：第一个匹配子序列的起始索引。
- 失败：`basic_string::npos`。

`npos` 是无符号 `size_type` 的最大值，不是 `-1` 类型的普通索引。应写：

```cpp
if (position != std::string::npos) {
    // 使用 position
}
```

不要对未检查的 npos 做 `+ 1`，也不要把它窄化进 `int`。

## 复杂度

`[string.find]` 委托到对应的 string_view 搜索合同；其最坏上界为
`O(size() * needle.size())`。这不承诺实现采用某个特定线性算法或预建索引。重复搜索大型文本
时，应根据工作负载选择更适合的解析器或索引结构。

## 异常与错误

字符及字符串重载为只读搜索，不修改源对象。标为 `noexcept` 的重载不抛异常。接受空字符结尾
指针的重载要求指针有效；传入空指针不是“搜索空字符串”。

## 生命周期与失效

返回的是数值索引，不依赖内部缓冲区地址。find 自身不修改 string，也不会使指针、引用或
迭代器失效；后续修改字符串后，旧索引可能不再表示同一语义位置。

## 示例

第一个示例找到 `env=production` 中 `=` 的位置 3。第二个示例搜索不存在的 `/admin`，先与
`npos` 比较，再输出稳定的 `missing` 分支。

## 什么时候使用

从 `pos > size()` 开始搜索通常直接失败而不是抛出越界异常。find 的错误通道是 npos；这与
`at()` 或非法 `substr(pos)` 的异常模型不同。

## 常见错误

- 用 `if (text.find(needle))` 判断是否找到：位置 0 会转成 false，npos 会转成 true。
- 把 npos 保存到 int 或参与未检查的算术。
- 期待默认大小写不敏感或 Unicode 感知搜索。
- 使用无长度指针重载处理可能含嵌入空字符的数据。

## 与 JavaScript 的区别

> JavaScript `String.prototype.indexOf()` 未找到时返回 `-1`；C++ 返回无符号的 `npos`。
> 两者都需要显式比较哨兵，但 C++ 还要选择指针/长度重载并管理字符存储生命周期。

## 相关内容

找到边界后可用 `std::string::substr` 复制结果；非拥有文本搜索使用 `std::string_view` 的同名成员。
通用范围元素查找则是 `std::find`，返回迭代器而不是字符串索引。

## 来源

匹配规则、返回值和重载来自 `[string.find]` 与 N4861；string_view 对应规则用于交叉核对，
cppreference 作为二级学习参考。
