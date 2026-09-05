# C++ Reference 第十九批：`std::jthread` 与协作式停止研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-05
>
> 精确范围：`std::jthread`（含理解该类型所必需的 `std::stop_token` / `std::stop_source`
> 语义，但本批不为后二者建立独立 Entry）
>
> 事实基线：C++20 最终工作草案 N4861、当前 C++ Working Draft 与原始提案
> P0660R10。中文 cppreference 只用于二级页面结构和覆盖核对；正文、表格、示例与
> JavaScript 类比应由项目原创。

## 1. 批次结论与 Entry 边界

`std::jthread` 在 C++20 由 P0660R10 加入标准，定义于 `<thread>`。它与
`std::thread` 一样管理单个执行线程，但额外拥有停止状态、可以把 `std::stop_token`
注入线程函数，并在仍为 joinable 时于析构中先 `request_stop()` 再 `join()`。

建议新增唯一 Entry：

| 建议 ID | kind | symbol | slug | header | `since` | category |
|---|---|---|---|---|---|---|
| `std-jthread` | `type` | `std::jthread` | `standard-library/concurrency/jthread` | `<thread>` | `c++20` | `concurrency` |

建议 `relatedEntryIds`：`header-thread`、`std-thread`、`std-atomic`。页面正文可以链接和
讲解 `std::stop_token`、`std::stop_source`、`std::stop_callback`，但本批不创建这三个
独立条目，也不扩展 condition-variable 的 stop-token wait、线程池、future 取消、
coroutine 或 sender/receiver。

功能检测宏为 `__cpp_lib_jthread == 201911L`，由 `<version>`、`<stop_token>` 与
`<thread>` 提供。内容页应以 C++20 N4861 的接口为主体；当前草案的 thread attributes
是后续标准演进，不应混入 C++20 教学轮廓。

来源：[N4861 `[thread.jthread.class]`](https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.class)、
[N4861 feature-test macros](https://timsong-cpp.github.io/cppwp/n4861/version.syn)、
[当前 `[thread.jthread.class]`](https://eel.is/c++draft/thread.jthread.class)、
[P0660R10](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf)。

## 2. 本机能力探针与发布门槛

用于验证的最小真实探针应同时使用 `std::jthread` 与 `std::stop_token`，而不是只检查
语言模式或用普通 `std::thread` fallback：

```cpp
#include <stop_token>
#include <thread>

int main() {
  std::jthread worker([] (std::stop_token token) {
    while (!token.stop_requested()) {
      std::this_thread::yield();
    }
  });

  worker.request_stop();
  worker.join();
}
```

以 `-std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread` 编译并运行的本机结果：

| 工具链 | 版本 | 结果 | 结论 |
|---|---|---|---|
| `/usr/bin/clang++` + 系统 libc++ | Apple clang 15.0.0 | 编译失败；没有 `std::jthread` / `std::stop_token` | 不可作为本条目的验证工具链 |
| `/opt/homebrew/opt/llvm/bin/clang++` + Homebrew libc++ | Homebrew LLVM 22.1.6 | 严格 C++20 编译、运行成功 | 可验证 |
| `/opt/homebrew/opt/gcc/bin/g++-15` + libstdc++ | GCC 15.2.0 | 严格 C++20 编译、运行成功 | 可交叉验证 |

因此第十九批可以发布，但 Reference 的验证命令必须选择真实支持
`__cpp_lib_jthread >= 201911L` 的工具链。Judge 的默认编译器是否变更是另一个决策；
不能用条件编译跳过主体、替换为 `std::thread` 或只验证一段空程序来声称本条目已通过。

## 3. C++20 接口轮廓

页面建议展示教学轮廓而非实现布局：

```cpp
// <thread>；C++20 教学轮廓
namespace std {
  class jthread {
  public:
    using id = thread::id;
    using native_handle_type = thread::native_handle_type;

    jthread() noexcept;

    template<class F, class... Args>
    explicit jthread(F&& f, Args&&... args);

    ~jthread();

    jthread(const jthread&) = delete;
    jthread(jthread&&) noexcept;
    jthread& operator=(const jthread&) = delete;
    jthread& operator=(jthread&&) noexcept;

    void swap(jthread&) noexcept;
    bool joinable() const noexcept;
    void join();
    void detach();
    id get_id() const noexcept;
    native_handle_type native_handle();

    stop_source get_stop_source() noexcept;
    stop_token get_stop_token() const noexcept;
    bool request_stop() noexcept;

    static unsigned int hardware_concurrency() noexcept;
  };

  void swap(jthread&, jthread&) noexcept;
}
```

`stop_token` 类型本身定义于 `<stop_token>`，而 `jthread` 定义于 `<thread>`。
只使用 `jthread` 时直接包含 `<thread>`；若源码显式写出 `std::stop_token`，示例应再直接
包含 `<stop_token>`，不要依赖 `<thread>` 的传递包含。

来源：[N4861 `[thread.syn]`](https://timsong-cpp.github.io/cppwp/n4861/thread.syn)、
[N4861 `[thread.jthread.class]`](https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.class)、
[当前 `<thread>` synopsis](https://eel.is/c++draft/thread.syn)。

## 4. 构造、token 注入与线程函数合同

### 4.1 默认构造

默认构造的 `jthread` 不表示线程，`get_id() == id{}`，其内部 stop source 不可停止。
它是合法的空句柄，`joinable()` 为 `false`；对它调用 `join()` 或 `detach()` 不是无操作，
而会进入相应的 `system_error` 错误合同。

### 4.2 启动构造函数的参数与选择规则

`jthread(F&& f, Args&&... args)` 在构造线程中 materialize callable 与参数的衰减副本，
并创建内部 stop state。线程入口有两种形式，选择顺序很重要：

```cpp
invoke(decay-copy(f), get_stop_token(), decay-copy(args)...)
```

若上式良构，则使用它；只有它不良构时，才尝试：

```cpp
invoke(decay-copy(f), decay-copy(args)...)
```

因此：

- 若 callable 接受 `std::stop_token` 作为首参，`jthread` 自动注入自己的 token；调用者
  不应再把同一个 token 当普通参数传入；
- callable 不接受 token 也完全合法，此时 `jthread` 仍会在析构时发出停止请求，但线程
  函数没有观察该请求的通道，只能等待 callable 自行返回；
- 若 callable 同时可按“带 token”和“不带 token”两种方式调用，带 token 的形式优先；
- callable 的返回值被忽略；若线程入口函数向外抛异常，调用 `std::terminate`，异常不会
  自动存入 `jthread` 或跨线程交还调用方；
- callable / 参数副本的构造错误发生在构造线程；无法创建系统线程时构造函数抛
  `std::system_error`。

构造函数返回与新线程中 callable 副本开始调用之间有同步关系。成功构造后
`get_id() != id{}`、`joinable()` 为真、stop source 可停止。

来源：[N4861 `[thread.jthread.cons]`](https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.cons)、
[当前 `[thread.jthread.cons]`](https://eel.is/c++draft/thread.jthread.cons)。

## 5. 协作式停止：请求不是强制终止

`jthread` 逻辑上持有一个 `stop_source`。`get_stop_token()` 得到与同一 stop state 关联的
只读观察者；`get_stop_source()` 得到可复制的请求端；`request_stop()` 等价于对内部
source 调用 `request_stop()`。

停止状态是单调、一次性的：第一次真正把状态改为“已请求”的调用返回 `true`；后续请求
没有状态变化并返回 `false`。若 source 已 disengaged，也返回 `false`。请求一旦成立不能
撤销或重置。所有关联 token/source 都能观察同一状态。

这不是 `pthread_cancel`、信号、异常注入或抢占式 kill：

- 线程函数必须主动轮询 `stop_requested()`，或使用支持 stop token 的等待设施/回调；
- `request_stop()` 不等待线程退出，也不等价于 `join()`；
- callable 忽略 token 时，停止请求不会使它自动返回；
- `request_stop()` 会同步执行当前注册的 stop callbacks，因此它虽然 `noexcept`，耗时
  仍可能包含任意 callback 工作；callback 若向外抛异常会触发 `std::terminate`。

停止相关并发保证：关联 source/token 上的 `request_stop()`、`stop_requested()` 与
`stop_possible()` 不引入 data race；一次返回 `true` 的 `request_stop()` 与观察到
`stop_requested() == true` 的调用同步。这个边可以发布请求前的写入，但不会自动保护
程序中其他无关共享数据。

来源：[当前 stop-token introduction](https://eel.is/c++draft/thread.stoptoken.intro)、
[当前 stoppable-source semantics](https://eel.is/c++draft/stoptoken.concepts)、
[当前 `jthread` stop handling](https://eel.is/c++draft/thread.jthread.stop)、
[P0660R10 设计讨论](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf)。

## 6. 析构、移动与所有权状态

### 6.1 析构的精确顺序

若 `joinable()` 为真，析构函数调用 `request_stop()`，然后调用 `join()`；若不 joinable，
不做这两步。它带来作用域退出时的结构化回收，但不是“析构立即结束线程”：析构会阻塞到
线程真实结束，若线程不观察请求、在不可停止操作中永久阻塞，或等待调用线程仍持有的锁，
析构可以无限等待甚至形成死锁。

### 6.2 move-only 句柄

`jthread` 不可复制、可以移动。移动构造把线程表示和 stop source 一并转移到目标，源对象
进入默认构造状态：`get_id() == id{}`，源 stop source 不可停止。线程入口已持有的 token
仍关联被转移到目标对象的同一个 stop state，所以应由新 owner 请求停止。

移动赋值不是廉价的句柄覆盖：若目标原来 joinable，它先对原线程请求停止并 join，再接管
源对象。即使函数签名是 `noexcept`，它也可能阻塞。`swap` 交换线程表示与停止所有权，
但不等待线程。

### 6.3 `join`、`detach` 与状态失效

| 操作后 | 当前对象是否表示线程 | `joinable()` | 自动回收后果 |
|---|---:|---:|---|
| 默认构造 | 否 | `false` | 无线程可回收 |
| 成功启动 | 是 | `true` | 析构会 stop + join |
| 移动后的 source | 否 | `false` | 责任已转给 destination |
| 成功 `join()` | 否 | `false` | 已等待完成 |
| 成功 `detach()` | 否 | `false` | 线程可能仍在执行；析构不再 stop + join |

`join()` 的成功返回与被管理线程完成同步，因此 join 后可以按普通 happens-before 规则读取
worker 已发布的写入。`detach()` 切断句柄所有权，不延长引用捕获、指针、`this` 或其他
共享对象的生命周期；它也让 RAII 自动停止/等待失效，应当是少数经过证明的选择，而不是
“后台执行”的默认写法。

线程句柄状态与 stop state 不是同一维度。`join()` / `detach()` 令 `jthread` 不再表示
线程，但先前复制出的 token/source 可以继续引用共享 stop state；共享状态资源在最后一个
owner 离开后才释放。不要用 `stop_possible()` 代替 `joinable()`。

来源：[N4861 constructors/destructor/move](https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.cons)、
[N4861 members](https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.mem)、
[当前 stop-state lifetime](https://eel.is/c++draft/thread.stoptoken.intro)。

## 7. 成员参数、返回值、错误与复杂度

| API | 参数 | 返回 / 后置状态 | 异常与错误条件 |
|---|---|---|---|
| `jthread()` | 无 | 空句柄；不可停止 | `noexcept` |
| `jthread(f, args...)` | callable 与参数；按值类别转发后衰减保存 | 新线程句柄；入口返回值被忽略 | 副本构造异常；无法建线程时 `system_error(resource_unavailable_try_again)` |
| `~jthread()` | 无 | 若 joinable：先请求停止再等待结束 | 析构不能把 `join()` 错误作为普通异常通道；错误逃逸会终止程序 |
| move constructor | `jthread&&` | 接管线程和 stop state；source 为空 | `noexcept` |
| move assignment | `jthread&&` | 先清理目标旧线程，再接管；返回 `*this` | `noexcept`，但可阻塞 |
| `joinable()` | 无 | `get_id() != id{}` | `noexcept` |
| `join()` | 无 | 等待结束；成功后不再表示线程 | `system_error`：`resource_deadlock_would_occur`、`no_such_process`、`invalid_argument` |
| `detach()` | 无 | 线程独立继续；当前对象不再表示它 | `system_error`：`no_such_process`、`invalid_argument` |
| `get_id()` | 无 | 空句柄返回默认 ID，否则返回被管理线程 ID | `noexcept` |
| `native_handle()` | 无 | 实现定义的底层句柄 | 可移植语义由实现定义，不适合作为跨平台业务接口 |
| `get_stop_source()` | 无 | 内部 stop source 的副本 | `noexcept` |
| `get_stop_token()` | 无 | 关联 token；无状态时为 disengaged token | `noexcept` |
| `request_stop()` | 无 | 首次真正发出请求返回 `true`，否则 `false` | `noexcept`；callback 抛异常会 terminate |
| `swap(other)` / `std::swap` | 另一个 `jthread` | 交换线程与停止所有权 | `noexcept` |
| `hardware_concurrency()` | 无 | 硬件线程上下文数量提示；未知时可为 0 | `noexcept` |

标准没有为这些 `jthread` 操作规定可移植的大 O 复杂度。页面的复杂度栏应明确写“标准未
指定”，并补充真正重要的等待语义：构造依赖 OS 线程创建；`join()` 与析构阻塞时长取决于
worker；`request_stop()` 可能同步执行 callbacks；`hardware_concurrency()` 只给 hint。
不得自行把这些操作标为 O(1)，也不得给 join/析构承诺时间上界。

来源：[当前 members](https://eel.is/c++draft/thread.jthread.mem)、
[当前 stop members](https://eel.is/c++draft/thread.jthread.stop)、
[当前 static member](https://eel.is/c++draft/thread.jthread.static)、
[线程异常总则](https://eel.is/c++draft/thread.req.exception)。

## 8. 线程安全、同步与生命周期审计清单

- 构造函数完成 synchronizes-with 新线程开始调用 callable 副本；不要把这误读为构造后
  所有共享对象都永久安全。
- 线程完成 synchronizes-with 对应成功 `join()` 返回；worker 写入若通过这条边发布，主
  线程可在 join 后读取。
- 同一个 `jthread` 对象上的普通成员操作彼此不自动同步。不要一边 move/detach/join，
  另一边对同一 wrapper 调用成员。
- 关联 stop state 的 request/query 具有明确的无 data-race 与 synchronizes-with 保证；
  其他业务字段仍需 mutex、atomic 或清晰的 happens-before。
- lambda 的引用捕获、raw pointer、`this`、`string_view`、`span` 等非 owning 视图必须活到
  worker 最后一次访问。正常作用域析构 join 有帮助，move 会转移等待责任，detach 则失去
  这层保护。
- worker 的未捕获异常会 terminate；需要返回值或异常时，显式使用共享状态、promise/
  future 或捕获并编码错误，`jthread` 自身不是结果容器。

## 9. 与 `std::thread` 的选择对照

| 维度 | `std::thread` | `std::jthread` |
|---|---|---|
| 首发 | C++11 | C++20 |
| 析构时仍 joinable | 调用 `std::terminate` | `request_stop()` 后 `join()` |
| 内建 stop state | 无 | 有 |
| 自动注入 `stop_token` | 无 | callable 接受首参时注入 |
| 拷贝 / 移动 | 不可复制、可移动 | 不可复制、可移动 |
| 显式 `join` / `detach` | 有 | 有 |
| 线程函数返回 / 异常通道 | 无 | 同样无 |

一般新代码若工具链支持且生命周期应由作用域管理，优先考虑 `jthread`。但它不是
`thread` 的无条件机械替换：自动析构等待会改变时延和死锁面；停止是协作式；detach 仍会
放弃结构化生命周期；面向 C++17 或旧标准库的项目也不能使用它。

## 10. JavaScript 对照：可迁移直觉与边界

| C++ | 最接近的 Web/JS 直觉 | 关键边界 |
|---|---|---|
| `stop_source` / `request_stop()` | `AbortController` / `.abort()` | 都是单调请求；JS abort 可携带 `reason`，C++ stop state 不携带原因 |
| `stop_token` / `stop_requested()` | `AbortSignal` / `.aborted` | 两者都可被操作忽略；C++ token 还参与明确的跨线程同步语义 |
| `jthread` 句柄 | `Worker` 句柄 | C++ 线程默认共享地址空间；Web Worker 默认隔离并以消息通信 |
| `join()` | 等待 worker 完成的 Promise（概念上） | C++ join 同步阻塞 OS thread；`await` 让出并恢复 continuation，不是 blocking join |
| `detach()` | 丢弃对后台任务的结构化等待 | Web 平台没有完全同构的 RAII 句柄状态 |

必须单独强调两条反类比：

1. `Worker.prototype.terminate()` 按 HTML Standard 丢弃排队任务并中止正在运行的 worker，
   更接近强制终止；`jthread::request_stop()` 只表达愿望，worker 必须协作退出。
2. JavaScript 对象离开词法作用域或被 GC 不会像 C++ `jthread` 析构那样确定地 abort +
   blocking join。`Promise` 也不内建取消；Web API 通常把 `AbortSignal` 作为显式参数并在
   abort 时拒绝 Promise。

来源：[WHATWG DOM aborting activities](https://dom.spec.whatwg.org/#aborting-ongoing-activities)、
[WHATWG HTML workers](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate)、
[MDN `AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)、
[MDN `Worker.terminate()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)。

## 11. 必须覆盖的常见误区

1. 以为 `request_stop()` 会强杀线程，或会等待线程退出。
2. 以为 `jthread` 析构一定立即完成；实际上它可能长期阻塞或死锁。
3. callable 接受 token 却把 token 放在非首参位置，误以为仍会自动注入。
4. callable 同时有带 token / 不带 token 的调用形式，却没意识到带 token 形式优先。
5. 线程函数完全忽略 token，却期待析构停止无限循环。
6. 在持有 worker 退出所需 mutex 时销毁或移动赋值 `jthread`。
7. 调用 `detach()` 后仍期待析构 stop + join，或让引用捕获早于 detached worker 销毁。
8. 以为线程自然执行完后 `joinable()` 自动变 `false`；必须成功 join/detach 或转移句柄。
9. 对空句柄重复 `join()` / `detach()`，把规定的 `system_error` 当作无操作。
10. 把 `stop_possible()` 当 `joinable()`，混淆停止状态与线程句柄状态。
11. 以为 worker 的返回值或异常存进 `jthread`；返回值被忽略，未捕获异常 terminate。
12. 并发操作同一个 `jthread` wrapper，误以为 stop-state 的线程安全覆盖全部成员。
13. 输出 thread ID、native handle、调度顺序、耗时或 `hardware_concurrency()` 作为稳定快照。
14. 只看编译器语言版本，不检查所链接标准库是否实现 `__cpp_lib_jthread`。

## 12. 两个确定性可运行示例

示例共同红线：C++20；严格 warning；无 `sleep_for`；worker 不输出；不输出线程 ID、调度
顺序或耗时；主线程只在建立同步后打印。下列两例已分别使用 Homebrew LLVM 22.1.6 与
GCC 15.2.0，以 `-std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread` 编译、运行并核对
精确 stdout。

### 示例 1：显式请求、幂等返回与 join 状态

建议文件名：`request-cooperative-stop.cpp`

```cpp
#include <atomic>
#include <iostream>
#include <stop_token>
#include <thread>

int main() {
  std::atomic<bool> ready{false};
  std::atomic<int> checkpoints{0};

  std::jthread worker([&] (std::stop_token token) {
    checkpoints.fetch_add(1, std::memory_order_relaxed);
    ready.store(true, std::memory_order_release);
    ready.notify_one();

    while (!token.stop_requested()) {
      std::this_thread::yield();
    }

    checkpoints.fetch_add(1, std::memory_order_relaxed);
  });

  ready.wait(false, std::memory_order_acquire);
  const bool first_request = worker.request_stop();
  const bool second_request = worker.request_stop();
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "first_request=" << first_request << '\n';
  std::cout << "second_request=" << second_request << '\n';
  std::cout << "checkpoints="
            << checkpoints.load(std::memory_order_relaxed) << '\n';
  std::cout << "joinable=" << worker.joinable() << '\n';
}
```

精确 stdout：

```text
first_request=true
second_request=false
checkpoints=2
joinable=false
```

覆盖点：token 首参注入；ready handshake 避免猜调度；首次/重复停止请求的返回；显式 join
后的句柄状态。`checkpoints` 用 atomic 消除共享写读竞态，输出不依赖 worker 调度顺序。

### 示例 2：析构自动请求并等待

建议文件名：`stop-and-join-on-destruction.cpp`

```cpp
#include <atomic>
#include <iostream>
#include <stop_token>
#include <thread>

int main() {
  std::atomic<bool> started{false};
  std::atomic<bool> stop_observed{false};

  {
    std::jthread worker([&] (std::stop_token token) {
      started.store(true, std::memory_order_release);
      started.notify_one();

      while (!token.stop_requested()) {
        std::this_thread::yield();
      }

      stop_observed.store(true, std::memory_order_release);
    });

    started.wait(false, std::memory_order_acquire);
  }

  std::cout << std::boolalpha;
  std::cout << "stop_observed="
            << stop_observed.load(std::memory_order_acquire) << '\n';
}
```

精确 stdout：

```text
stop_observed=true
```

覆盖点：作用域退出触发 request_stop + join；主线程在析构返回后读取结果；无 sleep 或超时
猜测。注意这只是教学示例，实际 worker 应优先使用可停止的阻塞等待，避免忙轮询。

## 13. 内容验收清单

`std-jthread` 页面必须在同一条目内可核对：

- [ ] `<thread>`、C++20、`__cpp_lib_jthread == 201911L`；
- [ ] interface synopsis 与 member 分类；
- [ ] callable/参数约束，以及 token-first 注入优先级；
- [ ] 参数存储、返回值忽略、线程函数未捕获异常 terminate；
- [ ] `request_stop()` 的 bool 返回和一次性、协作式含义；
- [ ] 析构、move construction、move assignment、join/detach 的所有权迁移；
- [ ] join / detach / thread construction 的 `system_error` 条件；
- [ ] stop-state 与 join 的 synchronizes-with，及同一 wrapper 不自动同步；
- [ ] 生命周期、detach 悬空、析构阻塞/死锁面；
- [ ] 复杂度“标准未指定”，不虚构 O(1)；
- [ ] `hardware_concurrency()` 与 native handle 的实现相关边界；
- [ ] `std::thread` 对照；
- [ ] AbortController/AbortSignal、Worker、Promise/await 的类比与反类比；
- [ ] 两个在真实支持工具链上严格编译、运行并核对 stdout 的示例；
- [ ] Apple clang 15 不支持且不得 fallback，Homebrew LLVM 22 / GCC 15 可验证。

## 14. 建议 sources URL 清单

Entry manifest 建议至少登记以下来源：

1. `https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.class`
2. `https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.cons`
3. `https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.mem`
4. `https://timsong-cpp.github.io/cppwp/n4861/thread.jthread.stop`
5. `https://timsong-cpp.github.io/cppwp/n4861/version.syn`
6. `https://eel.is/c++draft/thread.jthread.class`
7. `https://eel.is/c++draft/thread.jthread.cons`
8. `https://eel.is/c++draft/thread.jthread.mem`
9. `https://eel.is/c++draft/thread.jthread.stop`
10. `https://eel.is/c++draft/stoptoken.concepts`
11. `https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0660r10.pdf`
12. `https://zh.cppreference.com/cpp/thread/jthread`

JavaScript 对照来源放入正文/扩展阅读即可，不必伪装成 C++ API 的规范来源：WHATWG DOM
AbortController/AbortSignal、WHATWG HTML Worker termination、MDN 对应页面。

## 15. 最终研究结论

第十九批应新增 `std-jthread`，并把它写成“结构化线程所有权 + 一次性协作停止”的页面，
而不是“自动杀线程”的便利封装。真正决定内容质量的五条主线是：token-first 调用选择、
stop state 的单调协作语义、析构的 request-then-join 顺序、move/detach 后责任变化、以及
stop/join 各自建立的同步边。

本机已有两套可真实验证的现代标准库工具链，发布阻塞已从“机器不支持”转变为“Reference
检查应选择支持该功能的编译器”。实现阶段必须让两个示例在 Homebrew LLVM 22.1.6（并可
用 GCC 15.2.0 交叉核对）下以严格 C++20 构建并得到精确 stdout；Apple clang 15 的失败
应继续作为能力检测与可移植性说明，而不能由 fallback 掩盖。
