# C++ Reference 第十五批：线程生命周期、互斥同步与作用域锁研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-02
>
> 精确范围：`<thread>`、`std::thread`、`<mutex>`、`std::mutex`、
> `std::lock_guard`
>
> 事实基线：C++11 后工作草案 N3337、C++20 最终工作草案 N4861、当前
> C++ Working Draft，以及相关 WG21 原始提案。cppreference 与
> zh.cppreference 只作二级信息架构和覆盖核对，正文、表格和示例不得复制。

## 1. 批次目标与范围决策

本批建立并发学习的最小闭环：`<thread>` 创建执行线程，`std::thread` 管理线程
句柄的 joinable 状态和回收责任；`<mutex>` 提供同步设施地图，`std::mutex`
建立互斥与 happens-before 边；`std::lock_guard` 再把手工 `lock`/`unlock`
收束成异常安全的作用域所有权。

五个 Entry 均归入新建的 `concurrency` 分类。`<thread>`、`std::thread`、
`<mutex>`、`std::mutex`、`std::lock_guard` 都从 C++11 起存在；示例全部使用
C++20 编译，但不依赖 C++20 后新增接口。C++20 `<thread>` 规范还包含
`std::jthread`，然而本项目当前 Apple clang 15/libc++ 没有提供它，详见 1.3。

来源：[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、
[`[thread.syn]`](https://eel.is/c++draft/thread.syn)、
[`[mutex.syn]`](https://eel.is/c++draft/mutex.syn)。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | 建议 slug | direct header | `since` | 示例标准 | 主要规范锚点 |
|---|---|---|---|---|---|---|---|
| `header-thread` | `header` | `<thread>` | `standard-library/headers/thread` | `<thread>` | `c++11` | `c++20` | [`[thread.syn]`](https://eel.is/c++draft/thread.syn) |
| `std-thread` | `type` | `std::thread` | `standard-library/concurrency/thread` | `<thread>` | `c++11` | `c++20` | [`[thread.thread.class]`](https://eel.is/c++draft/thread.thread.class) |
| `header-mutex` | `header` | `<mutex>` | `standard-library/headers/mutex` | `<mutex>` | `c++11` | `c++20` | [`[mutex.syn]`](https://eel.is/c++draft/mutex.syn) |
| `std-mutex` | `type` | `std::mutex` | `standard-library/concurrency/mutex` | `<mutex>` | `c++11` | `c++20` | [`[thread.mutex.class]`](https://eel.is/c++draft/thread.mutex.class) |
| `std-lock-guard` | `type` | `std::lock_guard` | `standard-library/concurrency/lock-guard` | `<mutex>` | `c++11` | `c++20` | [`[thread.lock.guard]`](https://eel.is/c++draft/thread.lock.guard) |

五个建议 ID 在第十四批 catalog 中均未使用。Catalog 需要新增：

```json
{
  "id": "concurrency",
  "title": "并发与同步",
  "parentId": "standard-library",
  "order": 100
}
```

### 1.2 Manifest-ready 关系

| ID | 建议 `relatedEntryIds` |
|---|---|
| `header-thread` | `std-thread`、`header-mutex`、`std-mutex`、`standard-library` |
| `std-thread` | `header-thread`、`header-mutex`、`std-mutex`、`std-lock-guard` |
| `header-mutex` | `std-mutex`、`std-lock-guard`、`header-thread`、`standard-library` |
| `std-mutex` | `header-mutex`、`std-lock-guard`、`std-thread`、`header-thread` |
| `std-lock-guard` | `header-mutex`、`std-mutex`、`std-thread`、`header-thread` |

只引用本批已有或同时落库的 ID。`std::unique_lock`、`std::scoped_lock`、
`std::condition_variable`、`std::atomic` 和 `std::future` 尚未创建，不得先写进
manifest 形成悬空关系；Header 正文可以把它们标为后续学习方向。

### 1.3 `std::jthread` 延后而不是伪装支持

C++20 的 P0660R10 把 `std::jthread`、`std::stop_token` 与协作式停止机制加入标准，
并规定 `jthread` 析构时在仍 joinable 的情况下先请求停止再 join。它仍属于 120 条
规划中的候选条目，不能从内容清单删除。

但本项目的实际验证工具链为 Apple clang 15.0.0 与系统 libc++。以下真实探针：

```cpp
#include <thread>

int main() {
  std::jthread worker([] {});
}
```

使用 `clang++ -std=c++20 -pthread` 编译时报告
`no member named 'jthread' in namespace 'std'`。因此本批不使用 feature-test
分支把示例降级成普通 `thread`，也不把“跳过代码”记作 jthread 验证成功。待 CI/本地
libc++ 升级并真实提供 `__cpp_lib_jthread` 后，再实现 `std::jthread` 条目与协作停止示例。

规范来源：[P0660R10](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf)、
N4861 `[thread.jthread.class]`、
[`[thread.jthread.class]`](https://eel.is/c++draft/thread.jthread.class)。

## 2. 五页共享的并发正确性模型

### 2.1 线程句柄、线程执行与共享数据是三件事

`std::thread` 对象是一个可移动、不可复制的管理句柄；它不是线程函数的返回值容器，
也不会因为“线程已经执行结束”就自动变成 non-joinable。成功构造后，调用方必须在句柄
析构前选择 `join()` 或 `detach()`。`join()` 回收管理责任并建立完成同步；`detach()` 只让
执行线程脱离句柄，不能延长 lambda 捕获对象、raw pointer 或 `this` 的生命周期。

`std::mutex` 管理的是某个执行线程对互斥量的排他所有权，不管理受保护对象的生命周期；
`lock_guard` 又只管理 mutex 的锁所有权，不管理 mutex 自身生命周期。三者都不能替调用方
决定“哪些字段受哪把锁保护”。

来源：[`[thread.thread.class]`](https://eel.is/c++draft/thread.thread.class)、
[`[thread.lock]`](https://eel.is/c++draft/thread.lock)、
[`[res.on.objects]`](https://eel.is/c++draft/res.on.objects)。

### 2.2 `join` 与 mutex 建立可见性，不是只“等待一下”

线程函数完成 synchronizes-with 对应成功 `join()` 的返回。因此 worker 在结束前对普通
对象的写入，可以在 join 返回后由调用线程读取；这不是“CPU 通常会刷新缓存”的经验规则。

同一 mutex 上的 lock/unlock 以单一总顺序出现；一次 `unlock()` synchronizes-with 后续
成功取得同一 mutex 的 `lock()`，也 synchronizes-with 返回 `true` 的 `try_lock()`。
失败的 `try_lock()` 不建立同步边。只要所有冲突访问都遵守同一同步协议，普通非 atomic
字段也可以安全传递状态；若两个潜在并发操作冲突、至少一个非 atomic，且二者之间没有
happens-before，则 data race 导致未定义行为。

来源：[`[thread.thread.member]`](https://eel.is/c++draft/thread.thread.member)、
[`[thread.mutex.requirements.mutex]`](https://eel.is/c++draft/thread.mutex.requirements.mutex)、
[`[intro.races]`](https://eel.is/c++draft/intro.races)。

### 2.3 本批示例的确定性红线

十个示例必须遵守：

- 全部以 `clang++ -std=c++20 -pthread` 编译；每个设施直接包含声明它的 header；
- worker 不向 `std::cout` 写入；所有输出由主线程在相关 `join()` 后产生；
- 不输出线程 ID 数值、native handle、地址、`hardware_concurrency()`、耗时或执行次序；
- 不用 `sleep_for` 猜调度，不断言哪个 worker 先获得锁，不依赖 mutex 公平性；
- 线程只并发写不同数组元素，或在同一 mutex 临界区写共享状态；
- worker 写入的普通字段只在 join 后读取；没有 detach 示例；
- mutex 不被递归锁定，不由非 owner unlock，不在 owned 状态销毁；
- `try_lock` 示例只在明确由另一线程持锁时期待 `false`，不把“空闲时成功”写成固定输出；
- `lock_guard` 必须具名并覆盖完整临界区；`adopt_lock` 只接管已经取得的锁；
- 不用 `std::jthread`/`stop_token` 的 fallback 或跳过分支伪造 C++20 支持。

## 3. `<thread>`

### 3.1 C++20 设施地图与直接包含

```cpp
// <thread>, C++20 教学轮廓
namespace std {
  class thread;
  void swap(thread&, thread&) noexcept;
  class jthread; // C++20，当前本地 libc++ 未提供

  namespace this_thread {
    thread::id get_id() noexcept;
    void yield() noexcept;

    template<class Clock, class Duration>
    void sleep_until(const chrono::time_point<Clock, Duration>& time);

    template<class Rep, class Period>
    void sleep_for(const chrono::duration<Rep, Period>& duration);
  }
}
```

必须直接 `#include <thread>`。`<thread>` 是线程句柄和当前线程操作的设施入口；mutex
与 locks 属于 `<mutex>`，condition variables 属于 `<condition_variable>`，atomics
属于 `<atomic>`。不能依赖 `<iostream>`、`<future>` 或平台头传递包含线程声明。

C++11 已有 `thread` 和 `this_thread`；C++20 由 P0660R10 加入 `jthread`。当前 Working
Draft 已包含后续 thread attributes 等非 C++20 设施，页面的 C++20 synopsis 不能直接复制
当前全文。

来源：N3337 `[thread.threads]`、N4861 `[thread.syn]`、
[`[thread.syn]`](https://eel.is/c++draft/thread.syn)、
[P0660R10](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf)。

### 3.2 返回、错误、同步与选择

`this_thread::get_id()` 返回当前线程的唯一 ID；同一活动线程的反复调用值相同且不等于
默认构造的 `thread::id`。`yield()` 只是给实现一个重新调度机会，`sleep_for`/
`sleep_until` 只阻塞到超时要求；三者都明确不建立同步关系。不要用 yield 或 sleep
替代 mutex、atomic、condition variable 或 join。

`thread::hardware_concurrency()` 只返回实现提示，允许为 0；不能把它输出进快照示例，
也不能把它当作任务数、物理核数或性能保证。`sleep_*` 可能抛与 timeout 相关的异常，
`get_id`/`yield` 为 `noexcept`。这些线程调度函数没有可移植的大 O 或公平性保证。

来源：[`[thread.thread.this]`](https://eel.is/c++draft/thread.thread.this)、
[`[thread.thread.static]`](https://eel.is/c++draft/thread.thread.static)、
[`[thread.req.timing]`](https://eel.is/c++draft/thread.req.timing)。

### 3.3 JS 对照与常见误区

JavaScript 的 Promise/async function 主要调度同一事件循环上的任务，不等同于创建
`std::thread`。Web Worker 或 Node.js worker thread 更接近独立执行线程，但其默认通信模式
偏向消息传递；C++ 线程天然共享同一地址空间，所以悬空引用和 data race 更直接。

常见误区：

- 包含 `<thread>` 后共享变量就自动安全；
- `yield()` 会把执行权确定交给某个指定 worker；
- `sleep_for` 可以可靠等待另一线程完成；
- thread ID 数值稳定、连续且可作为永久业务 ID；
- `hardware_concurrency()` 永不为 0 且等于最优线程数；
- `<thread>` 保证传递包含 `<mutex>`；
- 规范列出 `jthread` 就意味着当前工具链必然已实现它。

### 3.4 两个确定性示例

#### 示例 1：`run-independent-workers.cpp`

两个线程只写不同数组元素，主线程 join 后按固定顺序汇总。

```cpp
#include <array>
#include <iostream>
#include <thread>

int main() {
  std::array<int, 2> results{};

  std::thread first([&results] {
    results[0] = 20;
  });
  std::thread second([&results] {
    results[1] = 22;
  });

  first.join();
  second.join();

  std::cout << "results=" << results[0] << ',' << results[1] << '\n';
  std::cout << "sum=" << results[0] + results[1] << '\n';
}
```

精确 stdout：

```text
results=20,22
sum=42
```

#### 示例 2：`inspect-thread-identities.cpp`

只比较规范保证的 ID 关系，不输出实现相关的 ID 表示。

```cpp
#include <iostream>
#include <thread>

int main() {
  const std::thread::id main_id = std::this_thread::get_id();
  std::thread::id worker_id;

  std::thread worker([&worker_id] {
    worker_id = std::this_thread::get_id();
    std::this_thread::yield();
  });
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "main_valid=" << (main_id != std::thread::id{}) << '\n';
  std::cout << "different=" << (main_id != worker_id) << '\n';
  std::cout << "joined=" << (worker.get_id() == std::thread::id{}) << '\n';
}
```

精确 stdout：

```text
main_valid=true
different=true
joined=true
```

## 4. `std::thread`

### 4.1 C++20 代表接口

```cpp
// <thread>
class thread {
public:
  class id;
  using native_handle_type = /* implementation-defined */;

  thread() noexcept;

  template<class F, class... Args>
  explicit thread(F&& function, Args&&... args);

  ~thread();

  thread(const thread&) = delete;
  thread(thread&& other) noexcept;
  thread& operator=(const thread&) = delete;
  thread& operator=(thread&& other) noexcept;

  void swap(thread&) noexcept;
  bool joinable() const noexcept;
  void join();
  void detach();
  id get_id() const noexcept;
  native_handle_type native_handle();

  static unsigned int hardware_concurrency() noexcept;
};
```

以上是 C++20 学习轮廓，不展示当前草案后续 thread attributes。一个 thread object 最多
唯一代表一个执行线程；表示关系可以 move 到另一个 object，但不能 copy。默认构造、被 move
后、成功 join 后和成功 detach 后都不再表示线程。

来源：N4861 `[thread.thread.class]`、
[`[thread.thread.class]`](https://eel.is/c++draft/thread.thread.class)。

### 4.2 构造参数、返回与错误

C++20 构造函数在构造线程中对 callable 和参数做 decay-copy，再在新线程中调用副本；若要
传真正引用，显式使用 `std::ref`、pointer 或捕获引用，并证明被引用对象活得足够久。线程
函数返回值被忽略；要把结果或异常传回调用方，应使用受同步保护的状态，或在后续条目学习
promise/future。线程函数若让异常逃出最外层，会调用 `std::terminate`。

成功构造后 thread 为 joinable。无法创建线程时抛 `std::system_error`，标准错误条件为
`resource_unavailable_try_again`。参数 materialization/复制移动在构造线程发生，因此其
异常在构造线程抛出，尚未开始新线程。

`join()` 返回 `void`，阻塞直到被表示线程完成；成功后 non-joinable。它可报告
`resource_deadlock_would_occur`（包括尝试 join 自己）、`no_such_process`、
`invalid_argument`。`detach()` 返回 `void`，成功后句柄 non-joinable，底层线程可继续运行；
它可报告 `no_such_process` 或 `invalid_argument`。

来源：N4861 `[thread.thread.constr]`/`[thread.thread.member]`、
[`[thread.thread.constr]`](https://eel.is/c++draft/thread.thread.constr)、
[`[thread.thread.member]`](https://eel.is/c++draft/thread.thread.member)、
[N3255](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2011/n3255.html)。

### 4.3 生命周期、同步、复杂度与失效

构造函数完成 synchronizes-with 新线程调用 callable 副本的开始；被表示线程完成
synchronizes-with 成功 join 的返回。后者让示例可以安全地在 join 后读取 worker 对普通
对象的写入。对同一个 `std::thread` object 的成员调用本身不自动同步，不能让两个线程无锁
地同时 join、move 或查询/修改同一句柄。

已经完成但尚未 join/detach 的线程 object 仍是 joinable。joinable object 的析构函数会
调用 `std::terminate`；把另一个 thread move-assign 给一个仍 joinable 的目标也会 terminate。
这不是 RAII 自动 join。必须让所有正常路径和异常路径在析构前明确完成 join/detach；本批
优先 join，避免 detach 捕获悬空。

detach 不提供 join 的完成同步。detach 后，原 thread object 的 get_id 变成默认 ID，但这
不表示底层工作已经结束。捕获的局部引用、pointer、`this` 和输出对象都必须独立活到 worker
真正结束。

标准没有给线程创建、join、detach 或调度规定可移植的大 O、公平性或启动先后保证；join
按合同可阻塞。不要承诺“创建线程为 O(1)”或“先构造的先执行”。

来源：[`[thread.thread.destr]`](https://eel.is/c++draft/thread.thread.destr)、
[`[thread.thread.assign]`](https://eel.is/c++draft/thread.thread.assign)、
[`[thread.thread.member]`](https://eel.is/c++draft/thread.thread.member)、
[`[except.terminate]`](https://eel.is/c++draft/except.terminate)。

### 4.4 JS 对照与常见误区

Node.js `Worker`/Web Worker 能帮助理解“创建独立执行单元并等待退出”，但 Promise 的
`await` 不等于 `thread::join()`：await 不阻塞 OS 线程，而 C++ join 是同步阻塞并带有标准
内存可见性边。JS worker 通常以消息或 transferable 数据通信；C++ thread 直接共享地址空间。

常见误区：

- 析构会自动 join；
- worker 运行结束后 `joinable()` 会自动变 false；
- `detach()` 是“后台安全运行”并会复制所有捕获对象；
- join 只等待，不影响普通字段可见性；
- thread 可以 copy，或两个 object 可同时代表同一线程；
- move-assign 会先替目标自动 join；
- callable 返回值会从 thread object 取回；
- worker 抛异常能在创建线程的 try/catch 中捕获；
- 构造参数默认按引用共享；
- 可以并发操作同一个 thread object。

### 4.5 两个确定性示例

#### 示例 1：`join-and-observe-result.cpp`

worker 写普通 int；只在 join 返回后读取，依赖标准同步边而不是 atomic。

```cpp
#include <iostream>
#include <thread>

int main() {
  int result = 0;
  std::thread worker([&result] {
    result = 42;
  });

  const bool before = worker.joinable();
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "joinable_before=" << before << '\n';
  std::cout << "result=" << result << '\n';
  std::cout << "joinable_after=" << worker.joinable() << '\n';
}
```

精确 stdout：

```text
joinable_before=true
result=42
joinable_after=false
```

#### 示例 2：`transfer-thread-ownership.cpp`

只移动句柄所有权；结果仍在新 owner join 后读取。

```cpp
#include <iostream>
#include <thread>
#include <utility>

int main() {
  int value = 0;
  std::thread source([&value] {
    value = 7;
  });
  std::thread owner = std::move(source);

  std::cout << std::boolalpha;
  std::cout << "source_joinable=" << source.joinable() << '\n';
  std::cout << "owner_joinable=" << owner.joinable() << '\n';

  owner.join();
  std::cout << "value=" << value << '\n';
}
```

精确 stdout：

```text
source_joinable=false
owner_joinable=true
value=7
```

## 5. `<mutex>`

### 5.1 C++20 设施地图与版本边界

```cpp
// <mutex>, C++20 教学轮廓
namespace std {
  class mutex;
  class recursive_mutex;
  class timed_mutex;
  class recursive_timed_mutex;

  struct defer_lock_t;
  struct try_to_lock_t;
  struct adopt_lock_t;
  inline constexpr defer_lock_t defer_lock{};
  inline constexpr try_to_lock_t try_to_lock{};
  inline constexpr adopt_lock_t adopt_lock{};

  template<class Mutex> class lock_guard;
  template<class... MutexTypes> class scoped_lock; // C++17
  template<class Mutex> class unique_lock;

  template<class L1, class L2, class... L3>
  int try_lock(L1&, L2&, L3&...);

  template<class L1, class L2, class... L3>
  void lock(L1&, L2&, L3&...);

  struct once_flag;

  template<class Callable, class... Args>
  void call_once(once_flag&, Callable&&, Args&&...);
}
```

必须直接 `#include <mutex>`。Header 同时组织 mutex types、RAII locks、通用多锁算法和
once initialization；`shared_mutex` 位于 `<shared_mutex>`，condition variables 位于
`<condition_variable>`。`scoped_lock` 由 P0156R2 在 C++17 加入，C++20 已可使用。

来源：N3337 `[mutex.syn]`、N4861 `[mutex.syn]`、
[`[mutex.syn]`](https://eel.is/c++draft/mutex.syn)、
[P0156R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0156r2.html)、
[P0636R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0636r3.html)。

### 5.2 选择、错误与同步边界

- `mutex`：非递归排他锁；本批实体页。
- `recursive_mutex`：允许同一线程重复取得；不能用来掩盖不清晰的调用层次。
- `timed_mutex` / `recursive_timed_mutex`：增加超时尝试；时间与调度不适合快照示例。
- `lock_guard`：最小作用域 RAII；本批实体页。
- `unique_lock`：可 move、延迟/尝试/手工 unlock，是 condition variable 常用适配器；后续页。
- `scoped_lock`：C++17 多锁 RAII，并使用 deadlock-avoidance；后续页。
- `lock` / `try_lock`：协调多个 Lockable；需要自行把已取得锁交给 RAII owner。
- `call_once`：对同一个 `once_flag` 至多有一个 returning execution；其完成同步到 passive
  calls 的返回。若 callable 抛异常，本次为 exceptional execution，异常传播且未来调用可重试。

Header Entry 只组织发现路径，不应把每个实体压成薄版教程。所有设施的异常、复杂度和
同步合同由其实体/requirements 页面决定，Header 本身没有统一的大 O。

来源：[`[thread.mutex]`](https://eel.is/c++draft/thread.mutex)、
[`[thread.lock]`](https://eel.is/c++draft/thread.lock)、
[`[thread.lock.algorithm]`](https://eel.is/c++draft/thread.lock.algorithm)、
[`[thread.once.callonce]`](https://eel.is/c++draft/thread.once.callonce)。

### 5.3 JS 对照与常见误区

浏览器主线程上的普通 JS 常用事件循环避免同时执行同一段代码，但 Web Worker、Node worker
和 `SharedArrayBuffer` 会重新引入跨执行单元共享。Promise 链或第三方 async mutex 管理的是
任务调度，不自动等价于 C++ mutex 的 lock/unlock synchronizes-with 合同。

常见误区：

- `<mutex>` 只声明 `std::mutex`；
- `std::lock` 本身是 RAII object；
- `call_once` 的 callable 抛异常后 flag 仍永久标记完成；
- `scoped_lock` 在 C++11 已存在；
- `<thread>` 会传递包含 `<mutex>`；
- 所有 lock type 都可移动和手工 unlock；
- mutex 公平性与 worker 先后顺序由 Header 保证。

### 5.4 两个确定性示例

#### 示例 1：`initialize-once.cpp`

两个线程竞争同一 once flag；callable 写固定结果，主线程 join 后输出。

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::once_flag flag;
  int calls = 0;
  int value = 0;

  const auto initialize = [&] {
    ++calls;
    value = 42;
  };

  std::thread first([&] {
    std::call_once(flag, initialize);
  });
  std::thread second([&] {
    std::call_once(flag, initialize);
  });

  first.join();
  second.join();

  std::cout << "calls=" << calls << '\n';
  std::cout << "value=" << value << '\n';
}
```

精确 stdout：

```text
calls=1
value=42
```

#### 示例 2：`lock-two-mutexes.cpp`

两个 worker 以相反实参顺序交给 `scoped_lock`，但不输出取得顺序。

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex left_mutex;
  std::mutex right_mutex;
  int left = 0;
  int right = 0;

  const auto forward = [&] {
    for (int i = 0; i < 100; ++i) {
      std::scoped_lock lock(left_mutex, right_mutex);
      ++left;
      ++right;
    }
  };

  const auto reverse = [&] {
    for (int i = 0; i < 100; ++i) {
      std::scoped_lock lock(right_mutex, left_mutex);
      ++left;
      ++right;
    }
  };

  std::thread first(forward);
  std::thread second(reverse);
  first.join();
  second.join();

  std::cout << "left=" << left << '\n';
  std::cout << "right=" << right << '\n';
}
```

精确 stdout：

```text
left=200
right=200
```

## 6. `std::mutex`

### 6.1 C++20 代表接口

```cpp
// <mutex>
class mutex {
public:
  constexpr mutex() noexcept;
  ~mutex();

  mutex(const mutex&) = delete;
  mutex& operator=(const mutex&) = delete;

  void lock();
  bool try_lock();
  void unlock();

  using native_handle_type = /* implementation-defined */;
  native_handle_type native_handle();
};
```

`std::mutex` 是 non-recursive、exclusive-ownership mutex，不可复制也不可移动。某线程
成功调用 lock function 后成为 owner，直到同一线程 unlock。另一线程的 `lock()` 阻塞，
`try_lock()` 则不阻塞并返回 false。

来源：N4861 `[thread.mutex.class]`、
[`[thread.mutex.class]`](https://eel.is/c++draft/thread.mutex.class)、
[`[thread.mutex.requirements]`](https://eel.is/c++draft/thread.mutex.requirements)。

### 6.2 参数、返回、错误与复杂度

三个核心成员均无参数。`lock()` 返回 void，阻塞直到取得所有权；需要报告错误时抛
`std::system_error`，标准错误条件包括 `operation_not_permitted` 与检测到死锁时的
`resource_deadlock_would_occur`。对 non-recursive mutex，调用线程在进入 `lock` 前不得
已经拥有它；重复锁定不是可移植的递归计数，可能死锁。

`try_lock()` 不阻塞，取得所有权返回 true，否则 false；即便 mutex 表面空闲也允许
spurious failure，所以测试不能把“空闲必为 true”做成固定合同。它不抛异常。
`unlock()` 要求调用线程当前 owns mutex，释放所有权并返回 void，不抛异常。非 owner
unlock 违反前置条件。

标准没有规定 lock 排队公平性、FIFO 次序、饥饿上界或可移植的大 O；`lock` 可阻塞，
`try_lock` 的合同仅是不阻塞。不要承诺“一定按请求顺序唤醒”。

来源：[`[thread.mutex.requirements.mutex]`](https://eel.is/c++draft/thread.mutex.requirements.mutex)、
[`[thread.req.lockable]`](https://eel.is/c++draft/thread.req.lockable)、
[`[thread.req.exception]`](https://eel.is/c++draft/thread.req.exception)。

### 6.3 同步、生命周期与失效

同一 mutex 的 lock/unlock 操作表现为 atomic operations，并按单一总顺序出现。prior
`unlock()` synchronizes-with 后续成功 `lock()`；成功 `try_lock()` 也观察 prior unlock，
失败则不建立同步。mutex 只保护所有调用方一致放进同一锁协议的访问；有一个路径绕过锁，
仍可能 data race。

销毁仍由任意线程 owning 的 mutex，或让线程在仍 owning mutex 时终止，行为未定义。
mutex 构造/析构本身不要求 thread-safe；必须先完成构造和安全发布，再让 worker 使用，且在
所有潜在访问结束后才析构。`unlock()` 返回后，另一线程甚至可能取得、释放并销毁包含该
mutex 的对象；原 owner 在 unlock 返回后不得再无生命周期保证地访问 mutex。

mutex 的所有权属于线程，不属于保存 mutex reference 的任意 wrapper object。锁住一把
mutex 后把“解锁责任”交给另一个线程会违反 unlock 的 owner 前置条件。

来源：[`[thread.mutex.requirements.mutex]`](https://eel.is/c++draft/thread.mutex.requirements.mutex)、
[`[thread.mutex.class]`](https://eel.is/c++draft/thread.mutex.class)、
[`[res.on.objects]`](https://eel.is/c++draft/res.on.objects)。

### 6.4 JS 对照与常见误区

JS 的 `Atomics` + `SharedArrayBuffer` 可以建立跨 worker 的原子与等待/通知协议，但没有
一个自动包住任意 JS object 的 `std::mutex` 等价物。第三方 async mutex 常在 Promise
层串行化任务；`await` 会让出事件循环，不等于 C++ 线程阻塞和内存模型中的 mutex edge。

常见误区：

- mutex 自己知道并自动保护某个业务对象；
- 同一线程可重复 lock 普通 mutex；
- `try_lock()` 在空闲时保证成功；
- failed try_lock 也能看到上一 owner 的写入；
- 任何线程都可 unlock；
- mutex 可复制/移动进容器；
- 析构 owned mutex 会自动 unlock；
- 线程退出会自动安全释放所持 mutex；
- mutex 保证 FIFO、公平性或固定 worker 顺序；
- 对 mutex 成员并发调用合法，就表示其保护的所有数据自动安全。

### 6.5 两个确定性示例

#### 示例 1：`publish-value-through-mutex.cpp`

主线程持锁启动 worker，写入 41 后 unlock；worker 的成功 lock 观察该写入并递增。

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  int value = 0;

  mutex.lock();
  std::thread worker([&] {
    std::lock_guard<std::mutex> lock(mutex);
    ++value;
  });

  value = 41;
  mutex.unlock();
  worker.join();

  std::cout << "value=" << value << '\n';
}
```

精确 stdout：

```text
value=42
```

#### 示例 2：`try-lock-while-owned.cpp`

主线程持锁期间让另一线程 try_lock；由于锁明确被另一线程持有，false 是确定结果。

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  bool acquired = true;

  mutex.lock();
  std::thread contender([&] {
    acquired = mutex.try_lock();
    if (acquired) {
      mutex.unlock();
    }
  });

  contender.join();
  mutex.unlock();

  std::cout << std::boolalpha;
  std::cout << "acquired=" << acquired << '\n';
}
```

精确 stdout：

```text
acquired=false
```

## 7. `std::lock_guard`

### 7.1 C++20 代表接口

```cpp
// <mutex>
template<class Mutex>
class lock_guard {
public:
  using mutex_type = Mutex;

  explicit lock_guard(mutex_type& mutex);
  lock_guard(mutex_type& mutex, adopt_lock_t);
  ~lock_guard();

  lock_guard(const lock_guard&) = delete;
  lock_guard& operator=(const lock_guard&) = delete;

private:
  mutex_type& pm; // exposition only
};
```

`Mutex` 必须满足 Cpp17BasicLockable。普通构造保存 reference 并调用 `m.lock()`；析构等价于
`m.unlock()`。guard 在完整生命周期内保持锁所有权，不可复制、不可移动，也没有手工
unlock/release 接口。若需要延迟锁、条件变量等待、移动或中途 unlock，应选后续
`unique_lock`，而不是绕过 lock_guard。

来源：N4861 `[thread.lock.guard]`、
[`[thread.lock.guard]`](https://eel.is/c++draft/thread.lock.guard)、
[`[thread.req.lockable.basic]`](https://eel.is/c++draft/thread.req.lockable.basic)。

### 7.2 参数、返回、异常与复杂度

普通构造接收 `Mutex&` 且没有返回值；调用底层 `lock()`，因此可传播它的异常。若 lock
失败，guard 尚未成功构造，也不会在析构时 unlock。`adopt_lock` 构造不调用 lock，前置条件
是当前线程已经持有 m 的 non-shared lock；该构造不抛异常。

析构调用一次 `unlock()`；Cpp17BasicLockable 要求 unlock 不抛。标准没有给 lock_guard
单独的大 O，它的加锁/阻塞代价来自所包装 Mutex；可移植的操作计数是普通构造一次 lock、
析构一次 unlock，adopt 构造零次 lock。

来源：[`[thread.lock.guard]`](https://eel.is/c++draft/thread.lock.guard)、
[`[thread.req.lockable.basic]`](https://eel.is/c++draft/thread.req.lockable.basic)。

### 7.3 生命周期、同步与失效

mutex 必须在 guard 的完整生命周期内存在，否则行为未定义。guard 只持 reference，不能让
局部 mutex、owner object 或 heap allocation 自动延寿。guard 的同步/可见性完全来自底层
mutex lock/unlock；构造 guard 本身不是对任意数据的万能屏障。

具名 guard 的作用域就是临界区。写成 `std::lock_guard{mutex};` 会创建一个未命名临时量，
在当前完整表达式结束立即析构，后续语句不受保护。`adopt_lock` 不是“尝试取得锁”的标签；
未持锁时传入会违反前置条件，随后析构还会错误 unlock。

作用域因正常 return 或异常展开退出时，已成功构造的 guard 都会析构并释放 mutex；这正是
它比手写 lock/unlock 更安全的地方。但进程终止、`std::terminate` 或不进行栈展开的退出不应
被误解为常规 RAII 路径。

来源：[`[thread.lock]`](https://eel.is/c++draft/thread.lock)、
[`[thread.lock.guard]`](https://eel.is/c++draft/thread.lock.guard)、
[`[except.terminate]`](https://eel.is/c++draft/except.terminate)。

### 7.4 JS 对照与常见误区

JS 中用 `try { await acquire(); ... } finally { release(); }` 可以类比“无论正常还是异常都
归还锁”，但 C++ lock_guard 的 destructor 在同步词法作用域结束时确定执行，并且包装的是
线程 mutex。JS Promise cleanup、GC finalizer 和事件循环调度没有同一生命周期/内存模型合同。

常见误区：

- 临时 `std::lock_guard{mutex};` 能保护后续语句；
- lock_guard 析构会销毁 mutex；
- guard 可以 copy/move 给另一个线程；
- guard 有 unlock，可缩短临界区；
- `adopt_lock` 会自动取得当前未锁 mutex；
- mutex 可以先于 guard 析构；
- 普通构造抛异常后仍会调用 unlock；
- lock_guard 自己规定锁公平性和复杂度；
- RAII 能挽救 detach 捕获的悬空 mutex；
- 在临界区里做无限等待不会影响并发进度。

### 7.5 两个确定性示例

#### 示例 1：`unlock-during-exception.cpp`

异常离开作用域时 guard 解锁；catch 后可再次用具名 guard 取得同一 mutex。

```cpp
#include <iostream>
#include <mutex>
#include <stdexcept>

int main() {
  std::mutex mutex;
  int value = 0;
  bool caught = false;

  try {
    std::lock_guard<std::mutex> lock(mutex);
    value = 1;
    throw std::runtime_error("stop");
  } catch (const std::runtime_error&) {
    caught = true;
  }

  {
    std::lock_guard<std::mutex> lock(mutex);
    ++value;
  }

  std::cout << std::boolalpha;
  std::cout << "caught=" << caught << '\n';
  std::cout << "value=" << value << '\n';
}
```

精确 stdout：

```text
caught=true
value=2
```

#### 示例 2：`adopt-an-existing-lock.cpp`

先手工取得 mutex，再由 adopt-lock guard 接管恰好一个作用域；随后普通 guard 能再次取得。

```cpp
#include <iostream>
#include <mutex>

int main() {
  std::mutex mutex;
  int value = 0;

  mutex.lock();
  {
    std::lock_guard<std::mutex> owner(mutex, std::adopt_lock);
    value = 7;
  }

  {
    std::lock_guard<std::mutex> owner(mutex);
    ++value;
  }

  std::cout << "value=" << value << '\n';
}
```

精确 stdout：

```text
value=8
```

## 8. 十个示例的确定性清单

| # | Entry / 文件名 | 直接包含 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `header-thread` / `run-independent-workers.cpp` | `<array>`、`<iostream>`、`<thread>` | worker 写不同数组元素；join 后固定顺序输出 | `results=20,22\nsum=42\n` |
| 2 | `header-thread` / `inspect-thread-identities.cpp` | `<iostream>`、`<thread>` | 只比较 ID 合同，不输出 ID 数值 | `main_valid=true\ndifferent=true\njoined=true\n` |
| 3 | `std-thread` / `join-and-observe-result.cpp` | `<iostream>`、`<thread>` | join 后读取普通字段 | `joinable_before=true\nresult=42\njoinable_after=false\n` |
| 4 | `std-thread` / `transfer-thread-ownership.cpp` | `<iostream>`、`<thread>`、`<utility>` | 只移动句柄；新 owner join 后读结果 | `source_joinable=false\nowner_joinable=true\nvalue=7\n` |
| 5 | `header-mutex` / `initialize-once.cpp` | `<iostream>`、`<mutex>`、`<thread>` | call_once 写固定值；join 后输出 | `calls=1\nvalue=42\n` |
| 6 | `header-mutex` / `lock-two-mutexes.cpp` | `<iostream>`、`<mutex>`、`<thread>` | scoped_lock；不观察锁取得顺序 | `left=200\nright=200\n` |
| 7 | `std-mutex` / `publish-value-through-mutex.cpp` | `<iostream>`、`<mutex>`、`<thread>` | prior unlock → successful lock；join 后读 | `value=42\n` |
| 8 | `std-mutex` / `try-lock-while-owned.cpp` | `<iostream>`、`<mutex>`、`<thread>` | 另一线程明确持锁，因此 try_lock 固定失败 | `acquired=false\n` |
| 9 | `std-lock-guard` / `unlock-during-exception.cpp` | `<iostream>`、`<mutex>`、`<stdexcept>` | 栈展开释放；随后重新取得 | `caught=true\nvalue=2\n` |
| 10 | `std-lock-guard` / `adopt-an-existing-lock.cpp` | `<iostream>`、`<mutex>` | adopt 前已持锁；后续普通 guard 验证可重入作用域 | `value=8\n` |

实现时逐字复制文件名与 stdout。全部 example manifest `standard` 为 `c++20`、`kind`
为 `run`。虽然 Header Entry 以导航为主，本批保留每页两个示例，以满足并发示例的本地可验证
证据要求；它们分别演示 Header 中不同的设施，不用重复填充正文。

## 9. 版本与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| C++11 `<thread>` / `thread` / `<mutex>` / `mutex` / `lock_guard` 基线 | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) `[thread.threads]`、`[thread.mutex]` |
| C++20 精确接口基线 | [N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) `[thread.syn]`、`[thread.thread.class]`、`[mutex.syn]`、`[thread.mutex.class]`、`[thread.lock.guard]` |
| 当前 `<thread>` 设施地图 | [`[thread.syn]`](https://eel.is/c++draft/thread.syn)、[`[thread.thread.this]`](https://eel.is/c++draft/thread.thread.this) |
| thread 构造、所有权与同步 | [`[thread.thread.class]`](https://eel.is/c++draft/thread.thread.class)、[`[thread.thread.constr]`](https://eel.is/c++draft/thread.thread.constr)、[`[thread.thread.member]`](https://eel.is/c++draft/thread.thread.member) |
| joinable 析构与 move assignment 终止 | [`[thread.thread.destr]`](https://eel.is/c++draft/thread.thread.destr)、[`[thread.thread.assign]`](https://eel.is/c++draft/thread.thread.assign)、[`[except.terminate]`](https://eel.is/c++draft/except.terminate) |
| C++11 decay-copy 设计 | [N3255](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2011/n3255.html) |
| C++20 jthread 与协作停止（本批因工具链延后） | [P0660R10](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf)、N4861 `[thread.jthread.class]` |
| 当前 `<mutex>` 设施地图 | [`[mutex.syn]`](https://eel.is/c++draft/mutex.syn)、[`[thread.mutex]`](https://eel.is/c++draft/thread.mutex) |
| mutex 锁、错误、同步与生命周期 | [`[thread.mutex.requirements]`](https://eel.is/c++draft/thread.mutex.requirements)、[`[thread.mutex.requirements.mutex]`](https://eel.is/c++draft/thread.mutex.requirements.mutex)、[`[thread.mutex.class]`](https://eel.is/c++draft/thread.mutex.class) |
| Lockable 基础要求 | [`[thread.req.lockable]`](https://eel.is/c++draft/thread.req.lockable)、[`[thread.req.lockable.basic]`](https://eel.is/c++draft/thread.req.lockable.basic) |
| lock_guard 作用域合同 | [`[thread.lock]`](https://eel.is/c++draft/thread.lock)、[`[thread.lock.guard]`](https://eel.is/c++draft/thread.lock.guard) |
| C++17 scoped_lock 版本边界 | [P0156R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0156r2.html)、[P0636R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0636r3.html) |
| call_once 单次执行与同步 | [`[thread.once.callonce]`](https://eel.is/c++draft/thread.once.callonce) |
| data race 与 library object lifetime | [`[intro.races]`](https://eel.is/c++draft/intro.races)、[`[res.on.objects]`](https://eel.is/c++draft/res.on.objects) |

二级页面只用于核对搜索别名、分栏顺序与学习导航：
[`<thread>`](https://zh.cppreference.com/w/cpp/header/thread)、
[`std::thread`](https://zh.cppreference.com/w/cpp/thread/thread)、
[`<mutex>`](https://zh.cppreference.com/w/cpp/header/mutex)、
[`std::mutex`](https://zh.cppreference.com/w/cpp/thread/mutex)、
[`std::lock_guard`](https://zh.cppreference.com/w/cpp/thread/lock_guard)。正文、接口摘要、
JS 对照和示例必须原创。

建议所有 manifest 使用 `verifiedAt: 2026-09-02`。Header Entry 使用 reduced profile，
ordinary type Entry 必须满足参数、返回、错误、复杂度、同步、生命周期、误区和 JS 对照要求。

## 10. 内容实施与终审清单

- 只新增五个建议 ID 和一个 `concurrency` category；新增 10 个 deterministic C++20 run 示例。
- `<thread>` 明确 thread/this_thread 设施地图、jthread C++20 版本边界和本地未支持状态；
  yield/sleep 不建立同步，hardware_concurrency 允许为 0。
- `std::thread` 明确 C++20 decay-copy、返回值忽略、worker 未捕获异常 terminate、move-only、
  joinable 状态、join/detach 错误、join synchronizes-with、detach 生命周期风险。
- `<mutex>` 明确 mutex/lock/tag/multi-lock/call-once 设施地图与 scoped_lock C++17 边界。
- `std::mutex` 明确 non-recursive、exclusive、不可移动复制、lock/try_lock/unlock 返回与错误、
  spurious try-lock failure、单一总序、unlock→lock 同步、owned destruction UB。
- `std::lock_guard` 明确 BasicLockable、普通构造一次 lock、析构一次 unlock、adopt 前置条件、
  不可 copy/move、mutex 必须长寿、具名作用域与临时量陷阱。
- 所有 JS 对照先写边界：Promise/await 不等于 OS thread/join，async mutex 不自动等于 C++
  memory-model mutex，GC/finalizer 不等于确定性 RAII destructor。
- 每个 worker 不输出；所有共享结果在 join 后由主线程固定顺序输出。
- 本地验证命令必须包含 `-pthread`；expected stdout 与第 8 节逐字一致。
- `std::jthread` 保留后续债务，必须等真实 toolchain feature 支持；不得以宏分支 no-op 示例
  把“编译通过”伪装成设施已验证。
- 终审拒绝：thread 析构自动 join；结束即自动 non-joinable；detach 延长引用寿命；worker
  异常回到创建者；yield/sleep 建同步；mutex 可递归；try_lock 空闲必成功；failed try_lock
  可见 prior writes；任意线程 unlock；owned mutex 可安全析构；临时 lock_guard 保护后续语句；
  adopt_lock 自动取得锁；guard 让 mutex 自动延寿；标准保证 FIFO、公平性或固定调度次序。
