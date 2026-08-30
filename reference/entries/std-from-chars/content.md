# `std::from_chars`

`std::from_chars` 从一个明确的字符区间解析整数或浮点数，通过结果对象同时报告停止位置和错误码。
它不创建临时 string，不使用区域设置，也不以异常表示普通转换失败。

## 快速信息

- 头文件：`<charconv>`
- 命名空间：`std`
- 标准：C++17 起
- 输入：`[first, last)`，不要求空字符结尾
- 返回：`from_chars_result { ptr, ec }`

## C++20 代表声明

```cpp
template<class Integer>
from_chars_result from_chars(const char* first,
                             const char* last,
                             Integer& value,
                             int base = 10);

from_chars_result from_chars(const char* first,
                             const char* last,
                             float& value,
                             chars_format format = chars_format::general);
```

这里按行为展示整数与浮点家族，省略其他数值类型。当前草案新增的 constexpr 或结果便利接口
晚于 C++20，不能混入本页基线。

## 整数解析规则

`base` 必须在 2 到 36。语法类似 `strtol` 对应进制，但有重要差异：

- 不跳过前导空白；
- 只有有符号目标可接受前导负号；
- 前导 `+` 不属于匹配模式；
- base 16 不把 `0x` 当作自动前缀；
- 解析一个合法前缀后即可成功，剩余字符由 `ptr` 指出。

## 返回值与错误码

| 情况 | `ptr` | `ec` | `value` |
|---|---|---|---|
| 成功解析 | 第一未匹配字符 | `errc{}` | 写入解析值 |
| 没有字符匹配 | `first` | `invalid_argument` | 保持不变 |
| 数值超出目标范围 | 匹配模式之后 | `result_out_of_range` | 保持不变 |

成功不等于完整消费。协议字段要求整段都是数字时，还要检查 `result.ptr == last`。

## 复杂度

`[charconv.from.chars]` 没有为这些重载单独规定渐进复杂度上界。函数只检查 `[first, last)` 内的
输入，不会为了寻找终止符越过 `last`；不要把某个实现的 benchmark 当作标准复杂度保证。

## 异常、分配与区域设置

标准合同为不抛异常。接口直接读取调用者区间并写目标数值，不建立拥有型临时字符串；结果通过
`errc` 返回。解析规则不受当前 C locale 或 iostream locale 影响。

底层字符区间必须在调用期间有效，且 `first`、`last` 必须表示同一有效范围。错误码无法修复
悬空指针或倒置区间。

## 示例

第一个示例解析 `200ms`，成功得到 200，并用 `ptr` 建立剩余 `ms` 的 string_view。第二个示例
分别触发 `invalid_argument` 和 `result_out_of_range`，不依赖异常文本。

## Notes

高层表单经常希望接受空白、加号或本地化数字；from_chars 不替你定义这些产品规则。应在调用前
明确规范化策略，并在调用后检查完整消费。

## 常见错误

- 只检查 `ec`，忘记检查 `ptr` 是否到达 last。
- 期待跳过空白、接受 `+42` 或自动识别 `0x`。
- 错误时继续使用以为已被清零的 value；标准要求 value 保持原值。
- 让 string_view/字符串在解析前销毁，使输入指针悬空。

## 与 JavaScript 的区别

> JavaScript `parseInt("200ms", 10)` 也接受数字前缀，但返回 Number，失败通常表现为 `NaN`，
> 并且语法与空白处理不同。from_chars 把目标整数宽度、区间终点、停止位置和错误类别全部显式化。

## 相关内容

反向格式化使用 `std::to_chars`。`std::string_view` 适合提供不拥有的输入区间；若业务希望“有值
或无值”而不暴露错误分类，可在验证层映射到 `std::optional`，但不要丢失有用诊断。

## 来源

语法差异、结果状态和不抛异常合同来自 `[charconv.from.chars]`、N4861、P0067R5 与 P0682R1；
cppreference 用于二级页面覆盖核对。
