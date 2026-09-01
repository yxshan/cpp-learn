# `std::getline`

`std::getline` 从字符输入流提取到分隔符为止的字符，写入现有 `std::string`，并消费但不保存分隔
符。它是保留空格和行边界的基础接口，不负责把行内容转换成业务类型。

## 快速信息

- 直接头文件：`<string>`
- 命名空间：`std`
- 标准：C++98 起；rvalue stream overload 从 C++11 起
- 默认分隔符：`input.widen('\n')`

## 什么时候使用

需要完整姓名、命令或配置行时使用 getline。空白分隔 token 更适合 `operator>>`；二进制帧、长度
前缀协议或需要精确错误位置的解析器不应把“换行”当成完整协议。

## C++20 代表声明

```cpp
template<class CharT, class Traits, class Allocator>
std::basic_istream<CharT, Traits>& getline(
    std::basic_istream<CharT, Traits>& input,
    std::basic_string<CharT, Traits, Allocator>& text,
    CharT delimiter);

template<class CharT, class Traits, class Allocator>
std::basic_istream<CharT, Traits>& getline(
    std::basic_istream<CharT, Traits>& input,
    std::basic_string<CharT, Traits, Allocator>& text);
```

另有 rvalue stream overload，返回类型仍是 stream 引用。

## 参数、提取与前置条件

在 sentry 允许读取后，函数先清空 `text`，再逐字符提取，直到 EOF、delimiter 或
`text.max_size()`。delimiter 被消费但不追加。只读到 delimiter 的空行仍算提取了一个字符；若
完全没有提取字符则设置 `failbit`。调用前 stream 已失败时，sentry 可能阻止后续步骤，不能承诺
目标 string 无条件先被清空。

## 返回值与状态

返回 `input` 引用，所以可写 `while (std::getline(input, line))`。最后一行即使没有换行，只要已
提取字符仍可成功处理并设置 `eofbit`。string 版非成员 getline **不更新 `gcount()`**；不要把
遗留值当行长。

## 复杂度

没有独立大 O 合同；工作随检查和追加的字符数以及 string 可能发生的分配增长。外部设备等待、
locale 和 stream buffer 成本也属于实际运行时间。

## 异常与错误

达到 max_size 或没有提取字符会设置 `failbit`，底层错误可设置 `badbit`。默认通过状态报告；状态
位与 `exceptions()` 掩码相交时可抛 `ios_base::failure`。string 分配也可能抛异常。

## 生命周期与失效规则

每次成功读取都会修改目标 string，因此此前指向其字符的指针、引用或迭代器按 string 修改规则
处理。函数不保存 input 或 string 引用。delimiter 和已消费字符从 stream 序列中移除。

## 线程安全

同一普通 stream 或同一目标 string 的并发读写需要同步。一次返回成功不冻结后续输入位置；检查
状态与下一次读取也不是跨线程原子事务。

## 示例

第一个示例逐行读取两行。第二个示例在格式化读取整数后用带上限的 `ignore` 丢弃剩余行，再读取
完整姓名，并证明 getline 没有改变 `ignore` 留下的 `gcount()`。

## 常见错误

- 认为返回值是 string 或字符数。
- 认为 delimiter 会保存在结果中。
- 用 `gcount()` 读取行长度。
- 在 `>>` 后直接 getline，意外消费残留换行得到空行。
- 一概使用 `std::ws`，从而吞掉本来有意义的空行。
- 写 `while (!input.eof())` 而不是测试读取表达式。

## 与 JavaScript 的区别

> Node readline 或字符串 `split` 可以类比记录边界；getline 是同步地消费有状态 C++ stream，并
> 写入现有 string。它不返回 Promise，也不把所有失败折叠成 `undefined`。

## 相关内容

控制台整行输入结合 `std::cin`；内存文本示例使用 `<sstream>`/`std::stringstream`。目标对象的
拥有与失效规则继续阅读 `std::string`。

## 来源

提取顺序、delimiter、状态、返回引用、gcount 与生命周期由 manifest 中的 Working Draft、N1146、
N1350 和 N4861 验证；cppreference 仅用于二级结构核对。
