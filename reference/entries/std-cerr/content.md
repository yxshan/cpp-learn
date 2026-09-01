# `std::cerr`

`std::cerr` 是与 C `stderr` 关联的预定义窄字符输出流，适合与正常结果分离的诊断信息。它有更
积极的刷新初始设置，但不是结构化日志、记录原子性或持久化保证。

## 快速信息

- 头文件：`<iostream>`
- 类型：`std::ostream`
- 命名空间：`std`
- 标准：C++98 起；tie-to-cout 合同由缺陷报告追溯修正

## 什么时候使用

命令行工具希望调用者分别重定向正常结果和错误诊断时使用 `cerr`。需要并发整条记录不交错、稳定
字段、日志级别或落盘策略时，应使用专门日志设施；普通结果继续写 `std::cout`。

## 代表性声明与初始状态

```cpp
namespace std {
extern ostream cerr;
}
```

标准流初始化后，`cerr.flags() & ios_base::unitbuf` 非零，且 `cerr.tie() == &cout`。输出 sentry
会先刷新 tied stream；操作结束时 unitbuf 通常请求同步关联 buffer。程序可以修改 flags、tie 或
rdbuf，所以这些是初始化合同，不是不可变属性。

## 输出、状态与复杂度

格式化输出把字符交给关联 stream buffer。失败可设置 `badbit`/`failbit`；默认异常掩码不抛，若
对应位加入 `exceptions()`，操作可以抛 `ios_base::failure`。标准没有统一复杂度或系统调用次数
保证；成本取决于格式化、locale、buffer 和外部设备。

unitbuf 不等于“每个字符直接系统调用”，也不保证 flush 后断电持久。默认 cerr 上再频繁使用
`std::endl` 往往只是重复请求刷新。

## 生命周期与失效规则

`cerr` 在进入 `main` 前可用，程序执行期间不销毁。替换 `rdbuf()` 返回旧 buffer 指针；新 buffer
及旧 buffer 都必须在恢复/使用期间存活。全局重定向会影响整个进程，不应在无同步并发范围修改。

## 线程安全

同步的标准 iostream 对象允许并发 formatted/unformatted I/O 而不产生 data race，但字符仍可
交错，多段 `<<` 不组成原子日志记录。`sync_with_stdio(false)` 改变与 C stream 的同步关系；记录
级完整性仍需外部同步、先组装后写入，或评估 C++20 `<syncstream>`。

## 示例

第一个示例只查询标准初始属性。第二个示例用局部 RAII guard 临时替换 `cerr` 的 buffer，恢复后
再把捕获结果写到 stdout；它不把全局重定向推广为并发安全方案。

## 常见错误

- 把 unitbuf 解释成“完全无缓冲”或每字符一次系统调用。
- 认为 `cerr` 与 `clog` 必然连接不同设备。
- 假定多线程链式输出是一条不可分割记录。
- 每行都用 `endl`，重复刷新。
- 修改 flags/tie/rdbuf 后仍假定初始合同存在。

## 与 JavaScript 的区别

> `console.error()` 可以类比诊断通道，但宿主没有 C++ 的 unitbuf、tie、iostate 与异常掩码合同。
> 两者都不应直接替代结构化、并发安全的生产日志组件。

## 相关内容

正常结果阅读 `std::cout`；标准对象声明阅读 `<iostream>`。需要先组装一条消息时可使用
`<sstream>`，但仍要设计最终写入的同步边界。

## 来源

对象关联、unitbuf/tie、sentry 刷新、生命周期与标准流线程特例由 manifest 中的 Working Draft、
N1146、N1905 与 N4861 验证；cppreference 仅用于二级结构核对。
