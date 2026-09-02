# C++ Reference 第十四批：所有权接入、分配器与原始存储生命周期研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-02
>
> 精确范围：`std::enable_shared_from_this`、`std::allocator`、
> `std::uninitialized_copy`、`std::destroy`
>
> 事实基线：C++98 公共审查稿 N2356、C++11 工作草案 N3337、C++17
> 工作草案 N4659、C++20 工作草案 N4861、当前 C++ Working Draft，以及相关
> WG21 原始提案和 LWG 缺陷报告。cppreference 与 zh.cppreference 只作二级信息
> 架构和覆盖核对，正文、表格和示例不得复制。

## 1. 批次目标与版本边界

本批恰好增加四个 Memory Entry，把“共享所有权如何从对象内部安全接回控制块”与
“原始存储如何分配、开始对象生命周期、结束对象生命周期、最后释放存储”串成一条完整
学习路径。它们都由 `<memory>` 直接声明并归入现有 `memory` 分类，不新增 Header Entry。

- `std::allocator` 与 `std::uninitialized_copy` 自 C++98 起存在；前者是默认分配器，后者
  在尚无活动目标对象的存储上逐项复制构造。
- `std::enable_shared_from_this` 自 C++11 起存在。C++17 的 P0033R1 补全
  `weak_from_this`，并把未接入共享控制块时的 `shared_from_this` 行为明确为构造
  `shared_ptr` 失败并抛出 `std::bad_weak_ptr`，不再沿用早期“调用前必须已有 owner”的
  前置条件表述。
- `std::destroy`、`std::destroy_n` 和 `std::destroy_at` 由 P0040R3 加入 C++17；
  `destroy` 的页面 `since` 应为 `c++17`，不能因为它处理的是 C++98 已有的显式析构语义
  而写成 `c++98`。
- P0040R3 同时把 execution-policy overload 加入相关原始存储算法。C++20 N4861 中
  `uninitialized_copy(policy, ...)` 仍把源 iterator 写作 `InputIterator`，目标为
  `NoThrowForwardIterator`；不要机械套用普通 `<algorithm>` 并行算法的统一模板轮廓。
- P0896R4 在 C++20 加入 ranges 原始存储算法。它们使用有上界的 output range，返回
  `in_out_result` 或结束 iterator，并以 exposition-only `no-throw-*` concepts 限制用于
  清理的 iterator 操作。
- P0784R7 使 `std::allocator::allocate/deallocate` 与 `std::destroy` 家族在 C++20
  获得相应 `constexpr` 支持；但 C++20 的 `uninitialized_copy` 及其 ranges overload
  **还不是** `constexpr`。P2283R2/P3508 为 C++26 才把多数 specialised memory
  algorithms 变成 `constexpr`，不能倒灌为 C++20 接口。
- P0174R2 在 C++17 弃用 `std::allocator` 的冗余成员；P0619R4 在 C++20 删除
  `pointer`、`const_pointer`、`reference`、`const_reference`、`rebind`、`address`、
  `construct`、`destroy` 等冗余接口。现代泛型代码使用 `allocator_traits`，对象创建和
  销毁使用 traits 或 `construct_at`/`destroy_at`。
- P0401R6 的 `allocate_at_least` 属于 C++23；C++20 代表接口不能展示它。当前草案中的
  `allocation_result`、C++26 constexpr specialized algorithms 和 parallel ranges 也都要
  带清晰版本徽标。

来源：[N2356](https://www.open-std.org/jtc1/sc22/open/n2356/)、
[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)、
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、
[P0033R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0033r1.html)、
[P0040R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0040r3.html)、
[P0174R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0174r2.html)、
[P0619R4](https://wg21.link/P0619R4)、
[P0784R7](https://open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0784r7.html)、
[P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)、
[P0401R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0401r6.html)、
[P3508R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3508r0.html)。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | 建议 slug | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|---|
| `std-enable-shared-from-this` | `type` | `std::enable_shared_from_this` | `standard-library/memory/enable-shared-from-this` | `<memory>` | `c++11` | `c++20` | [`[util.smartptr.enab]`](https://eel.is/c++draft/util.smartptr.enab) |
| `std-allocator` | `type` | `std::allocator` | `standard-library/memory/allocator` | `<memory>` | `c++98` | `c++20` | [`[default.allocator]`](https://eel.is/c++draft/default.allocator) |
| `std-uninitialized-copy` | `function` | `std::uninitialized_copy` | `standard-library/memory/uninitialized-copy` | `<memory>` | `c++98` | `c++20` | [`[uninitialized.copy]`](https://eel.is/c++draft/uninitialized.copy) |
| `std-destroy` | `function` | `std::destroy` | `standard-library/memory/destroy` | `<memory>` | `c++17` | `c++20` | [`[specialized.destroy]`](https://eel.is/c++draft/specialized.destroy) |

四个 ID 均未在当前 catalog 中使用。`std-destroy` 作为家族入口，以范围版 `std::destroy`
为主，同时解释 `destroy_at` 与 `destroy_n`；不要额外新增三个彼此割裂的薄页。

### 1.2 Manifest-ready 关系

| ID | 建议 `relatedEntryIds` |
|---|---|
| `std-enable-shared-from-this` | `header-memory`、`std-shared-ptr`、`std-weak-ptr`、`std-make-shared` |
| `std-allocator` | `header-memory`、`std-vector`、`std-uninitialized-copy`、`std-destroy` |
| `std-uninitialized-copy` | `header-memory`、`std-copy`、`std-allocator`、`std-destroy` |
| `std-destroy` | `header-memory`、`std-allocator`、`std-uninitialized-copy`、`std-vector` |

这些 related ID 均已存在或在本批同时落库。不要引用尚未创建的 `allocator_traits`、
`construct_at`、`uninitialized_move` 独立页面。

## 2. 四页共享的存储—对象生命周期模型

### 2.1 存储、对象与所有权不是同义词

本批最重要的教学前置不是函数签名，而是三层概念分离：

1. `allocator.allocate(n)` 取得足够容纳 `n` 个 `T` 的动态存储。C++20 合同会开始
   `T[n]` 数组对象本身的生命周期，但不会开始各数组元素的生命周期。
2. `uninitialized_copy`/`construct_at` 在相应槽位创建 `T` 元素，构造完成后才能读取其值、
   调成员函数或把它当作活动对象使用。
3. `destroy`/`destroy_at` 结束元素生命周期；`deallocate` 最后释放整个存储。只释放存储而
   不销毁仍活动的非平凡元素会跳过其资源清理；只 destroy 不 deallocate 则泄漏存储。

对象寿命开始与结束的一般规则来自 [`[basic.life]`](https://eel.is/c++draft/basic.life)。
`std::allocator<T>::allocate` 的 C++20 数组对象规则来自 N4861 `[allocator.members]` 和
[P0593R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0593r6.html)。
专用内存算法在复用存储时会结束任何既有对象（包括 potentially-overlapping subobject）的
生命周期，见
[`[specialized.algorithms.general]`](https://eel.is/c++draft/specialized.algorithms.general)。

### 2.2 原始存储算法的异常清理合同

`uninitialized_copy` 与普通 `std::copy` 的根本差别是前者调用**复制构造**，而不是赋值。
如果构造第 k 个元素时抛异常，specialized algorithms 的共享规则要求先销毁本次调用已经通过
placement new 构造出的目标对象，再让异常传播；销毁顺序未指定。源对象不由该算法销毁，
目标 raw storage 本身也不由算法释放。因此调用方在 catch 路径仍负责将 allocator 返回的
存储交回 allocator。

这个保证不等价于“整个程序状态无变化”：源类型的复制构造、日志、全局计数或外部资源可能有
副作用，销毁顺序也不能被观察为固定。来源：
[`[specialized.algorithms.general]`](https://eel.is/c++draft/specialized.algorithms.general)、
[LWG 3054](https://cplusplus.github.io/LWG/issue3054)。

### 2.3 Execution policy 的异常与次序边界

C++17/C++20 的标准 execution policies 不改变“目标必须是未初始化且不重叠的存储”这一
前置条件。对标准 policy，element access function 抛出的异常会调用 `std::terminate`；
算法为并行化申请内部内存失败仍可能抛 `std::bad_alloc`。自定义 policy 的行为由实现规定。
policy 允许构造或销毁调用不按输入 iterator 的可见顺序发生，不能让构造函数、析构函数或
iterator 操作依赖线程、次序或无同步共享状态。

`std::destroy(policy, ...)` 处理的类型仍必须满足不抛析构要求；不要用一个主动抛异常的析构
函数测试 policy 行为。来源：N4861 `[algorithms.parallel.exceptions]`、
[`[algorithms.parallel.exceptions]`](https://eel.is/c++draft/algorithms.parallel.exceptions)、
[`[algorithms.parallel.user]`](https://eel.is/c++draft/algorithms.parallel.user)、
[P0040R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0040r3.html)。

### 2.4 Iterator、范围与并发访问

Classic `uninitialized_copy` 的目标是 `NoThrowForwardIterator`：有效 iterator 的递增、复制、
赋值、比较和解引用不能抛异常，以便构造失败后可靠清理。C++20 ranges 使用 exposition-only
`no-throw-forward-iterator`/`no-throw-sentinel`，并要求目标解引用为真正 lvalue reference、
其去 cvref 类型与 `iter_value_t` 一致。`ranges::destroy` 只需单遍，因此约束可降到
`no-throw-input-iterator`。

这些 concepts 是规范说明工具，不是用户可命名的 `std::nothrow_forward_iterator` API。
来源：[`[special.mem.concepts]`](https://eel.is/c++draft/special.mem.concepts)、N4861
`[special.mem.concepts]`。

算法没有替调用方同步共享存储。对同一个活动对象，一线程 copy-read 而另一线程写，或一线程
destroy 而另一线程读写，都会触及 data-race/对象寿命规则。不同目标槽位可由算法内部并行
构造或销毁，但用户提供的类型操作不得偷偷写同一共享非原子状态。来源：
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)、
[`[basic.life]`](https://eel.is/c++draft/basic.life)。

### 2.5 确定性示例红线

本批 8 个示例必须遵守：

- 全部以 C++20 编译；不使用 C++23 `allocate_at_least`、C++26 constexpr specialized
  algorithms 或 parallel ranges；
- 每个标准设施直接包含声明它的 header；不能依赖 `<vector>` 传递包含 `<memory>`；
- `enable_shared_from_this` 只通过 `make_shared` 或明确的首个 owner 建立控制块，不从同一 raw
  pointer 创建第二个独立 `shared_ptr`；
- 不输出 heap address、控制块地址、allocator 调用次数、allocation size class、线程、时间或
  实现相关 type name；
- allocator 示例成对执行 construct/destroy 与 allocate/deallocate，并把原始 `p` 与原始
  `n` 交回同一 allocator；
- uninitialized-copy 的 source/destination 完全不重叠，目标槽位没有活动对象；只读取成功
  构造的前缀；
- destroy 后不再读取、调用成员或析构同一对象；只允许用 raw pointer 表示存储位置并最终
  deallocate；
- 不用抛异常析构函数，不把清理顺序、构造调用线程或实现优化次数写进 expected stdout。

## 3. `std::enable_shared_from_this`

### 3.1 C++20 代表接口与直接包含

```cpp
// <memory>
template<class T>
class enable_shared_from_this {
protected:
  constexpr enable_shared_from_this() noexcept;
  enable_shared_from_this(const enable_shared_from_this&) noexcept;
  enable_shared_from_this&
    operator=(const enable_shared_from_this&) noexcept;
  ~enable_shared_from_this();

public:
  shared_ptr<T> shared_from_this();
  shared_ptr<const T> shared_from_this() const;
  weak_ptr<T> weak_from_this() noexcept;             // C++17
  weak_ptr<const T> weak_from_this() const noexcept; // C++17
};
```

必须直接 `#include <memory>`。`T` 可以在实例化该基类时是不完整类型。构造、复制、赋值和
析构为 protected，设计用途是作为 `T` 的基类，而不是让业务代码单独持有 helper 对象。
复制/赋值 helper 不复制内部 `weak_this` 绑定，因此复制一个派生对象不会让新对象偷偷共享原
对象控制块。来源：
[`[util.smartptr.enab]`](https://eel.is/c++draft/util.smartptr.enab)、N4861
`[util.smartptr.enab]`。

### 3.2 控制块接入、参数、返回与错误

类型 `T` 应以**公开且无歧义**方式继承 `enable_shared_from_this<T>`。一个创建新所有权组的
`shared_ptr` 构造过程发现该基类后，会在 `p != nullptr` 且内部 weak owner 尚 expired 时，
把它接到当前控制块。`make_shared<T>` 最自然地完成同一件事。私有继承、多个歧义基类或 CRTP
模板参数不对应实际对象类型时，自动接入条件不成立。

`shared_from_this()` 没有参数，返回指向 `*this` 且与已存在 owner 共享控制块的新
`shared_ptr`；因此正常成功后强引用计数会增加一。它规范上等价于从内部 `weak_ptr` 构造
`shared_ptr`：尚未接入 owner、正在构造函数中、栈对象或最后一个强 owner 已经消失时，内部
weak owner expired，构造会抛 `std::bad_weak_ptr`。`weak_from_this()` 不抛异常；未接入时返回
empty/expired weak pointer。

没有单独的运行时复杂度保证写在 `[util.smartptr.enab]`；不要承诺“零成本”或精确原子操作数。
来源：[`[util.smartptr.enab]`](https://eel.is/c++draft/util.smartptr.enab)、
[`[util.smartptr.shared.const]`](https://eel.is/c++draft/util.smartptr.shared.const)、
[P0033R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0033r1.html)、
[LWG 2529](https://cplusplus.github.io/LWG/issue2529)。

### 3.3 生命周期、失效与线程安全

返回的 `shared_ptr` 可以让完整对象活过当前成员函数调用，适合把 `this` 交给异步回调；但必须
在进入成员函数时对象仍然存活。对已经析构的对象调用成员函数本身就无效，
`enable_shared_from_this` 不能复活 dead object。

构造函数中通常还没有完成 owning `shared_ptr` 的接入，调用 `shared_from_this()` 会抛
`bad_weak_ptr`。析构期间最后一个强 owner 已进入释放流程，`weak_from_this()` 可用于取得仍
共享 weak ownership identity 的 expired weak pointer，但不能重新取得强 owner。

从同一个 raw pointer 构造两个互不相关的 `shared_ptr` 不是“重新接入”：第二个控制块不会在
已有绑定活跃时覆盖 `weak_this`，最终还会发生重复删除等未定义行为。正确做法是复制已有
`shared_ptr`、调用 `shared_from_this`，或从一开始使用 `make_shared`。

`shared_ptr` 控制块允许不同 `shared_ptr` 实例并发增减 owner，但首次给 `weak_this` 赋值不是
原子操作；规范明确它会与对同一对象的潜在并发访问冲突。在对象构造和发布完成前不要把 raw
`this` 暴露给其他线程。对象自身业务字段也仍需自己的同步。来源：
[`[util.smartptr.shared.const]`](https://eel.is/c++draft/util.smartptr.shared.const)、
[`[util.smartptr.shared.atomic]`](https://eel.is/c++draft/util.smartptr.shared.atomic)、
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)。

### 3.4 JS 对照与常见误区

JS 中把 `this` 放进 Promise 或闭包通常会让闭包对对象形成普通强引用，GC 自动追踪它；C++ 的
raw `this` 不增加任何 owner。`shared_from_this()` 更像“从对象内部取得一张指向既有控制块的
强所有权票”，不是重新 `new` 或克隆对象。JS `WeakRef` 可帮助理解 `weak_from_this` 的非拥有
观察，但 JS 的回收时间不确定，也没有 C++ 控制块和确定性析构合同。

常见误区：

- 继承后任何 raw/stack 对象都能 `shared_from_this`；
- private 或 ambiguous inheritance 也会自动接入；
- 构造函数里已经可以安全调用；
- `shared_ptr<T>(this)` 等价于 `shared_from_this()`；
- 第二个独立控制块会自动合并到第一个控制块；
- `weak_from_this()` 会增加强引用计数；
- helper 的复制会复制 owner 绑定；
- 拿到 weak pointer 就能保证对象继续存活；
- shared control block thread-safe 等于 `T` 的全部成员自动 thread-safe。

### 3.5 两个确定性示例

#### 示例 1：`share-service-from-member.cpp`

从 `make_shared` 创建服务，再由成员函数返回 `shared_from_this()`。只输出规范保证的 owner
等价关系、计数和字段，不输出地址。

直接包含：`<iostream>`、`<memory>`。

```cpp
#include <iostream>
#include <memory>

class Service : public std::enable_shared_from_this<Service> {
public:
  explicit Service(int id) : id_(id) {}

  std::shared_ptr<Service> share() {
    return shared_from_this();
  }

  int id() const noexcept {
    return id_;
  }

private:
  int id_;
};

int main() {
  auto owner = std::make_shared<Service>(42);
  auto from_member = owner->share();

  const bool same_owner =
    !owner.owner_before(from_member) && !from_member.owner_before(owner);

  std::cout << std::boolalpha;
  std::cout << "same_owner=" << same_owner << '\n';
  std::cout << "owners=" << owner.use_count() << '\n';
  std::cout << "id=" << from_member->id() << '\n';
}
```

精确 stdout：

```text
same_owner=true
owners=2
id=42
```

#### 示例 2：`observe-object-without-owner.cpp`

对栈对象先调用 C++17 `weak_from_this`，再捕获 `shared_from_this` 的 `bad_weak_ptr`。这是
P0033 之后定义明确的失败路径，不演示 UB。

直接包含：`<iostream>`、`<memory>`。

```cpp
#include <iostream>
#include <memory>

class Session : public std::enable_shared_from_this<Session> {};

int main() {
  Session session;
  const bool weak_expired = session.weak_from_this().expired();

  bool shared_failed = false;
  try {
    static_cast<void>(session.shared_from_this());
  } catch (const std::bad_weak_ptr&) {
    shared_failed = true;
  }

  std::cout << std::boolalpha;
  std::cout << "weak_expired=" << weak_expired << '\n';
  std::cout << "shared_failed=" << shared_failed << '\n';
}
```

精确 stdout：

```text
weak_expired=true
shared_failed=true
```

## 4. `std::allocator`

### 4.1 C++20 代表接口与现代定位

```cpp
// <memory>, C++20 教学轮廓
template<class T>
class allocator {
public:
  using value_type = T;
  using size_type = std::size_t;
  using difference_type = std::ptrdiff_t;
  using propagate_on_container_move_assignment = std::true_type;

  constexpr allocator() noexcept;
  constexpr allocator(const allocator&) noexcept;
  template<class U>
  constexpr allocator(const allocator<U>&) noexcept;
  constexpr ~allocator();

  [[nodiscard]] constexpr T* allocate(std::size_t n);
  constexpr void deallocate(T* p, std::size_t n);
};
```

必须直接包含 `<memory>`。以上是 C++20 轮廓，不应加入 C++23 `allocate_at_least`。所有默认
allocator specialization 的 `allocator_traits<allocator<T>>::is_always_equal::value` 为 true，
不同 `T/U` 的默认 allocator 比较相等。默认 allocator 是大多数标准容器的默认模板参数，
通常由容器和 `allocator_traits` 驱动；普通业务代码很少需要手写原始分配循环。

泛型 allocator-aware 代码必须通过 `std::allocator_traits<Alloc>` 访问 pointer、rebind、
construct、destroy、propagation traits 等统一接口。直接写 `alloc.construct`、
`alloc.destroy` 或 `Alloc::rebind` 会把代码锁死在已从 C++20 标准接口移除的旧成员上。
来源：[`[default.allocator]`](https://eel.is/c++draft/default.allocator)、
[`[allocator.traits]`](https://eel.is/c++draft/allocator.traits)、
[`[allocator.requirements]`](https://eel.is/c++draft/allocator.requirements)、
[P0174R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0174r2.html)、
[P0619R4](https://wg21.link/P0619R4)。

### 4.2 `allocate`：参数、返回、错误与对象寿命

`allocate(n)` 要求 `T` 是完整类型，返回指向 `T[n]` 数组首元素的适当对齐 pointer。
C++20 中该调用开始数组对象的生命周期，但不开始任何元素生命周期；因此返回后可做同一数组
中的 pointer arithmetic，却不能直接读取 `p[i]`。必须用 `allocator_traits::construct`、
`construct_at` 或 uninitialized-memory algorithm 创建元素。

若 `n > numeric_limits<size_t>::max() / sizeof(T)`，当前合同抛
`std::bad_array_new_length`；无法取得存储时抛 `std::bad_alloc`。C++20 N4861 的旧措辞只明确
存储失败为 `bad_alloc`，页面应把 `bad_array_new_length` 标作后来规范精化/当前合同，而不是
谎称所有 C++20 实现都必须提供完全相同诊断路径。

规范允许 allocator 通过 `::operator new` 获取存储，但何时、调用几次 operator new 是未指定
的；不能通过重载全局 new 的计数来断言一次 `allocate` 就精确对应一次底层调用。标准没有给
`allocate` 一个可移植的大 O 时间界。来源：
[`[allocator.members]`](https://eel.is/c++draft/allocator.members)、N4861
`[allocator.members]`、[P0593R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0593r6.html)。

### 4.3 `deallocate`：前置条件、失效与线程

若 `p` 来自 `allocate(n)`，必须把**同一首地址**和**同一 n** 传给 `deallocate(p,n)`；
C++23 `allocate_at_least` 才有 `requested <= n <= returned.count` 的放宽规则。deallocate 释放
整块存储后，所有指向该块的 pointer/reference 都不能再用来访问对象或做该数组的 pointer
arithmetic。先前仍活动的非平凡元素应先逐个 destroy。

默认 allocator 除析构函数外，不会仅因不同线程并发调用其成员而引入 data race；对同一存储
单元的 allocate/deallocate 存在单一全序，deallocation happens-before 后续复用该单元的
allocation。这不让“两个线程同时操作同一个由 allocator 管理的对象”变安全；元素同步仍由
调用方负责。

来源：[`[allocator.members]`](https://eel.is/c++draft/allocator.members)、
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)、
[P0401R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0401r6.html)。

### 4.4 JS 对照与常见误区

JS 的 `new Array(2)` 同时产生可由语言直接操作的数组对象，开发者看不到“先分配 raw storage、
再逐槽开始元素生命周期”的分层。`ArrayBuffer`/typed array 可以帮助理解连续字节与 typed view，
但仍没有 C++ 非平凡对象的构造、析构和 allocator propagation 合同。`std::allocator` 更接近
容器内部可替换的存储策略入口，而不是 JS 的 `new` 操作符。

常见误区：

- `allocate(n)` 已默认构造 n 个 `T`；
- 取得 pointer 后可立即读取 `p[i]`；
- `deallocate` 会先调用元素析构函数；
- 可以用不同 allocator、内部 pointer 或不同 n 释放；
- `allocator` 自己记录分配长度，所以 n 随便传也行；
- 一次 allocate 必然调用一次全局 operator new；
- C++20 仍应调用 `allocator::construct/destroy/rebind`；
- `allocate_at_least` 可在 C++20 使用；
- 默认 allocator thread-safe 意味着其中所有对象无需同步；
- 日常代码应手写 allocator，而不是优先使用 `vector`、`string`、smart pointer 或 RAII。

### 4.5 两个确定性示例

#### 示例 1：`allocate-construct-and-release.cpp`

显式展示 storage、元素 lifetime 与 storage release 三步。`Record` 构造函数声明为
`noexcept`，示例不引入部分构造清理噪音。

直接包含：`<iostream>`、`<memory>`。

```cpp
#include <iostream>
#include <memory>

struct Record {
  explicit Record(int value) noexcept : value(value) {}
  int value;
};

int main() {
  std::allocator<Record> allocator;
  Record* records = allocator.allocate(2);

  std::construct_at(records, 7);
  std::construct_at(records + 1, 9);

  std::cout << "values=" << records[0].value << ',' << records[1].value << '\n';

  std::destroy_n(records, 2);
  allocator.deallocate(records, 2);
}
```

精确 stdout：

```text
values=7,9
```

#### 示例 2：`use-default-allocator-with-vector.cpp`

展示默认 allocator 的现代主场是容器模板参数，而不是业务层 raw allocation。

直接包含：`<iostream>`、`<memory>`、`<type_traits>`、`<vector>`。

```cpp
#include <iostream>
#include <memory>
#include <type_traits>
#include <vector>

int main() {
  std::vector<int, std::allocator<int>> values{3, 5};
  using Allocator = decltype(values)::allocator_type;

  std::cout << std::boolalpha;
  std::cout << "default_allocator="
            << std::is_same_v<Allocator, std::allocator<int>> << '\n';
  std::cout << "values=" << values[0] << ',' << values[1] << '\n';
}
```

精确 stdout：

```text
default_allocator=true
values=3,5
```

## 5. `std::uninitialized_copy`

### 5.1 C++20 代表接口与版本边界

```cpp
// <memory>
template<class InputIterator, class NoThrowForwardIterator>
NoThrowForwardIterator uninitialized_copy(InputIterator first,
                                           InputIterator last,
                                           NoThrowForwardIterator result);

template<class ExecutionPolicy, class InputIterator,
         class NoThrowForwardIterator>
NoThrowForwardIterator uninitialized_copy(ExecutionPolicy&& exec,
                                           InputIterator first,
                                           InputIterator last,
                                           NoThrowForwardIterator result);

namespace ranges {
  template<class I, class O>
  using uninitialized_copy_result = in_out_result<I, O>;

  template<input_iterator I, sentinel_for<I> S1,
           /* no-throw-forward-iterator */ O,
           /* no-throw-sentinel-for<O> */ S2>
    requires constructible_from<iter_value_t<O>, iter_reference_t<I>>
  uninitialized_copy_result<I, O>
    uninitialized_copy(I ifirst, S1 ilast, O ofirst, S2 olast);

  template<input_range IR, /* no-throw-forward-range */ OR>
    requires constructible_from<range_value_t<OR>, range_reference_t<IR>>
  uninitialized_copy_result<borrowed_iterator_t<IR>, borrowed_iterator_t<OR>>
    uninitialized_copy(IR&& input, OR&& output);
}
```

必须直接 `#include <memory>`，不是 `<algorithm>`。以上严格对应 C++20：classic、policy 和
ranges overload 都没有 `constexpr`。Current draft 的 `constexpr` 来自 C++26
P2283/P3508。Ranges 不是三参数 classic 的简单 wrapper：它接收目标边界并在输入耗尽或目标
写满时停止，返回输入和输出的两个结束位置。

来源：N4861 `[memory.syn]`/`[uninitialized.copy]`、
[`[uninitialized.copy]`](https://eel.is/c++draft/uninitialized.copy)、
[P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)、
[P3508R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3508r0.html)。

### 5.2 参数、前置条件、效果与返回值

Classic 对 `[first,last)` 的每个源元素，在从 `result` 开始的 raw storage 槽位上执行
`value_type(*first)` 形式的复制构造，返回最后一个已构造元素之后的 output iterator。目标必须
至少有 `distance(first,last)` 个合适对齐且没有活动目标对象的槽位；算法不会分配或扩容。

Ranges iterator overload 同时接收 `[ifirst,ilast)` 和 `[ofirst,olast)`，最多构造
`min(input length, output capacity)` 个对象，返回 `{input_stop, output_stop}`。Range overload
对 non-borrowed 临时 range 的相应结果成员可能是 `dangling`；本批示例使用 lvalue source 与
allocator raw array。

输入范围与实际使用的输出范围不得重叠。当前草案明确 classic 的
`result + [0,last-first)` 不与 `[first,last)` overlap，ranges 则要求完整输入/输出范围不重叠。
不要把 `std::copy` 的某些方向性 overlap 讨论搬到这里：在同一存储上开始新生命周期会使源
对象寿命与读取顺序纠缠，规范直接禁止 overlap。

来源：[`[uninitialized.copy]`](https://eel.is/c++draft/uninitialized.copy)、
[`[basic.life]`](https://eel.is/c++draft/basic.life)。

### 5.3 复杂度、异常、生命周期与线程

Classic 成功时进行 `N = distance(first,last)` 次目标构造；ranges 进行直到任一边界的逐项
构造，即 `min(N,M)` 次。没有目标赋值，原目标槽位必须未初始化。成功后 `[result,end)` 中
每个新对象开始生命周期，调用方必须在 deallocate 前 destroy 它们。

若复制构造抛异常，算法销毁本次已构造的目标对象，销毁顺序未指定，然后传播异常；raw storage
仍由调用方持有。输入不被该算法销毁或写入。对标准 execution policy，element construction
异常遵循 policy 的 terminate 规则，而不是作为普通异常返回给 catch；并行内部分配失败仍可能
抛 `bad_alloc`。

若目标槽位已有活动对象，placement construction 会复用存储并结束原对象生命周期。跳过原
非平凡对象的显式销毁可能泄漏其资源；对 const complete object 或不满足存储/对齐/可构造约束
的目标则可能直接不合法或产生未定义行为。不要用 `vector<T>(n).begin()` 当作 raw destination：
那些元素已经构造完成，应该用 `std::copy` 赋值。

源可由多线程只读的前提仍是源对象及其 copy constructor 不发生冲突写；目标槽位在调用期间
必须由本次算法独占。Policy 版本可能并发执行多个构造，copy constructor 不得无同步修改同一
共享计数器。

来源：
[`[specialized.algorithms.general]`](https://eel.is/c++draft/specialized.algorithms.general)、
[`[uninitialized.copy]`](https://eel.is/c++draft/uninitialized.copy)、
[`[algorithms.parallel.exceptions]`](https://eel.is/c++draft/algorithms.parallel.exceptions)、
[LWG 2433](https://cplusplus.github.io/LWG/issue2433)、
[LWG 3054](https://cplusplus.github.io/LWG/issue3054)、
[LWG 3870](https://cplusplus.github.io/LWG/issue3870)。

### 5.4 JS 对照与常见误区

JS 的 `array.slice()` 或 `Array.from()` 创建的新数组在语言层已经拥有可访问元素，没有“目标
只有 raw storage、逐项 copy constructor 开始生命周期”的阶段。概念上可把
`uninitialized_copy` 看成容器扩容时“在新仓库的空槽位逐件复制建造”，而 `std::copy` 是
“给已有对象赋新值”。JS 对象复制通常还是复制引用，这也不等于 C++ 用户类型的复制构造。

常见误区：

- 它与 `std::copy` 完全相同，只是名字更长；
- 目标 vector 有 size n 才叫未初始化存储；
- 算法会自动 allocate/deallocate；
- classic 会检查目标容量并截断；
- 输入和目标可任意 overlap；
- 返回删除数或目标首 iterator；
- ranges 只返回 output iterator；
- 构造抛异常后已构造前缀留给调用方逐个猜测清理；
- 算法会释放 allocator storage；
- C++20 overload 已经是 constexpr；
- policy 下构造顺序、线程或异常 catch 行为与串行版完全一样。

### 5.5 两个确定性示例

#### 示例 1：`copy-strings-into-raw-storage.cpp`

用 allocator 取得两个 `string` 槽位，classic uninitialized-copy 逐项复制构造；只读取成功
构造范围，并成对 destroy/deallocate。

直接包含：`<array>`、`<iostream>`、`<memory>`、`<string>`。

```cpp
#include <array>
#include <iostream>
#include <memory>
#include <string>

int main() {
  const std::array<std::string, 2> source{"api", "worker"};
  std::allocator<std::string> allocator;
  std::string* storage = allocator.allocate(source.size());

  std::string* end =
    std::uninitialized_copy(source.begin(), source.end(), storage);

  std::cout << "constructed=" << (end - storage) << '\n';
  std::cout << "values=" << storage[0] << ',' << storage[1] << '\n';

  std::destroy(storage, end);
  allocator.deallocate(storage, source.size());
}
```

精确 stdout：

```text
constructed=2
values=api,worker
```

#### 示例 2：`copy-until-output-is-full.cpp`

Ranges overload 只有两个目标槽位，因此消费三个输入中的前两个并返回两个停止位置。示例只
销毁真正构造的 `[storage,result.out)`。

直接包含：`<array>`、`<iostream>`、`<memory>`。

```cpp
#include <array>
#include <iostream>
#include <memory>

int main() {
  const std::array<int, 3> source{3, 5, 8};
  std::allocator<int> allocator;
  int* storage = allocator.allocate(2);

  auto result = std::ranges::uninitialized_copy(
    source.begin(), source.end(), storage, storage + 2);

  std::cout << "copied=" << (result.out - storage) << '\n';
  std::cout << "remaining=" << (source.end() - result.in) << '\n';
  std::cout << "values=" << storage[0] << ',' << storage[1] << '\n';

  std::destroy(storage, result.out);
  allocator.deallocate(storage, 2);
}
```

精确 stdout：

```text
copied=2
remaining=1
values=3,5
```

## 6. `std::destroy`

### 6.1 C++20 代表接口与家族边界

```cpp
// <memory>
template<class T>
constexpr void destroy_at(T* location);

template<class NoThrowForwardIterator>
constexpr void destroy(NoThrowForwardIterator first,
                       NoThrowForwardIterator last);

template<class ExecutionPolicy, class NoThrowForwardIterator>
void destroy(ExecutionPolicy&& exec,
             NoThrowForwardIterator first,
             NoThrowForwardIterator last);

template<class NoThrowForwardIterator, class Size>
constexpr NoThrowForwardIterator destroy_n(NoThrowForwardIterator first,
                                            Size n);

namespace ranges {
  template<destructible T>
  constexpr void destroy_at(T* location) noexcept;

  template</* no-throw-input-iterator */ I,
           /* no-throw-sentinel-for<I> */ S>
    requires destructible<iter_value_t<I>>
  constexpr I destroy(I first, S last) noexcept;

  template</* no-throw-input-range */ R>
    requires destructible<range_value_t<R>>
  constexpr borrowed_iterator_t<R> destroy(R&& range) noexcept;
}
```

必须直接包含 `<memory>`。Classic `destroy` 与 ranges `destroy` 自 C++20 起可用于符合 constant
evaluation 限制的场景；policy overload 不是 constexpr。`destroy_at` 对 array type 的递归处理
是 C++20 合同，C++17 初版只处理单个非数组对象。`destroy_n` 返回最后一个已销毁对象之后的
iterator，而 classic `destroy(first,last)` 返回 `void`；ranges `destroy` 返回结束 iterator。

来源：N4861 `[specialized.destroy]`、
[`[specialized.destroy]`](https://eel.is/c++draft/specialized.destroy)、
[P0040R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0040r3.html)、
[P0784R7](https://open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0784r7.html)。

### 6.2 参数、效果、返回与复杂度

Classic `destroy(first,last)` 按 iterator 前进顺序，对每个活动对象调用
`destroy_at(addressof(*first))`，等价于显式析构调用；共执行 N 次 destroy。即使 iterator 是
bidirectional/random-access，串行 classic 也不是自动逆序销毁。需要逆序语义的容器实现应
显式传 reverse iterators 或自己控制顺序。

`ranges::destroy` 同样逐项结束对象生命周期，并返回最终 iterator。Range overload 对
non-borrowed 临时 owner 可返回 `dangling`；原始生命周期算法通常不应对临时 owning container
调用，因为其中元素原本会由容器析构自动管理。

`destroy` 不释放存储、不改变 allocator 的 allocation 记录，也不重新构造默认值。对平凡类型
调用依然结束其生命周期；实现可优化掉机器指令，但语义上不能把旧值当作仍活动对象读取。
来源：[`[specialized.destroy]`](https://eel.is/c++draft/specialized.destroy)、
[P0040R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0040r3.html)、
[P0593R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0593r6.html)。

### 6.3 前置条件、错误、生命周期与线程

`[first,last)` 中每个位置必须表示一个仍活动、可析构的 `T` 对象。重复 destroy、销毁尚未
construct 的 raw slot、把范围跨出同一有效数组，或 destroy 后再次访问对象都会违反对象寿命
合同。对于 automatic/static/thread storage duration 的非平凡对象，若提前 destroy，通常还要
在隐式析构时刻之前在同一位置重新构造同类型对象，否则作用域退出时的隐式析构将作用于不存在
的对象并产生未定义行为。allocator 动态存储示例没有这个额外的作用域隐式析构问题。

classic 的 `NoThrowForwardIterator` 要求 iterator 操作不抛；所处理类型须满足 Cpp17Destructible
的析构不抛要求。Ranges 直接用 `destructible` 与 `no-throw-*` concepts 并声明 `noexcept`。
主动抛异常的析构通常导致 terminate 或不满足接口要求，页面不应承诺异常传播/回滚。

串行 classic 按前向次序销毁；execution-policy overload 可无序/并行执行。销毁会结束对象
生命周期，因此和任何其他线程对同一对象的读写冲突；即使多个对象占不同槽位，其析构函数若
修改共享 registry/counter 也必须自行同步。本批示例只使用串行 overload。

来源：[`[specialized.destroy]`](https://eel.is/c++draft/specialized.destroy)、
[`[special.mem.concepts]`](https://eel.is/c++draft/special.mem.concepts)、
[`[basic.life]`](https://eel.is/c++draft/basic.life)、
[`[algorithms.parallel.user]`](https://eel.is/c++draft/algorithms.parallel.user)、
[LWG 2598](https://cplusplus.github.io/LWG/issue2598)。

### 6.4 JS 对照与常见误区

JS 的 GC 回收时间通常不可预测，业务代码也不能对普通对象调用一个语言级 destructor 来结束其
对象生命周期。显式 cleanup/dispose 协议可类比“现在释放外部资源”，但仍不等于 C++ 中对象
寿命结束后禁止访问同一 typed object。`std::destroy` 是容器/arena/optional-like 类型的底层
构件，不是日常替代作用域与 RAII 的工具。

常见误区：

- `destroy` 等于 `delete` 或 `allocator.deallocate`；
- 它会释放 heap storage；
- 调一次后仍可读取旧字段，只是析构副作用发生过；
- 可以对 `vector` 的元素手动 destroy，然后让 vector 正常析构；
- 可以 destroy 同一对象两次；
- 可以销毁还没有 construct 的 raw slot；
- classic 返回结束 iterator；
- ranges 返回 `subrange`；
- bidirectional iterator 会自动逆序析构；
- 平凡析构类型的 lifetime 不受调用影响；
- 抛异常析构能被算法安全收集并继续；
- policy 版本仍保持严格前向次序。

### 6.5 两个确定性示例

#### 示例 1：`destroy-tasks-in-forward-order.cpp`

在 allocator raw storage 中构造三个对象，classic `std::destroy` 按前向 iterator 次序调用
析构；之后只 deallocate，不再访问对象。

直接包含：`<iostream>`、`<memory>`。

```cpp
#include <iostream>
#include <memory>

struct Task {
  explicit Task(int id) noexcept : id(id) {}

  ~Task() noexcept {
    std::cout << "destroy=" << id << '\n';
  }

  int id;
};

int main() {
  std::allocator<Task> allocator;
  Task* tasks = allocator.allocate(3);

  std::construct_at(tasks, 1);
  std::construct_at(tasks + 1, 2);
  std::construct_at(tasks + 2, 3);

  std::destroy(tasks, tasks + 3);
  allocator.deallocate(tasks, 3);
}
```

精确 stdout：

```text
destroy=1
destroy=2
destroy=3
```

#### 示例 2：`destroy-range-and-use-returned-end.cpp`

Ranges overload 返回最终 iterator；析构只更新一个由每个对象独占指针指向的单线程计数，不在
destroy 后读取任何对象字段。

直接包含：`<iostream>`、`<memory>`。

```cpp
#include <iostream>
#include <memory>

struct Tracker {
  explicit Tracker(int* destroyed) noexcept : destroyed(destroyed) {}

  ~Tracker() noexcept {
    ++*destroyed;
  }

  int* destroyed;
};

int main() {
  int destroyed = 0;
  std::allocator<Tracker> allocator;
  Tracker* trackers = allocator.allocate(2);

  std::construct_at(trackers, &destroyed);
  std::construct_at(trackers + 1, &destroyed);

  Tracker* end = std::ranges::destroy(trackers, trackers + 2);
  std::cout << "returned=" << (end - trackers) << '\n';
  std::cout << "destroyed=" << destroyed << '\n';

  allocator.deallocate(trackers, 2);
}
```

精确 stdout：

```text
returned=2
destroyed=2
```

## 7. 八个示例的确定性清单

| # | Entry / 文件名 | 直接包含 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `std-enable-shared-from-this` / `share-service-from-member.cpp` | `<iostream>`、`<memory>` | `make_shared` 单一控制块；只比较 owner identity | `same_owner=true\nowners=2\nid=42\n` |
| 2 | `std-enable-shared-from-this` / `observe-object-without-owner.cpp` | `<iostream>`、`<memory>` | C++17 定义的 empty weak / `bad_weak_ptr` 路径 | `weak_expired=true\nshared_failed=true\n` |
| 3 | `std-allocator` / `allocate-construct-and-release.cpp` | `<iostream>`、`<memory>` | noexcept element construction；严格成对清理 | `values=7,9\n` |
| 4 | `std-allocator` / `use-default-allocator-with-vector.cpp` | `<iostream>`、`<memory>`、`<type_traits>`、`<vector>` | compile-time type identity；固定 vector 值 | `default_allocator=true\nvalues=3,5\n` |
| 5 | `std-uninitialized-copy` / `copy-strings-into-raw-storage.cpp` | `<array>`、`<iostream>`、`<memory>`、`<string>` | lvalue source；只读构造前缀；成对 destroy/deallocate | `constructed=2\nvalues=api,worker\n` |
| 6 | `std-uninitialized-copy` / `copy-until-output-is-full.cpp` | `<array>`、`<iostream>`、`<memory>` | ranges 有界目标；固定 consumed/remaining | `copied=2\nremaining=1\nvalues=3,5\n` |
| 7 | `std-destroy` / `destroy-tasks-in-forward-order.cpp` | `<iostream>`、`<memory>` | 串行 classic 规范前向顺序；析构 noexcept | `destroy=1\ndestroy=2\ndestroy=3\n` |
| 8 | `std-destroy` / `destroy-range-and-use-returned-end.cpp` | `<iostream>`、`<memory>` | 单线程计数；只检查返回 pointer distance | `returned=2\ndestroyed=2\n` |

实现时必须逐字复制文件名与 stdout。全部 example manifest `standard` 为 `c++20`、`kind` 为
`run`；不加入 policy 示例、地址、allocation count、未指定清理顺序或死对象读取。

## 8. 版本与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| C++98 `allocator` / `uninitialized_copy` 起点 | [WG21 1997 public review draft N2356](https://www.open-std.org/jtc1/sc22/open/n2356/) 的 `[lib.default.allocator]`、`[lib.uninitialized.copy]` |
| C++11 `enable_shared_from_this` 基线 | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) `[util.smartptr.enab]` |
| C++17 `weak_from_this` 与控制块接入精化 | [P0033R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0033r1.html)、[LWG 2529](https://cplusplus.github.io/LWG/issue2529)、[N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) |
| C++17 destroy 家族与 policy raw-storage algorithms | [P0040R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0040r3.html)、[N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) |
| C++17 allocator 冗余成员弃用 | [P0174R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0174r2.html) |
| C++20 allocator 冗余成员移除 | [P0619R4](https://wg21.link/P0619R4) |
| C++20 constexpr allocator/destroy | [P0784R7](https://open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0784r7.html)、[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) |
| C++20 allocator 数组 storage/lifetime 规则 | [P0593R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p0593r6.html)、N4861 `[allocator.members]` |
| C++20 ranges raw-storage algorithms | [P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)、N4861 `[specialized.algorithms]` |
| C++23 `allocate_at_least` | [P0401R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p0401r6.html) |
| C++26 constexpr specialized memory algorithms | [P3508R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3508r0.html)（更新 P2283R2 wording） |
| 当前 ownership/control-block 合同 | [`[util.smartptr.enab]`](https://eel.is/c++draft/util.smartptr.enab)、[`[util.smartptr.shared.const]`](https://eel.is/c++draft/util.smartptr.shared.const) |
| 当前 default allocator 合同 | [`[default.allocator]`](https://eel.is/c++draft/default.allocator)、[`[allocator.traits]`](https://eel.is/c++draft/allocator.traits)、[`[allocator.requirements]`](https://eel.is/c++draft/allocator.requirements) |
| 当前 uninitialized-copy 合同 | [`[uninitialized.copy]`](https://eel.is/c++draft/uninitialized.copy)、[`[specialized.algorithms.general]`](https://eel.is/c++draft/specialized.algorithms.general)、[`[special.mem.concepts]`](https://eel.is/c++draft/special.mem.concepts) |
| 当前 destroy 合同 | [`[specialized.destroy]`](https://eel.is/c++draft/specialized.destroy)、[`[basic.life]`](https://eel.is/c++draft/basic.life) |
| Policy 异常与并发要求 | [`[algorithms.parallel.exceptions]`](https://eel.is/c++draft/algorithms.parallel.exceptions)、[`[algorithms.parallel.user]`](https://eel.is/c++draft/algorithms.parallel.user)、[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races) |
| Raw-storage 缺陷修正 | [LWG 2433](https://cplusplus.github.io/LWG/issue2433)、[LWG 2598](https://cplusplus.github.io/LWG/issue2598)、[LWG 3054](https://cplusplus.github.io/LWG/issue3054)、[LWG 3870](https://cplusplus.github.io/LWG/issue3870) |

二级页面只用于核对搜索别名、重载栏目与学习导航：
[`enable_shared_from_this`](https://zh.cppreference.com/w/cpp/memory/enable_shared_from_this)、
[`allocator`](https://zh.cppreference.com/w/cpp/memory/allocator)、
[`uninitialized_copy`](https://zh.cppreference.com/w/cpp/memory/uninitialized_copy)、
[`destroy`](https://zh.cppreference.com/w/cpp/memory/destroy)。正文、接口摘要与示例必须原创。

## 9. 每个 Entry 的 manifest-ready 来源建议

### `std-enable-shared-from-this`

- Current: `[util.smartptr.enab]`、`[util.smartptr.shared.const]`、
  `[util.smartptr.shared.atomic]`、`[res.on.data.races]`
- Historical/WG21/DR: N3337、P0033R1、N4659、N4861、LWG 2529
- Secondary: zh.cppreference `enable_shared_from_this`

### `std-allocator`

- Current: `[default.allocator]`、`[allocator.members]`、`[allocator.traits]`、
  `[allocator.requirements]`、`[basic.life]`
- Historical/WG21: N2356、P0174R2、P0619R4、P0784R7、P0593R6、N4861、
  P0401R6
- Secondary: zh.cppreference `allocator`

### `std-uninitialized-copy`

- Current: `[uninitialized.copy]`、`[specialized.algorithms.general]`、
  `[special.mem.concepts]`、`[algorithms.parallel.exceptions]`、`[basic.life]`
- Historical/WG21/DR: N2356、P0040R3、N4659、P0896R4、N4861、P3508R0、
  LWG 2433、LWG 3054、LWG 3870
- Secondary: zh.cppreference `uninitialized_copy`

### `std-destroy`

- Current: `[specialized.destroy]`、`[special.mem.concepts]`、`[basic.life]`、
  `[algorithms.parallel.user]`
- Historical/WG21/DR: P0040R3、N4659、P0784R7、N4861、LWG 2598
- Secondary: zh.cppreference `destroy`

建议所有 manifest 使用 `verifiedAt: 2026-09-02`。Primary source 数量可以多于 UI 默认折叠
展示数，但不能为了凑数量重复同一事实或把二级页面标成 primary。

## 10. 内容实施与终审清单

- 只新增四个建议 ID；每页两个 deterministic C++20 run 示例，共 8 个。
- 四页均覆盖：直接包含、C++20 代表接口、版本边界、参数/约束、返回、复杂度、异常/终止、
  生命周期/失效、线程/data race、常见误区、JS 对照与一级来源。
- `enable_shared_from_this` 明确 public/unambiguous base、首个控制块接入、ctor/dtor 时机、
  `bad_weak_ptr`、`weak_from_this` 非拥有语义、禁止 `shared_ptr(this)` 和双控制块。
- `allocator` 明确 allocate 只给 storage、不构造元素；construct/destroy 与 deallocate 分层；
  C++20 冗余成员已移除；泛型代码走 allocator_traits；同 p/n/same allocator 释放；
  `allocate_at_least` 为 C++23。
- `uninitialized_copy` 明确复制构造而非赋值、目标 raw storage、无 overlap、classic 无容量边界、
  ranges 双边界与 `in_out_result`、异常自动 destroy 已构造前缀但不释放 storage。
- `destroy` 明确只结束 lifetime、不释放 storage；classic 前向顺序与 void 返回；ranges 返回 end；
  不得重复 destroy、访问 dead object 或让 owning container 再析构已手工销毁元素。
- C++20 `uninitialized_copy` 所有展示 overload 不写 `constexpr`；C++20 `destroy` 串行/ranges
  overload 写 `constexpr`；policy overload 不写。
- Execution-policy 部分以 C++17/C++20 标准 policy 为准：element-access exception 导致
  terminate、内部 allocation failure 可 bad_alloc；不复制 Parallelism TS 的
  `exception_list` 旧设计，也不把 C++26 parallel ranges 教成 C++20。
- expected stdout 与第 7 节逐字一致；直接 include 完整，不输出地址、allocation 次数、
  未指定 cleanup order、线程、耗时或 dead/moved-from/未构造值。
- 终审拒绝：栈对象可直接 shared_from_this；private inheritance 会自动接入；
  `shared_ptr(this)` 正确；allocate 已构造对象；deallocate 调析构；C++20 仍用
  `allocator::construct`；uninitialized-copy 写入 live vector element；source/output 可重叠；
  构造异常泄漏已构造前缀；destroy 等于 delete；destroy 后读取字段；classic destroy 返回
  iterator；C++20 uninitialized-copy 已 constexpr。
