# std::string_view

`std::string_view` 保存字符序列的位置和长度，但不拥有字符。复制视图通常只复制
这两个描述信息，不会复制底层文本。

## 头文件与声明

```cpp
#include <string_view>

// 代表性公开声明（省略约束与部分重载）
namespace std {
template<class CharT, class Traits = std::char_traits<CharT>>
class basic_string_view {
public:
    constexpr basic_string_view() noexcept;
    constexpr basic_string_view(const CharT* text);
    constexpr basic_string_view(const CharT* text, std::size_t count);
    constexpr std::size_t size() const noexcept;
};

using string_view = basic_string_view<char>;
} // namespace std
```

## 生命周期

视图必须比它引用的字符活得短。返回指向局部 `std::string` 的视图、保存临时
字符串形成的视图，或在原字符串重新分配后继续使用旧视图，都会产生悬空访问。

## 复杂度

复制视图、以“指针 + 长度”构造以及调用 `size()` 为常数复杂度。只传入空字符
结尾指针的构造需要扫描字符来求长度，因此是线性复杂度。比较和查找同样需要
检查字符，其复杂度取决于参与操作的长度。

## 何时使用

只读参数若无需取得所有权，可接收 `std::string_view`。需要跨越调用保存文本时，
应复制到拥有存储的 `std::string`。

## 常见陷阱

`data()` 指向的字符区间不保证在视图末尾之后存在空字符；调用只接受 C 字符串的
接口前，应先确认终止条件或构造拥有的字符串。
