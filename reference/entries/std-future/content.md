# `std::future`

`std::future<R>` 是 shared state 的 move-only、单消费者返回对象。它等待 provider 交付值或异常，并通过一次 `get()` 消费结果；它本身不是线程，也不会自动给任意共享数据加锁。

## 快速信息

- 头文件：`<future>`
- 命名空间：`std`
- 标准：C++11 起
- 核心状态：是否关联 shared state，与 state 是否 ready 是两件事

## 什么时候使用

一个异步结果只需由一个 owner 最终取走，且 provider 来自 promise、packaged task 或 async 时使用。需要多个观察者时，应把状态转交给 `shared_future`；需要组合 continuation、取消或任务调度时，C++20 `future` 本身不够。

不要把 `valid()` 当作“任务已完成”。它只说明 wrapper 当前是否关联 shared state；完成状态用等待接口观察。

## C++20 代表接口

```cpp
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

标准还提供 `future<R&>` 与 `future<void>`。主模板的 `R` 必须是满足 Cpp17Destructible 的对象类型；引用与 void 由这两个特化支持。

## 状态、所有权与返回值

| 操作后 | 当前对象 `valid()` | 结果 |
|---|---:|---|
| 默认构造 | `false` | 没有 shared state |
| 从 provider 或 `async` 取得 future | `true` | 已关联状态，但不保证 ready |
| move 后的 source | `false` | 状态引用转移给 destination |
| `wait` / timed wait | 保持 `true` | 只等待或观察，不消费状态 |
| `get()` 返回或抛 stored exception | `false` | 取出结果并 release state |
| `share()` | `false` | 状态转交给返回的 `shared_future` |

`future<R>::get()` 以 `std::move(v)` 返回保存的值；`future<R&>::get()` 返回所保存的引用且不延长 referent 生命周期；`future<void>::get()` 不返回值。三者都会等待 ready，并在 state 保存异常时重新抛出该异常。

## 等待参数与结果

| 成员 | 参数 | 返回 | Deferred state |
|---|---|---|---|
| `wait()` | 无 | `void` | 首次非定时等待可在调用线程执行 deferred function |
| `wait_for(rel_time)` | 相对 duration | `ready`、`timeout` 或 `deferred` | 不启动函数，报告 `deferred` |
| `wait_until(abs_time)` | 指定 clock 的绝对 time point | `ready`、`timeout` 或 `deferred` | 不启动函数，报告 `deferred` |

Timed wait 返回 timeout 不会取消 provider，也不会消费 shared state；之后仍可再次等待或调用 `get()`。调用者只向 `wait_for` 传入 duration，标准建议实现内部以 steady clock 度量相对等待；`wait_until` 则使用调用者给出的 clock 和绝对时间点，其调整可能影响等待长度。两者的截止点都不是硬实时返回保证。

## 复杂度与阻塞

标准没有为这些成员规定统一大 O、固定分配次数、等待延迟或 lock-free 保证。`get()` 的耗时包含等待 provider 与移动结果，不能写成固定 O(1)。

析构和 move assignment 会 release 原 shared state。通常释放不等待 ready，但同时满足“状态由 `std::async` 创建、尚未 ready、这是最后一个状态引用”时可以阻塞。由 promise 或 packaged task 创建的普通 future 不能仅凭名称推断出同样行为。

## 异常与错误

`get()` 重新抛出 shared state 中保存的异常，包括 callable 异常或 `broken_promise`。Provider 未交付结果便 abandon state 时，消费者会观察到 `future_error`，其 code 为 `future_errc::broken_promise`。

C++20 中，当 `valid() == false` 时，除析构、move assignment、`share()` 和 `valid()` 外调用成员是未定义行为；标准只建议实现检测并抛 `future_error(no_state)`。因此不要依赖第二次 `get()` 抛出可捕获异常。Timed wait 还可能传播与自定义 clock/duration 有关的 timeout 异常。

## 生命周期与线程安全

Wrapper 必须活到成员调用结束；move、get 或 share 后的旧对象不再拥有 state。`future<R&>` 只保存引用，provider 与 consumer 必须另行保证 referent 存活。

同一个 future 对象的成员调用不会彼此自动同步，不能让多个线程无协调地同时 wait、get 或 move。Provider 写入 result 与 consumer 成功检测 ready 之间有规定同步关系，但这不会自动保护与 result 无关的共享对象。

## 示例

第一个示例展示 `get()` 前后 `valid()` 的一次性状态迁移。第二个示例让 promise 未兑现便析构，并比较标准 error code，而不快照实现定义的整数或 `what()` 文本。

## 常见错误

- 复制 future，或认为 move 后的 source 仍可等待。
- 把 `valid()` 当作 ready 检查。
- 在 `get()` 或 `share()` 后继续调用等待成员。
- 认为 `wait()` 会取出值或重新抛出 stored exception。
- 把 timeout 当作任务已取消。
- 假设 timed wait 会在截止点精确返回。
- 把所有 future 析构概括为一定阻塞或一定不阻塞。
- 从多个线程同时操作同一个 future wrapper。

## 与 JavaScript 的区别

> JavaScript Promise 可以被多个 continuation 观察，`await` 通常暂停 async 函数而不阻塞事件循环线程。`std::future` 默认只有一个消费 owner，`get()` 会阻塞当前线程并使对象失效；需要多观察者必须显式转成 `shared_future`。

## 相关内容

设施全貌见 `<future>`；执行策略和参数保存见 `std::async`；如果只需要等待线程结束而不取返回值，阅读 `std::thread`。

## 来源

类型约束、状态迁移、三类 `get()` 返回、等待结果、deferred 触发、异常传播、同步和最后引用阻塞规则由 manifest 中的 `[futures.unique.future]`、`[futures.state]`、`[futures.async]`、`[futures.future.error]`、`[thread.req.timing]`、N3337、N4861 与 N3776 验证；cppreference 中文页仅用于二级覆盖核对。
