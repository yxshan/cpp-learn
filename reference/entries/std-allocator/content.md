# `std::allocator`

`std::allocator<T>` 是标准容器默认使用的无状态分配器。它负责取得和释放适合 `T` 的存储，但 `allocate()` 不等于构造 N 个可读取的 `T` 对象。

## 快速信息

```cpp
#include <memory>
```

- 首次标准：C++98。
- C++17：冗余成员被弃用。
- C++20：`construct`、`destroy`、`rebind` 等冗余成员移除；`allocate`/`deallocate` 获得 `constexpr` 支持边界。
- C++23：`allocate_at_least`，不属于本页 C++20 示例。

## 什么时候使用

普通应用应优先让 `vector`、`string`、智能指针和 RAII 对象管理内存。实现容器、arena 或 allocator-aware 泛型组件时，才需要直接处理分配器；泛型代码应通过 `std::allocator_traits<Alloc>` 访问统一接口，而不是假定所有 allocator 都有旧式成员。

## C++20 接口与主要操作

```cpp
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

所有默认 allocator specialization 通过 `allocator_traits` 表现为 always equal。C++20 泛型代码使用 `allocator_traits::construct`/`destroy` 或 `construct_at`/`destroy_at`，不再调用已移除的 `allocator::construct`、`allocator::destroy` 和 member `rebind`。

## 分配、构造、销毁、释放

这四步必须分开理解：

1. `allocate(n)` 取得足够容纳 N 个 `T` 的适当对齐存储。
2. `construct_at`、traits construct 或未初始化存储算法开始每个元素的生命周期。
3. `destroy`/`destroy_at` 结束活动元素生命周期。
4. `deallocate(p, n)` 释放整块存储。

C++20 规则会在 `allocate` 时开始承载存储的数组对象生命周期，但不会开始各 `T` 元素生命周期。构造前读取 `p[i]`，或把 `deallocate` 当成元素析构，都是错误模型。

## 参数、返回与错误

`allocate(n)` 要求 `T` 是完整对象类型，返回数组首地址。存储不足时抛 `std::bad_alloc`；当前合同对无法表示的超大数组还规定 `std::bad_array_new_length`，但这是后来规范精化，不应倒推成所有 C++20 实现完全一致的诊断路径。

`deallocate(p, n)` 要求 `p` 是由相等 allocator 以相同 N 分配得到的首地址。不能传内部地址、随意修改 N，或换用不相等的 stateful allocator。C++23 `allocate_at_least` 才有与返回 count 配套的范围规则。

## 复杂度、失效与线程

标准不为一次分配规定可移植的大 O 时间，也不保证每次 `allocate` 恰好调用一次全局 `operator new`。释放后，所有指向该块的指针和引用都不能再用于访问或该数组内的 pointer arithmetic。

默认 allocator 的成员调用遵守标准库 data-race 要求，同一存储单元的释放与后续复用有规定顺序；这不使存储中的业务对象自动线程安全。对象读写仍需调用方同步。

## 示例

“分配、构造并释放”完整展示存储和元素生命周期的四步；“vector 的默认 allocator”展示它更常作为容器模板参数出现，而不是由业务代码手写 raw allocation。

## 常见错误

- 认为 `allocate(n)` 已默认构造 N 个对象。
- 构造前直接读取 `p[i]`。
- 认为 `deallocate` 会调用析构函数。
- 使用不同的指针、N 或不相等 allocator 释放。
- 在 C++20 继续调用已移除的 member `construct`/`destroy`/`rebind`。
- 把 C++23 `allocate_at_least` 当作 C++20 接口。
- 用分配次数推断实现内部布局或性能承诺。

## 与 JavaScript 的区别

> JavaScript 的 `new Array(2)` 已产生语言可操作的数组，没有“先取 raw storage，再逐槽开始非平凡对象生命周期”的显式阶段。`ArrayBuffer` 只能帮助理解连续存储；`std::allocator` 更接近容器内部可替换的存储策略入口，而不是 JS 的 `new`。

## 相关内容

- `std::vector`：默认通过 allocator 管理动态存储。
- `std::uninitialized_copy`：在空槽位中复制构造对象。
- `std::destroy`：结束元素生命周期但不释放存储。
- `<memory>`：分配器和对象生命周期设施入口。

## 规范来源

当前接口、traits 与 allocator 要求见 `[default.allocator]`、`[allocator.members]`、`[allocator.traits]`；C++17/20 冗余成员变化见 P0174R2、P0619R4，constexpr 与 C++23 `allocate_at_least` 边界见 P0784R7、P0401R6。
