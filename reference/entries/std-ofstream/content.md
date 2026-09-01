# `std::ofstream`

`std::ofstream` 拥有面向输出的文件缓冲，并复用 `std::ostream` 的格式、状态和异常模型。默认模式
会创建或截断文件；保留旧内容需要明确选择追加策略。

## 快速信息

- 头文件：`<fstream>`
- 命名空间：`std`
- 标准：C++98 起；string 路径/move C++11，filesystem path C++17
- 默认模式：`ios_base::out`，通常创建或截断

## 什么时候使用

需要同步、流式写文本或已定义字节格式时使用。并发日志、原子替换、事务提交或断电耐久需要更
高层协议；binary mode 也不会自动形成可移植序列化。

## C++20 代表接口

```cpp
class basic_ofstream : public basic_ostream<CharT, Traits> {
public:
    basic_ofstream();
    explicit basic_ofstream(const char* path,
                            ios_base::openmode mode = ios_base::out);
    explicit basic_ofstream(const std::string& path,
                            ios_base::openmode mode = ios_base::out);
    bool is_open() const;
    void open(/* path */, ios_base::openmode mode = ios_base::out);
    void close();
};
```

构造/open 总加入 `out`。默认 out 截断；`app` 每次写前定位末尾，`ate` 只在打开后定位一次。

## 参数、返回与状态

路径指定文件，mode 控制截断、追加和 binary。`is_open()` 报告关联，不保证最近写入、flush 或
close 成功。输出表达式返回 stream 引用，可链式写入，但每一段仍可能改变状态。

## 复杂度

没有统一复杂度保证；成本取决于字符数、格式化、locale、buffer 和文件系统。flush 不承诺一次
系统调用或断电耐久。

## 异常与错误

打开失败设置 `failbit`，写/同步失败可设置 `badbit`/`failbit`；默认不抛，异常掩码匹配时可抛
`ios_base::failure`。close 失败也设置 failbit。重要输出应显式 close 并在对象仍可检查时验证。

## 生命周期与失效规则

ofstream 拥有 filebuf；析构尝试 close 但吞掉析构异常，move 转移文件关联。close 后不再关联文件。
RAII 保证资源清理尝试，不保证调用者观察到最终写入错误。

## 线程安全

同一 ofstream 的写、flush、状态与 close 并发需要同步。多个 `app` 流也不使多段 `<<` 成为原子
记录，外部文件的顺序和一致性需要额外协议。

## 示例

第一个示例默认写入、显式 close/check 后读回。第二个示例先截断写首行，再用 `app` 追加次行，
证明它与 `ate` 的一次性定位不同。

## 常见错误

- 忘记默认 out 会截断旧文件。
- 把 `ate` 当成追加保护。
- 只检查打开，不检查写、flush 或 close。
- 把 flush 当成事务或持久化提交。
- 直接 binary 写对象布局并称为可移植格式。

## 与 JavaScript 的区别

> Node `writeFileSync` 与 append flag 可类比覆盖和追加；ofstream 仍有 locale、格式状态、持久错误
> 位与 RAII close。它不是 Promise，也不自动提供原子替换或耐久性。

## 相关内容

mode 与设施地图阅读 `<fstream>`；读回文件使用 `std::ifstream`；普通标准输出使用 `std::cout`。

## 来源

默认 mode、open/close、状态、生命周期和线程边界由 manifest 中的 Working Draft、N1146、N3337
与 N4861 验证；cppreference 仅用于二级覆盖核对。
