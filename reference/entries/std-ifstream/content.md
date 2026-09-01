# `std::ifstream`

`std::ifstream` 拥有面向输入的文件缓冲，并复用 `std::istream` 的格式化、状态和异常模型。它保持
当前位置，不会一次性把整份文件变成 string 或字节数组。

## 快速信息

- 头文件：`<fstream>`
- 命名空间：`std`
- 标准：C++98 起；string 路径/move C++11，filesystem path C++17
- 默认模式：`ios_base::in`

## 什么时候使用

需要流式读取文本 token、行或字节，并希望限制内存占用时使用。一次性小文件且需要随机字符串
处理时，可以先明确读取策略；二进制对象协议仍需自己定义字节格式。

## C++20 代表接口

```cpp
template<class CharT, class Traits = std::char_traits<CharT>>
class basic_ifstream : public std::basic_istream<CharT, Traits> {
public:
    basic_ifstream();
    explicit basic_ifstream(const char* path,
                            std::ios_base::openmode mode = std::ios_base::in);
    explicit basic_ifstream(const std::string& path,
                            std::ios_base::openmode mode = std::ios_base::in);
    bool is_open() const;
    void open(/* path */,
              std::ios_base::openmode mode = std::ios_base::in);
    void close();
};

using ifstream = basic_ifstream<char>;
```

这是学习用摘要；省略了析构、move、swap、`rdbuf()`、wchar alias 和部分路径重载。构造/
open 总把 `in` 加入 mode；filesystem path overload 从 C++17 起。

## 参数、返回与状态

路径指定外部文件，mode 控制 binary/ate 等附加行为。打开失败设置 `failbit`；成员 open 成功会
`clear()`。`is_open()` 只报告 filebuf 关联，不代表最近一次提取成功；读取 EOF 后文件通常仍 open，
但 stream Boolean 已可能为 false。实际读取应直接测试 `while (input >> value)` 或 getline。

## 复杂度

没有统一复杂度保证；成本取决于读取字符数、locale 转换、buffer 与文件系统。`is_open()` 的具体
实现成本和系统调用次数也不是页面可承诺合同。

## 异常与错误

打开、格式转换、EOF 和底层错误分别通过 `failbit`、`eofbit`、`badbit` 组合报告；默认不抛，异常
掩码匹配时可抛 `ios_base::failure`。close 失败设置 `failbit`。只查 `bad()` 会漏掉常见 failbit。

## 生命周期与失效规则

ifstream 拥有 filebuf；析构尝试关闭，move 转移文件关联，移后源不再关联原文件。close 后
`is_open()` 为 false。到 EOF 后若要 seek 重读，通常先 `clear()` 再 `seekg()`；clear 不移动文件
位置。多个独立流也不构成外部文件快照。

## 线程安全

同一 ifstream 的提取、定位、状态与 close 并发需要同步。不同 ifstream 有独立位置，但文件被其他
线程/进程修改时，标准不提供一致快照或记录顺序保证。

## 示例

第一个示例建立两条记录后以提取表达式为循环条件读取。第二个示例打开确定不存在的相对路径，
分别观察 filebuf 关联和流失败状态。

## 常见错误

- 写 `while (!eof())` 或 `while (is_open())`。
- 把 `is_open()` 等同于 stream Boolean。
- EOF 后不 clear 就直接 seek。
- 只检查打开，不检查后续读取与 close。
- 认为 binary mode 自动解决对象布局和 endian。

## 与 JavaScript 的区别

> Node `readFileSync` 一次返回 Buffer/string；ifstream 保持读取位置、格式设置和错误位，默认通过
> 状态而不是异常报告失败。它也不是异步 stream 或 Promise。

## 相关内容

头文件和 mode 地图阅读 `<fstream>`；整行读取使用 `std::getline`；生成输入文件或写结果使用
`std::ofstream`。

## 来源

open/close、状态、版本、生命周期与线程边界由 manifest 中的 Working Draft、N1146、N3337、
N4659、P0610R0 与 N4861 验证；cppreference 仅用于二级覆盖核对。
