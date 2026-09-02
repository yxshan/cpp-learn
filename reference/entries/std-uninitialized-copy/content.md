# `std::uninitialized_copy`

`std::uninitialized_copy` 在没有活动目标对象的存储槽位中，依据源元素逐项**复制构造**新对象。它不是对已有对象执行复制赋值的 `std::copy`。

## 快速信息

```cpp
#include <memory>
```

- 经典接口：C++98。
- execution-policy 重载：C++17。
- ranges 接口：C++20。
- C++20 的 classic、policy 和 ranges 接口都不是 `constexpr`；相应 constexpr 扩展属于 C++26。

## 什么时候使用

实现容器扩容、arena 或 optional-like 底层存储，需要在已分配但尚未构造对象的槽位中复制建立元素时使用。目标已经有活动对象时用 `std::copy`；普通业务代码通常应让容器负责这套生命周期协议。

## C++20 代表性声明

```cpp
template<class InputIterator, class NoThrowForwardIterator>
NoThrowForwardIterator
uninitialized_copy(InputIterator first, InputIterator last,
                   NoThrowForwardIterator result);

template<class ExecutionPolicy, class InputIterator,
         class NoThrowForwardIterator>
NoThrowForwardIterator
uninitialized_copy(ExecutionPolicy&& policy,
                   InputIterator first, InputIterator last,
                   NoThrowForwardIterator result);

template<std::input_iterator I, std::sentinel_for<I> S1,
         /* no-throw-forward-iterator */ O,
         /* no-throw-sentinel-for<O> */ S2>
  requires std::constructible_from<std::iter_value_t<O>,
                                   std::iter_reference_t<I>>
std::ranges::uninitialized_copy_result<I, O>
std::ranges::uninitialized_copy(I ifirst, S1 ilast,
                                O ofirst, S2 olast);
```

ranges 还有双 range 重载，返回成员使用 `borrowed_iterator_t`；非 borrowed 临时 range 的对应成员可能为 `std::ranges::dangling`。注释中的 `no-throw-*` 是规范说明概念，不是用户能直接命名的标准 concept。

## 参数与前置条件

- `[first, last)`：有效源范围。
- `result`：classic 目标首槽位；必须至少有与输入长度相同的已对齐、无活动目标对象存储。
- ranges 接口同时接收输入和输出边界，目标写满或输入耗尽时停止。
- 源范围与实际使用的输出范围不得重叠。

不要把 `vector<T>(n).begin()` 当作 raw destination：其中 N 个元素已经构造，应使用赋值算法。目标 iterator 操作必须满足 no-throw 清理要求，以便元素复制构造失败后可靠销毁本次构造的前缀。

## 返回值

经典接口返回最后一个新对象之后的目标迭代器；它不检查容量。ranges 接口返回 `{input_stop, output_stop}`，因此可同时观察消费了多少输入和构造了多少输出。

## 复杂度

classic 成功时执行 `distance(first, last)` 次复制构造。ranges 最多执行输入长度与输出容量二者的较小值次数。算法不会分配、扩容或释放目标存储。

## 异常与部分构造

普通接口的复制构造若抛异常，算法会销毁本次调用已经构造的目标对象，再传播异常；清理顺序未指定。源对象不会被销毁，raw storage 也不会被释放，因此调用方在 catch 路径仍负责把存储交还 allocator。

标准 execution policy 下，元素构造抛出的未捕获异常遵循 `std::terminate` 规则；并行化临时分配失败可抛 `std::bad_alloc`。不能依赖 policy 的构造顺序或线程。

## 生命周期、失效与线程

成功后，构造前缀中的对象生命周期已经开始，必须在释放底层存储前逐项 destroy。未构造尾部不能读取或销毁。若目标槽位原先有活动的非平凡对象，直接重用而未先履行其析构责任可能泄漏资源或违反对象寿命合同。

源在调用期间必须可安全读取，目标槽位必须由该算法独占。并行重载可能同时构造多个槽位，用户类型的 copy constructor 不得无同步写同一共享状态。

## 示例

“复制字符串到 raw storage”展示 classic 的完整构造—读取—销毁—释放链；ranges 示例用只有两个槽位的有界目标消费三个输入中的前两个，并读取 `in_out_result`。

## 常见错误

- 把它当作对现有对象赋值的 `std::copy`。
- 使用已经具有 size 的 vector 元素作为 raw destination。
- 认为 classic 会自动检查容量或截断。
- 让源与目标重叠。
- 认为构造失败后 storage 会自动释放。
- 销毁未成功构造的尾部。
- 把 C++20 接口错误标成 `constexpr`。

## 与 JavaScript 的区别

> JavaScript 的 `Array.from()` 或 `slice()` 产生的数组已拥有可访问元素，没有“目标只有 raw storage、复制构造逐项开始生命周期”的阶段。可把 `uninitialized_copy` 想成在新仓库空槽位逐件建造，而 `std::copy` 是给已有对象赋新值。

## 相关内容

- `std::copy`：向活动目标对象复制赋值。
- `std::allocator`：取得与释放 raw storage。
- `std::destroy`：结束成功构造对象的生命周期。
- `<memory>`：本算法所在头文件。

## 规范来源

当前效果、重叠、清理和 ranges 返回见 `[uninitialized.copy]`、`[specialized.algorithms.general]`、`[special.mem.concepts]`；C++17 policy、C++20 ranges 与 C++26 constexpr 边界见 P0040R3、P0896R4、N4861、P3508R0。
