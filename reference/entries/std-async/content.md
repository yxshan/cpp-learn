# `std::async`

`std::async` 把一次 callable 调用及其值或异常放入 shared state，并返回关联的 `std::future`。它可以请求新执行线程或延迟到等待时执行，但不是可控制并发度的线程池 API。

## 快速信息

- 头文件：`<future>`
- 命名空间：`std`
- 标准：C++11 起
- 返回：与新 shared state 关联的 `std::future`

## 什么时候使用

需要用较少代码表达“一次调用，稍后取得一个值或异常”，并且 `launch::async` / `launch::deferred` 的粗粒度策略足够时使用。需要任务队列、并发上限、优先级、取消、continuation 或 executor 时，不应把实现未规定的 `async` 行为当作调度框架。

如果正确性要求并发执行，就显式传 `launch::async`；如果要求 lazy 且由等待线程执行，就显式传 `launch::deferred`。不带 policy 的 overload 不保证并行。

## C++20 代表声明

```cpp
template<class F, class... Args>
[[nodiscard]]
future<invoke_result_t<decay_t<F>, decay_t<Args>...>>
async(F&& f, Args&&... args);

template<class F, class... Args>
[[nodiscard]]
future<invoke_result_t<decay_t<F>, decay_t<Args>...>>
async(launch policy, F&& f, Args&&... args);
```

C++20 N4861 以 `decay-copy(std::forward<...>(...))` 描述 callable 与参数的保存。C++23 的 P0849R8 把当前草案改写为 `auto(...)` materialization；这是规范表达的版本变化，不应倒写成 C++20 可在普通代码任意使用的 `auto(x)` cast。

## 参数与前置条件

`f` 是 callable，`args...` 是调用实参，`policy` 是 `std::launch` bitmask。C++20 要求 decay 后对象能由对应转发实参构造，并且 decay 后 callable 能以 decay 后参数调用；N4861 还包含后来由 LWG 3476 删除的冗余 MoveConstructible 条件。

C++20 会在调用 `async` 的线程中先 decay-copy callable 与参数。默认因此保存值副本，而不是自动借用原 lvalue；要传引用必须显式使用 `std::ref` / `std::cref`，并确保 referent 活到任务完成。裸指针、引用包装和引用捕获也不会延长目标生命周期。

| 调用或 policy | 执行方式 | 可观察边界 |
|---|---|---|
| `launch::async` | 如同在新 `std::thread` 中调用 | 明确请求并发；等待具有 join-like 同步 |
| `launch::deferred` | 保存 callable/args，由首次非定时等待的线程调用 | Timed wait 报 `deferred`；若无人等待，任务可不执行 |
| `launch::async \| launch::deferred` | 实现选择适用策略之一 | 不可假设新线程或 lazy |
| 不传 policy | 等价于上述组合策略 | 不保证并行 |
| 没有标准位或实现定义位 | 没有有效策略 | 行为未定义 |

## 返回值

返回类型为 `future<invoke_result_t<decay_t<F>, decay_t<Args>...>>`。Callable 返回引用时得到 `future<R&>`，返回 void 时得到 `future<void>`；返回 future 与本次调用创建的 shared state 关联。Callable 的正常返回值存入状态，执行时传播出的异常存为 exceptional result，之后由 `get()` 重新抛出。

## 异常与错误

内部数据结构分配失败时 `async` 可抛 `std::bad_alloc`。当 policy 恰为 `launch::async` 且无法启动新线程时抛 `std::system_error`，error condition 为 `resource_unavailable_try_again`。Callable 执行产生的异常不会在 worker 线程逃逸，而是进入 state 并由 consumer 的 `get()` 抛出。

C++20 对参数 decay-copy 初始化异常的规范存在 LWG 3582 记录的措辞歧义，因此本页不把它断言为“必然同步从 async 调用抛出”或“必然保存到 future”；代码也不应靠这项争议行为跨实现控制流程。

## 生命周期、同步与线程安全

`async` 调用 synchronizes-with callable 的调用，callable 完成 sequenced-before state ready。选择 `launch::async` 时，成功检测 ready 或最后释放 state 与关联线程完成之间还有规定同步关系。

必须保存返回的 future 并最终 wait/get。若显式 async 的返回临时量在完整表达式末尾释放最后一个、尚未 ready 的 async-created state，它可能等待任务完成，使连续“丢弃 future”的调用意外串行。明确 deferred 的 future 若在首次非定时等待前销毁，其 callable 可以永不执行。

Decay-copy 的值由 shared state 管理；`std::ref`、指针和引用捕获指向的对象仍由调用者管理。对同一个 future wrapper 的并发操作也需要外部同步。

## 复杂度与调度边界

标准没有规定 `async` 的渐进复杂度、分配次数、线程复用、线程池、调度公平、启动延迟、完成延迟或最大并发数。显式 `launch::async` 给出“如同新线程”的语义，不等于实现细节上必须采用某种固定线程模型；默认策略更不能从一次本机运行推断。

## 示例

第一个示例用显式 deferred 和 `wait_for(0s)` 稳定观察 lazy 状态，并证明 C++20 参数按值 decay-copy。第二个示例用显式 async 执行抛异常的 callable，再由主线程 `get()` 接收；worker 不参与输出。

## 常见错误

- 认为默认 `async` 一定创建新线程。
- 用默认/组合策略写依赖固定执行策略的测试。
- 忘记保存返回 future，把调用误当 fire-and-forget。
- 认为 deferred 会在后台自行启动。
- 假设 timed wait 会启动 deferred task 或取消任务。
- 忘记参数默认 decay-copy，或用 `std::ref` 后让对象提前销毁。
- 让 worker 异常逃逸的心智模型替代 future 的异常状态。
- 把当前草案的 `auto(...)` 规范表达倒写成 C++20。
- 假设实现使用线程池、固定分配次数或公平调度。

## 与 JavaScript 的区别

> JavaScript `async` 函数总是返回 Promise，但通常仍在事件循环模型中推进，不等于创建 OS thread。`std::async` 返回 move-only future，可能新建执行线程，也可能 deferred 到调用 `get()` 的线程；C++20 future 还没有标准 continuation 或取消接口。

## 相关内容

消费返回结果与等待状态见 `std::future`；完整 future 设施地图见 `<future>`；需要明确管理执行线程的 join/detach 生命周期时阅读 `std::thread`。

## 来源

声明、约束、launch policy、返回类型、异常、同步、最后引用阻塞和 C++20/C++23 参数实体化差异由 manifest 中的 `[futures.async]`、`[futures.state]`、N3337、N4861、P0849R8、N3776、LWG 2021、LWG 2752、LWG 3476 与 LWG 3582 验证；cppreference 中文页仅用于二级覆盖核对。
