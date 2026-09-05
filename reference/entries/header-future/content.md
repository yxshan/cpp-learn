# `<future>`

`<future>` 提供一组通过 shared state 传递“稍后得到的值或异常”的设施。它能连接结果提供方与消费方，但不是线程池、通用任务调度器或取消框架。

## 快速信息

- 直接包含：`#include <future>`
- 命名空间：`std`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用 future、promise、packaged task 或 async 时直接写 `#include <future>`。线程、引用包装、时间类型和输出分别属于 `<thread>`、`<functional>`、`<chrono>` 与 `<iostream>`；不要依赖这些头文件偶然传递包含 `<future>`，示例也应直接包含自己使用的设施。

## C++20 主要设施

| 设施 | 用途 | 版本边界 |
|---|---|---|
| `std::promise<R>` | 显式写入一个值或异常，并产生关联 future | C++11 |
| `std::packaged_task<R(Args...)>` | 把一次 callable 调用包装为结果 provider | C++11 |
| `std::future<R>`、`future<R&>`、`future<void>` | move-only、单消费者的异步返回对象 | C++11 |
| `std::shared_future<R>` 及其特化 | 可复制、可供多个观察者读取的异步返回对象 | C++11 |
| `std::async` | 按 launch policy 建立调用及其 future | C++11 |
| `std::launch` | `async` / `deferred` bitmask 执行策略 | C++11 |
| `std::future_status` | 定时等待结果：`ready`、`timeout` 或 `deferred` | C++11 |
| `std::future_error`、`std::future_errc` | 表达 future 协议错误及标准 error code | C++11 |
| `future_category`、`make_error_code`、`make_error_condition` | 把 `future_errc` 接入标准错误码体系 | C++11 |

`packaged_task` 可以在当前线程直接调用，也可以被移动到线程中执行；它本身不会自动创建线程。`future` 也不等于线程：deferred async 可以把 callable 保存到 shared state，直到消费线程首次执行非定时等待。

## 什么时候选择

已经有显式生产方并要稍后交付值或异常时使用 `promise`；要把 callable 的一次调用变成 provider 时使用 `packaged_task`；希望直接启动或延迟一次调用并取得结果时使用 `async`。结果只消费一次时使用 `future`，确实需要多个观察者时再评估 `shared_future`。

需要任务队列、并发上限、组合 continuation、取消或服务级调度时，应使用更合适的执行框架。C++20 标准 future 没有 `.then()`、`when_all()` 或内建取消操作。

## Shared state 与错误边界

Provider 把值或异常写入独立的 shared state，return object 只持有对状态的引用。Provider 在状态尚未 ready 时放弃它，会存入 `future_errc::broken_promise` 异常；这不同于 timeout 和无 state。

`future_errc` 还包含 `future_already_retrieved`、`promise_already_satisfied` 与 `no_state`。枚举的具体整数值和 `future_error::what()` 文本不是可移植输出。尤其不能把 invalid `future` 的错误路径概括为“保证抛 no_state”：C++20 对它的大多数成员调用规定为未定义行为，只有实现检测并抛出该异常的建议。

标准没有为整个设施组规定统一大 O、分配次数、线程池行为或等待时延。由 `std::async` 创建且尚未 ready 的 shared state 在最后一个引用释放时可能阻塞；不能把这条例外推广到所有 future 析构。

## 示例

第一个示例把 promise 移给生产线程，主线程从 future 一次性取得值后 join。第二个示例在当前线程调用 packaged task，再从 shared state 读取结果，证明 future 设施并不必然创建线程。

## 常见错误

- 依赖其他并发头文件传递包含 `<future>`。
- 把 future 当作线程句柄、线程池或任务调度器。
- 认为不带 policy 的 `async` 一定并行执行。
- 复制 `future` 或对它多次调用 `get()`。
- 把 timed wait 当成取消任务。
- 认为所有 future 析构都阻塞，或都绝不阻塞。
- 把 `future_error(no_state)` 当作 invalid future 的可移植保证。
- 把非标准 continuation 写成 C++20 标准接口。

## 与 JavaScript 的区别

> JavaScript Promise 同样承载未来的值或错误，但通常允许多个 `.then()` 观察者，`await` 暂停 continuation 而不阻塞事件循环线程。C++ `std::future` 默认是 move-only 单消费者，`wait()` / `get()` 可以同步阻塞当前 OS thread，C++20 也没有标准 `.then()`。

## 相关内容

一次性消费与状态迁移见 `std::future`；启动策略、参数复制与异常传播见 `std::async`；需要直接拥有执行线程时阅读 `std::thread`。

## 来源

设施地图、直接包含、provider/return object/shared state 分工及错误类型由 manifest 中的 `[future.syn]`、`[futures]`、`[futures.state]`、N3337 与 N4861 验证；cppreference 中文页仅用于二级信息结构核对。
