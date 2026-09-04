# `std::atomic`

`std::atomic<T>` 把一个值包装成可由多个线程原子访问的对象，并允许为每次访问选择内存顺序。它适合独立标志、计数器、指针发布和经过证明的无锁算法；跨多个字段维护业务不变量时，mutex 往往更清楚。

## 快速信息

- 头文件：`<atomic>`
- 命名空间：`std`
- 标准：C++11 起
- C++20 新能力：默认值初始化、`wait` / `notify`、浮点和智能指针特化

## 什么时候使用

一个状态可以由单次 load/store/RMW 表达，或已经明确设计了 release/acquire、CAS 等协议时使用。普通计数器可用 `fetch_add`，一次状态转换可用 strong CAS，需要重试的条件更新使用 weak CAS loop。

若正确性依赖两个以上对象保持联合不变量、需要条件谓词或临界区内有多步逻辑，优先 `mutex`。不要只因为 atomic 看起来更“底层”就替代容易审查的锁协议。

## C++20 代表接口

```cpp
template<class T>
struct atomic {
  using value_type = T;
  static constexpr bool is_always_lock_free = implementation-defined;

  bool is_lock_free() const noexcept;
  constexpr atomic() noexcept(is_nothrow_default_constructible_v<T>);
  constexpr atomic(T desired) noexcept;
  atomic(const atomic&) = delete;
  atomic& operator=(const atomic&) = delete;

  void store(T desired,
             memory_order order = memory_order::seq_cst) noexcept;
  T load(memory_order order = memory_order::seq_cst) const noexcept;
  T exchange(T desired,
             memory_order order = memory_order::seq_cst) noexcept;
  bool compare_exchange_weak(T& expected, T desired,
                             memory_order success,
                             memory_order failure) noexcept;
  bool compare_exchange_strong(T& expected, T desired,
                               memory_order success,
                               memory_order failure) noexcept;
  void wait(T old,
            memory_order order = memory_order::seq_cst) const noexcept;
  void notify_one() noexcept;
  void notify_all() noexcept;
};
```

此处省略 volatile overload、隐式转换、值赋值、单 order CAS 以及非成员镜像。整数和指针特化另有 fetch 操作。上方是 N4861 的 C++20 形态；当前草案把更多非 volatile 操作改为 `constexpr`，并含更新版本的接口，不能倒写进 C++20 基线。

## 类型约束与特化

C++20 主模板要求 `T` 满足 Cpp17CopyConstructible 与 Cpp17CopyAssignable，并且 `is_trivially_copyable_v<T>`、copy/move constructible、copy/move assignable 五个 trait 都为 true，否则程序 ill-formed。实际代码应使用 cv-unqualified `T`；当前草案已显式把这一点加入约束。

| 类别 | 起始版本 | 在主模板之外增加或限制的能力 |
|---|---|---|
| `atomic<bool>` | C++11 | 提供主模板的 load/store/exchange/CAS；不提供整数 fetch 算术与位运算 |
| 标准整数特化 | C++11 | 增加 `fetch_add/sub/and/or/xor` 及对应复合赋值；有符号整数运算使用二进制补码且不产生未定义结果 |
| `atomic<T*>` | C++11 | 增加 `fetch_add/sub` 与 `+=/-=`；指针算术要求 `T` 是完整对象类型，结果即使是未定义地址也不能解引用 |
| `atomic<Floating>` | C++20 | 增加 `fetch_add/sub` 与 `+=/-=`；浮点环境可以不同于调用线程，结果不可表示时结果值未指定，但该操作不会因此产生未定义行为 |
| `atomic<shared_ptr<T>>`、`atomic<weak_ptr<T>>` | C++20 | 在 `<memory>` 中声明，原子化的是智能指针控制状态；不是任意 `shared_ptr` 成员访问的自动同步 |

## 初始化、参数与返回值

C++20 `atomic()` 用 `T()` 初始化，值构造器保存 desired；构造都不是原子操作。Wrapper 不可复制、不可移动，要复制值就显式 load 后构造或 store。`store` 返回 void；`load` 返回读取值；`exchange` 与整数 `fetch_*` 返回修改前的旧值。

`compare_exchange_*` 把 expected 作为 in/out 参数。比较成功时写入 desired、返回 true，expected 不变；失败时 atomic 不写 desired、返回 false，并把观察到的实际值写回 expected。Weak 允许伪失败，通常放入循环；只尝试一次时使用 strong。

单 order CAS 在 success 为 acq_rel 时将 failure 推导为 acquire，success 为 release 时推导为 relaxed。双 order CAS 的 failure 不能是 release 或 acq_rel。纯 store 只能用 relaxed/release/seq_cst；纯 load 和 wait 只能用 relaxed/consume/acquire/seq_cst。

| 操作 | 返回值 | C++20 合法 order |
|---|---|---|
| `store(desired, order)` | `void` | relaxed、release、seq_cst |
| `load(order)` | 读取到的 `T` | relaxed、consume、acquire、seq_cst |
| `exchange(desired, order)` | 修改前的 `T` | 六种 order 均可 |
| `compare_exchange_*` | 是否写入 desired 的 `bool`；失败时回写 expected | success 可用六种；failure 不得为 release/acq_rel，且不得强于 success |
| 整数、指针或浮点特化的 `fetch_*` | 修改前的值 | 六种 order 均可 |
| `wait(old, order)` | `void` | relaxed、consume、acquire、seq_cst |
| `notify_one()`、`notify_all()` | `void` | 没有 order 参数；通知本身不建立发布语义 |

## 原子性、同步与线程安全

同一个 atomic object 有单独 modification order，每次 RMW 读取其中紧邻之前的值。Relaxed 保证该对象上的原子性和顺序，不为其他普通对象建立 happens-before。Release 操作与真正读到相应 release sequence 的 acquire 操作同步，才会发布此前的普通写入。

对同一 atomic 对象并发调用原子成员是安全的；这不会让相邻普通对象或由 atomic 指针指向的对象自动安全。`load(); 计算; store()` 是两个独立原子操作，不能替代 `fetch_add` 或 CAS。

C++20 `wait(old)` 值不等时返回，值仍相等时阻塞并在唤醒后重查。Notify 不保存令牌；A→B→A 的短暂变化可能被错过。需要每个事件都可观察时使用代数、队列或更高层同步。

## 复杂度、lock-free 与进度

标准未规定这些操作的统一渐进复杂度、固定延迟、公平性或 wait-free 保证。`is_always_lock_free` 是类型级 implementation-defined 常量，`is_lock_free()` 查询对象的实现属性；结果为 false 仍具有完整 atomic 语义，但实现可以用内部锁并 potentially block。

不要输出 lock-free 查询作为跨平台测试结果，也不要据此直接判断实际性能。缓存竞争、内存序、对齐和平台实现都可能影响成本。

## 异常、失效与生命周期

核心成员是 `noexcept`；CAS 失败通过 bool 和 expected 回写表达，竞争不是异常。`noexcept` 不等于不阻塞。C++20 对非 always-lock-free 类型的 volatile overload 已进入 deprecated 路径；`volatile` 本身从不建立线程同步。

Atomic 的大小和对齐可以不同于 `T`。对象必须在所有并发访问前完整构造，并活过最后一次 load/store/wait；构造、析构与并发访问重叠，错误对齐、伪造别名、memcpy wrapper 或解引用无效 atomic 指针结果都可能导致未定义行为。错误 memory order 是前置条件违反，不能依赖异常恢复。

## 示例

第一个示例让两个线程各做 1000 次 relaxed fetch_add；它只统计 atomic 自身，不用计数器发布其他数据。第二个示例先故意让 strong CAS 失败，观察 expected 被改写，再以新 expected 成功更新状态。

## 常见错误

- 用 relaxed 标志发布普通 payload。
- 把 load 加 store 当成原子读改写。
- 忘记 fetch 操作返回修改前的旧值。
- CAS 失败后仍假设 expected 保持调用前值。
- Weak CAS 只调用一次却要求必定成功。
- 为 store、load、wait 或 CAS failure 选择非法 order。
- 认为 seq_cst 能建立跨多个调用的事务。
- 把 lock-free 等同于 wait-free、公平或更快。
- 用 `volatile` 替代 atomic。
- Atomic 仍被访问或等待时结束其生命周期。

## 与 JavaScript 的区别

> `Atomics.add(typedArray, index, value)` 与整数 atomic 的 `fetch_add` 都返回更新前旧值；JavaScript `Atomics.compareExchange` 直接返回旧值，而 C++ CAS 返回成功 bool，并在失败时改写 `expected`。JavaScript API 也不让调用者选择 C++ memory order，不能机械映射。

## 相关内容

头文件设施和 memory-order 地图见 `<atomic>`；线程执行与 join 见 `std::thread`；复合不变量见 `std::mutex`；等待复合谓词见 `std::condition_variable`。

## 来源

类型约束、初始化、操作返回、CAS、等待通知、各类特化、内存序、lock-free、volatile 与生命周期合同由 manifest 中的 `[atomics.types.generic]`、`[atomics.types.int]`、`[atomics.types.pointer]`、`[atomics.types.float]`、`[atomics.wait]`、`[atomics.order]`、`[atomics.lockfree]`、N3337、N4861、P0883R2、P0418R2、P0718R2、P1135R6 与 P1831R1 验证；cppreference 中文页仅用于二级结构核对。
