# `<string_view>`

`<string_view>` 声明一组非拥有、只读的连续字符视图。复制视图不会复制字符，也不会延长底层
字符存储的生命周期。

## 快速信息

- 头文件：`<string_view>`
- 主要命名空间：`std`
- 首次标准：C++17
- 页面角色：非拥有字符串设施地图

## 直接包含

```cpp
#include <string_view>
```

即使某个 `<string>` 实现顺带声明了相关名字，也应按使用的设施直接包含本头文件。

## 主要设施

| 设施组 | 代表实体 | 版本 | 说明 |
|---|---|---|---|
| 通用视图 | `basic_string_view<CharT>` | C++17 | 保存字符区间，不拥有字符 |
| 常用别名 | `string_view`、`wstring_view` | C++17 | 针对常见字符类型 |
| UTF 视图 | `u16string_view`、`u32string_view` | C++17 | 观察对应编码单元 |
| UTF-8 视图 | `u8string_view` | C++20 | 基于 `char8_t` |
| 字面量 | `"text"sv` | C++17 | 以编译期长度构造视图 |
| 比较与输出 | 比较运算、`operator<<` | C++17；C++20 加入 `<=>` | 比较内容；流输出按 view 长度，不要求 NUL 终止 |
| 散列 | `hash<basic_string_view<...>>` | C++17 | 支持标准无序容器 |
| Ranges 集成 | `enable_view`、`enable_borrowed_range` | C++20 | view 类型可进入 ranges；不代表任意来源都不会悬空 |

## 所有权与失效

string_view 只保存一个区间。局部 string 销毁、string 重新分配、vector 字符缓冲区移动，都会
使相关视图悬空。视图仍可能保留非零 `size()`，因此它无法自行检测失效。

`substr`、`remove_prefix`、`remove_suffix` 只调整观察窗口，不修改字符。`data()` 不保证视图
边界处有空字符，不能无条件传给只接收 C 字符串的接口。

## 选择边界

- 同步函数参数只读文本：通常适合按值接收 string_view。
- 结果需要保存、排队或异步使用：在所有权边界复制为 string。
- 需要修改文本：选择拥有型 string 或明确的可写缓冲区。

## 示例

示例从静态字符串字面量建立视图，以 `find` 找分隔符，再通过两个 `substr` 观察前缀和后缀。
底层存储具有静态生命周期，因此两个子视图都有效。

## 常见错误

- 返回指向局部 string 的视图。
- 保存由临时 string 产生的视图供稍后访问。
- 把 `data()` 当作必然空字符结尾。
- 认为 `const string_view` 能阻止底层拥有者修改字符。

## 与 JavaScript 的区别

> JavaScript 的 `slice()` 返回受垃圾回收管理的字符串值；string_view 切片只是复制借用区间。
> C++ 调用者必须证明原字符存储在每次访问时仍然有效。

## 相关内容

`std::string_view` 实体页解释完整生命周期合同。需要拥有结果时转到 `<string>`；数字区间解析
可把 view 的 `data()` 与长度交给 `<charconv>`，但仍要检查返回指针和错误码。

## 来源

设施图与 C++17/C++20 边界以 Working Draft、N4659、N4861 和 P0220R1 核对；cppreference
作为二级展示与覆盖参考。
