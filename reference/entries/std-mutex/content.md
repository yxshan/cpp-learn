# `std::mutex`

`std::mutex` 是不可复制、不可移动、非递归的独占互斥量。它用 lock/unlock 建立临界区和跨线程可见性，但不会自动把“应该受保护的状态”与 mutex 绑定。

## 快速信息

- 头文件：`<mutex>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权：同一时刻至多一个线程

## 什么时候使用

多个线程需要一起维护不能由单个原子操作表达的不变量时使用。日常代码通常不直接手写配对的 lock/unlock，而是让 `lock_guard`、`unique_lock` 或 `scoped_lock` 管理异常路径。

同一线程需要重复进入时不要误用普通 mutex；先检查设计是否可消除重入，再考虑 `recursive_mutex`。读多写少也不意味着普通 mutex 一定不合适，应先以清晰正确为基线再测量。

## C++20 代表接口

```cpp
class mutex {
public:
  constexpr mutex() noexcept;
  ~mutex();

  mutex(const mutex&) = delete;
  mutex& operator=(const mutex&) = delete;

  void lock();
  bool try_lock();
  void unlock();
};
```

此处省略 implementation-defined native handle。

## 操作与返回

`lock()` 阻塞直到获得所有权并返回 `void`。`try_lock()` 不等待：成功持有锁并返回 true，否则返回 false；即使当时无人持锁也允许偶发失败，所以 false 只表示“这次没有取得”。`unlock()` 释放当前线程持有的所有权并返回 `void`。

同一线程再次 `lock()` 普通 mutex 违反非递归前置条件，可能死锁；不是 owner 却 unlock 同样违反前置条件。

## 复杂度、公平与进度

标准没有为这些操作规定渐进复杂度、FIFO 顺序、公平性或等待上限。竞争线程可能长期等待；业务需要取消、超时或公平队列时要选择不同抽象并明确合同。

## 异常与错误

`lock()` 需要报告错误时抛 `std::system_error`，包括不允许操作或检测到潜在自死锁。`try_lock()` 与 `unlock()` 的基础 mutex 合同不抛异常，但错误前置条件仍不能当成可恢复分支。

销毁仍被任何线程持有的 mutex，或让线程在仍持有 mutex 时结束，行为未定义。

## 生命周期、同步与线程安全

同一 mutex 上的 lock/unlock 处于单一总顺序；一次 unlock 同步于之后成功取得同一 mutex 的 lock，以及返回 true 的 try_lock。失败的 try_lock 不建立同步关系。

mutex 必须先完整构造并发布给线程，并活过所有使用者。保护的是程序约定的临界区：绕开同一 mutex 访问共享非原子对象仍可能产生 data race。

## 示例

第一个示例让主线程在持锁时写入 41，worker 成功取得同一 mutex 后递增，并在 join 后输出 42，直接展示 unlock-to-lock 可见性。第二个示例让主线程持锁直至竞争线程的 try_lock 完成，因此 false 不依赖调度时机。

## 常见错误

- lock 后在异常或早返回路径忘记 unlock。
- 同一线程重复锁定普通 mutex。
- 非 owner 解锁，或销毁仍被持有的 mutex。
- 认为失败的 try_lock 证明另一个线程一定持锁。
- 认为 mutex 保证公平或按等待顺序唤醒。
- 只给写操作加锁，却无锁读取同一普通对象。
- 用不同 mutex 保护同一不变量的不同入口。

## 与 JavaScript 的区别

> 普通 JS 对象通常由一个 event-loop 线程访问，不需要为每次属性更新放 mutex；C++ 共享普通对象可以被多个执行线程同时访问。`Atomics` 只适用于 SharedArrayBuffer 上的特定原子操作，也不等同于能保护任意 C++ 对象不变量的 mutex。

## 相关内容

设施地图见 `<mutex>`；简单异常安全作用域使用 `std::lock_guard`；产生并 join 竞争线程阅读 `std::thread`。

## 来源

非递归所有权、错误、生命周期与同步关系由 manifest 中的 mutex requirements、class mutex、`[intro.multithread]`、N3337 与 N4861 验证；cppreference 仅用于二级覆盖核对。
