# C++ Reference 第十六批：可转移锁、多锁所有权与条件变量研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-03
>
> 精确范围：`std::unique_lock`、`std::scoped_lock`、
> `<condition_variable>`、`std::condition_variable`
>
> 事实基线：C++11 工作草案 N3337、C++20 最终工作草案 N4861、当前
> C++ Working Draft，以及相关 WG21 提案与缺陷报告。cppreference 仅作
> 二级结构核对，正文与示例必须原创。

## 1. 批次目标与身份

第十五批已有 thread、mutex 与最小 RAII 锁。本批补上 `unique_lock` 的可变
ownership、`scoped_lock` 的多锁协调，以及用 predicate 等待共享状态的 condition
variable。四页沿用 `concurrency` 分类。

| 建议 ID | kind | symbol | slug | header | `since` |
|---|---|---|---|---|---|
| `std-unique-lock` | `type` | `std::unique_lock` | `standard-library/concurrency/unique-lock` | `<mutex>` | `c++11` |
| `std-scoped-lock` | `type` | `std::scoped_lock` | `standard-library/concurrency/scoped-lock` | `<mutex>` | `c++17` |
| `header-condition-variable` | `header` | `<condition_variable>` | `standard-library/headers/condition-variable` | `<condition_variable>` | `c++11` |
| `std-condition-variable` | `type` | `std::condition_variable` | `standard-library/concurrency/condition-variable` | `<condition_variable>` | `c++11` |

建议关系：`std-unique-lock` 关联 `<mutex>`、`std::mutex`、`std::lock_guard` 与两页
condition variable；`std-scoped-lock` 关联 `<mutex>`、`std::mutex`、lock_guard、
unique_lock；Header 与 condition_variable 实体页互链，并关联 unique_lock、mutex、thread。

`unique_lock`、`<condition_variable>`、`condition_variable` 从 C++11 起存在；
`scoped_lock` 由 P0156R2 加入 C++17。示例使用 C++20，不把这些设施误写成 C++20 首发。

来源：[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、
[P0156R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0156r2.html)。

## 2. 共享正确性模型

### 2.1 Wrapper、mutex owner 与生命周期

`unique_lock` 和 `scoped_lock` 关联 Lockable，不拥有或延长 mutex 对象生命周期。
mutex 必须先构造、安全发布，并活过 wrapper 与全部访问。锁所有权属于执行线程：
可在同一线程内移动 unique_lock，但不能靠 move 把已持有的普通 mutex 交给另一线程解锁。

unique_lock 有三态：无关联；关联但不 owns；关联且 owns。`mutex() != nullptr` 不等于
`owns_lock()`。`release()` 只断开关联，不 unlock，调用者接管手工解锁责任。

来源：[`[thread.lock.unique]`](https://eel.is/c++draft/thread.lock.unique)、
[`[thread.lock.scoped]`](https://eel.is/c++draft/thread.lock.scoped)、
[`[thread.mutex.requirements]`](https://eel.is/c++draft/thread.mutex.requirements)。

### 2.2 Condition variable 等待状态，不保存通知

Condition variable 不是消息队列。修改方在同一 mutex 下更新 predicate 与数据后通知；
等待方持该 mutex 检查 predicate，并用 `wait(lock, pred)` 在为假时原子解锁和阻塞。

wait 的“释放 mutex 并进入等待”“解除阻塞”“重新取得 mutex”是三个 atomic parts。
同一 CV 的 notify 与这些 parts 表现为一个与 happens-before 一致、顺序未指定的单一总序。
该规则不会把通知变成可积累令牌；早通知与虚假唤醒都仍需 predicate 协议。

来源：N4861 `[thread.condition]`、
[`[thread.condition.general]`](https://eel.is/c++draft/thread.condition.general)、
[LWG 2190](https://cplusplus.github.io/LWG/issue2190)。

### 2.3 示例确定性规则

- `clang++ -std=c++20 -pthread`，直接包含目标 header；
- worker 不输出，只在 join 后由主线程固定顺序输出；
- 不输出耗时、地址、线程 ID、锁或唤醒先后；
- 不用 sleep、yield 或忙等猜 waiter 已阻塞；
- CV 始终配合同一 mutex 下的 predicate；
- 不断言 notify 选择、wake/re-lock 顺序或 mutex 公平性；
- release 后由原 owner unlock；adopt 前已取得全部 mutex；
- 不用 timeout 或 wall clock 制作快照断言。

## 3. `std::unique_lock`

### 3.1 C++20 代表接口

```cpp
// <mutex>；C++20 N4861 教学轮廓
template<class Mutex>
class unique_lock {
public:
  using mutex_type = Mutex;
  unique_lock() noexcept;
  explicit unique_lock(mutex_type&);
  unique_lock(mutex_type&, std::defer_lock_t) noexcept;
  unique_lock(mutex_type&, std::try_to_lock_t);
  unique_lock(mutex_type&, std::adopt_lock_t);
  template<class Clock, class Duration>
  unique_lock(mutex_type&, const std::chrono::time_point<Clock, Duration>&);
  template<class Rep, class Period>
  unique_lock(mutex_type&, const std::chrono::duration<Rep, Period>&);
  ~unique_lock();
  unique_lock(const unique_lock&) = delete;
  unique_lock& operator=(const unique_lock&) = delete;
  unique_lock(unique_lock&&) noexcept;
  unique_lock& operator=(unique_lock&&);
  void lock();
  bool try_lock();
  template<class Rep, class Period>
  bool try_lock_for(const std::chrono::duration<Rep, Period>&);
  template<class Clock, class Duration>
  bool try_lock_until(const std::chrono::time_point<Clock, Duration>&);
  void unlock();
  void swap(unique_lock&) noexcept;
  mutex_type* release() noexcept;
  bool owns_lock() const noexcept;
  explicit operator bool() const noexcept;
  mutex_type* mutex() const noexcept;
};
```

N4861 的 move assignment 没有 `noexcept` 拼写但规定 Throws: Nothing；当前工作草案
synopsis 写为 `noexcept`。页面应把这标成版本化声明差异。

来源：N4861 `[thread.lock.unique]`、
[`[thread.lock.unique]`](https://eel.is/c++draft/thread.lock.unique)、
[LWG 2104](https://cplusplus.github.io/LWG/issue2104)。

### 3.2 约束、状态、返回与错误

`Mutex` 基线满足 Cpp17BasicLockable；try 操作要求 Lockable；timed 构造/成员要求
TimedLockable。普通构造调用 lock；defer 只关联；try_to_lock 调 try_lock，可能不 owns；
adopt 不加锁，前置条件是当前线程已持有 non-shared lock。

默认构造无关联。Move 转移关联与 owns，source 变成无关联且非 owning；move assignment
先释放目标已有锁。析构只在 owns 时 unlock。不可复制。非递归 mutex 的普通/try/timed
构造前当前线程不得已持锁；adopt 恰好相反。

`lock()` 成功后 owns=true；无关联时报 `operation_not_permitted`，已 owns 时报告
`resource_deadlock_would_occur`，并传播底层异常。try/timed 返回底层结果、更新 owns，
有相同 wrapper 状态错误。`unlock()` 后 owns=false 但仍关联；不 owns 时调用它报告
`operation_not_permitted`。

`owns_lock()`/bool 返回 owns；`mutex()` 返回可能为空的指针。`release()` 返回此前指针，
将 wrapper 变成无关联、非 owning，**不 unlock**。

标准未规定渐进复杂度、公平性或等待上限。普通构造一次 lock；defer/adopt 零次；析构
至多一次 unlock；release 零次 unlock。成本来自 Lockable。关联指针非空时，mutex 必须
活过 wrapper，即使 owns=false。同步来自底层 mutex，不是 wrapper 本身。

来源：N4861 `[thread.lock.unique.cons]`/`locking`/`mod`/`obs`、
[`[thread.lock.unique.locking]`](https://eel.is/c++draft/thread.lock.unique.locking)、
[`[thread.lock.unique.mod]`](https://eel.is/c++draft/thread.lock.unique.mod)。

### 3.3 JS 对照与误区

> JavaScript async mutex 常返回 Promise 或 release callback；await 不同步阻塞 OS 线程。
> unique_lock 是同步的 C++ ownership 状态机，其 mutex edge 参与 memory model，析构也
> 不是 Promise/GC 行为。

误区：关联即 owns；defer 已加锁；try 后不检查；未持锁 adopt；无关联或已 owns 时再
lock；release 自动 unlock；mutex 先析构；跨线程移动 owning wrapper；认为它保证公平。

### 3.4 示例

#### `defer-lock-and-relock.cpp`

```cpp
#include <iostream>
#include <mutex>

int main() {
  std::mutex mutex;
  int value = 0;
  std::unique_lock<std::mutex> owner(mutex, std::defer_lock);
  const bool owns_before = owner.owns_lock();
  owner.lock();
  const bool owns_after_lock = owner.owns_lock();
  value = 41;
  owner.unlock();
  owner.lock();
  ++value;
  std::cout << std::boolalpha;
  std::cout << "owns_before=" << owns_before << '\n';
  std::cout << "owns_after_lock=" << owns_after_lock << '\n';
  std::cout << "value=" << value << '\n';
}
```

```text
owns_before=false
owns_after_lock=true
value=42
```

#### `release-lock-ownership.cpp`

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::unique_lock<std::mutex> owner(mutex);
  std::mutex* released = owner.release();
  bool contender_acquired = true;
  std::thread contender([&] {
    contender_acquired = mutex.try_lock();
    if (contender_acquired) mutex.unlock();
  });
  contender.join();
  released->unlock();
  std::cout << std::boolalpha;
  std::cout << "owns=" << owner.owns_lock() << '\n';
  std::cout << "associated=" << (owner.mutex() != nullptr) << '\n';
  std::cout << "contender_acquired=" << contender_acquired << '\n';
}
```

```text
owns=false
associated=false
contender_acquired=false
```

## 4. `std::scoped_lock`

### 4.1 接口与合同

```cpp
// <mutex>；C++17 起
template<class... MutexTypes>
class scoped_lock {
public:
  using mutex_type = Mutex; // 仅当参数包恰有一个类型
  explicit scoped_lock(MutexTypes&...);
  explicit scoped_lock(std::adopt_lock_t, MutexTypes&...);
  ~scoped_lock();
  scoped_lock(const scoped_lock&) = delete;
  scoped_lock& operator=(const scoped_lock&) = delete;
};
```

一个 mutex 时只需 Cpp17BasicLockable，普通构造调用一次 lock；多 mutex 时每个类型须
满足 Cpp17Lockable，构造调用 `std::lock`，用未指定 lock/try_lock/unlock 序列避免死锁。
零参数可构造且无效果。

adopt 不加锁；当前线程必须已拥有每把 mutex 的 non-shared lock。它不抛异常。析构按
参数索引 unlock。类没有 owns 查询、提前 unlock、release 或 move。

单锁构造传播底层异常；多锁构造传播 std::lock 异常。std::lock 抛出前会 unlock 本轮已
取得的 Lockable。不要重复传同一普通 mutex，也不要在普通构造前已持其中一把非递归锁。

无渐进复杂度、取得顺序、公平或饥饿上界保证。Deadlock avoidance 不等于固定时间成功。
每把 mutex 必须活过 wrapper；同步来自各底层 mutex。

来源：[P0156R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0156r2.html)、
N4861 与当前 [`[thread.lock.scoped]`](https://eel.is/c++draft/thread.lock.scoped)、
[`[thread.lock.algorithm]`](https://eel.is/c++draft/thread.lock.algorithm)。

### 4.2 JS 对照与误区

> JavaScript 可按固定 Promise 获取顺序组合多个许可；scoped_lock 同步阻塞 C++ 线程并
> 调用多个 Lockable。其 RAII 与 memory-model edge 没有 Promise/GC 一一对应物。

误区：假设从左到右 lock；把 deadlock avoidance 当公平；未持全部锁却 adopt；已持一把
又普通构造；重复 mutex；期待 unlock/release/move；临时 wrapper 保护下一句；误记为 C++11。

### 4.3 示例

#### `update-two-balances.cpp`

```cpp
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex left_mutex;
  std::mutex right_mutex;
  int left = 1000;
  int right = 1000;
  const auto left_to_right = [&] {
    for (int i = 0; i < 200; ++i) {
      std::scoped_lock owner(left_mutex, right_mutex);
      --left;
      ++right;
    }
  };
  const auto right_to_left = [&] {
    for (int i = 0; i < 200; ++i) {
      std::scoped_lock owner(right_mutex, left_mutex);
      --right;
      ++left;
    }
  };
  std::thread first(left_to_right);
  std::thread second(right_to_left);
  first.join();
  second.join();
  std::cout << "left=" << left << '\n';
  std::cout << "right=" << right << '\n';
  std::cout << "total=" << left + right << '\n';
}
```

```text
left=1000
right=1000
total=2000
```

#### `adopt-locks-after-std-lock.cpp`

```cpp
#include <iostream>
#include <mutex>

int main() {
  std::mutex left_mutex;
  std::mutex right_mutex;
  int left = 0;
  int right = 0;
  std::lock(left_mutex, right_mutex);
  {
    std::scoped_lock owner(std::adopt_lock, left_mutex, right_mutex);
    left = 3;
    right = 4;
  }
  std::cout << "left=" << left << '\n';
  std::cout << "right=" << right << '\n';
}
```

```text
left=3
right=4
```

## 5. `<condition_variable>`

### 5.1 C++20 设施地图与合同

```cpp
namespace std {
  class condition_variable;
  class condition_variable_any;
  void notify_all_at_thread_exit(condition_variable&, unique_lock<mutex>);
  enum class cv_status { no_timeout, timeout };
}
```

直接包含 `<condition_variable>`；不要依赖传递包含。condition_variable 只等待
unique_lock<mutex>；condition_variable_any 可等待用户 BasicLockable。C++20 any 的
stop-token overload 属于版本地图，但当前 libc++ 缺完整 jthread/stop-token 支持，不以
fallback 伪装验证。

`notify_all_at_thread_exit` 移动接收已 locked 的 unique_lock，安排当前线程退出时通知和
释放；锁持有至 thread exit，可能扩大 lock-order deadlock。cv_status 只说明 timed wait
是否超时，不代表业务 predicate。

Header 无统一复杂度、公平或 wake 顺序保证。CV 构造可因非内存资源不足抛 system_error；
any 还可能抛 bad_alloc。析构前必须没有 blocked waiter，也不能让新 wait 与析构并发。

来源：N4861 `[condition.variable.syn]`/`[thread.condition.nonmember]`、
[`[condition.variable.syn]`](https://eel.is/c++draft/condition.variable.syn)、
[`[thread.condition.nonmember]`](https://eel.is/c++draft/thread.condition.nonmember)。

### 5.2 JS 对照与误区

> Promise 保存 settled 状态，未来注册仍可观察；CV notify 不保存状态。可靠等待来自
> “mutex 下的 predicate + wait 循环”，不是通知对象本身。

误区：依赖传递包含；notify 缓存令牌；wait 返回即条件成立；用 sleep 等 waiter；普通 CV
接受任意 lock；no_timeout 等于 predicate=true；thread-exit 通知立即 unlock；notify_all
保证顺序；通知后即可无协议销毁 CV。

### 5.3 示例

#### `notify-at-thread-exit.cpp`

```cpp
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool finished = false;
  int value = 0;
  std::thread worker([&] {
    std::unique_lock<std::mutex> lock(mutex);
    value = 42;
    finished = true;
    std::notify_all_at_thread_exit(condition, std::move(lock));
  });
  {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return finished; });
  }
  worker.join();
  std::cout << std::boolalpha;
  std::cout << "finished=" << finished << '\n';
  std::cout << "value=" << value << '\n';
}
```

```text
finished=true
value=42
```

#### `wait-with-condition-variable-any.cpp`

```cpp
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::recursive_mutex mutex;
  std::condition_variable_any condition;
  bool ready = false;
  int value = 0;
  std::thread worker([&] {
    std::unique_lock<std::recursive_mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    value = 42;
  });
  {
    std::lock_guard<std::recursive_mutex> lock(mutex);
    ready = true;
  }
  condition.notify_one();
  worker.join();
  std::cout << std::boolalpha;
  std::cout << "ready=" << ready << '\n';
  std::cout << "value=" << value << '\n';
}
```

```text
ready=true
value=42
```

## 6. `std::condition_variable`

### 6.1 C++20 代表接口

```cpp
class condition_variable {
public:
  condition_variable();
  ~condition_variable();
  condition_variable(const condition_variable&) = delete;
  condition_variable& operator=(const condition_variable&) = delete;
  void notify_one() noexcept;
  void notify_all() noexcept;
  void wait(std::unique_lock<std::mutex>&);
  template<class Predicate>
  void wait(std::unique_lock<std::mutex>&, Predicate);
  template<class Clock, class Duration>
  std::cv_status wait_until(std::unique_lock<std::mutex>&,
      const std::chrono::time_point<Clock, Duration>&);
  template<class Clock, class Duration, class Predicate>
  bool wait_until(std::unique_lock<std::mutex>&,
      const std::chrono::time_point<Clock, Duration>&, Predicate);
  template<class Rep, class Period>
  std::cv_status wait_for(std::unique_lock<std::mutex>&,
      const std::chrono::duration<Rep, Period>&);
  template<class Rep, class Period, class Predicate>
  bool wait_for(std::unique_lock<std::mutex>&,
      const std::chrono::duration<Rep, Period>&, Predicate);
};
```

省略 native handle。N4861 时间参数为 const reference；当前草案采用 by-value，页面须标明
C++20 基线。

### 6.2 参数、返回、错误、同步与生命周期

wait 要求 unique_lock<mutex> 当前 owns 且由调用线程持有。多个线程并发等待同一 CV 时，
必须关联同一个 mutex。Predicate 无参，结果按 BooleanTestable 判断；谓词和共享状态都在
mutex 已持有时访问。

无谓词 wait 返回 void，可因 notify 或 spurious wake 返回。谓词 overload 等价于
`while (!pred()) wait(lock)`。notify_one 解除一个当前 waiter，选择未指定；notify_all
解除所有当前 waiter，但它们仍竞争 mutex。

无谓词 timed wait 返回 timeout/no_timeout，后者不保证业务条件；谓词 timed overload
返回结束时 predicate 是否为 true，无论 deadline 是否也已到达。

构造可抛 system_error；notify 为 noexcept。普通 wait 不抛；若不能满足返回后重新 owns
mutex 的后置条件，则 terminate。谓词 wait 传播 predicate 异常；timed overload 还传播
timeout-related exceptions，并同样要求离开前重新持锁，否则 terminate。LWG 2135 澄清
了这一异常边界。

没有大 O、公平、wake 次序或饥饿上界保证。共享数据可见性来自 notifier 在 mutex 下发布，
以及 waiter 重新取得该 mutex。对象不可复制；析构前须排除 blocked waiter 与可能再次 wait
的路径。mutex、predicate state、CV 均须活过 worker。

来源：N4861 与当前
[`[thread.condition.condvar]`](https://eel.is/c++draft/thread.condition.condvar)、
[LWG 2114](https://cplusplus.github.io/LWG/issue2114)、
[LWG 2135](https://cplusplus.github.io/LWG/issue2135)、
[`[intro.races]`](https://eel.is/c++draft/intro.races)。

### 6.3 JS 对照与误区

> Promise settled value 是持久状态；EventEmitter emit 更像可能错过的通知，但 JS event
> loop 没有 wait 的原子 unlock/block/re-lock 与 mutex happens-before 合同。正确类比是
> “提醒重新读取共享条件”，不是“通知就是数据”。

误区：if 代替 predicate loop；修改 ready 不持同一 mutex；只 notify 不发布状态；认为
早通知缓存；不同 mutex 等待同一 CV；用 lock_guard 调 wait；认为返回后 lock 已释放；
假设 notify_one 选中谁；输出 notify_all wake 次序；销毁仍有 blocked waiter 的 CV。

### 6.4 示例

#### `wait-for-published-value.cpp`

```cpp
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool ready = false;
  int published = 0;
  int observed = 0;
  std::thread worker([&] {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    observed = published;
  });
  {
    std::lock_guard<std::mutex> lock(mutex);
    published = 42;
    ready = true;
  }
  condition.notify_one();
  worker.join();
  std::cout << std::boolalpha;
  std::cout << "observed=" << observed << '\n';
  std::cout << "ready=" << ready << '\n';
}
```

```text
observed=42
ready=true
```

#### `wake-all-subscribers.cpp`

```cpp
#include <array>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool ready = false;
  int base = 0;
  std::array<int, 2> results{};
  const auto subscribe = [&] (std::size_t index) {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    results[index] = base + static_cast<int>(index);
  };
  std::thread first(subscribe, 0);
  std::thread second(subscribe, 1);
  {
    std::lock_guard<std::mutex> lock(mutex);
    base = 42;
    ready = true;
  }
  condition.notify_all();
  first.join();
  second.join();
  std::cout << "first=" << results[0] << '\n';
  std::cout << "second=" << results[1] << '\n';
  std::cout << "count=" << results.size() << '\n';
}
```

```text
first=42
second=43
count=2
```

## 7. 示例与来源验收表

| Entry / 文件名 | 精确 stdout |
|---|---|
| `std-unique-lock` / `defer-lock-and-relock.cpp` | `owns_before=false\nowns_after_lock=true\nvalue=42\n` |
| `std-unique-lock` / `release-lock-ownership.cpp` | `owns=false\nassociated=false\ncontender_acquired=false\n` |
| `std-scoped-lock` / `update-two-balances.cpp` | `left=1000\nright=1000\ntotal=2000\n` |
| `std-scoped-lock` / `adopt-locks-after-std-lock.cpp` | `left=3\nright=4\n` |
| `header-condition-variable` / `notify-at-thread-exit.cpp` | `finished=true\nvalue=42\n` |
| `header-condition-variable` / `wait-with-condition-variable-any.cpp` | `ready=true\nvalue=42\n` |
| `std-condition-variable` / `wait-for-published-value.cpp` | `observed=42\nready=true\n` |
| `std-condition-variable` / `wake-all-subscribers.cpp` | `first=42\nsecond=43\ncount=2\n` |

全部 manifest 使用 `kind: "run"`、`standard: "c++20"`。实现代理须以
`clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread` 逐一实测；本研究子任务
收到停止编译指令后未执行最终编译门，不能把源码审查误报为本地 verified。

一级来源矩阵：N3337 给出 C++11 基线；N4861 给出 C++20 接口；P0156R2 引入
scoped_lock；当前 `[thread.lock.unique]`、`[thread.lock.scoped]`、
`[thread.lock.algorithm]` 核对锁合同；当前 `[thread.condition.general]`、
`[condition.variable.syn]`、`[thread.condition.nonmember]`、`[thread.condition.condvar]`
核对 CV；LWG 2104、2114、2135、2190 核对历史澄清。

二级结构参考：[`unique_lock`](https://zh.cppreference.com/w/cpp/thread/unique_lock)、
[`scoped_lock`](https://zh.cppreference.com/w/cpp/thread/scoped_lock)、
[`<condition_variable>`](https://zh.cppreference.com/w/cpp/header/condition_variable)、
[`condition_variable`](https://zh.cppreference.com/w/cpp/thread/condition_variable)。

建议 `verifiedAt: 2026-09-03`。终审拒绝：release 自动 unlock；跨线程转移 mutex owner；
未拥有全部 mutex 却 adopt；把 deadlock avoidance 写成公平；用 sleep 猜 waiter；把 notify
当状态；忽略虚假唤醒；不同 mutex 等待同一 CV；断言 wake 顺序；仍有 blocked waiter
时析构 CV；未执行真实编译却标记示例 verified。
