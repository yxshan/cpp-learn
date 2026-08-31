# `std::forward`

`std::forward<T>` 在泛型包装器中依据原始模板参数 `T` 恢复调用者传入的 lvalue 或 rvalue 值
类别。它同样只是引用转换，不复制、不移动，也不拥有对象。

## 快速信息

- 头文件：`<utility>`
- 命名空间：`std`
- 标准：C++11 起；C++14 起 `constexpr`
- 典型上下文：由函数模板推导出的 forwarding reference

## 什么时候使用

一个泛型包装器接收 `T&&`，并需要把参数继续交给构造函数或另一可调用对象时使用。普通业务
代码若已明确决定消费一个命名对象，通常使用 `std::move`；没有模板推导与引用折叠时，不应为了
“性能”套用 `std::forward`。

## C++20 代表声明

```cpp
template<class T>
constexpr T&& forward(std::remove_reference_t<T>& value) noexcept;

template<class T>
constexpr T&& forward(std::remove_reference_t<T>&& value) noexcept;
```

两者都返回 `static_cast<T&&>(value)`。C++23 的 `std::forward_like` 不属于本页 C++20 基线。

## 参数、推导与前置条件

`T` 通常来自外层 `template<class T> wrapper(T&& value)` 的模板推导，调用时必须显式写成
`std::forward<T>(value)`。第二个重载要求 `T` 不是左值引用类型，用于阻止把 rvalue 错误转发
成 lvalue。

当调用者传入 `U` 类型左值时，`T` 推导为 `U&`，引用折叠使 `T&&` 成为 `U&`；传入临时量时，
`T` 为 `U`，结果为 `U&&`。命名参数表达式 `value` 自身始终是 lvalue，即使其声明类型包含
`&&`，因此包装器内部才需要 forward。

`const T&&` 和类模板中已经固定类型的 `T&&` 并不会自动成为 forwarding reference。

## 返回值与值类别

返回指向同一对象的 `T&&`。若 `T` 是左值引用，折叠后返回 lvalue reference；否则返回 rvalue
reference。函数不构造对象，也不会让临时量活得更久。

## 复杂度

标准没有单列渐进复杂度；规定效果是一次引用转换，不遍历对象也不分配。被转发目标的构造或
调用成本属于目标操作。

## 异常与错误

两个重载均无条件 `noexcept`。模板参数写错可能导致程序编译失败，也可能把本应保留的 lvalue
错误转换为可被消费的 xvalue；目标函数随后抛出的异常不属于 `std::forward` 自身。

## 生命周期与失效规则

返回引用不拥有对象。包装器不能保存它并假定 rvalue 实参在调用结束后仍存活；需要跨调用保存
时应复制或取得明确所有权。把同一转发参数多次交给消费型操作，也可能在第一次后再次使用
moved-from 对象。

## 线程安全

`std::forward` 只恢复值类别，不读取对象值、不复制状态，也不提供同步。返回引用与原实参指向
同一对象；目标调用若会读写共享对象，调用者仍须按一般数据竞争规则同步冲突访问。完美转发只
保留调用语义，不会把目标函数或被转发对象变成线程安全。

## 示例

第一个示例让 `relay(T&&)` 把命名字符串和临时字符串分别送到 lvalue/rvalue 重载。第二个示例
实现小型 `make_box`，把不同类型参数转发到 `Job` 构造函数，不保存任何转发引用。

## 常见错误

- 省略模板参数写成 `std::forward(value)`。
- 随意猜测显式 `T`，而不是使用外层推导出的同一个参数。
- 忘记命名的 `T&&` 参数表达式仍是 lvalue。
- 把 `const T&&` 当作 forwarding reference。
- 多次把同一参数转发给会消费它的操作。
- 返回或保存指向临时实参的转发引用。

## 与 JavaScript 的区别

> JavaScript 的 `fn(...args)` 和 TypeScript 参数包能保留参数顺序，却没有 lvalue/xvalue、
> 引用折叠或值类别重载。spread syntax 只能类比“包装器继续传参”，不能解释 forward 的核心合同。

## 相关内容

先阅读 `std::move` 理解 xvalue cast，再用本页处理模板推导后的值类别。`make_unique` 和
`make_shared` 是标准库中构造参数转发的常见使用者。

## 来源

两个重载、引用折叠、forwarding-reference 推导和 C++11/C++14/C++23 版本边界由 manifest 的
Working Draft、N4861、历史提案验证；cppreference 仅用于二级结构核对。
