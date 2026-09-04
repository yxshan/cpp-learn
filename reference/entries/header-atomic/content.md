# `<atomic>`

`<atomic>` 声明 C++ 的原子对象、内存序、等待通知、原子标志和栅栏设施。它让多个线程在不产生 data race 的前提下访问同一个原子对象，但不会自动把一组操作变成事务，也不会自动发布旁边的普通对象。

## 快速信息

- 直接包含：`#include <atomic>`
- 命名空间：`std`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用原子设施时直接写 `#include <atomic>`。创建线程另含 `<thread>`，智能指针的 C++20 atomic 特化声明归属 `<memory>`；不要依赖这些头文件或实现细节传递包含 `<atomic>`。

## C++20 主要设施

| 设施 | 用途 | 版本边界 |
|---|---|---|
| `memory_order` 与命名常量 | 选择 relaxed、acquire、release、acq_rel、seq_cst 等顺序 | C++11 |
| `ATOMIC_*_LOCK_FREE` 宏 | 以 0/1/2 表示从不/有时/总是 lock-free | C++11 |
| `atomic<T>` 及整数、指针特化 | load/store、exchange、CAS 和特化 RMW | C++11 |
| `atomic_bool`、`atomic_int` 等别名 | 常用基础类型和定宽整数的 `atomic<T>` 别名（定宽别名在对应整数类型存在时提供） | C++11 |
| `atomic_ref<T>` | 对满足约束的既有对象建立原子引用 | C++20 |
| `atomic_*` 非成员函数 | 成员原子操作的函数式镜像 | C++11 |
| `atomic_wait`、`atomic_notify_*` | 等待原子值改变并唤醒等待者 | C++20 |
| `atomic_flag` | 保证 lock-free 的布尔标志；C++20 增加 test/wait/notify | C++11 / C++20 |
| `atomic_thread_fence`、`atomic_signal_fence` | 高级线程/信号内存排序 | C++11 |
| `atomic_init`、旧初始化宏 | 兼容早期初始化模型；新代码使用构造 | C++11；C++20 deprecated |

## 什么时候选择

单个标志、计数器或指针状态能由一次原子操作表达时，从 `atomic<T>` 开始；需要等待这个单值改变时，C++20 的 atomic wait/notify 可以避免轮询。若操作必须同时维护多个字段的不变量，选择 mutex；若线程等待的是受锁保护的复合谓词，选择 condition variable。`atomic_flag` 适合构建更底层原语，不应默认拿来手写忙等锁。

## C++20 memory order 速查

| order | 纯 load / wait | 纯 store / clear | RMW 成功 | 核心含义 |
|---|---:|---:|---:|---|
| `relaxed` | 可用 | 可用 | 可用 | 只保证该原子对象上的原子性与 modification order |
| `consume` | 可用 | 不可用 | 可用 | C++20 依赖排序；实践通常按 acquire 实现 |
| `acquire` | 可用 | 不可用 | 可用 | 读取对应 release 时取得此前发布的访问 |
| `release` | 不可用 | 可用 | 可用 | 发布当前线程此前的访问 |
| `acq_rel` | 不可用 | 不可用 | 可用 | 同一个 RMW 兼具 acquire 与 release |
| `seq_cst` | 可用 | 可用 | 可用 | acquire/release 外还参与 seq_cst 单一总序 |

默认 order 是 `seq_cst`，适合先建立正确模型，但它仍不会把多个独立调用合并成事务。C++20 仍有 `consume`；当前工作草案已把它降为 deprecated 兼容项并按 acquire 语义处理，阅读新版材料时要区分版本。

## 阅读地图与发布边界

`memory_order::relaxed` 保证单个原子对象不撕裂并遵守自己的 modification order，不发布其他普通数据。经典发布协议是：生产者先写 payload，再 release-store 一个原子标志；消费者用 acquire-load 或 acquire-wait 读到该 release sequence 的值后，才可安全读取 payload。

本页用于先定位设施和理解发布边界。`wait` / `notify` 的返回合同、合法 order、A→B→A 变化风险，以及各特化可用的 RMW 操作集中在 `std::atomic` 页面，避免把头文件索引误当成完整类型文档。

## Lock-free、复杂度与进度

`ATOMIC_*_LOCK_FREE` 的 0、1、2 分别表示从不、有时、总是 lock-free。`atomic_flag` 的操作保证 lock-free，但不能把该保证推广到任意 `atomic<T>`。非 lock-free atomic 可以在内部使用锁并 potentially block。

标准没有为这些设施提供统一大 O、固定延迟、公平、wait-free 或 lock-free 进度保证。Atomic 的价值是不可分割操作和明确内存模型，而不是“必然比 mutex 快”。不要把本机 `is_lock_free()` 输出写成跨平台结论。

## 初始化与兼容边界

C++11 中，默认构造的 `atomic<T>` 不包含已初始化的 `T` 值；早期代码因此会见到 `atomic_init`、`ATOMIC_VAR_INIT` 和 `ATOMIC_FLAG_INIT`。C++20 修正为值初始化：默认构造的 `atomic<T>` 含 `T()`，`atomic_flag{}` 为 clear，同时把这些旧初始化 API 标记为 deprecated。新代码优先使用直接构造或列表初始化。

构造本身不是原子操作；对象必须完整构造并安全发布后才能并发访问，也必须活过最后一次访问。具体成员函数的合法 order 和失败行为见 `std::atomic`。`volatile` 不提供线程同步，不能替代 atomic 或 mutex。

## 示例

第一个示例以 release store 和 acquire wait 发布普通 payload；notify 只负责唤醒。第二个示例展示 C++20 `atomic_flag` 的 clear、test_and_set 和 test 状态，不把忙等锁当作推荐抽象。

## 常见错误

- 认为 relaxed flag 能发布相邻普通数据。
- 把 `load()` 后计算再 `store()` 当成一个原子 RMW。
- 认为 seq_cst 能把多个对象组成事务。
- 假设所有 atomic 都 lock-free、O(1) 或比 mutex 快。
- 忽略上表和具体类型页，为操作传入不合法 memory order。
- 把 notify 当作保存状态的事件令牌。
- 用 `volatile` 代替原子同步。
- 依赖 `<thread>` 对 `<atomic>` 的传递包含。
- 销毁仍被线程访问或等待的 atomic 对象。

## 与 JavaScript 的区别

> JavaScript `Atomics` 只操作 `SharedArrayBuffer` 上的 typed-array 元素，并受 agent 环境限制；C++ `<atomic>` 操作语言内存模型中的 typed atomic object。JS 普通对象属性不会自动变成共享原子状态，正如 C++ 普通 `int` 也不会因附近存在 atomic 而安全。

## 相关内容

通用原子对象见 `std::atomic`；执行线程见 `std::thread`；跨多个状态维护不变量时评估 `std::mutex`；阻塞等待复合谓词时比较 `std::condition_variable`。

## 来源

设施地图、合法内存序、release/acquire、lock-free、C++11/C++20 初始化差异、C++20 wait/notify 和 `consume` 的当前状态由 manifest 中的 `[atomics.syn]`、`[atomics.order]`、`[atomics.flag]`、N3337、N4861、P0883R2、P1135R6 与 P3475R2 验证；cppreference 中文页仅用于二级结构核对。
