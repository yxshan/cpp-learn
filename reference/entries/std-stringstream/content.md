# `std::stringstream`

`std::stringstream` 是 `std::basic_stringstream<char>` 的别名。它拥有字符串缓冲，同时提供
`std::istream` 与 `std::ostream` 接口，适合需要在同一段内存文本上交替读写的场景。

## 快速信息

- 头文件：`<sstream>`
- 命名空间：`std`
- 标准：C++98 起；move C++11；右值 `str()` 与 `view()` C++20
- 默认打开模式：`ios_base::in | ios_base::out`

## 什么时候使用

需要多个格式化字段并确实要双向读写时使用。只读解析优先 `istringstream`，只写构造优先
`ostringstream`；locale 无关的高性能数值转换优先评估 `<charconv>`。

## C++20 代表接口

```cpp
class basic_stringstream : public basic_iostream<CharT, Traits> {
public:
    basic_stringstream();
    explicit basic_stringstream(
        ios_base::openmode mode = ios_base::in | ios_base::out);
    explicit basic_stringstream(
        const basic_string<CharT, Traits, Allocator>& text,
        ios_base::openmode mode = ios_base::in | ios_base::out);

    basic_string<CharT, Traits, Allocator> str() const &;
    basic_string<CharT, Traits, Allocator> str() &&; // C++20
    basic_string_view<CharT, Traits> view() const noexcept; // C++20
    void str(const basic_string<CharT, Traits, Allocator>& text);
};
```

这是学习用摘要，实际模板还包含 allocator、move、swap 等重载；C++26 又增加 string-view-like
构造和 `str` 重载，C++20 代码不能提前依赖它们。

## 参数、返回与读写位置

构造参数 text 初始化底层字符串，mode 决定输入、输出和 `ate` 等行为。输入序列维护 get position，
输出序列维护 put position；两者相互独立。用已有字符串构造且包含 `out` 时，不指定 `ate` 并不
表示追加，写位置可从开头覆盖字符。

左值 `str()` 返回拥有字符串副本；C++20 在右值上调用 `str()` 可转移缓冲区。`view()` 返回非拥有
视图，只适合在流和缓冲均未发生失效操作的短生命周期内观察。

## 状态、复用与定位

格式化失败会设置 `failbit`，到达末尾可设置 `eofbit`。`clear()` 只清状态，不清缓冲；
`str(new_text)` 替换缓冲并重设相关序列，却不负责清除此前错误状态；`seekg`/`seekp` 只移动对应
位置。解析失败后复用流，通常需要 `clear(); str(new_text);` 两步。

## 复杂度

标准没有为整个 stringstream API 规定统一复杂度。复制式 `str()` 至少需要构造返回字符串，格式化
成本还取决于字符数、locale、分配和转换规则；C++20 的右值提取可避免不必要的整段复制，但不应
据此承诺所有实现都零成本。

## 异常与错误

默认通过 `failbit`/`badbit` 等状态位报告失败；异常掩码命中时可抛 `ios_base::failure`，分配也可能
抛出。检查完整输入时，仅成功读出目标值还不够，必要时还要验证是否存在非空白尾随字符。

## 生命周期与失效规则

stringstream 拥有其缓冲。移动对象会转移实现状态；销毁对象结束所有相关缓冲观察。由 `view()`
得到的视图可能因写入导致重分配、`str(...)` 替换、移动或销毁而失效，不要把它存入长生命周期
对象。

## 线程安全

同一 stringstream 上的提取、插入、定位、`str`、`view` 与状态操作需要同步；不同流对象可独立
使用。一个对象“只读位置、另一个写位置”的直觉不会让并发访问自动安全。

## 示例

第一个示例从已有缓冲输出一个字符，展示 put position 与 get position 独立；显式 `seekg(0)` 后
再读取首字符。第二个示例制造格式化失败，再同时重置状态和缓冲后成功解析。

## 常见错误

- 把 `clear()` 当成清空字符串。
- 只调用 `str("42")` 就期望此前的 `failbit` 消失。
- 假定用已有字符串构造后，输出位置天然在末尾。
- 把 get position 和 put position 当成同一个游标。
- 在修改、移动或销毁流后继续使用旧 `view()`。
- 只需单向流或数字转换，却默认选择最宽的双向接口。

## 与 JavaScript 的区别

> JS 字符串不可变，常以 `split`、正则、模板字符串和 `Number` 组合处理文本；stringstream 拥有
> 可变缓冲、两个位置、格式标志和持久错误位。它也不会返回 `NaN` 表示提取失败，调用者要检查
> stream 状态。

## 相关内容

设施总览阅读 `<sstream>`；整行解析使用 `std::getline`；低分配数字转换阅读 `std::from_chars` 与
`std::to_chars`。

## 来源

接口、打开模式、缓冲访问、状态、生命周期与版本边界由 manifest 中的 Working Draft、N1146、
N3337、N4861、P0408R7 与 P2495R3 验证；cppreference 仅用于二级覆盖核对。
