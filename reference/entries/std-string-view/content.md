# `std::string_view`

`std::string_view` 是对一段连续只读字符的非拥有视图。它可以按值传递和切片而不复制字符，
但每一次访问都要求底层字符区间仍然有效。

## 快速信息

- 头文件：`<string_view>`
- 命名空间：`std`
- 标准：C++17 起
- 所有权：不拥有字符，也不会延长字符存储的生命周期

## 什么时候使用

函数只需在调用期间读取文本时，可以按值接收 `string_view`，从而同时接受字符串字面量、
`std::string` 和其他连续字符区间。解析器可以用 `substr`、`remove_prefix` 或
`remove_suffix` 移动视窗，而不创建拥有型子字符串。

如果结果需要保存、排队异步处理或跨越调用边界，而底层存储寿命无法证明，应在边界处复制
成 `std::string`。`string_view` 也不是 Unicode 文本处理抽象；它观察的是 `CharT` 代码
单元，不理解用户感知字符。

## 代表性声明

以下是面向 C++17/C++20 的代表性子集，省略比较和部分搜索重载：

```cpp
namespace std {
template<class CharT, class Traits = char_traits<CharT>>
class basic_string_view {
public:
    constexpr basic_string_view() noexcept;
    constexpr basic_string_view(const CharT* text);
    constexpr basic_string_view(const CharT* text, size_type count);

    constexpr const CharT* data() const noexcept;
    constexpr size_type size() const noexcept;
    constexpr bool empty() const noexcept;

    constexpr const_reference operator[](size_type pos) const;
    constexpr const_reference at(size_type pos) const;

    constexpr void remove_prefix(size_type count);
    constexpr void remove_suffix(size_type count);
    constexpr basic_string_view substr(
        size_type pos = 0,
        size_type count = npos) const;
    constexpr size_type find(
        basic_string_view needle,
        size_type pos = 0) const noexcept;
};

using string_view = basic_string_view<char>;
} // namespace std
```

## 构造、参数与前置条件

只接收指针的构造函数会调用字符 traits 计算长度，因此要求该指针指向一个有效的空字符
结尾区间；传入空指针并不表示空视图。指针加长度的构造函数使用精确的
`[text, text + count)` 区间，不扫描终止符，并要求该区间有效。

`operator[]` 要求 `pos < size()`；`front()` 和 `back()` 要求视图非空；
`remove_prefix(count)` 与 `remove_suffix(count)` 要求 `count <= size()`。这些操作不会
因为参数非法而自动转成受检异常。

## 返回值与切片

`string_view` 是 trivially copyable 类型；复制只复制视图状态，不复制字符。标准不要求
实现必须恰好由“两个字段”组成，因此教学内容不依赖具体内存布局。

`substr` 返回指向原字符区间的另一个视图，不创建 `std::string`。`remove_prefix` 和
`remove_suffix` 只改变当前视图表示的范围，不修改底层字符。`const string_view` 仅禁止
通过视图修改字符；拥有者仍可能修改底层存储。

## 复杂度

除非某个成员另有规定，string_view 成员函数为 O(1)。重要例外包括：

- 从空字符结尾指针构造需要扫描长度，为线性复杂度；
- 指针加长度构造及 `substr` 为 O(1)；
- `copy` 和 `compare` 随有效字符数量线性增长；
- 搜索操作的最坏情况为视图长度与待查字符串长度的乘积。

## 异常与错误

`at(pos)` 在 `pos >= size()` 时抛出 `std::out_of_range`，而 `operator[]` 使用前置条件。
`substr(pos, count)` 和 `copy(..., pos)` 在 `pos > size()` 时抛出
`std::out_of_range`。

视图无法检测底层字符已经销毁或重新分配。悬空通常在后续访问时表现为未定义行为，而不是
由 string_view 抛出一个可恢复异常。

## 生命周期与失效规则

任何使底层字符指针失效的操作，也会使相关视图、迭代器和元素引用失效。局部
`std::string` 被销毁、拥有者替换缓冲区或发生重新分配，都可能留下仍有长度但已悬空的
string_view。

临时 `std::string` 可以安全地提供一个只在当前函数调用中使用的视图，因为访问在完整表达式
结束前完成；把该视图保存或返回给稍后使用则不安全。返回 string_view 并非一律错误：指向
静态存储或调用者拥有存储时可以安全，API 必须明确其寿命契约。

`data()` 只返回区间起点，不保证视图边界处存在空字符。子视图可能在原字符串终止符之前
结束；调用 C 接口时必须使用同时接受指针和长度的形式，或者先构造拥有型字符串。

## 示例

最小示例切分静态字符串字面量而不分配；工程示例在调用期间借用请求目标，并在返回边界
构造拥有型结果，避免把视图泄漏到输入寿命之外。

## 常见错误

- 认为视图复制了一份小字符串，因而忽略原字符寿命。
- 把 `data()` 当作当前视图必然空字符结尾的 C 字符串。
- 认为传入 `nullptr` 能构造空视图。
- 混淆指针构造和指针加长度构造，忽略前者会扫描并在嵌入的空字符处停止。
- 认为 `const string_view` 能阻止拥有者修改或重新分配字符。
- 认为所有操作都是 O(1)，忽略构造扫描、比较、复制和搜索成本。
- 认为 `operator[]` 会像 `at()` 一样检查越界。

## 与 JavaScript 的区别

JavaScript 字符串是由运行时管理生命周期的不可变值，切片结果仍是字符串值；程序员通常
不需要证明原字符串缓冲区继续存在。C++ string_view 是显式借用，性能收益来自不复制，
代价是调用方和被调用方必须共同维护清楚的生命周期契约。

## 相关内容

需要拥有结果时使用 `std::string`。`std::optional<std::string_view>` 只能表达“可能有一个
视图”，不能延长字符寿命；两层类型的状态与所有权必须分别分析。

## 来源

构造、访问、修改器、切片、搜索、失效规则和 C++17 引入历史分别由 Entry manifest 中的
C++ Working Draft 与 WG21 主要来源验证。
