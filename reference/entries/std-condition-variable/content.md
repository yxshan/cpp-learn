# `std::condition_variable`

`std::condition_variable` 让线程在等待共享状态时原子地“释放 mutex 并阻塞”，在被通知或伪唤醒后重新取得同一 mutex，再检查状态。它只能与 `std::unique_lock<std::mutex>` 配合。

## 快速信息

- 头文件：`<condition_variable>`
- 命名空间：`std`
- 标准：C++11 起
- 核心规则：等待条件必须由共享谓词表达，通知本身不保存状态

## 什么时候使用

线程要等待队列非空、初始化完成、任务结束或容量可用等复合状态时使用。若只需一个无需阻塞的独立数值操作，可先评估 atomic；若需要任意 BasicLockable 类型，使用 `condition_variable_any`。

设计时先写清谓词，例如 `ready` 或 `!queue.empty()`，再确定唯一保护它的 mutex。发送者在该 mutex 下修改谓词；等待者用同一 mutex 和带谓词 wait。这样无论通知先到、后到或出现伪唤醒，正确性都来自状态检查。

## C++20 代表接口

```cpp
class condition_variable {
public:
  condition_variable();
  ~condition_variable();
  condition_variable(const condition_variable&) = delete;
  condition_variable& operator=(const condition_variable&) = delete;

  void notify_one() noexcept;
  void notify_all() noexcept;

  void wait(std::unique_lock<std::mutex>& lock);
  template<class Predicate>
  void wait(std::unique_lock<std::mutex>& lock, Predicate predicate);

  template<class Clock, class Duration>
  cv_status wait_until(
      std::unique_lock<std::mutex>& lock,
      const std::chrono::time_point<Clock, Duration>& timeout_time);
  template<class Rep, class Period>
  cv_status wait_for(
      std::unique_lock<std::mutex>& lock,
      const std::chrono::duration<Rep, Period>& timeout_duration);
};
```

`wait_until` 和 `wait_for` 另有返回 `bool` 的谓词重载；此处省略 native handle。上方采用 C++20 最终工作草案 N4861 的 const-reference 时间参数；当前工作草案已将这些参数改为按值传递，因此阅读更新标准的签名时会看到差异。

## 参数、返回与等待过程

传给 wait 的 lock 必须关联并拥有一个 `std::mutex`。对同一个 condition variable 并发等待的线程必须使用同一个 mutex。无谓词 `wait(lock)` 等价于一次“原子释放并阻塞—唤醒—重新加锁”，可以伪唤醒；谓词版本等价于 `while (!predicate()) wait(lock);`。

`notify_one()` 解除某一个阻塞等待者的阻塞，选择未指定；`notify_all()` 解除当时所有阻塞等待者的阻塞。它们返回 `void`，不要求调用线程持有 mutex。通知后，等待者仍须重新取得 mutex 才能从 wait 返回。

无谓词定时等待返回 `cv_status::timeout` 或 `cv_status::no_timeout`；谓词定时等待返回结束时谓词是否为 true。超时不是精确定时器，也不应被用作内存可见性协议。

## 复杂度、顺序与进度

标准没有规定 wait/notify 的渐进复杂度、公平性、唤醒次序或等待上限。每个 condition variable 的 notify 与每次 wait 的“解锁并阻塞、唤醒、重新加锁”阶段处于一条单独全序中，但这不把通知变成可缓存事件。

`notify_all` 可能造成大量线程同时竞争同一 mutex；只需一个线程消费一项工作时通常使用 `notify_one`，状态变化可能让所有等待者成立时再考虑 `notify_all`。

## 异常与错误

构造可抛 `std::system_error`。等待调用会执行 mutex 的 unlock 和 lock；若无法满足返回时 `lock.owns_lock() == true` 且该 mutex 被当前线程持有的后置条件，程序调用 `std::terminate`。

传入不拥有 mutex 的 lock，或同一 condition variable 的并发等待者使用不同 mutex，违反前置条件并导致未定义行为。谓词抛出的异常会从谓词 wait 传播，但 lock 的最终状态仍要满足接口规定。

## 生命周期、失效与线程安全

condition variable 不拥有谓词状态、mutex 或等待线程。析构前必须确保没有线程仍阻塞在它上面，并通过生命周期协议阻止新的 wait。常见顺序是：在锁下设置停止谓词，notify_all，join 全部工作线程，然后销毁 condition variable 与 mutex。

修改谓词和读取谓词都必须遵守同一 mutex 协议，即使字段本身是 atomic 也不要随意拆开一套已经依赖 mutex 的条件协议。wait 返回时 unique_lock 仍拥有锁；可在锁下安全读取状态，再主动解锁以缩小后续临界区。

## 示例

第一个示例展示通知可先于等待者真正阻塞：谓词保存状态，等待者仍能观察 `ready`。第二个示例用 `notify_all` 唤醒两个订阅者，但只在全部 join 后排序并输出结果，不依赖实际唤醒顺序。

## 常见错误

- 不带谓词地只调用一次 wait，忽略伪唤醒。
- 在 mutex 外写谓词，造成 data race 或破坏发布关系。
- 把一次 notify 当作以后可消费的消息。
- 假设 notify_one 会唤醒最早等待或指定线程。
- 认为 wait 返回时 mutex 仍未锁定。
- 多个等待者为同一个 condition variable 使用不同 mutex。
- 仅依赖 sleep 让线程“应该已经开始等待”。
- 销毁 condition variable 时仍有潜在等待者。

## 与 JavaScript 的区别

> Promise 把完成状态和结果保存在对象中，`await` 不需要用户提供 mutex；condition variable 只发送重新检查信号，状态与互斥协议必须由程序显式维护。它更接近“等待某个共享谓词”，而不是 C++ 版 Promise。

## 相关内容

头文件设施地图见 `<condition_variable>`；wait 所需的可移动锁见 `std::unique_lock`；底层互斥量见 `std::mutex`；等待线程的 join 生命周期见 `std::thread`。

## 来源

等待三阶段、参数前置条件、伪唤醒、返回值、全序与生命周期合同由 manifest 中的 `[thread.condition.condvar]`、N3337 与 N4861 验证；cppreference 中文页用于二级覆盖核对。
