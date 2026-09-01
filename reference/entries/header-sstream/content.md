# `<sstream>`

`<sstream>` 提供以 `std::basic_string` 为底层缓冲的字符流。它适合用熟悉的 iostream 操作解析一段
内存文本或逐段构造文本，但不代表最高性能的数字转换方案。

## 快速信息

- 直接包含：`#include <sstream>`
- 命名空间：`std`
- 首次标准：C++98
- 本页示例基线：C++20

## 直接包含

使用字符串流时显式包含 `<sstream>`。`std::string`、`std::cout` 等名称仍应分别直接包含 `<string>`、
`<iostream>`；不要依赖实现偶然提供的传递包含。

## 主要设施与版本

| 学习目的 | 代表设施 | 版本 | 选择边界 |
|---|---|---|---|
| 从字符串读取 | `istringstream` | C++98；move C++11 | 只需要输入时优先 |
| 向字符串写入 | `ostringstream` | C++98；move C++11 | 只需要输出时优先 |
| 同时读写 | `stringstream` | C++98；move C++11 | 有独立的读、写位置 |
| 观察缓冲区 | `view()` | C++20 | 非拥有视图，修改后可能失效 |
| 转移缓冲区 | 右值 `str()` | C++20 | 从可销毁流中取出字符串 |
| string-view-like 输入 | 部分构造/`str` 重载 | C++26 | C++20 项目不可假定存在 |

## 如何选择

仅解析文本用 `istringstream`，仅构造文本用 `ostringstream`，确实需要在同一缓冲区读写才用
`stringstream`。对 locale 无关、低分配的数字转换，优先评估 `<charconv>` 的 `from_chars` 与
`to_chars`；复杂格式、多个字段或已有 stream 代码更适合字符串流。

## 缓冲区、位置与状态

字符串流同时维护底层字符串、读/写位置以及 `goodbit`/`eofbit`/`failbit`/`badbit`。这三类状态
不能互相替代：`clear()` 只重置状态位，`str(new_text)` 替换缓冲并重设相关位置，`seekg`/`seekp`
只移动位置。一次解析失败后复用对象，通常需要同时 `clear()` 和 `str(...)`。

## 返回、错误与复杂度

格式化提取和插入返回 stream 引用以支持链式调用；失败通过状态位报告，异常掩码匹配时可抛
`ios_base::failure`。`str()` 在左值上返回拥有副本；C++20 的右值 `str()` 可转移字符串，`view()`
返回非拥有视图。标准不为所有格式化操作给出统一复杂度；成本受字符数、locale、分配和格式规则
影响。

## 生命周期与线程安全

由 `view()` 或其他缓冲区观察操作得到的非拥有引用/视图，可能因继续写入、替换缓冲、移动或销毁
stream 而失效。同一字符串流对象的读写、定位和状态修改不能无同步并发；不同对象可独立使用。

## 示例

第一个示例用 `istringstream` 解析两个字段并检查结果，第二个示例用 `ostringstream` 构造请求文本。
两者都选择单向类型，而不是为了方便一律使用 `stringstream`。

## 常见错误

- 认为 `clear()` 会清空底层字符串。
- 替换 `str(...)` 后忘记清除此前的 `failbit`。
- 长期保存 `view()`，同时继续修改或销毁流。
- 只需单向操作却使用双向 `stringstream`，让读写位置更难推理。
- 把 C++26 的 string-view-like 重载写进 C++20 基线代码。

## 与 JavaScript 的区别

> JS 常用 `split`、模板字符串、`Number` 或数组 `join` 完成类似任务。字符串流则保留 locale、格式
> 标志、读写位置和持久错误位；提取失败不会像 `Number` 那样返回 `NaN`，而是改变 stream 状态。

## 相关内容

双向状态模型进入 `std::stringstream`；整行读取使用 `std::getline`；低层数字转换阅读
`std::from_chars` 与 `std::to_chars`。

## 来源

设施清单、缓冲访问、状态与版本边界由 manifest 中的 Working Draft、N1146、N3337、N4861、
P0408R7 与 P2495R3 验证；cppreference 仅用于二级覆盖核对。
