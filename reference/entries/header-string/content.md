# `<string>`

`<string>` 是拥有型字符串设施的入口：它声明 `std::basic_string`、常用字符别名、字符 traits，
以及部分字符串转换与非成员操作。

## 快速信息

- 头文件：`<string>`
- 主要命名空间：`std`
- 首次标准：C++98
- 页面角色：设施地图；具体成员合同请进入独立实体页

## 直接包含

源文件直接使用 `std::string` 或本页设施时，应显式写出：

```cpp
#include <string>
```

不要依赖 `<iostream>`、容器头文件或框架头文件偶然传递包含 `<string>`。能编译不等于依赖关系
稳定。

## 主要设施与版本

| 设施组 | 代表实体 | 版本边界 | 学习重点 |
|---|---|---|---|
| 拥有型字符序列 | `basic_string<CharT>` | C++98 | 连续存储、可修改、管理字符生命周期 |
| 常用别名 | `string`、`wstring` | C++98 | 分别基于 `char`、`wchar_t` |
| UTF 字符别名 | `u16string`、`u32string` | C++11 | 类型区分编码单元，不自动完成 Unicode 语义处理 |
| UTF-8 别名 | `u8string` | C++20 | 元素类型是 `char8_t` |
| 多态分配器别名 | `pmr::string` 等 | C++17 | 更换分配资源，不改变字符串语义 |
| 字符 traits | `char_traits<CharT>` | C++98 | 字符比较、长度和复制的类型策略 |
| 拼接、比较与交换 | `operator+`、比较运算、`swap` | C++98；C++20 加入 `<=>` | 非成员操作仍服从字符串的拥有与分配语义 |
| 整行输入 | `getline` | C++98 | 从流读取到分隔符；区别于 `operator>>` 的空白分词 |
| 数值转换 | `stoi`、`stol`、`to_string` 等 | C++11 | 方便但可能分配、依赖区域设置并以异常报告部分错误 |
| 字符串字面量 | `operator""s` | C++14 | 产生拥有型 string，不是 `string_view` |
| 按值/谓词擦除 | `erase`、`erase_if` | C++20 | 非成员便利接口，返回移除数量 |

大量 `basic_string` 成员从 C++20 起可参与常量求值，但这不意味着任意持久动态分配都能成为
编译期字符串对象。当前 Working Draft 还包含晚于 C++20 的重载与 `constexpr` 扩展，本项目
不会把它们回写成 C++20 能力。

## 选择边界

- 需要保存、返回或修改文本：选择 `std::string`。
- 只在已知生命周期内读取连续字符：考虑 `std::string_view`。
- 需要不分配、无区域设置的数字转换：选择 `<charconv>`。
- 需要 Unicode 分词、规范化或用户感知字符处理：标准字符串类型本身不够，需要明确的文本库。

## 示例

本页示例直接包含 `<string>`，构造拥有型 `std::string` 并读取内容与 `size()`。输出只依赖
字符串值，不依赖容量、小字符串优化或内存地址。

## 常见错误

- 把 `size()` 当作 Unicode 字符数，而不是 `CharT` 元素数。
- 长期保存修改前取得的 `data()`、`c_str()` 指针。
- 仅为了读取参数就无条件复制成 string。
- 把当前草案的新声明误认为 C++20 已有。

## 与 JavaScript 的区别

> JavaScript 字符串是不可变、由运行时管理生命周期的值；`std::string` 是可变的拥有型对象，
> 复制、移动、容量变化和字符指针失效都属于可观察的 C++ 合同。

## 相关内容

先阅读 `std::string` 的对象模型，再按任务进入 `substr`、`find`、`append`。只读借用转到
`<string_view>`；低层数字转换转到 `<charconv>`。

## 来源

设施清单和版本边界由 manifest 中的 Working Draft、N4861、历史草案与 WG21 论文验证；
cppreference 仅作为覆盖范围与页面组织的二级参考。
