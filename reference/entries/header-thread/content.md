# `<thread>`

`<thread>` 提供直接管理线程执行的低层设施。它不是任务队列、线程池或 JavaScript event loop；创建多少线程、如何取消工作以及如何传播结果和异常，仍由程序设计决定。

## 快速信息

- 直接包含：`#include <thread>`
- 主要命名空间：`std`、`std::this_thread`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用 `std::thread`、`std::jthread` 或 `std::this_thread` 操作时直接包含 `<thread>`。互斥设施另行包含 `<mutex>`，输出另行包含 `<iostream>`；不要依赖实现偶然提供的传递包含。

## C++20 主要设施

| 实体组 | 用途 | 版本边界 |
|---|---|---|
| `std::thread`、`std::thread::id` | 启动线程并显式 join 或 detach | C++11 |
| `std::this_thread::get_id`、`yield`、`sleep_for`、`sleep_until` | 操作当前线程 | C++11 |
| `std::jthread` | 析构时请求停止并 join 的线程句柄 | C++20 |
| `std::stop_token` 协作停止模型 | 给 `jthread` 工作函数传递停止请求 | C++20；主要声明位于 `<stop_token>` |

当前工作草案还包含晚于 C++20 的线程属性；不能把最新版 synopsis 整段当成 C++20 接口。

## 什么时候选择

需要明确拥有一个执行线程的句柄并控制 join 时使用 `thread`。标准不要求它与某种 OS 线程模型一一对应。C++20 工具链完整支持且任务能协作检查停止请求时优先评估 `jthread`。大量短任务通常应交给受控线程池或更高层执行器，而不是为每个任务直接创建线程。

`sleep_for` 只让当前线程至少等待一段时间，不提供数据同步；共享状态仍使用 mutex、atomic 或其他同步设施。

## 共同复杂度、错误与同步边界

标准不保证创建成本、调度公平性、唤醒精度或 `hardware_concurrency()` 的准确性。线程创建和 join 等操作可报告 `std::system_error`；线程入口函数若让异常逃逸，会调用 `std::terminate`。

启动线程与成功 `join()` 建立规定的同步关系，但对同一个线程句柄并发调用成员本身不会自动安全。detach 会切断句柄所有权，也不会替捕获的引用延长生命周期。

## 示例

第一个示例让两个工作线程只写不同数组元素，join 后再按固定顺序汇总。第二个示例只比较规范保证的线程 ID 关系，不输出其实现定义的文本形式；join 后句柄恢复为空 ID。两者都不输出调度顺序或耗时。

## 常见错误

- 让仍为 joinable 的 `thread` 离开作用域。
- 把 detach 当成“后台自动安全管理”，留下悬空引用。
- 从线程入口抛出异常，期待创建线程自动捕获。
- 依赖 `hardware_concurrency()` 非零或等于可安全创建的线程数。
- 用 sleep 猜测另一个线程已经完成，而不是 join 或同步。
- 把当前草案的线程属性误写成 C++20 接口。

## 与 JavaScript 的区别

> JavaScript `async`/`await` 和 Promise 通常不会创建可共享普通对象内存的 OS 线程；Web Worker 更接近独立执行者，但主要通过消息传递。C++ `thread` 可以直接并发访问同一内存，因此也会直接暴露 data race、对象生命周期和同步可见性问题。

## 相关内容

线程句柄合同阅读 `std::thread`；共享数据保护从 `<mutex>`、`std::mutex` 和 `std::lock_guard` 开始。`std::jthread` 会在本地标准库真正支持其 C++20 接口后再提供独立可运行页面。

## 来源

设施地图、版本和线程同步合同由 manifest 中的 Working Draft、N3337、P0660R10 与 N4861 验证；cppreference 仅用于二级覆盖和信息架构核对。
