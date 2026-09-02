# `<mutex>`

`<mutex>` 提供互斥量、RAII 锁包装器和同时协调多个锁的算法。它解决共享状态的互斥访问，不会自动设计锁粒度、避免所有死锁或保证线程公平。

## 快速信息

- 直接包含：`#include <mutex>`
- 命名空间：`std`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用 `std::mutex`、锁包装器或 `std::lock` 时直接包含 `<mutex>`。创建线程另含 `<thread>`，输出另含 `<iostream>`；不要依赖其他头文件对 `<mutex>` 的传递包含。

## C++20 主要设施

| 实体组 | 用途 | 版本边界 |
|---|---|---|
| `mutex`、`recursive_mutex` | 独占互斥 | C++11 |
| `timed_mutex`、`recursive_timed_mutex` | 带超时的独占互斥 | C++11 |
| `lock_guard` | 不可移动的简单作用域锁 | C++11 |
| `unique_lock` | 可移动、可延迟及可手动解锁的锁所有者 | C++11 |
| `scoped_lock` | 同时持有一个或多个锁 | C++17 |
| `lock`、`try_lock` | 协调多个 Lockable 对象 | C++11 |

## 什么时候选择

只有一个临界区且进入后始终持锁到作用域末尾时，优先 `lock_guard`。需要延迟加锁、条件变量等待、移动所有权或提前解锁时使用 `unique_lock`。需要一次取得多个 mutex 时使用 `scoped_lock` 或 `std::lock`，不要手写相反锁序。

若状态可以用单个原子操作表达，评估 `<atomic>`；不要因为 mutex 直观就把长耗时 I/O、回调或未知代码全部包进临界区。

## 共同复杂度、错误与生命周期边界

标准不保证锁获取的渐进复杂度、FIFO、公平性或等待上限。底层 lock 操作可抛 `std::system_error`；错误使用 `adopt_lock`、非 owner 解锁、销毁仍被持有的 mutex 或让线程持锁结束，都不是 RAII 能自动修复的正常业务分支。

一次 unlock 同步于之后成功获得同一 mutex 的 lock，提供被保护写入的可见性。锁包装器必须比所引用 mutex 更短命；同时操作同一个包装器对象也需要外部同步。

## 示例

第一个示例让两个线程竞争同一 `once_flag`，只观察一次初始化的最终结果。第二个示例让两个线程以相反参数顺序交给 `scoped_lock`，不观察锁取得顺序；所有结果都在 join 后输出。

## 常见错误

- 临时构造 `std::lock_guard{mutex}`，完整表达式结束就立即解锁。
- 同一线程再次锁定非递归 mutex。
- 多处用不同顺序手工取得两个 mutex。
- 持锁调用未知回调或执行阻塞 I/O。
- 把 mutex 当成数据本身；仍有绕过锁的访问路径。
- 锁包装器比底层 mutex 活得更久。
- 认为 mutex 保证公平或先等待者先获得。

## 与 JavaScript 的区别

> 普通浏览器 JavaScript 常依赖单线程 event loop，Promise 不会让一段同步代码同时执行；C++ 多线程可以真正并发读写同一对象。Web Locks API 的“命名锁”也不是 `std::mutex` 对象，生命周期、调度和共享内存合同不能互换。

## 相关内容

底层非递归独占锁阅读 `std::mutex`；简单作用域所有权阅读 `std::lock_guard`；创建并 join 执行线程阅读 `<thread>` 与 `std::thread`。

## 来源

设施地图、版本、互斥同步和多锁接口由 manifest 中的 Working Draft、N3337、P0156R2 与 N4861 验证；cppreference 仅用于二级覆盖核对。
