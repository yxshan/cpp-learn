# `std::to_chars`

`std::to_chars` 把数值写入调用者提供的字符区间，返回写入尾或缓冲区不足错误。它不创建 string，
也不会在结果后追加空字符。

## 快速信息

- 头文件：`<charconv>`
- 命名空间：`std`
- 标准：C++17 起
- 输出：可写 `[first, last)`
- 返回：`to_chars_result { ptr, ec }`

## C++20 代表声明

```cpp
template<class Integer>
to_chars_result to_chars(char* first,
                         char* last,
                         Integer value,
                         int base = 10);

to_chars_result to_chars(char* first,
                         char* last,
                         double value,
                         chars_format format = chars_format::general);
```

另有浮点精度重载。当前 Working Draft 中晚于 C++20 的 constexpr 与便利扩展不属于本页基线。

## 什么时候使用

需要把数值写入已有缓冲区、协议帧或固定大小临时数组，并希望显式控制写入边界、避免区域设置
和普通失败异常时使用。需要宽度、对齐、补零、本地化或直接得到拥有型字符串时，更高层格式化
设施通常更清楚；不要为了“零分配”让缓冲区生命周期管理变得更危险。

## 参数与整数格式

`base` 必须在 2 到 36。字母数字使用小写表示；负的有符号整数输出 `-`。正数不输出 `+`，
十六进制也不自动输出 `0x`。

`[first, last)` 必须是有效可写区间。函数不知道数组 capacity 之外的空间，也不会调整 string 的
size。

## 返回值与错误码

| 情况 | `ptr` | `ec` | 可读取输出 |
|---|---|---|---|
| 成功 | 最后写入字符之后 | `errc{}` | `[first, ptr)` |
| 缓冲区太小 | `last` | `value_too_large` | 不应把失败区间当作完整表示 |

成功结果不是 C 字符串：`ptr` 位置不会自动写 `\0`。应使用指针差构造 string/string_view，或在
确认剩余空间后由调用者追加终止符。

## 复杂度

`[charconv.to.chars]` 没有为这些重载单独规定渐进复杂度上界。数值类型、进制和浮点格式会影响
实际工作量，但页面不把实现经验写成标准保证；接口也不会替调用者扩大输出区间。

## 异常、分配与区域设置

标准合同为不抛异常。函数直接写入调用者缓冲区，不构造拥有型字符串；普通失败通过 `errc` 返回。
输出形式不受当前 locale 影响，因此适合协议和机器可读字段。

## 生命周期与安全边界

返回指针只在原缓冲区仍存活时有效。从栈数组建立的 string_view 不能逃出数组作用域。若目标是
std::string 的内部存储，必须先建立合法可写大小，并考虑后续修改造成的指针失效；简单场景通常
先写固定数组再构造 string 更清楚。

## 示例

最小示例把 255 格式化为十六进制 `ff`。第二个示例故意提供 2 字节缓冲区格式化 2026，验证
`value_too_large` 和 `ptr == last`，且不读取失败缓冲区内容。

## Notes

需要 `0x`、宽度、补零或对齐时，由调用者组合前后缀，或使用更高层格式化工具。to_chars 的优势
是边界、写入位置和错误通道都可预测，而不是替代所有面向用户的格式化需求。

## 常见错误

- 把成功区间当作空字符结尾字符串。
- 缓冲区不足后仍输出其中的部分字符。
- 忽略 base 范围或期待十六进制自动带 `0x`。
- 返回指向局部数组的 string_view。

## 与 JavaScript 的区别

> JavaScript `(255).toString(16)` 直接返回由运行时管理的字符串 `"ff"`；to_chars 要求调用者
> 提供可写内存并检查错误码，换来不分配拥有型字符串和明确的写入边界。

## 相关内容

解析使用 `std::from_chars`。需要保存格式化结果时构造 `std::string`；只在缓冲区存活期间读取
可使用 `std::string_view`。

## 来源

整数/浮点家族、返回指针和错误模型依据 `[charconv.to.chars]`、N4861、P0067R5、P0682R1；
cppreference 是二级展示与覆盖参考。
