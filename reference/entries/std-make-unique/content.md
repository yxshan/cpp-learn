# `std::make_unique`

`std::make_unique<T>(args...)` 动态构造对象，并立即把唯一所有权放入返回的
`std::unique_ptr`。它解决的是“动态生命周期已经合理时，安全地建立独占所有者”，而不是
鼓励把普通局部对象都放到堆上。

## 快速信息

- 头文件：`<memory>`
- 命名空间：`std`
- 标准：C++14 起
- 返回：使用默认删除器的 `std::unique_ptr`

## 什么时候使用

当对象必须跨越当前作用域、通过工厂隐藏具体实现，或以唯一所有权进入另一个组件时，
使用 `make_unique<T>`。所有权可以通过移动返回或传递，不能复制。

如果自动存储、直接成员或 `std::vector<T>` 已能清楚表达生命周期和大小，就不需要动态
分配。需要自定义删除器、对象池、placement new 或其他特殊分配协议时，应建立匹配该
协议的专用所有者，不能把删除器作为参数交给 `make_unique`。

## 代表性声明

以下是 C++14/C++20 的三个重载类别；当前草案中的 `constexpr` 是后续标准演进：

```cpp
namespace std {
// T 不是数组。
template<class T, class... Args>
unique_ptr<T> make_unique(Args&&... args);

// T 是未知边界数组，例如 Widget[]。
template<class T>
unique_ptr<T> make_unique(size_t count);

// T 是已知边界数组，例如 Widget[4]；此形式被删除。
template<class T, class... Args>
unspecified make_unique(Args&&...) = delete;
} // namespace std
```

## 参数与约束

对象重载把 `args...` 完美转发给 `T` 的构造函数，因此只有对应构造表达式合法时才可用。
`T` 不会从函数参数中自动推导，调用方必须写出 `make_unique<Widget>(...)`。

数组重载只接受未知边界数组类型，例如 `make_unique<int[]>(count)`。已知边界形式
`make_unique<int[4]>()` 被删除。

## 返回值与所有权

对象重载返回拥有 `new T(...)` 结果的 `unique_ptr<T>`；数组重载返回拥有
`new U[count]()` 结果的 `unique_ptr<U[]>`。默认删除器分别使用 `delete` 和 `delete[]`。

返回值离开作用域或被重置时会销毁对象。移动 unique_ptr 会把所有权交给目标并使源指针
为空。构造参数中引用的外部对象不会因此延长寿命：如果 `T` 保存了引用、指针或视图，
这些借用仍需要独立的生命周期保证。

## 数组初始化

`make_unique<int[]>(count)` 中的元素会被值初始化，因此标量 `int` 初始为零。不要漏写
方括号：`make_unique<int>(count)` 只创建一个值为 `count` 的整数。

若确实需要跳过值初始化，应单独研究 C++20 的 `make_unique_for_overwrite`；它不是
`make_unique` 的同一个初始化语义。一般业务代码仍应优先选择能记录大小并支持迭代、
调整容量的 `std::vector`。

## 复杂度

标准通过等价构造表达式定义行为，没有给出独立的渐进复杂度：

- 对象重载执行一次动态分配并构造一个 `T`；
- 数组重载执行一次数组分配并值初始化 `count` 个元素。

总成本包含分配器和构造函数的工作，数组形式还随元素数量增长，不能笼统称为 O(1)。

## 异常与错误

分配可能抛出 `std::bad_alloc`，无效数组长度可能产生
`std::bad_array_new_length`。`T` 或数组元素构造时抛出的异常会继续传播。

`make_unique` 并不是通过捕获异常实现安全性。普通 new-expression 在初始化失败时会释放
已分配的存储，而 unique_ptr 只在分配和初始化全部成功后才成为返回值，因此不会返回
一个“拥有半成品”的智能指针。

## 生命周期与失效规则

从返回值取得的裸指针或引用只在所拥有对象存活时有效。销毁或 `reset()` 会调用删除器并
结束对象生命周期。移动所有权不会移动堆上对象本身，旧的借用仍指向同一对象，但现在由
新的 unique_ptr 决定它何时销毁。

`release()` 会放弃所有权而不删除对象；它是 unique_ptr 的高级修改操作，不是
`make_unique` 的正常后续步骤。除非立即交给另一个明确所有者，否则容易泄漏。

## 示例

最小示例展示构造参数转发；工程示例通过工厂返回抽象接口的唯一所有权，展示具体类型隐藏
和安全的所有权转移。

## 常见错误

- 把 `make_unique<int>(n)` 误认为创建 n 个整数；数组形式必须写成 `int[]`。
- 使用已知边界数组 `make_unique<int[4]>()`，该重载被删除。
- 认为数组标量元素未初始化；`make_unique<T[]>(count)` 使用值初始化。
- 试图传入自定义删除器；返回类型固定使用默认删除器。
- 认为模板参数能像 `make_pair` 一样自动推导。
- 为了“现代 C++”而把本可直接存在栈上或容器里的对象强行动态分配。

## 与 JavaScript 的区别

JavaScript 对象通常由垃圾回收器决定回收时机。`make_unique` 建立的是确定性的独占所有权：
unique_ptr 离开作用域时立即执行对象析构，所有权转移必须显式移动。这种确定性是管理文件、
锁、连接和其他非内存资源的重要基础。

## 相关内容

`std::unique_ptr` 页面解释移动、观察器、`reset()`、`release()` 和自定义删除器。动态数组
若需要大小、遍历和增长能力，应比较 `std::vector`。

## 来源

重载、数组初始化和返回表达式来自 `[unique.ptr.create]`；所有权与删除行为、
new-expression 异常清理以及 C++14 引入历史由 Entry manifest 中的主要来源验证。
