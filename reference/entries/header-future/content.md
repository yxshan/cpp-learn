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

## 错误码导航

| `future_errc` | 协议含义 | 典型来源 |
|---|---|---|
| `broken_promise` | Provider 未设置 result 就放弃 shared state | 未兑现的 `promise` 析构 |
| `future_already_retrieved` | 同一 provider 已经生成过 return object | 对同一 `promise` 再次调用 `get_future()` |
| `promise_already_satisfied` | Shared state 已经保存值或异常 | 再次调用 `set_value()` 或 `set_exception()` |
| `no_state` | 要求 provider state 的操作没有关联 state | 对 moved-from `promise` 调用要求 state 的成员 |

这些枚举值互不相同且非零，但具体整数和 `future_error::what()` 文本由实现决定。`no_state` 也不是 invalid `future` 的通用恢复通道；它的成员前置条件与 C++20 未定义行为边界见 `std::future` 页面。

## 示例

第一个示例把 promise 移给生产线程，主线程从 future 一次性取得值后 join。第二个示例在当前线程调用 packaged task，再从 shared state 读取结果，证明 future 设施并不必然创建线程。

## 常见错误

- 依赖其他并发头文件传递包含 `<future>`。
- 把 future 当作线程句柄、线程池或任务调度器。
- 认为不带 policy 的 `async` 一定并行执行。
- 复制 `future` 或对它多次调用 `get()`。
- 把 timed wait 当成取消任务。
- 未查看具体 state 来源就断言 future 析构一定阻塞或一定不阻塞。
- 把 `future_error(no_state)` 当作 invalid future 的可移植保证。
- 把非标准 continuation 写成 C++20 标准接口。

## 与 JavaScript 的区别

> JavaScript Promise 同样承载未来的值或错误，但通常允许多个 `.then()` 观察者，`await` 暂停 continuation 而不阻塞事件循环线程。C++ `std::future` 默认是 move-only 单消费者，`wait()` / `get()` 可以同步阻塞当前 OS thread，C++20 也没有标准 `.then()`。

## 相关内容

一次性消费与状态迁移见 `std::future`；启动策略、参数复制与异常传播见 `std::async`；需要直接拥有执行线程时阅读 `std::thread`。

## 来源

设施地图、直接包含、provider/return object/shared state 分工及错误类型由 manifest 中的 `[future.syn]`、`[futures]`、`[futures.state]`、`[futures.promise]`、`[futures.future.error]`、N3337 与 N4861 验证；cppreference 中文页仅用于二级信息结构核对。
