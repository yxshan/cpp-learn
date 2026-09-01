# `<fstream>`

`<fstream>` 提供拥有文件缓冲的输入、输出和双向字符流。它复用 iostream 的格式、状态和异常模型，
并通过对象生命周期管理文件关联。

## 快速信息

- 直接包含：`#include <fstream>`
- 命名空间：`std`
- 首次标准：C++98
- 本页基线：C++20

## 直接包含

使用文件流时显式包含 `<fstream>`。路径 string、控制台输出和 `std::remove` 仍分别直接包含
`<string>`、`<iostream>`、`<cstdio>`；不要依赖其他头文件的传递包含或实现偶然带入声明。

## 主要设施与版本

| 学习目的 | 代表设施 | 版本 | 选择边界 |
|---|---|---|---|
| 文件缓冲 | `basic_filebuf` | C++98 | 普通代码通常用上层 stream |
| 只读文件 | `ifstream` | C++98；string path C++11；filesystem path C++17 | 总加入 `in` |
| 只写文件 | `ofstream` | C++98；string path C++11；filesystem path C++17 | 总加入 `out` |
| 双向文件 | `fstream` | C++98；move C++11 | 共享一个文件位置 |
| 排他创建 | `ios_base::noreplace` | C++23 | 不属于 C++20 mode 集合 |
| 原生句柄 | `native_handle()` | C++26 | 非拥有、close 后失效 |

## 如何选择

只读文件使用 `ifstream`，只写文件使用 `ofstream`，确实需要在同一个文件关联上交替读写才选择
`fstream`。需要路径遍历、类型化路径和目录操作时使用 `<filesystem>`；需要异步 I/O、原子替换、
事务提交或结构化序列化时，应选择提供相应协议的更高层设施。

## 打开模式

`in`/`out` 选择方向；`trunc` 打开时截断；`app` 在**每次写入前**定位末尾；`ate` 只在打开成功后
定位一次，随后仍可 seek；`binary` 选择二进制模式但不序列化对象、不规定 endian 或 ABI。默认
ofstream 的 `out` 会创建或截断文件。

## 状态、关闭与复杂度

打开失败通常设置 `failbit`，默认不抛；异常掩码匹配时可抛 `ios_base::failure`。`is_open()` 只
报告 filebuf 是否关联，stream Boolean 报告逻辑状态，两者不能互换。析构会尝试 close 并吞掉
析构路径异常；重要输出应显式 close 并检查状态。标准没有统一复杂度、系统调用或耐久落盘保证。

## 示例

第一个示例用双向 `fstream` 写入后 flush、seek 并读回。第二个示例只往 binary 文件写固定字节，
不写原生对象布局。文件均位于验证器临时目录并自动删除。

## 常见错误

- 认为默认 ofstream 会保留旧内容。
- 把 `ate` 当成 `app`。
- 把 binary 当成可移植对象序列化。
- 把 flush/close 成功描述成断电耐久事务。
- 只检查 `bad()` 或 `is_open()`，忽略 `failbit` 与后续操作。
- 依赖析构把关闭错误报告给调用者。

## 与 JavaScript 的区别

> Node `fs` flags 可类比打开模式，但 fstream 是同步、有 locale 和持久状态位的 iostream 对象，
> 不是 Promise、Buffer 或 backpressure API。binary mode 也不等于 JS 对象编码。

## 相关内容

只读进入 `std::ifstream`，只写进入 `std::ofstream`；内存文本转换阅读 `<sstream>`。整行文件输入
仍使用 `std::getline`。

## 来源

设施、模式、open/close 与版本边界由 manifest 中的 Working Draft、N1146、N3337、N4659、
P0610R0、N4861、P2467R1 与 P1759R6 验证。
