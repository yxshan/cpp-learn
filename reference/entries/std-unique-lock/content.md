# `std::unique_lock`

`std::unique_lock<Mutex>` 是可移动的 RAII 锁所有者。与 `lock_guard` 相比，它额外保存“关联了哪个 mutex”和“当前是否拥有锁”两部分状态，因此能延迟加锁、尝试加锁、提前解锁、重新加锁或转移所有权。

## 快速信息

- 头文件：`<mutex>`
- 命名空间：`std`
- 标准：C++11 起
- 典型用途：条件变量等待、需要拆分临界区、转移锁所有权

## 什么时候使用

需要把 mutex 交给 `condition_variable::wait`，或者锁的取得与释放不严格等同于一个词法作用域时使用。若进入作用域就加锁并始终持有到末尾，`lock_guard` 更小也更清楚；一次取得多个 mutex 通常优先 `scoped_lock`。

不要仅因接口更丰富就默认使用它。手动 `unlock()` 会让后续代码是否受保护变得依赖控制流，必须明确每次访问共享状态时锁处于什么状态。

## C++20 代表接口

```cpp
template<class Mutex>
class unique_lock {
public:
  using mutex_type = Mutex;

  unique_lock() noexcept;
  explicit unique_lock(mutex_type& mutex);
  unique_lock(mutex_type& mutex, std::defer_lock_t) noexcept;
  unique_lock(mutex_type& mutex, std::try_to_lock_t);
  unique_lock(mutex_type& mutex, std::adopt_lock_t);

  template<class Clock, class Duration>
  unique_lock(mutex_type& mutex,
              const std::chrono::time_point<Clock, Duration>& timeout_time);
  template<class Rep, class Period>
  unique_lock(mutex_type& mutex,
              const std::chrono::duration<Rep, Period>& timeout_duration);

  ~unique_lock();
  unique_lock(unique_lock&& other) noexcept;
  unique_lock& operator=(unique_lock&& other);
  unique_lock(const unique_lock&) = delete;
  unique_lock& operator=(const unique_lock&) = delete;

  void lock();
  bool try_lock();
  void unlock();
  mutex_type* release() noexcept;
  bool owns_lock() const noexcept;
  explicit operator bool() const noexcept;
  mutex_type* mutex() const noexcept;
};
```

定时构造和 `try_lock_for` / `try_lock_until` 只在 `Mutex` 满足相应 TimedLockable 合同时可用。此处省略 `swap` 和非成员重载。

## 状态、参数与返回值

对象有三种重要状态：未关联 mutex；已关联但不拥有锁；已关联且拥有锁。默认构造得到未关联状态；普通构造调用 `lock()`；`defer_lock` 只建立关联；`try_to_lock` 尝试一次并通过 `owns_lock()` 报告结果；`adopt_lock` 不加锁，要求当前线程已经拥有该 mutex。

`lock()` 成功后拥有锁，`try_lock()` 返回是否取得锁，`unlock()` 释放锁但仍保留 mutex 关联。`mutex()` 返回关联 mutex 的指针，未关联时为 null。`release()` 返回该指针并清除关联和所有权标记，**不会调用 `unlock()`**；调用者从此必须自行完成解锁。移动构造把关联与所有权一起转给目标，源对象变为未关联状态。

## 复杂度与阻塞

标准没有为包装器规定独立的渐进复杂度。各操作至多转发一次对应的底层 mutex 操作；`lock()` 可以阻塞，`try_lock()` 不应阻塞，定时操作的等待精度和调度不保证严格实时。

## 异常与错误

底层 mutex 的锁操作异常会传播。对未关联对象调用 `lock()` 或 `try_lock()`，可抛错误码为 `operation_not_permitted` 的 `std::system_error`；已经拥有锁时再次锁定，可报告 `resource_deadlock_would_occur`；不拥有锁却 `unlock()`，可报告 `operation_not_permitted`。

`adopt_lock` 的“当前线程已经持有锁”是前置条件，不满足时不能指望得到可恢复异常。析构函数只有在 `owns_lock()` 为 true 时才调用底层 `unlock()`。

## 生命周期、失效与线程安全

`unique_lock` 不拥有 mutex 对象本身，只保存指针；只要仍有关联，mutex 就必须继续存活，包括“已解锁但尚未 release”的状态。移动会使源包装器失去关联，先前取得的锁由目标包装器负责。

不要从多个线程同时操作同一个 `unique_lock` 对象。保护的数据是否可安全访问取决于底层 mutex 的同步关系；包装器的存在并不保护未持锁区间。用于条件变量等待时，wait 会原子地释放底层锁并阻塞，返回前重新取得它。

## 示例

第一个示例用 `defer_lock` 建立关联，再显式加锁、解锁和重新加锁。第二个示例验证 `release()` 不会解锁 mutex：竞争线程仍无法取得锁，原 owner 最后通过返回的指针显式解锁。

## 常见错误

- 把 `release()` 误解为“释放 mutex”，造成永不解锁。
- 对默认构造或已移动的对象调用 `lock()`。
- `unlock()` 后直接访问共享数据，却忘记临界区已经结束。
- 未持锁时使用 `adopt_lock`。
- 让关联的 mutex 先于包装器销毁。
- 认为 `try_lock()` 失败表示 mutex 永远不可用。
- 在 condition variable 的 wait 返回后不重新检查谓词。

## 与 JavaScript 的区别

> JavaScript Promise 可以把异步流程的“继续执行权”传给下一个回调，但它不代表共享内存 mutex 的所有权。`unique_lock` 的 move、unlock 和 release 都改变真实同步状态；它更接近一个必须线性移交、且由作用域清理的资源令牌。

## 相关内容

底层锁见 `std::mutex`；固定作用域锁见 `std::lock_guard`；同时取得多个锁见 `std::scoped_lock`；等待共享状态变化见 `<condition_variable>` 与 `std::condition_variable`。

## 来源

三态模型、构造策略、移动、release、异常与析构合同由 manifest 中的 `[thread.lock.unique]`、N3337 与 N4861 验证；cppreference 中文页用于二级覆盖与术语核对。
