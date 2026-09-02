# `std::destroy`

`std::destroy` 对范围中的活动对象逐项调用析构并结束其生命周期。它不释放底层存储，也不等于 `delete` 或 `allocator::deallocate`。

## 快速信息

```cpp
#include <memory>
```

- `destroy`、`destroy_n`、`destroy_at`：C++17。
- execution-policy `destroy`：C++17。
- 串行 classic 和 ranges 家族从 C++20 起为 `constexpr`；policy 重载不是。
- `std::ranges::destroy`：C++20。

## 什么时候使用

实现容器、arena、variant/optional-like 存储，需要明确结束由 placement construction 或未初始化存储算法创建的对象时使用。普通局部对象和容器元素应由 RAII 与容器析构自动管理，不要把此算法当作日常“提前释放内存”的工具。

## C++20 代表性声明

```cpp
template<class T>
constexpr void destroy_at(T* location);

template<class NoThrowForwardIterator>
constexpr void destroy(NoThrowForwardIterator first,
                       NoThrowForwardIterator last);

template<class ExecutionPolicy, class NoThrowForwardIterator>
void destroy(ExecutionPolicy&& policy,
             NoThrowForwardIterator first,
             NoThrowForwardIterator last);

template<class NoThrowForwardIterator, class Size>
constexpr NoThrowForwardIterator
destroy_n(NoThrowForwardIterator first, Size n);

template</* no-throw-input-iterator */ class I,
         /* no-throw-sentinel-for<I> */ class S>
  requires std::destructible<std::iter_value_t<I>>
constexpr I std::ranges::destroy(I first, S last) noexcept;
```

ranges 还有 range 重载，返回 `borrowed_iterator_t<R>`；非 borrowed 临时 owner 的结果可能是 `std::ranges::dangling`。`destroy_at` 从 C++20 起还按规定递归处理数组类型。

## 参数与前置条件

`[first, last)` 中每个位置必须表示仍处于生命周期内且可析构的对象。不能重复 destroy、销毁尚未 construct 的槽位，或传入跨越无关数组的伪范围。iterator 操作及析构必须满足对应 no-throw/Destructible 要求。

对 automatic/static/thread storage duration 的非平凡对象提前 destroy 后，通常还要在隐式析构时刻前在同一位置重新构造合适对象；否则作用域结束会再次尝试析构不存在的对象。allocator 动态存储没有这个隐式作用域析构步骤。

## 返回值

- classic `destroy(first, last)` 返回 `void`。
- `destroy_n(first, n)` 返回最后一个已销毁对象之后的迭代器。
- `ranges::destroy` 返回结束迭代器，而不是 subrange。
- `destroy_at` 返回 `void`。

## 复杂度与顺序

对 N 个对象执行 N 次析构。串行 classic 按 iterator 前进顺序处理，即便提供双向迭代器也不会自动逆序。若确需反向次序，应显式控制迭代方向。对平凡析构类型，实现可能不产生机器指令，但对象生命周期在语义上仍结束。

## 异常与 execution policy

处理类型须满足不抛析构要求；主动从析构函数抛异常通常会导致 `std::terminate` 或不满足接口约束，算法没有“收集异常后回滚对象寿命”的合同。对标准 execution policy，元素访问函数抛出的未捕获异常会调用 `std::terminate`，并行化临时分配失败仍可抛 `std::bad_alloc`。policy 重载可无序或并行销毁；用户不能依赖严格前向顺序。

## 生命周期、失效与线程

destroy 后不能再读取字段、调用成员或再次析构同一对象。raw pointer 可暂时表示存储位置，用于之后重新构造或交回 allocator，但不再指向一个可访问的活动 `T`。`destroy` 本身不 deallocate，调用方仍负责释放存储。

销毁与其他线程对同一对象的任何读写冲突。即便对象位于不同槽位，析构函数若修改共享 registry 或计数器，也需要自行同步。

## 示例

“按前向顺序销毁任务”明确展示串行 classic 顺序；ranges 示例使用返回 iterator，并在对象全部结束后只读取独立计数器，再释放 raw storage。

## 常见错误

- 把 destroy 当成 `delete` 或 `deallocate`。
- destroy 后继续读取旧字段。
- 手工销毁 vector 元素后仍让 vector 正常析构它们。
- 对同一对象执行两次 destroy。
- 销毁尚未构造的 raw slot。
- 认为 classic 返回 iterator，或 ranges 返回 subrange。
- 认为双向迭代器会让算法自动逆序。

## 与 JavaScript 的区别

> JavaScript GC 的回收时间通常不可预测，普通对象也没有可由业务代码调用的语言级 destructor。显式 dispose 可以类比“现在清理外部资源”，但 C++ `destroy` 还会结束对象生命周期，此后继续访问同一个 typed object 本身就不合法。

## 相关内容

- `std::allocator`：结束对象后仍需归还底层存储。
- `std::uninitialized_copy`：在 raw storage 中开始一批对象生命周期。
- `std::vector`：普通容器元素应由容器管理，不要手工 destroy。
- `<memory>`：本算法家族所在头文件。

## 规范来源

当前接口、顺序、返回和 no-throw 约束见 `[specialized.destroy]`、`[special.mem.concepts]`、`[basic.life]`；C++17 引入和 C++20 constexpr 边界见 P0040R3、N4659、P0784R7、N4861。
