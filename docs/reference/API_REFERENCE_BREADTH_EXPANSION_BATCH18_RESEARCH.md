# C++ Reference 第十八批：`<future>`、`std::future` 与 `std::async` 研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-05
>
> 精确范围：`<future>`、`std::future`、`std::async`
>
> 事实基线：C++11 工作草案 N3337、C++20 最终工作草案 N4861、当前
> C++ Working Draft，以及直接相关的 WG21 papers / LWG issues。中文
> cppreference 仅用于二级信息结构核对；正文、示例和 JavaScript 类比必须原创。

## 1. 批次目标与边界

第十五至十七批已经建立 thread、mutex、condition variable 与 atomic 的基础。本批补上
标准 C++11 future 共享状态模型，以及从 `std::async` 得到单消费者结果的最小路径。

Catalog 应从 version 17、116 Entries 升到 version 18、119 Entries。本批只新增三页：

| 建议 ID | kind | symbol | slug | header | `since` |
|---|---|---|---|---|---|
| `header-future` | `header` | `<future>` | `standard-library/headers/future` | `<future>` | `c++11` |
| `std-future` | `type` | `std::future` | `standard-library/concurrency/future` | `<future>` | `c++11` |
| `std-async` | `function` | `std::async` | `standard-library/concurrency/async` | `<future>` | `c++11` |

三页沿用 `concurrency` 分类，建议 `verifiedAt: 2026-09-05`。建议关系：

- `header-future`：`std-future`、`std-async`、`std-thread`；
- `std-future`：`header-future`、`std-async`、`std-thread`；
- `std-async`：`header-future`、`std-future`、`std-thread`。

Header 页可导航到 `std::promise`、`std::shared_future`、`std::packaged_task`、
`std::future_error`、`std::launch` 和 `std::future_status`，但本批不为它们创建独立 Entry。
也不扩写并发 TS 的 `future::then`、executor、coroutine、sender/receiver、线程池或取消模型。
C++20 的 `std::future` 没有标准 continuation API，也没有内建取消操作，页面不可暗示存在
`.then()`、`when_all()` 或 `abort()`。

仓库检查结果：catalog 17 目前确有 116 Entries，且没有 future/async Entry；既有
`std::thread` 页面只把 future/promise 当结果通道提及，没有重复本批操作合同。

来源：[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4861 `[futures]`](https://timsong-cpp.github.io/cppwp/n4861/futures)、当前
[`[futures]`](https://eel.is/c++draft/futures)。

## 2. 核心模型：共享状态不是 `future` 对象本身

### 2.1 Provider、return object 与 result

future 设施用 shared state 传递结果。状态包含状态信息，以及一个可能尚未求值的 result；
result 可以是值、`void` 或异常。提供结果的一侧是 asynchronous provider，例如
`std::promise`、`std::packaged_task` 或 `std::async` 管理的调用；读取结果的一侧是
asynchronous return object，例如 `std::future`。

这三者必须在页面中分开：

| 名称 | 学习者可见角色 | 不是 |
|---|---|---|
| provider | 写入值或异常、令状态 ready | `future` 自己 |
| shared state | 独立保存状态和 result | 栈上的 `future` wrapper |
| return object | 持有状态引用，等待并取走 result | 必然代表一个 OS thread |

`std::async(std::launch::deferred, ...)` 证明 future 不等于线程：shared state 可以先保存一个
尚未执行的函数，在首次 non-timed wait 时由等待线程执行。future 设施也可在单线程程序中
使用。

来源：N4861 [`[futures.overview]`](https://timsong-cpp.github.io/cppwp/n4861/futures)、
[`[futures.state]`](https://timsong-cpp.github.io/cppwp/n4861/futures.state)。

### 2.2 Ready、等待与同步

shared state 只有在已经保存可取的值或异常时才是 ready。Provider 成功设置 result 的调用
与成功检测到对应 ready state 的调用同步；将正常或异常 result 存入状态，与 waiting
function 的成功返回同步。因此 worker 在完成计算后写入 result，consumer 在 `wait()` 或
`get()` 成功返回后能观察到由该同步链发布的效果。

这不等于“future 自动保护所有共享对象”。`future` 的成员函数不会彼此自动同步，也不会与
`shared_future` 成员调用自动同步；同一个 `future` wrapper 被多个线程并发操作仍需调用者
协调。若 result 是引用，引用所指对象的后续冲突访问也需要自己的同步协议。

来源：N4861 [`[futures.state]`](https://timsong-cpp.github.io/cppwp/n4861/futures.state)、
[`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)。

### 2.3 Release shared state 与阻塞例外

return object 或 provider “release its shared state”表示放弃自己的状态引用；若这是最后一个
引用，还会销毁 shared state。通常 release 不为 ready 而阻塞，但同时满足以下三项时可以
阻塞：

1. 状态由 `std::async` 创建；
2. 状态尚未 ready；
3. 当前操作释放最后一个状态引用。

因此不能泛化为“所有 `future` 析构都阻塞”，也不能泛化为“析构从不阻塞”。C++11 发布后
由 N3776 明确了这项规则；C++20 N4861 已包含它。由 `promise` 或 `packaged_task` 建立的普通
future 析构不会仅为等待 provider 而阻塞；`std::async` 状态的最后释放则可能等待。

来源：N4861 [`[futures.state]`](https://timsong-cpp.github.io/cppwp/n4861/futures.state)、
[N3776 “Wording for ~future”](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3776.pdf)。

### 2.4 Abandon 与 `broken_promise`

Provider 在状态尚未 ready 时 abandon shared state，会先把一个
`std::future_error(std::future_errc::broken_promise)` 保存为 exceptional result，再令状态
ready，最后释放状态。典型情形是 `std::promise` 在未 `set_value` / `set_exception` 时析构。
消费者随后 `get()` 会取出并抛出这一个已存异常。

“broken promise”不是超时，也不是 invalid future。它说明 return object 仍有有效 shared
state，只是 provider 未交付正常结果便离开；`get()` 仍按一次性取值流程消费该异常状态。

来源：N3337 [`[futures.state]`](https://timsong-cpp.github.io/cppwp/n3337/futures.state)、
N4861 [`[futures.state]`](https://timsong-cpp.github.io/cppwp/n4861/futures.state)、
当前 [`[futures.promise]`](https://eel.is/c++draft/futures.promise)。

## 3. `<future>` Header Entry

### 3.1 直接包含合同

页面必须展示并要求：

```cpp
#include <future>
```

不要依赖 `<thread>`、`<functional>`、`<chrono>`、`<memory>` 或其他实现头间接带入 future
声明。使用 `std::thread`、`std::ref`、chrono 类型或流输出时，示例还应分别直接包含它们
自己的 header。

来源：N4861 [`[future.syn]`](https://timsong-cpp.github.io/cppwp/n4861/future.syn)、
当前 [`[future.syn]`](https://eel.is/c++draft/future.syn)。

### 3.2 学习者设施地图

Header 页采用按职责分组的地图，不复制整面 synopsis：

| 设施 | 首发 | Header 页应说明的职责 |
|---|---|---|
| `std::promise<R>` | C++11 | 显式 provider；写入一个值或异常，并产生关联 future |
| `std::packaged_task<R(Args...)>` | C++11 | 把 callable 包装成 provider；调用结果或异常进入 shared state |
| `std::future<R>` / `R&` / `void` | C++11 | move-only、单消费者 return object；等待并一次性 `get()` |
| `std::shared_future<R>` / `R&` / `void` | C++11 | 可复制、多观察者 return object；不是本批实体页 |
| `std::async` | C++11 | 按 launch policy 建立调用与返回的 future |
| `std::launch` | C++11 | bitmask policy：标准位为 `async` 与 `deferred` |
| `std::future_status` | C++11 | timed wait 返回 `ready`、`timeout` 或 `deferred` |
| `std::future_error` / `future_errc` | C++11 | future 协议错误与其 error code |
| `future_category` / `make_error_code` / `make_error_condition` | C++11 | 将 `future_errc` 接入标准 error code 体系 |

`std::future<R>` 并不因名字带 “future” 就可以复制或多次消费；需要多个观察者时先理解
`shared_future`。`std::packaged_task` 可在当前线程直接调用，也可移动到 thread 中执行；
header 地图不能把它描述成“自动建线程”。

来源：N4861 [`[future.syn]`](https://timsong-cpp.github.io/cppwp/n4861/future.syn)。

### 3.3 错误码地图

| `future_errc` | 协议含义 | 典型来源 |
|---|---|---|
| `broken_promise` | provider 未设置 result 就 abandon | 未兑现的 `promise` 析构 |
| `future_already_retrieved` | 同一 provider 已经取过 return object | 对同一 `promise` 再次 `get_future()` |
| `promise_already_satisfied` | 同一 state 已经有值或异常 | 再次 `set_value` / `set_exception` |
| `no_state` | 要求 provider state 的操作没有 state | 对 moved-from `promise` 设置值等有明确 Throws 的 API |

这些枚举值互不相同且非零，具体数值 implementation-defined。不要打印数值或把 `.what()`
字符串写入确定性快照；应比较 `error.code()` 与 `make_error_code(future_errc::...)`。

特别警告：对 `valid() == false` 的 `std::future` 调用大多数成员在 C++20 是 undefined
behavior；标准只是推荐实现检测并抛 `future_error(no_state)`，不是保证。不能用
`future_errc::no_state` 把这项 UB 叙述成可移植错误通道。

来源：N4861 [`[future.syn]`](https://timsong-cpp.github.io/cppwp/n4861/future.syn)、
[`[futures.future.error]`](https://timsong-cpp.github.io/cppwp/n4861/futures.future.error)、
[`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)。

### 3.4 Header 页语义边界、误区与 JS 卡片

Header 页只保留选择信息：

- 已有 provider，希望手动兑现：`promise`；
- 已有 callable，希望把一次调用转成 provider：`packaged_task`；
- 希望直接得到一次调用的 future：`async`；
- 单消费者：`future`；多观察者：进一步阅读 `shared_future`；
- future 是结果通道，不是通用 task scheduler、线程池或取消令牌。

> JavaScript `Promise` 同样承载“未来的值或错误”，但 JS Promise 通常允许多个 `.then()`
> 观察者，`await` 暂停 async continuation 而不阻塞事件循环线程。C++ `std::future` 默认是
> move-only 单消费者，`wait()` / `get()` 可以同步阻塞当前 OS thread；C++20 标准 future
> 也没有 `.then()`。

Header 页常见错误：依赖 transitive include；把 future 当线程；认为 async 一定并行；
认为 future 可复制或可多次 get；把 timed wait 当取消；假设所有析构都不阻塞；把
`future_error(no_state)` 当 invalid future 的保证；把并发 TS 的 continuation 写成 C++20
标准 API。

## 4. `std::future`

### 4.1 C++20 代表声明与类型约束

类型页应展示教学轮廓，而不是实现布局：

```cpp
// <future>；C++20 N4861 教学轮廓
template<class R>
class future {
public:
  future() noexcept;
  future(future&&) noexcept;
  future(const future&) = delete;
  ~future();

  future& operator=(future&&) noexcept;
  future& operator=(const future&) = delete;

  shared_future<R> share() noexcept;

  R get();
  bool valid() const noexcept;
  void wait() const;

  template<class Rep, class Period>
  future_status wait_for(
      const chrono::duration<Rep, Period>& rel_time) const;

  template<class Clock, class Duration>
  future_status wait_until(
      const chrono::time_point<Clock, Duration>& abs_time) const;
};
```

标准另提供 `future<R&>` 与 `future<void>`。Primary template 的 `R` 必须是满足
Cpp17Destructible 的 object type；reference 和 void 由要求的 specializations 支持。
`future` 可移动但不可复制，这与它独占 return-object 消费权的角色一致。

来源：N4861 [`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)。

### 4.2 状态迁移与 `valid()`

`valid()` 只回答 wrapper 是否引用 shared state，不回答 state 是否 ready，也不启动 deferred
callable：

| 操作后 | 当前对象 `valid()` | 说明 |
|---|---:|---|
| default construction | `false` | 没有 shared state |
| 从 provider / `async` 接收 future | `true` | 是否 ready 是另一维度 |
| move construction / move assignment 的 source | `false` | 状态引用转移到 destination |
| `wait` / `wait_for` / `wait_until` | 保持 `true` | 等待不消费 return object |
| `get()` 正常返回或抛出 stored exception | `false` | result 已取，state 已 release |
| `share()` | `false` | 状态转交给返回的 `shared_future` |

在 `valid() == false` 时，除 destructor、move assignment、`share()`、`valid()` 之外调用成员
是 UB；从 invalid future 移动是合法的。页面必须建议在控制流可能已消费或 move 的地方先
检查 `valid()`，但不要把 `valid()` 当无锁多线程竞态检查——同一 wrapper 的并发成员调用
本身没有同步保证。

来源：N4861 [`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)。

### 4.3 `get()`：等待、返回与一次性消费

`get()` 等到 state ready，取出 stored result，然后 release 当前 shared state。三种返回合同：

| future 类型 | `get()` 返回 | 生命周期提示 |
|---|---|---|
| `future<R>` | 以 `std::move(v)` 返回状态中的值 | 返回对象由调用者拥有；原 future 随即 invalid |
| `future<R&>` | 返回状态保存的 reference | 不延长被引用对象寿命；调用者保证 referent 存活 |
| `future<void>` | 无返回值 | 仍会等待并重新抛出 stored exception |

若 shared state 保存异常，`get()` 抛出该 stored exception，之后 future 同样 invalid。异常
传播发生在取值线程，而不是让异常从 worker 自动跨线程展开栈。`wait()` 只等待 ready，
不会替代 `get()` 的取值或异常观察。

来源：N4861 [`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)、
当前 [`[except.throw]`](https://eel.is/c++draft/except.throw)。

### 4.4 `wait`、`wait_for` 与 `wait_until`

| 成员 | 参数 | 返回 | Deferred state | 普通 state |
|---|---|---|---|---|
| `wait()` | 无 | `void` | 首次 non-timed wait 可在本线程执行 deferred function | 阻塞到 ready |
| `wait_for(rel_time)` | 相对 duration | `future_status` | 不执行，立即报告 `deferred` | ready 或 timeout |
| `wait_until(abs_time)` | 绝对 time point | `future_status` | 不执行，立即报告 `deferred` | ready 或 timeout |

Timed waits 的三个结果必须完整解释：`ready` 表示检测到 ready；`timeout` 表示因指定时限
到期返回；`deferred` 表示状态持有 deferred function。`wait_for(0s)` 是确定性识别明确
`launch::deferred` 状态的方式，不应用 sleep 猜调度。

`wait_for` 是相对超时，标准建议实现用 steady clock 测量。`wait_until` 使用给定 clock 的
绝对时间点，clock 前后调整会影响等待长度。两者都可能因中断响应、函数返回和系统调度在
截止点之后才返回；timeout 不是硬实时保证。由 clock/time-point/duration 操作抛出的异常
属于 timeout-related exceptions；标准库提供的常规 clock/time 类型不抛这些异常。

Timed wait 不取消 provider，也不丢弃 shared state。若返回 `timeout`，调用者仍可继续等待或
稍后 `get()`；若返回 `deferred`，只有 non-timed wait（包括 `get()` 内部等待）才会启动该
deferred function。

来源：N4861 [`[futures.unique.future]`](https://timsong-cpp.github.io/cppwp/n4861/futures.unique.future)、
[`[thread.req.timing]`](https://timsong-cpp.github.io/cppwp/n4861/thread.req.timing)、
[LWG 2100](https://cplusplus.github.io/LWG/issue2100)。

### 4.5 生命周期、线程安全、异常与复杂度

- future wrapper 必须存活到每次成员调用结束；move/get/share 后旧 wrapper 不再拥有 state；
- `future<R&>` 不拥有 referent，provider 和 consumer 必须另行保证其生命周期；
- 同一 `future` 对象的成员调用之间没有自动同步，不应由多个线程同时 get/wait/move；
- `get()` 重新抛出 normal provider、`async` callable 或 `broken_promise` 保存的异常；
- invalid future 的多数成员调用是 UB，不是可依赖的 `future_error`；
- destructor 和 move assignment 会 release 旧 state；若触发 `std::async` last-reference 规则，
  即使 API 表面不是 `wait()`，也可能阻塞；
- 标准没有为这些成员给统一大 O、固定分配数、等待延迟或 lock-free 保证。不要写
  “`valid()` / `get()` 是 O(1)”；`get()` 的 wall time 还包含 provider 完成与返回值移动。

“复杂度未规定”是标准精度，不代表可以声称任意性能。页面应建议以所用标准库与目标系统
做测量，但不把本机结果写成跨平台合同。

## 5. `std::async`

### 5.1 C++20 代表声明、约束与返回类型

```cpp
// <future>；C++20 N4861
template<class F, class... Args>
[[nodiscard]]
future<invoke_result_t<decay_t<F>, decay_t<Args>...>>
async(F&& f, Args&&... args);

template<class F, class... Args>
[[nodiscard]]
future<invoke_result_t<decay_t<F>, decay_t<Args>...>>
async(launch policy, F&& f, Args&&... args);
```

`f` 是 callable；`args...` 是其调用实参；`policy` 是 bitmask launch policy。C++20 N4861 的
Mandates 要求 decay 后对象可由传入实参构造，并要求 decay 后 callable 可用 decay 后参数
调用；N4861 还写有后来由 LWG 3476 删除的冗余 MoveConstructible 条件。实现页或当前草案
可能显示缺陷修正后的较短条件，内容页应标记事实来源，不把当前措辞伪称为 N4861 原文。

返回类型是
`future<invoke_result_t<decay_t<F>, decay_t<Args>...>>`，引用返回会形成 `future<R&>`，
`void` 返回形成 `future<void>`。返回 future 与本次 `async` 建立的 shared state 关联。

来源：N4861 [`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)、
[LWG 2021](https://cplusplus.github.io/LWG/issue2021)、
[LWG 3476](https://cplusplus.github.io/LWG/issue3476)。

### 5.2 Launch policy 完整矩阵

| 调用或 policy | 谁执行、何时执行 | 可观察边界 |
|---|---|---|
| `launch::async` | 如同新 `std::thread` 中调用 | 明确请求并发执行；等待与线程完成有 join-like 同步 |
| `launch::deferred` | shared state 保存 callable/args；首次 non-timed wait 的线程执行 | timed wait 返回 `deferred`；若无人 non-timed wait，函数可永不执行 |
| `launch::async \| launch::deferred` | 两个条件都适用，实现选择其中一个 | 不可预测是新线程还是 lazy；不能据此写确定性策略测试 |
| 不带 policy 的 overload | 语义基线等同上面的组合 | 不保证并行；实现还能按 as-if rule 扩展默认 policy |
| 没有标准位或实现定义位 | 无有效 policy | behavior undefined |

若多个 policy bit 适用，实现可以选择任一对应策略。默认调用因而只是“可能在新线程”，
不是线程池、并行保证或负载均衡合同。需要明确新执行线程时传 `launch::async`；需要明确 lazy
且在等待线程执行时传 `launch::deferred`。

显式 `launch::async` 且无法启动线程时抛 `std::system_error`，error condition 为
`resource_unavailable_try_again`。只有 `policy == launch::async` 才有这项 system_error
条件；组合 policy 可以选 deferred。内部数据结构分配失败会抛 `std::bad_alloc`。

来源：N4861 [`[future.syn]`](https://timsong-cpp.github.io/cppwp/n4861/future.syn)、
[`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)、当前
[`[futures.async]`](https://eel.is/c++draft/futures.async)。

### 5.3 C++20 参数转发与 `decay-copy`

C++20 的规范模型先对 `f` 和每个 `args` 做
`decay-copy(std::forward<...>(...))`；这些实体化发生在调用 `async` 的线程。影响包括：

- 顶层 cv 和 reference 被去除，数组/函数类型按 decay 规则转换；
- 默认保存自己的 callable 与参数值，而不是自动借用调用者变量；
- 原 lvalue 在 async 返回后改变，不会改变已经保存的 value copy；
- 调用时，保存的 callable 与参数按 rvalue 传给 `invoke`，支持 move-only payload；
- 需要引用语义时显式使用 `std::ref` / `std::cref`，并保证 referent 活到任务完成；
- 原始 pointer、reference wrapper 或引用 capture 不延长目标对象寿命。

`launch::async` 的调用在线程中发生，但 decay-copy 在 caller thread 完成；
`launch::deferred` 把这些 decay 后的值放入 shared state，首次 non-timed wait 再
`invoke(std::move(g), std::move(xyz)...)`。

来源：N4861 [`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)、
[LWG 2021](https://cplusplus.github.io/LWG/issue2021)。

### 5.4 C++23 `auto(...)` materialization：禁止倒写

当前 Working Draft 已把 C++20 的 exposition-only `decay-copy(...)` 改写为
`auto(std::forward<...>(...))`，并表述为 `auto` 产生的值在调用 `async` 的线程 materialize。
这来自 C++23 的 P0849R8 “auto(x): decay-copy in the language”。

两版应明确并列：

| 事实版本 | 规范表达 |
|---|---|
| C++20 N4861 | `decay-copy(std::forward<F>(f))` 与 decay-copy 后的 args |
| C++23 起 / 当前草案 | `auto(std::forward<F>(f))` 与 `auto(...)` materialization |

Batch 18 的 `since` 是 C++11、教学基线是 C++20，所以主体声明和解释必须使用
`decay-copy`。可以用版本 callout 提醒当前草案变化，不能直接把当前草案的 `auto(...)`
措辞写成 C++20，也不能让读者误以为 C++20 可以在任意表达式位置使用 `auto(x)` cast。

来源：[P0849R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0849r8.html)、
当前 [`[futures.async]`](https://eel.is/c++draft/futures.async)、N4861
[`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)。

### 5.5 Result、异常传播与一个仍需标注的标准风险

Callable 正常返回时，返回值作为 result 保存进 shared state；callable 执行传播出的异常
作为 exceptional result 保存。`future.get()` 在消费线程重新抛出 stored exception。

要区分两类错误时点：

| 时点 | 典型异常 | 观察位置 |
|---|---|---|
| `async` 建立调用/状态 | `bad_alloc`；显式 async 无法启线程的 `system_error` | `async(...)` 调用处 |
| callable 执行 | callable 自己抛出的异常 | 关联 future 的 `get()` |

C++20 N4861 对 decay-copy 初始化本身抛出的异常存在措辞歧义。LWG 3582 记录：主流实现把
decay-copy 初始化异常同步传播给 `async` caller，而不是存入 future，但该 issue 仍不是可
直接当作 C++20 已定结论的正式修订。本批页面可以安全写“callable invocation exception
进入 shared state”，但不应无条件声称“所有 argument copy/move exception 都必然同步抛出”
或“都必然由 get 重抛”。示例也不得依赖这个争议点。

来源：N4861 [`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)、
[LWG 2752](https://cplusplus.github.io/LWG/issue2752)、
[LWG 3582](https://cplusplus.github.io/LWG/issue3582)。

### 5.6 同步、析构阻塞与临时对象陷阱

不论选择哪项标准 policy，`async` 调用 synchronizes-with 对 `f` 的调用，`f` 完成
sequenced-before shared state ready。若选择 `launch::async`：

- 对关联 return object 的 waiting function 会等关联线程完成（或 timed wait timeout），
  效果如同 join；
- 关联线程完成 synchronizes-with 首个成功检测 ready 的函数返回，或最后释放 shared
  state 的函数返回，两者取先发生者。

如果由 `std::async` 得到的 future 是未绑定临时量，完整表达式结束时它可能作为最后引用
析构并等待任务完成。连续丢弃两个显式 async future，可能因第一个临时量析构等待而表现成
串行。页面必须建议保存返回 future，并最终 get/wait；不要把 `std::async(...);` 当 fire-and-
forget。

对明确 deferred state，若 future 在任何 non-timed wait 前被销毁，deferred callable 可以
根本不执行。`wait_for` / `wait_until` 返回 `deferred` 本身不会启动它。

来源：N4861 [`[futures.async]`](https://timsong-cpp.github.io/cppwp/n4861/futures.async)、
[`[futures.state]`](https://timsong-cpp.github.io/cppwp/n4861/futures.state)、
[N3776](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3776.pdf)。

### 5.7 复杂度与未规定边界

`[futures.async]` 没有规定算法大 O、分配次数、线程池、线程复用、调度公平、启动延迟、
完成延迟或最大并发数。`launch::async` 只给“as if in a new thread”的语义与同步合同；默认/
组合 policy 的选择由实现决定。以下说法都不应出现在页面：

- “async 是 O(1)”；
- “每次 async 恰好分配一次”或“总会复用线程池”；
- “默认 async 一定创建新线程”；
- “deferred 会在后台稍后自动跑”；
- “wait_for 到点精确返回”；
- “future 析构一定不会/一定会阻塞”。

可以给工程建议：显式选择 policy 以表达执行语义；需要线程池、任务组合、取消或可控 executor
时选择更适合的架构，而不是把未规定行为当调度器 API。

## 6. 六个确定性原创示例

共同验证规则：

- 每个 Entry 恰好两个 `run` 示例，共六个；
- `clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread`；
- worker 不输出，主线程按固定顺序输出；
- 不用 sleep、yield、wall clock、线程 ID、地址或调度顺序；
- 不用默认/组合 policy 构造需要固定策略的断言；
- 不输出 implementation-defined error number 或 `.what()` 文案；
- expected stdout 完全精确并有结尾换行。

### 6.1 `<future>`：`promise-value-channel.cpp`

```cpp
#include <future>
#include <iostream>
#include <thread>
#include <utility>

void publish(std::promise<int> output) {
  output.set_value(42);
}

int main() {
  std::promise<int> channel;
  std::future<int> answer = channel.get_future();

  std::thread producer(publish, std::move(channel));

  const int value = answer.get();
  producer.join();
  std::cout << "value=" << value << '\n';
}
```

```text
value=42
```

教学合同：`promise` 是 provider、`future` 是 return object；promise 被 move 给 worker。
Worker 不输出；主线程 `get()` 取得确定值，再 join 回收 thread。示例直接包含每个使用设施的
header。

### 6.2 `<future>`：`packaged-task-result.cpp`

```cpp
#include <future>
#include <iostream>

int add_values(int left, int right) {
  return left + right;
}

int main() {
  std::packaged_task<int(int, int)> add(add_values);
  std::future<int> result = add.get_future();

  add(19, 23);
  std::cout << "result=" << result.get() << '\n';
}
```

```text
result=42
```

教学合同：`packaged_task` 把 callable 变成 provider，但这里在当前线程直接调用，说明
`<future>` 设施不必创建线程。调用结果进入 shared state，再由 future 取回。

### 6.3 `std::future`：`single-consumption.cpp`

```cpp
#include <future>
#include <iostream>
#include <string>

int main() {
  std::promise<std::string> producer;
  std::future<std::string> result = producer.get_future();
  producer.set_value("ready");

  std::cout << std::boolalpha;
  std::cout << "before=" << result.valid() << '\n';
  std::cout << "value=" << result.get() << '\n';
  std::cout << "after=" << result.valid() << '\n';
}
```

```text
before=true
value=ready
after=false
```

教学合同：`valid()` 表示关联 state，不表示是否 ready；`get()` move 出 stored value 并消费
state，之后只查询 `valid()`，不再调用 UB 的第二次 `get()`。

### 6.4 `std::future`：`broken-promise.cpp`

```cpp
#include <future>
#include <iostream>

int main() {
  std::future<int> result;
  {
    std::promise<int> producer;
    result = producer.get_future();
  }

  bool is_broken_promise = false;
  try {
    static_cast<void>(result.get());
  } catch (const std::future_error& error) {
    is_broken_promise =
        error.code() == std::make_error_code(std::future_errc::broken_promise);
  }

  std::cout << std::boolalpha;
  std::cout << "broken_promise=" << is_broken_promise << '\n';
  std::cout << "valid_after_get=" << result.valid() << '\n';
}
```

```text
broken_promise=true
valid_after_get=false
```

教学合同：promise 未兑现便析构，provider abandon 时存入标准 broken-promise 异常。示例
比较 error condition，不依赖 implementation-defined 数值或本地化 `.what()`。`get()` 抛出
stored exception 后仍完成一次性消费。

### 6.5 `std::async`：`deferred-copy.cpp`

```cpp
#include <chrono>
#include <future>
#include <iostream>

int increment(int value) {
  return value + 1;
}

int main() {
  int source = 41;
  std::future<int> result = std::async(
      std::launch::deferred, increment, source);
  source = 100;

  const std::future_status status =
      result.wait_for(std::chrono::seconds{0});
  std::cout << "status="
            << (status == std::future_status::deferred ? "deferred" : "other")
            << '\n';
  std::cout << "result=" << result.get() << '\n';
  std::cout << "source=" << source << '\n';
}
```

```text
status=deferred
result=42
source=100
```

教学合同：显式 deferred 保证 `wait_for(0s)` 返回 deferred 而不运行 callable；`get()` 是首次
non-timed wait 并在主线程执行它。参数在 `async` 调用时 decay-copy，所以随后把原 source
改为 100 不会改变任务保存的 41。

### 6.6 `std::async`：`exception-result.cpp`

```cpp
#include <future>
#include <iostream>
#include <stdexcept>
#include <string>

int fail_task() {
  throw std::runtime_error("task failed");
}

int main() {
  std::future<int> result = std::async(std::launch::async, fail_task);

  std::string message;
  try {
    static_cast<void>(result.get());
  } catch (const std::runtime_error& error) {
    message = error.what();
  }

  std::cout << std::boolalpha;
  std::cout << "caught=" << message << '\n';
  std::cout << "valid=" << result.valid() << '\n';
}
```

```text
caught=task failed
valid=false
```

教学合同：worker 不直接输出；callable exception 进入 shared state，主线程的 `get()` 重新
抛出。捕获的是示例自己控制的 `runtime_error` 文案，不是实现定义的 `future_error::what()`。
`get()` 之后 wrapper invalid。

## 7. 本地编译运行证据

验证环境：

```text
Apple clang version 15.0.0 (clang-1500.3.9.4)
Target: arm64-apple-darwin23.1.0
```

验证命令：

```text
clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread <source> -o <binary>
<binary>
```

2026-09-05 对以上六个草案逐一执行，全部零 warning 编译并以 exit code 0 运行；实际 stdout
逐字等于各节给出的 expected stdout。验证未依赖网络、stdin、locale、随机数、wall-clock、
sleep、地址、线程 ID 或 implementation-defined policy 选择。

## 8. 审查断言与风险

实现与两轴复审至少逐项确认：

1. catalog 恰为 version 18、119 Entries，新增 ID/slug 稳定且无重复；
2. 三页都要求直接包含 `<future>`，示例为额外设施直接 include 自己 header；
3. Header 页是 facility map，不复制两个实体页的全部操作合同；
4. `future` 明确 move-only、single-consumer，get/share/move 后状态迁移正确；
5. invalid future 多数成员调用写为 UB + recommended detection，不写成保证抛 no_state；
6. `get()` 的 `R` / `R&` / `void` 返回和 stored exception 传播完整；
7. `wait_for` / `wait_until` 三状态齐全，deferred 不被 timed wait 启动；
8. shared state ready、abandon、last release、broken_promise 与同步链分开；
9. async policy 明确 async/deferred/组合/默认，默认不承诺并行；
10. C++20 参数保存写 `decay-copy`，引用语义要求 `std::ref` 与生命周期；
11. C++23 `auto(...)` 只出现在版本 callout，不进入 C++20 主合同；
12. callable invocation exception 进入 state，`bad_alloc`/thread failure 在 async 调用处；
13. LWG 3582 的 materialization-exception 歧义没有被写成过强保证；
14. async future 的最后释放“可能阻塞”限定三条件，不扩大到所有 future；
15. temporary future / fire-and-forget 与 deferred-never-runs 陷阱已说明；
16. 没有发明 O(1)、线程池、线程数、公平性、取消或硬实时保证；
17. JS 卡片同时说明 eventual value/error 的相似点和 blocking/single-consumer/scheduling 边界；
18. 六个示例各自原创、确定性、严格 C++20 编译运行，stdout 与 manifest 完全一致。

最高风险有三项：

- **版本倒写**：当前草案 `auto(...)` 是 C++23 后表达，不是 C++20；
- **策略过度承诺**：默认 `async` 可能 deferred，不能用一次本机行为断言跨实现并行；
- **异常措辞过度承诺**：LWG 3582 仍提示 argument materialization exception 的规范歧义。

只要实现按本研究拆分 Header 导航、future 消费合同与 async 执行合同，这三页可在不复制
cppreference 文本、不依赖调度巧合的前提下达到本项目 learning-quality profile。
