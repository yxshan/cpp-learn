# `std::enable_shared_from_this`

`std::enable_shared_from_this<T>` 让一个已经处于共享所有权组中的对象，在成员函数里取得指向自身且复用同一控制块的 `shared_ptr`。它不会给任意裸 `this` 凭空创建安全所有权。

## 快速信息

```cpp
#include <memory>
```

- 类型：供 `T` 公开继承的基类模板。
- 首次标准：C++11。
- `weak_from_this()`：C++17。
- 失败类型：未接入有效共享控制块时，`shared_from_this()` 抛 `std::bad_weak_ptr`。

## 什么时候使用

对象需要把自己交给异步回调、任务队列或其他会延长其生命周期的组件，而且该对象本来就由 `shared_ptr` 共同拥有时使用。若成员只在当前调用期间借用对象，普通引用或裸 `this` 更直接；若对象有唯一所有者，不应为了调用此工具而强行改成共享所有权。

## C++20 接口与主要操作

```cpp
template<class T>
class enable_shared_from_this {
protected:
  constexpr enable_shared_from_this() noexcept;
  enable_shared_from_this(const enable_shared_from_this&) noexcept;
  enable_shared_from_this&
    operator=(const enable_shared_from_this&) noexcept;
  ~enable_shared_from_this();

public:
  std::shared_ptr<T> shared_from_this();
  std::shared_ptr<const T> shared_from_this() const;
  std::weak_ptr<T> weak_from_this() noexcept;
  std::weak_ptr<const T> weak_from_this() const noexcept;
};
```

构造和析构受保护，说明它是基类设施而不是独立业务对象。复制或赋值这个基类不会复制内部 owner 绑定；复制派生对象也不会让新对象偷偷加入原对象的控制块。

## 控制块接入与约束

`T` 应公开且无歧义地继承 `enable_shared_from_this<T>`。第一个为对象建立共享所有权组的 `shared_ptr` 构造过程会在符合条件时把基类内部的弱观察者接到该控制块；`std::make_shared<T>` 是最自然的建立方式。

私有继承、歧义的多个基类，或 CRTP 参数不是实际派生类型时，自动接入条件不成立。从 `this` 再构造 `shared_ptr<T>(this)` 不是替代方案：它会创建第二个控制块，可能导致重复删除。

## 返回值与错误

- `shared_from_this()` 返回一个指向当前对象、与原 owner 共享控制块的新 `shared_ptr`，成功后强所有者数量增加。
- `weak_from_this()` 返回同一 ownership identity 的非拥有 `weak_ptr`，不会增加强计数。
- 若对象尚未接入 owner，`shared_from_this()` 等价的 weak-to-shared 构造会抛 `std::bad_weak_ptr`；`weak_from_this()` 则返回空的、已 expired 的观察者。

构造函数执行期间，外层 owning `shared_ptr` 通常还没有完成接入，因此不应在构造函数中调用 `shared_from_this()`。栈对象和直接 `new` 后尚未交给合适 owner 的对象也不满足条件。

## 复杂度、生命周期与线程

标准没有为本类型给出一个覆盖所有操作的独立渐进复杂度承诺，不应把它宣传为“零成本”。返回的 `shared_ptr` 能延长完整对象生命周期；返回的 `weak_ptr` 只能观察，调用方仍需 `lock()` 并检查结果。

它不能复活已经析构的对象。析构阶段最后一个强 owner 已进入释放流程，weak ownership identity 可能仍存在，但不能重新取得强 owner。

不同 `shared_ptr` 实例可按控制块规则并发增减所有权；首次写入内部 weak 绑定不是原子操作，会与对同一对象的潜在并发访问冲突。对象构造和发布完成前不要泄露裸 `this`。这些规则也不保护 `T` 的业务字段。

## 示例

“从成员共享服务”由 `make_shared` 建立唯一控制块，再比较 owner identity；“观察无 owner 对象”展示栈对象的 `weak_from_this()` 为空以及 `shared_from_this()` 的明确异常路径。

## 常见错误

- 认为继承后所有栈对象都能调用 `shared_from_this()`。
- 在构造函数里调用，忽略 owner 尚未接入。
- 使用 private 或 ambiguous inheritance。
- 用 `shared_ptr<T>(this)` 创建第二个控制块。
- 认为 `weak_from_this()` 会延长生命周期。
- 把控制块线程安全误认为业务对象线程安全。

## 与 JavaScript 的区别

> JavaScript 闭包捕获 `this` 通常形成由 GC 追踪的普通强引用；C++ 的裸 `this` 不增加 owner。`shared_from_this()` 是取得指向既有控制块的强所有权票，不是克隆对象；`weak_from_this()` 虽可类比 `WeakRef`，但 C++ 还有确定性析构与显式 `lock()` 合同。

## 相关内容

- `std::shared_ptr`：控制块和共享所有权主体。
- `std::weak_ptr`：不增加强计数的观察者。
- `std::make_shared`：建立对象与首个共享控制块。
- `<memory>`：本类型所在头文件。

## 规范来源

当前接口与接入规则见 Working Draft `[util.smartptr.enab]`、`[util.smartptr.shared.const]`；C++11 基线、C++17 `weak_from_this` 与历史澄清见 N3337、P0033R1、N4659 和 LWG 2529。
