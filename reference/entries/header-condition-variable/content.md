# `<condition_variable>`

`<condition_variable>` 提供“在谓词为假时休眠、状态可能改变时被通知”的线程同步设施。通知本身不保存状态；可靠协议必须把共享状态放在 mutex 保护下，并在每次唤醒后重新检查谓词。

## 快速信息

- 直接包含：`#include <condition_variable>`
- 命名空间：`std`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用条件变量实体时直接写 `#include <condition_variable>`。锁类型另由 `<mutex>` 提供，线程由 `<thread>` 提供；不要依赖任一实现恰好通过其他头文件传递包含 `<condition_variable>`。

## C++20 主要设施

| 实体 | 用途 | 版本边界 |
|---|---|---|
| `condition_variable` | 只与 `unique_lock<mutex>` 配合的高效条件变量 | C++11 |
| `condition_variable_any` | 可与满足 BasicLockable 的用户锁类型配合 | C++11 |
| `cv_status` | 定时等待结果：`timeout` 或 `no_timeout` | C++11 |
| `notify_all_at_thread_exit` | 在线程退出、锁释放后通知所有等待者 | C++11 |
| `condition_variable_any` 的 stop-token 等待 | 可停止的谓词等待 | C++20 |

`cv_status::no_timeout` 只表示等待并非因超时返回，不保证业务谓词已经为 true。非谓词定时等待仍可能伪唤醒。

## 选择与协议

通常优先 `condition_variable` 与 `unique_lock<mutex>`。只有锁类型不是 `std::mutex`，或确实需要 `condition_variable_any` 的 C++20 stop-token 重载时，才承担更通用抽象可能带来的额外成本。

推荐协议是：持有同一 mutex 修改状态；解锁后或仍持锁时发送通知；等待者以同一 mutex 构造 `unique_lock`，并调用带谓词的 `wait`。谓词才是事实来源，通知只是提示重新检查。

`notify_all_at_thread_exit(condition, std::move(lock))` 接管一个已持锁的 `unique_lock<mutex>`。调用线程退出时，它先完成受保护线程局部对象相关的退出阶段并释放锁，再通知等待者；移入后不要再使用原 lock 管理该 mutex。

## 返回、复杂度与异常

`notify_one` / `notify_all` 和普通 `wait` 返回 `void`；谓词 wait 返回时谓词为 true；定时谓词等待返回最终谓词值。标准不规定唤醒选择、公平性、固定等待时长或渐进复杂度，`notify_all` 后的线程还要重新竞争 mutex。

构造条件变量可能抛 `std::system_error`；`condition_variable_any` 的内部资源还可能导致 `std::bad_alloc`。等待过程中锁的 `unlock()` / `lock()` 异常按具体接口合同处理。对 `condition_variable`，若 wait 结束时无法重新取得 mutex 并满足后置条件，程序调用 `std::terminate`。

## 生命周期与线程安全

同一个 condition variable 的 wait 三阶段与 notify 操作存在一条专属全序，但通知不是缓冲消息：在通知之后才开始等待的线程不会“消费旧通知”。只要谓词已写入共享状态，它仍可在首次检查时直接继续。

销毁条件变量前必须确保没有线程仍阻塞其上，也没有线程可能新进入 wait。销毁共享状态、mutex、condition variable 和工作线程时，应使用 join 或其他生命周期协议明确排序。

## 示例

第一个示例让工作线程把锁和通知责任交给 `notify_all_at_thread_exit`，主线程用谓词等待完成状态。第二个示例展示 `condition_variable_any` 可与 `recursive_mutex` 配合；两者都不依赖 sleep 或输出顺序。

## 常见错误

- 把通知当作可累计事件，先 notify 后才无条件 wait。
- 不在同一 mutex 下读写谓词，造成 data race 或丢失协议关系。
- 用 `if` 加无谓词 wait，而不是循环重查状态。
- 认为 `no_timeout` 等于谓词成立。
- 多个等待者对同一 condition variable 使用不同 mutex。
- 条件变量销毁时仍有线程等待或准备等待。
- 依赖 `notify_one` 选择某个特定线程或 `notify_all` 的唤醒顺序。

## 与 JavaScript 的区别

> JavaScript Promise 会保存 fulfilled/rejected 状态，之后注册的回调仍能观察结果；condition variable 的通知本身不保存。C++ 中需要由 mutex 保护的谓词承担“状态”，wait 只是高效地在状态不满足时释放锁并休眠。

## 相关内容

具体等待接口见 `std::condition_variable`；所需锁所有者见 `std::unique_lock`；mutex 设施见 `<mutex>`；线程生命周期见 `std::thread`。

## 来源

设施地图、直接包含、等待/通知模型、线程退出通知和版本边界由 manifest 中的 `[thread.condition]`、N3337 与 N4861 验证；cppreference 中文页用于二级覆盖核对。
