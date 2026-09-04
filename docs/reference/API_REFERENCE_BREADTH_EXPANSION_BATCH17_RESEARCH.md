# C++ Reference 第十七批：原子操作头文件与 `std::atomic` 研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-04
>
> 精确范围：`<atomic>`、`std::atomic`
>
> 事实基线：C++11 工作草案 N3337、C++20 最终工作草案 N4861、当前
> C++ Working Draft，以及相关 WG21 提案与缺陷报告。zh.cppreference 仅作
> 二级结构核对，正文、示例与 JS 类比必须原创。

## 1. 批次目标与身份

第十六批已经建立 mutex 与 condition variable 的阻塞同步路径。本批补上无数据竞争的
细粒度原子访问、memory order、release/acquire 发布、CAS 更新与 lock-free 查询。范围只
包含一个 Header 页和一个类型页，不提前创建 `atomic_ref`、`atomic_flag`、fence 或单独的
`memory_order` 实体页；Header 页可以把它们作为设施地图讲清楚。

| 建议 ID | kind | symbol | slug | header | `since` |
|---|---|---|---|---|---|
| `header-atomic` | `header` | `<atomic>` | `standard-library/headers/atomic` | `<atomic>` | `c++11` |
| `std-atomic` | `type` | `std::atomic` | `standard-library/concurrency/atomic` | `<atomic>` | `c++11` |

建议关系：

- `header-atomic`：`std-atomic`、`std-thread`、`std-mutex`、
  `std-condition-variable`；
- `std-atomic`：`header-atomic`、`std-thread`、`std-mutex`、
  `std-condition-variable`。

两页沿用 `concurrency` 分类。建议 `verifiedAt: 2026-09-04`。

`<atomic>` 与 `std::atomic` 从 C++11 起存在。本批示例统一使用 C++20，因为其中一个发布
示例使用 C++20 `wait`/`notify_one`，Header 的 `atomic_flag::test` 也从 C++20 起提供。

来源：[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、
当前 [`[atomics]`](https://eel.is/c++draft/atomics)。

## 2. 共享正确性模型

### 2.1 原子性不等于发布可见性

对同一个 atomic object 的原子访问不可被其他原子访问撕裂。每个 atomic object 都有自己
的 modification order；read-modify-write 操作读取其在该顺序中紧邻之前的值。但
`memory_order::relaxed` 只保证这个对象上的原子性与一致的 modification order，不为其他
普通对象建立跨线程顺序。

若线程 A 先写普通数据，再对 atomic M 做 release store；线程 B 对同一 M 做 acquire load，
且该 load 读取 release sequence 中的值，则 release synchronizes-with acquire。A 中先于
release 的写 happens-before B 中后于 acquire 的读，因此普通 payload 才能被安全观察。

页面必须明确：`notify_one()` 只是唤醒机制；发布 payload 的同步边来自 release 写与读取它
的 acquire 读，而不是 notify 调用本身。

来源：N4861 `[intro.races]`、`[atomics.order]`，当前
[`[atomics.order]`](https://eel.is/c++draft/atomics.order)、
[CWG 726](https://cplusplus.github.io/CWG/issues/726.html)。

### 2.2 原子单操作不等于事务

`load` 与后续 `store` 分别原子，不代表“读－改－写”整体原子。两个线程做
`counter.store(counter.load() + 1)` 可以互相覆盖，程序可能无 data race 却得到错误结果。
计数应使用 `fetch_add`；条件更新应使用 CAS loop；跨多个 atomic object 的不变量通常仍需
mutex 或经过证明的 lock-free 算法。

默认 `memory_order::seq_cst` 最容易推理，但它也不会把两次独立调用合并成一个事务。

### 2.3 生命周期与表示

atomic 对象必须在所有并发访问前构造完成，并在最后一次访问结束后销毁。构造本身不是
atomic operation；通过 relaxed atomic pointer 把一个“正在构造”的 atomic 地址提前发布，
会让构造与访问发生 data race。析构也不能与任何 load/store/wait 等调用并发。

atomic specialization 的大小和对齐不必等于参数类型 `T`；实现可为非 lock-free 类型保存
额外状态。不要 `reinterpret_cast` 到 `T*`、复制对象表示，或把 atomic 放入不满足其对齐的
packed storage。`std::atomic<T>` 不可复制、不可移动；需要复制“值”时显式 `load` 后构造或
`store`，不能复制 atomic wrapper。

来源：N4861 `[atomics.types.generic]`/`[atomics.types.operations]`，当前
[`[atomics.types.generic]`](https://eel.is/c++draft/atomics.types.generic)。

### 2.4 示例确定性规则

- 编译命令固定为
  `clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread`；
- 每个 Entry 恰好两个 run 示例，总计四个；
- worker thread 不输出，主线程 join 后按固定顺序打印；
- 不输出地址、线程 ID、耗时、调度顺序或 lock-free 查询结果；
- 不用 sleep、yield、超时或忙等猜测线程状态；
- 发布示例用 `atomic::wait` 阻塞，不写 polling loop；
- 不断言哪个线程先执行，也不依赖 `notify_one` 已有 waiter；
- 不把 implementation-defined 的 `is_lock_free()` 结果写进快照。

## 3. `<atomic>`

### 3.1 直接包含合同

页面必须展示并要求：

```cpp
#include <atomic>
```

不能因为 `<thread>`、`<memory>` 或其他实现头当前间接带入声明就省略目标 header。标准只
通过 `<atomic>` 为下表中的核心原子设施提供声明；依赖 transitive include 会在换标准库、
版本或编译模式后失效。

来源：N4861 `[atomics.syn]`，当前
[`[atomics.syn]`](https://eel.is/c++draft/atomics.syn)。

### 3.2 主要设施地图

| 设施 | 首发版本 | Header 页应说明的职责 |
|---|---|---|
| `std::memory_order` 与命名常量 | C++11 | 选择 relaxed、acquire、release、acq_rel、seq_cst；C++20 还有 consume |
| `ATOMIC_*_LOCK_FREE` macros | C++11 | 以 0/1/2 表示 never/sometimes/always lock-free |
| `std::atomic<T>` 与整数、指针特化 | C++11 | atomic object、load/store、exchange、CAS 与类型专属 RMW |
| `std::atomic_ref<T>` | C++20 | 对既有对象建立原子引用；需要独立页面，不在本批展开 |
| `atomic_*` 非成员函数 | C++11 | 对应成员 API，主要支持 C/C++ 共享接口风格 |
| `atomic_wait` / `atomic_notify_*` | C++20 | 等待 atomic 值改变并通知 waiter |
| atomic type aliases | C++11 | `atomic_int` 等标准整数别名；部分别名依实现是否提供基础类型 |
| `std::atomic_flag` | C++11 | 保证 lock-free 的 clear/set flag；C++20 新增 test、wait、notify |
| `atomic_thread_fence` / `atomic_signal_fence` | C++11 | 高级内存顺序设施；错误使用风险高，应另页展开 |
| `atomic_init` / `ATOMIC_VAR_INIT` / `ATOMIC_FLAG_INIT` | C++11；C++20 deprecated | 旧初始化 API；C++20 新代码用构造或列表初始化 |

`std::atomic<std::shared_ptr<T>>` 与 `std::atomic<std::weak_ptr<T>>` 是 C++20 特化，但规范与
声明归属 `<memory>`；Header 页应以“相关特化”注记，不把它们误列为只靠 `<atomic>` 的设施。

来源：N4861 `[atomics.syn]`、`[atomics.alias]`、`[atomics.flag]`，
[P0718R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0718r2.html)。

### 3.3 C++20 memory order 速查

| order | load | store | RMW success | 含义摘要 |
|---|---:|---:|---:|---|
| `relaxed` | 可用 | 可用 | 可用 | 只保证该 atomic 的原子性与 modification order |
| `consume` | 可用 | 不可用 | 可用 | C++20 dependency ordering；实现实践中通常按 acquire，页面不教其优化技巧 |
| `acquire` | 可用 | 不可用 | 可用 | 阻止后续访问越过，读取 release 时建立同步 |
| `release` | 不可用 | 可用 | 可用 | 发布此前访问 |
| `acq_rel` | 不可用于纯 load | 不可用于纯 store | 可用 | RMW 同时具 acquire 与 release 部分 |
| `seq_cst` | 可用 | 可用 | 可用 | acquire/release 效果外，再参与 seq_cst 单一总序 |

`wait` 和 `atomic_flag::test` 是 load-like，只能使用 relaxed、consume、acquire、seq_cst；
`atomic_flag::clear` 是 store-like，只能使用 relaxed、release、seq_cst。默认 order 都是
seq_cst。

C++20 明确建议优先 acquire 而不是 consume，因为实现无法兑现比 acquire 更好的性能。
P3475R2 已在当前草案把 `memory_order::consume` 移到 Annex D：它被 deprecated，允许出现
在 acquire 可出现处，语义等同 acquire。C++20 教学页仍要列出 consume，但必须打版本提示，
不能从当前草案的五项主 enum 反推 C++20 没有 consume。

来源：N4861 [`[atomics.order]`](https://timsong-cpp.github.io/cppwp/n4861/atomics.order)、
[P3475R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3475r2.pdf)、
当前 [`[depr.atomics.order]`](https://eel.is/c++draft/depr.atomics.order)。

### 3.4 Lock-free 与进度保证

`ATOMIC_*_LOCK_FREE`：0 表示对应类型 never lock-free，1 表示 sometimes lock-free，2 表示
always lock-free。C++20 hosted implementation 至少有一对对应的 signed/unsigned integral
atomic specialization 始终 lock-free；这不等于 `atomic<int>`、指针或任意 `atomic<T>` 必然
lock-free。

非 lock-free atomic operation 被标准视为 potentially blocking，内部可以使用锁。Atomic
只承诺不可分割与内存模型语义，不承诺 wait-free、lock-free、固定延迟、公平性或比 mutex
更快。`atomic_flag` 的操作是单独的保证：它们必须 lock-free。

来源：N4861 [`[atomics.lockfree]`](https://timsong-cpp.github.io/cppwp/n4861/atomics.lockfree)、
[`[atomics.flag]`](https://timsong-cpp.github.io/cppwp/n4861/atomics.flag)。

### 3.5 初始化与版本边界

C++11 默认构造的 atomic 留在 uninitialized state，常见安全写法是 value constructor、
`ATOMIC_VAR_INIT` 或随后一次、且尚未并发的 `atomic_init`。P0883R2 修复了这组困难语义：
C++20 默认构造执行 `T()` value-initialization，旧的 `atomic_init`、`ATOMIC_VAR_INIT` 与
`ATOMIC_FLAG_INIT` 进入 deprecated Annex D。C++20 `atomic_flag{}` 明确初始化为 clear。

构造无论哪个版本都不是 atomic operation；“构造函数是 constexpr”也不允许与构造并发。

来源：N3337 `[atomics.types.operations.req]`、N4861 `[depr.atomics]`，
[P0883R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0883r2)、
[LWG 2334](https://cplusplus.github.io/LWG/issue2334)。

### 3.6 Header 页 JavaScript 对照与误区

> JavaScript `Atomics` 只操作 `SharedArrayBuffer` 上的 typed array 元素，并且等待能力受 agent
> 环境限制；C++ `<atomic>` 是对语言内存模型中的 typed atomic object 提供操作。JS 普通
> object 属性不会因为调用类似 API 自动变成共享原子状态，正如 C++ 普通 `int` 也不会因
> 同文件里存在 `std::atomic<int>` 而安全。

Header 页常见误区：依赖 `<thread>` 间接包含；认为所有 atomic 都 lock-free；把 `volatile`
当线程同步；认为 relaxed 发布旁边的普通对象；将 seq_cst 理解成多对象事务；用
`is_lock_free` 的本机输出作为跨平台答案；使用 deprecated 初始化宏写 C++20 新代码；把
`atomic_flag` 保证推广到任意 `atomic<T>`。

### 3.7 Header 示例

#### `release-acquire-publication.cpp`

```cpp
#include <atomic>
#include <iostream>
#include <thread>

int main() {
  int payload = 0;
  int observed = 0;
  std::atomic<bool> ready{false};

  std::thread producer([&] {
    payload = 42;
    ready.store(true, std::memory_order_release);
    ready.notify_one();
  });

  std::thread consumer([&] {
    ready.wait(false, std::memory_order_acquire);
    observed = payload;
  });

  producer.join();
  consumer.join();
  std::cout << std::boolalpha;
  std::cout << "ready=" << ready.load(std::memory_order_relaxed) << '\n';
  std::cout << "observed=" << observed << '\n';
}
```

```text
ready=true
observed=42
```

解释合同：consumer 的 acquire wait 会反复进行 load，只有观察到不等于 `false` 才返回。
它读取 producer 的 release store 后，producer 先写的 payload happens-before consumer 的
读取。producer 即使在 consumer 实际阻塞前 notify 也不会导致错误，因为 atomic 值本身是
持久 predicate。join 只让主线程安全读取 `observed`，不是 producer→consumer 发布的替代。

#### `atomic-flag-state.cpp`

```cpp
#include <atomic>
#include <iostream>

int main() {
  std::atomic_flag flag{};
  const bool first = flag.test_and_set(std::memory_order_relaxed);
  const bool second = flag.test_and_set(std::memory_order_relaxed);
  flag.clear(std::memory_order_relaxed);
  const bool after_clear = flag.test(std::memory_order_relaxed);

  std::cout << std::boolalpha;
  std::cout << "first=" << first << '\n';
  std::cout << "second=" << second << '\n';
  std::cout << "after_clear=" << after_clear << '\n';
}
```

```text
first=false
second=true
after_clear=false
```

解释合同：C++20 default constructor 把 flag 置 clear；`test_and_set` 原子设为 true 并返回
旧值；`clear` 置 false；`test` 只读当前值。这里刻意不写 spinlock：展示 API 状态合同而
不暗示忙等锁具备公平、阻塞或通用 mutex 语义。

## 4. `std::atomic`

### 4.1 C++20 代表声明

以下是类型页应展示的教学轮廓，不复制所有 volatile overload 与非成员镜像。注意 C++20
普通 operations 尚未普遍标记 `constexpr`；当前草案中的 constexpr 是后续版本边界。

```cpp
// <atomic>；C++20 N4861 教学轮廓
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
  operator T() const noexcept;
  T operator=(T desired) noexcept;

  T exchange(T desired,
             memory_order order = memory_order::seq_cst) noexcept;
  bool compare_exchange_weak(T& expected, T desired,
                             memory_order success,
                             memory_order failure) noexcept;
  bool compare_exchange_strong(T& expected, T desired,
                               memory_order success,
                               memory_order failure) noexcept;
  bool compare_exchange_weak(
      T& expected, T desired,
      memory_order order = memory_order::seq_cst) noexcept;
  bool compare_exchange_strong(
      T& expected, T desired,
      memory_order order = memory_order::seq_cst) noexcept;

  void wait(T old,
            memory_order order = memory_order::seq_cst) const noexcept;
  void notify_one() noexcept;
  void notify_all() noexcept;
};
```

来源：N4861 [`[atomics.types.generic]`](https://timsong-cpp.github.io/cppwp/n4861/atomics.types.generic)。

### 4.2 模板约束与特化

C++20 primary template 的 `T` 必须满足 Cpp17CopyConstructible 与
Cpp17CopyAssignable；若下列任一 trait 为 false，程序 ill-formed：

- `is_trivially_copyable_v<T>`；
- `is_copy_constructible_v<T>`；
- `is_move_constructible_v<T>`；
- `is_copy_assignable_v<T>`；
- `is_move_assignable_v<T>`。

不能因为一个类型“只是几个字节”就假定可用。C++20 的智能指针 partial specialization 是
标准库显式提供的例外，不代表用户可让 primary template 接受任意 non-trivial class。
LWG 3012 补齐了仅要求 trivially copyable 仍不足以实现 load/store 的缺口。

当前草案还明确要求 `T` 与 `remove_cv_t<T>` 相同，解决 `atomic<volatile T>` 等问题；这是
LWG 4069/P3323 之后的边界，不应伪装成 N4861 原文。实际 C++20 教学应直接使用 cv-unqualified
`T`，把 volatility 放在对象资格讨论中，而不是写 `atomic<volatile int>`。

标准特化矩阵：

| `T` | 版本 | 在 primary operations 之外的能力 |
|---|---|---|
| `bool` | C++11 | 使用 primary template 能力；没有整数 fetch arithmetic |
| 标准整数与所需 fixed-width 类型 | C++11 | `fetch_add/sub/and/or/xor` 与对应 operators |
| `T*` | C++11 | `fetch_add/sub` 与指针算术 operators；要求相关算术的 `T` 是完整 object type |
| `float` / `double` / `long double` | C++20 | `fetch_add/sub` 与 `+=`/`-=`；浮点环境可能不同于调用线程 |
| `shared_ptr<T>` / `weak_ptr<T>` | C++20 | `<memory>` 中的 owning smart-pointer atomic specialization |

整数 `fetch_add/sub` 的 signed overflow 按对应 unsigned 计算再转回，没有普通 signed integer
overflow 的 UB。Pointer fetch 可能产生 undefined address，但该 atomic operation 本身没有
因此 UB；解引用无效结果仍然错误。浮点算术不可表示时结果 unspecified，但该运算没有额外
UB。

来源：N4861 `[atomics.types.int]`、`[atomics.types.float]`、
`[atomics.types.pointer]`，[LWG 3012](https://cplusplus.github.io/LWG/issue3012)、
[LWG 4069](https://cplusplus.github.io/LWG/issue4069)、
[P0020R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0020r6.html)。

### 4.3 初始化、复制与返回值

`atomic()` 在 C++20 以 `T()` 初始化；`atomic(T desired)` 以 desired 初始化。两者都不是
atomic operation，因此对象必须先安全构造再发布。`atomic` wrapper 的复制构造与复制赋值
被删除，也没有把 atomic wrapper 当普通 value 移动的接口。

`operator=(T)` 等价于 seq_cst `store(desired)` 并返回 desired；它不是复制 atomic 对象。
隐式 `operator T()` 等价于 seq_cst `load()`。教学代码优先显式 load/store，让 memory order
和并发意图可见。

来源：N4861 `[atomics.types.operations]`，
[LWG 3633](https://cplusplus.github.io/LWG/issue3633)。

### 4.4 基本操作：参数、返回与复杂度

| 操作 | 原子效果 | 返回 | C++20 合法 order |
|---|---|---|---|
| `store(desired)` | 写入 desired | `void` | relaxed / release / seq_cst |
| `load()` | 读取当前值 | 读取值 | relaxed / consume / acquire / seq_cst |
| `exchange(desired)` | RMW，用 desired 替换 | 替换前的旧值 | 六种 order 均可 |
| `compare_exchange_*` 成功 | RMW，用 desired 替换 | `true` | success 可为六种 |
| `compare_exchange_*` 失败 | 只 load，并改写 expected | `false` | failure 不得为 release / acq_rel |
| `fetch_add/sub/...` | RMW，写入计算结果 | 计算前的旧值 | 六种 order 均可 |
| `wait(old)` | 值表示仍等于 old 时阻塞并重试 | `void` | relaxed / consume / acquire / seq_cst |
| `notify_one/all()` | 唤醒 eligible atomic waiter | `void` | 没有 order 参数 |

标准没有给这些调用统一的大 O、延迟、公平性或无锁进度保证。单个 API 语义上是一项 atomic
operation，但非 lock-free implementation 可以 potentially block，甚至调用内部锁支持。
因此“原子操作是 O(1)”或“atomic 一定比 mutex 快”都不应写入页面。

`is_always_lock_free` 是 type-level 的 implementation-defined compile-time 常量；
`is_lock_free()` 是对象查询。在一次程序执行中同类型 atomic object 的查询结果一致。
两者都只回答 lock-free property，不回答 wait-free、公平、延迟或当前是否竞争。

来源：N4861 `[atomics.types.operations]`、`[atomics.lockfree]`。

### 4.5 Compare-and-exchange 的 expected 双向参数

CAS 先取 `expected` 的值与 atomic 的 value representation 比较：

- 相等且操作成功：把 atomic 替换为 desired，返回 true，expected 保持原值；
- 比较失败：不写 desired，把 atomic 中实际观察到的值写回 expected，返回 false；
- `compare_exchange_weak` 即使表示相等也允许 spurious failure，因此几乎总应放在 loop；
- `compare_exchange_strong` 没有 weak 的 spurious-failure permission，适合只尝试一次的状态转换。

单 order overload 会推导 failure order：success 为 acq_rel 时 failure 改为 acquire；success
为 release 时 failure 改为 relaxed；其他情况 failure 等于给定 order。

C++11 文本还要求 failure 不得“强于”success。P0418R2 指出这个 strength lattice 不清晰并
移除该限制；C++17 以后、包括 N4861，双 order overload 的显式禁令只剩 failure 不得为
release 或 acq_rel。页面不可从旧资料重新加回已经删除的 C++11 限制。

比较基于 value representation，不等同于 `operator==`。浮点正负零、NaN、union 活动成员与
padding 都可能让直觉失效；类型页应把 CAS 当低级 primitive，不承诺用户级相等语义。

来源：N3337 `[atomics.types.operations.req]`、N4861 `[atomics.types.operations]`、
[P0418R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0418r2.html)、
[LWG 2445](https://cplusplus.github.io/LWG/issue2445)。

### 4.6 Wait、notify 与 ABA

C++20 `wait(old, order)` 执行 load、按 value representation 与 old 比较；不等则返回，相等
则可能阻塞，解除阻塞后继续重试。因此内部可以 spurious unblock，但函数不会仅因一次
spurious unblock 就在值仍等于 old 时返回。

`notify_one` 至少解除一个 eligible waiter（若存在），`notify_all` 解除全部 eligible
waiter。通知不保存为 token；正确性依赖 atomic value。等待比 polling 更高效，但标准没有
wall-clock latency、公平性或先来先醒保证。

若值发生 A→B→A，waiter 可能没有观察到短暂的 B 而继续等待，这就是这里的 ABA 提示。
需要识别每一次事件时，应使用单调 generation counter、队列或更高层同步原语，而不是只等
一个可回到旧值的 flag。

来源：N4861 [`[atomics.wait]`](https://timsong-cpp.github.io/cppwp/n4861/atomics.wait)、
`[atomics.types.operations]`，
[P1135R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1135r6.html)。

### 4.7 `volatile`、异常与错误边界

所有核心 member operations 都是 `noexcept`，不通过 C++ exception 报告竞争、锁实现或
CAS failure；CAS failure 是 bool 结果，wait 可能阻塞。`noexcept` 不表示 non-blocking。

C++20 对 volatile-qualified atomic object 保留 overload，但 P1831R1 把
`is_always_lock_free == false` 时的 volatile overload 放入 deprecated compatibility 路径。
即使 overload 可调用，`volatile` 也只保留 device-register 风格访问资格，不会让普通对象
访问变 atomic，也不会额外建立 happens-before。线程同步使用 `std::atomic<T>` 本身，通常
不应写 `volatile std::atomic<T>`。

以下属于必须明确列出的 ill-formed、前置条件违反或 undefined behavior 边界：

- `T` 不满足 primary template 的类型约束：程序 ill-formed；
- 纯 store 使用 consume/acquire/acq_rel，纯 load 或 wait 使用 release/acq_rel：违反
  C++20 precondition；
- CAS failure order 使用 release/acq_rel：违反 C++20 precondition；
- 构造/析构与另一线程访问重叠：可能 data race / lifetime UB；
- release/acquire 未读取对应 release sequence，却用普通 payload 当已发布：可能 data race；
- 同一普通对象同时被非 atomic 访问，而缺少其他 happens-before：data race；
- 指针 atomic arithmetic 产生无效地址后解引用；
- 对已经结束生命周期、未正确对齐或伪造别名的 atomic storage 调成员函数。

来源：[P1831R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1831r1)、
N4861 `[depr.atomics.volatile]`、当前
[`[depr.atomics.volatile]`](https://eel.is/c++draft/depr.atomics.volatile)。

### 4.8 当前草案版本边界

当前 Working Draft 已包含 C++20 后的新内容，不能直接逐字复制到 C++20 页面：

- P3309 使大量 non-volatile atomic operations `constexpr`；N4861 中 load/store/exchange/CAS
  等不是 constexpr；
- 当前草案含 `fetch_min`/`fetch_max` 等更晚接口，N4861 不含；
- P3475 把 consume 降为 deprecated compatibility 项且等价 acquire；N4861 仍把 consume
  列为独立 order；
- LWG 3949 在后续版本恢复 `atomic<bool>` trivial destructor 的遗漏；不要把当前修订倒写成
  C++20 全泛型 guarantee；
- 当前约束显式拒绝 cv-qualified `T`，N4861 的原文约束列表没有这一项。

来源：[P3309R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3309r2.html)、
[P0493R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p0493r4.pdf)、
[P3475R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3475r2.pdf)、
[LWG 3949](https://cplusplus.github.io/LWG/issue3949)。

### 4.9 JavaScript 对照与常见误区

> `Atomics.add(typedArray, index, value)` 最接近整数 atomic 的 `fetch_add`：两者都返回更新前
> 的旧值。JS `Atomics.compareExchange` 把旧值作为返回值；C++ CAS 返回成功 bool，并把
> `expected` 当 in/out 参数在失败时改成实际值。JS API 没有让调用者选择 C++ 的 memory
> order，不能把 JS 的默认模型机械映射为某个显式 C++ order。

常见误区清单：

- 把 atomicity 当成相邻普通 payload 自动可见；
- 用 relaxed flag 发布普通数据；
- 把 `load`+`store` 当成 RMW；
- 忘记 `fetch_add` 返回旧值；
- CAS 失败后仍假设 expected 保持调用前值；
- weak CAS 不放 loop；
- 给 store/load/wait/CAS failure 传不合法 order；
- 认为 seq_cst 把多个对象和调用组成事务；
- 认为 `is_lock_free()` 必为 true，或 false 就不满足 atomic semantics；
- 输出 lock-free 查询结果作为跨平台快照；
- 用 `volatile` 代替 atomic；
- 等待会 A→B→A 的值，却要求看到每一次 B；
- 在 worker 中输出并把调度顺序写成 expected stdout；
- atomic 仍被访问时离开作用域；
- 将 atomic wrapper `memcpy`、放入 packed storage 或试图复制。

### 4.10 `std::atomic` 示例

#### `relaxed-counter.cpp`

```cpp
#include <atomic>
#include <iostream>
#include <thread>

int main() {
  std::atomic<int> counter{0};
  auto increment = [&] {
    for (int i = 0; i < 1'000; ++i) {
      counter.fetch_add(1, std::memory_order_relaxed);
    }
  };

  std::thread first(increment);
  std::thread second(increment);
  first.join();
  second.join();

  std::cout << "counter=" << counter.load(std::memory_order_relaxed) << '\n';
}
```

```text
counter=2000
```

解释合同：每次 `fetch_add` 是不可分割 RMW；两个线程共 2000 次递增不能互相覆盖。这个例子
只需要 counter 本身的原子计数，不借它发布其他数据，因此 relaxed 足够。join 保证主线程
在两个 worker 完成后读取，不依赖耗时或调度次序。

#### `compare-exchange-expected.cpp`

```cpp
#include <atomic>
#include <iostream>

int main() {
  std::atomic<int> state{7};
  int expected = 3;
  const bool first = state.compare_exchange_strong(
      expected, 9, std::memory_order_relaxed, std::memory_order_relaxed);
  const int expected_after_failure = expected;
  const bool second = state.compare_exchange_strong(
      expected, 9, std::memory_order_relaxed, std::memory_order_relaxed);

  std::cout << std::boolalpha;
  std::cout << "first=" << first << '\n';
  std::cout << "expected_after_failure=" << expected_after_failure << '\n';
  std::cout << "second=" << second << '\n';
  std::cout << "state=" << state.load(std::memory_order_relaxed) << '\n';
}
```

```text
first=false
expected_after_failure=7
second=true
state=9
```

解释合同：第一次比较 3 与实际 7 失败，atomic 保持 7，但 expected 被更新为 7；第二次直接
使用这个新 expected，比较成功并把 state 写成 9。例子用 strong 避免教学输出依赖 weak 的
允许 spurious failure；它不是 CAS loop 性能示例。

## 5. 示例与来源验收表

| Entry / 文件名 | 精确 stdout |
|---|---|
| `header-atomic` / `release-acquire-publication.cpp` | `ready=true\nobserved=42\n` |
| `header-atomic` / `atomic-flag-state.cpp` | `first=false\nsecond=true\nafter_clear=false\n` |
| `std-atomic` / `relaxed-counter.cpp` | `counter=2000\n` |
| `std-atomic` / `compare-exchange-expected.cpp` | `first=false\nexpected_after_failure=7\nsecond=true\nstate=9\n` |

全部 example manifest 应使用 `kind: "run"`、`standard: "c++20"`，并保存上述 stdout。
本研究任务已在本机实际执行：

```text
Apple clang version 15.0.0 (clang-1500.3.9.4)
clang++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -pthread
```

四个源文件全部编译成功、运行退出码为 0，stdout 与表格逐字一致。发布示例的 C++20
`atomic::wait`/`notify_one` 和 flag 示例的 `atomic_flag::test` 均受该本地 toolchain 支持。
实现代理仍须在条目落盘后通过项目的真实 example verification 再标记最终 `verified`，不能
用本研究临时文件代替仓库验收。

## 6. 一级来源矩阵与二级结构参考

| 主题 | 一级来源 |
|---|---|
| C++11 初始接口与未初始化默认构造 | N3337 `[atomics.syn]`、`[atomics.types.generic]`、`[atomics.types.operations]` |
| C++20 Header 与 `std::atomic` 基线 | N4861 `[atomics.syn]`、`[atomics.types.generic]`、`[atomics.types.operations]` |
| memory order、release/acquire、seq_cst | N4861 与当前 `[atomics.order]` |
| lock-free 与 potentially blocking | N4861 与当前 `[atomics.lockfree]` |
| C++20 wait/notify 与 ABA | P1135R6、N4861 `[atomics.wait]` |
| C++20 初始化修复 | P0883R2、LWG 2334 |
| C++20 类型约束 | LWG 3012、N4861 `[atomics.types.generic]` |
| C++17 CAS failure-order 变更 | P0418R2、LWG 2445 |
| C++20 volatile deprecation | P1831R1、N4861 `[depr.atomics]` |
| C++20 floating atomic arithmetic | P0020R6、N4861 `[atomics.types.float]` |
| 后续 consume/cv/constexpr 边界 | P3475R2、LWG 4069、P3309R2 |

直接链接：

- [N3337 PDF](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- [N4861 PDF](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
- [当前 Atomic operations](https://eel.is/c++draft/atomics)
- [当前 Header `<atomic>` synopsis](https://eel.is/c++draft/atomics.syn)
- [当前 `std::atomic`](https://eel.is/c++draft/atomics.types.generic)
- [当前 memory order](https://eel.is/c++draft/atomics.order)
- [当前 lock-free property](https://eel.is/c++draft/atomics.lockfree)
- [当前 waiting and notifying](https://eel.is/c++draft/atomics.wait)

二级结构核对仅使用：

- [zh.cppreference `<atomic>`](https://zh.cppreference.com/w/cpp/header/atomic)
- [zh.cppreference `std::atomic`](https://zh.cppreference.com/w/cpp/atomic/atomic)
- [zh.cppreference `std::memory_order`](https://zh.cppreference.com/w/cpp/atomic/memory_order)

实现正文不可复制 cppreference 文句、表格或示例。二级页面用于发现是否遗漏设施与版本标签；
参数、返回、复杂度、同步、UB 与版本结论都回到以上 WG21 文本核对。

## 7. 实现与终审清单

Header 页必须具备：

- 精确 `#include <atomic>` 与拒绝 transitive include 的说明；
- 带 C++ 版本列的主要设施表；
- 六种 C++20 memory order 的适用操作与当前 consume 边界；
- lock-free 0/1/2、potentially blocking 与 atomic_flag 的独立保证；
- C++11 未初始化、C++20 value initialization 与旧宏 deprecated 的边界；
- release/acquire publication 与 atomic_flag 两个已验证示例；
- 第一段 JS 对照使用 blockquote；
- 至少两个 related ID 与至少一个 primary source。

`std::atomic` 页必须具备：

- N4861 代表声明，不混入当前草案的后续 constexpr/fetch_min/fetch_max；
- `T` 的五个 trait 与 Cpp17CopyConstructible/CopyAssignable 要求；
- 初始化、不可复制、表示/对齐与生命周期；
- load/store/exchange/CAS/fetch/wait-notify 的参数、返回和合法 order；
- CAS 失败会改写 expected、weak 可 spurious failure、单 order 推导；
- modification order、release/acquire、happens-before 与 relaxed 的边界；
- `is_lock_free`/`is_always_lock_free` 与非 lock-free potentially blocking；
- 整数、指针、浮点、smart pointer 特化的版本与能力；
- volatile deprecation、ill-formed/precondition/UB 边界；
- relaxed counter 与 expected mutation 两个已验证示例；
- 第一段 JS 对照使用 blockquote；
- 至少两个 related ID 与至少一个 primary source。

终审拒绝：把 atomic 写成事务；relaxed 发布普通 payload；非法 order；CAS failure 不更新
expected；weak 单次调用却期待必成功；把所有 atomic 写成 lock-free/O(1)；把 volatile 当
同步；忽略构造和析构 lifetime；断言 lock-free 输出；用 sleep 或 polling 制造示例；worker
直接输出；把当前草案接口倒写为 C++20；复制 cppreference 内容；未执行仓库级验证却声称
最终 verified。
