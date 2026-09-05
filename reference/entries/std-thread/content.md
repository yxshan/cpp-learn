# `std::thread`

`std::thread` 是一个独占线程句柄：成功构造后代表一个新执行线程，所有权可以移动，但不能复制。它不会保存线程函数的返回值，也不会在普通析构时自动等待。

## 快速信息

- 头文件：`<thread>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权终点：成功 `join()` 或 `detach()`

## 什么时候使用

需要直接控制一个线程的启动与 join，并愿意显式设计结果、异常和取消通道时使用。C++20 且标准库支持完整时，可评估析构自动请求停止并 join 的 `std::jthread`；大量小任务通常选择线程池或任务抽象。

不要为了“异步一下”就 detach。无法证明捕获数据、所属对象和进程资源都活到后台线程结束时，detach 很容易制造悬空访问和不可观察失败。

## C++20 代表接口

```cpp
class thread {
public:
  class id;

  thread() noexcept;

  template<class F, class... Args>
  explicit thread(F&& f, Args&&... args);

  ~thread();
  thread(const thread&) = delete;
  thread(thread&& other) noexcept;
  thread& operator=(const thread&) = delete;
  thread& operator=(thread&& other) noexcept;

  bool joinable() const noexcept;
  void join();
  void detach();
  id get_id() const noexcept;
  static unsigned int hardware_concurrency() noexcept;
};
```

此处省略 `swap`、native handle 和非成员操作。晚于 C++20 的线程属性不属于本页基线。

## 参数、调用与返回

C++20 构造器要求 callable 与各参数的 decay 后类型能分别从对应转发实参构造，并且 decay 后的 callable 能以 decay 后的参数调用。它在创建线程中完成这些参数实体化，再在新线程中调用副本；实体化或复制/移动抛出的异常留在创建线程，新的执行线程尚未开始。需要传引用时显式使用 `std::ref`，并保证被引用对象寿命。线程函数返回值会被忽略，需要结果时写入受同步保护的状态、使用 future/promise 或其他通道。

`joinable()` 表示句柄当前代表一个尚未 join/detach 的线程；底层线程即使已经执行完，句柄在 join 前仍可 join。`join()` 和 `detach()` 返回 `void`。`hardware_concurrency()` 只是提示，无法确定时允许返回 0。

## 复杂度与调度

标准没有规定线程创建、join、detach 的渐进复杂度、调度顺序、公平性或固定资源成本。不能从启动顺序推断完成顺序，也不能用 sleep 建立正确性。

## 异常与错误

参数实体化失败会传播对应构造异常；无法创建线程时构造器抛 `std::system_error`，典型错误为 `resource_unavailable_try_again`。`join()` 可报告自 join 导致的 `resource_deadlock_would_occur`、无效线程或不可 join；`detach()` 也会拒绝无效或不可 detach 的句柄。

线程入口的未捕获异常会调用 `std::terminate`，不会自动传播给创建线程。析构或移动赋值覆盖一个仍为 joinable 的句柄同样调用 `std::terminate`。

## 生命周期、同步与线程安全

构造完成同步于新线程开始调用 callable；被 join 线程的完成同步于成功 `join()` 返回。因此示例可以在 join 后读取工作线程写入的普通变量。detach 没有这条 join 同步边，且不会延长引用、指针或 `this` 的生命周期。

移动只转移句柄所有权，不移动执行线程。移出对象、默认对象以及成功 join/detach 后的对象不再代表线程。对同一个 `thread` 对象并发调用成员没有内建同步。

## 示例

第一个示例让工作线程写入结果，join 后再读取并观察句柄状态。第二个示例移动句柄并只由新 owner join；所有输出都发生在主线程，避免调度顺序影响结果。

## 常见错误

- 忘记在异常路径上 join/detach，最终触发 terminate。
- 认为线程函数返回值会保存在 `thread` 对象里。
- 忘记参数默认按值复制，或用 `std::ref` 后让对象提前销毁。
- detach 后捕获局部引用或裸 `this`。
- 同时从两个线程操作同一个 thread 句柄。
- 认为线程函数抛出的异常能被创建线程的 try/catch 捕获。
- 把 `hardware_concurrency()` 当作硬性容量。

## 与 JavaScript 的区别

> Promise/`async` 函数有可等待的完成值和拒绝通道，但通常不代表新 OS 线程；`std::thread` 相反，直接代表执行线程，却不保存结果和异常。`join()` 可类比等待 Worker 生命周期结束，但 C++ 线程还能直接共享内存，所以必须额外处理 data race 与对象寿命。

## 相关内容

头文件地图见 `<thread>`；C++20 结构化停止与析构等待见 `std::jthread`。共享状态的最小互斥原语见 `std::mutex`，日常作用域加锁优先用 `std::lock_guard`。

## 来源

构造、移动、join/detach、错误和同步关系由 manifest 中的 `[thread.thread.class]`、`[intro.multithread]`、N3337 与 N4861 验证；cppreference 仅用于二级覆盖核对。
