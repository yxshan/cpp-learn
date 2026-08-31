# `std::swap`

`std::swap` 交换两个同类型对象的值；数组重载逐元素交换两个同长度数组。泛型代码通常还要
配合 ADL，才能发现用户类型在关联命名空间中提供的专用交换。

## 快速信息

- 头文件：C++20 代码直接包含 `<utility>`
- 命名空间：`std`
- 通用函数：C++98 起；现代移动式形式与数组重载 C++11 起
- 通用与数组重载：C++20 起 `constexpr`

## 什么时候使用

需要交换两个对象当前持有的值时使用。具体已知的内置或标准类型可以直接调用 `std::swap`；
编写接受任意用户类型的模板时，应使用 `using std::swap; swap(a, b);`，让标准 fallback 与 ADL
定制共同参与重载决议。

若需要交换不同类型、只交换部分字段，或维护额外领域不变量，应提供语义更明确的成员操作，
不要把所有状态迁移都伪装成通用 swap。

## C++20 代表声明

```cpp
template<class T>
constexpr void swap(T& left, T& right)
  noexcept(std::is_nothrow_move_constructible_v<T> &&
           std::is_nothrow_move_assignable_v<T>);

template<class T, std::size_t N>
constexpr void swap(T (&left)[N], T (&right)[N])
  noexcept(std::is_nothrow_swappable_v<T>);
```

这里只展示通用与数组重载。许多标准库类型还有自己的成员或非成员 swap 合同。

## 参数与约束

通用重载要求两个参数具有相同类型，并满足可移动构造、可移动赋值及相应语义要求。数组重载
要求长度相同且每一对元素可交换；不同长度属于不同数组类型，不能调用这一重载。

泛型定制应把非成员 `swap` 放在用户类型的关联命名空间，并从调用处使用未限定 `swap(a, b)`。
不要为普通用户类型向 `namespace std` 添加随意的 overload。

## 返回值

返回 `void`。调用完成后两个对象持有彼此原来的值；引用本身不会重新绑定，变量身份也没有交换。

## 复杂度

标准没有为通用重载单列渐进复杂度，也没有要求实现必须恰好执行“三次移动”。数组重载等价于
逐元素交换，长度为 N 时恰好进行 N 次元素交换，因此相对数组长度为 O(N)。元素操作自身成本
仍由元素类型决定。

## 异常与错误

通用重载仅在移动构造和移动赋值均不抛时为 `noexcept`；数组重载取决于元素是否 nothrow
swappable。某一步抛异常时没有通用事务回滚保证，先前完成的赋值或数组元素交换可能保留。

## 生命周期与失效规则

交换通常不结束两个外层对象的生命周期，已有引用和指针仍绑定原对象身份，但会观察到交换后的
值。资源句柄、迭代器或成员引用如何变化由具体类型的 swap 合同决定；容器 swap 的规则不能推广
到所有类型。

## 示例

第一个示例交换两个整数和两个同长度数组。第二个示例为 `app::Buffer` 在同一命名空间提供 swap，
泛型 helper 用 `using std::swap` 加未限定调用，让 ADL 选择专用实现。

## 常见错误

- 在泛型代码中写死 `std::swap`，阻止 ADL 找到类型定制。
- 给 `namespace std` 添加普通用户类型 overload。
- 交换不同类型或不同长度数组。
- 假定所有 swap 都是 `noexcept` 或失败时会自动回滚。
- 把容器的迭代器保证推广到任意类型。
- 认为 swap 会改变引用绑定或变量身份。

## 与 JavaScript 的区别

> JavaScript 的 `[left, right] = [right, left]` 能交换变量当前绑定的值，但没有 ADL、类型专用
> 定制和条件 `noexcept`。C++ 引用仍绑定原对象；swap 改变的是对象持有的值。

## 相关内容

`std::move` 解释通用 fallback 所依赖的值类别；`std::pair`、`std::vector` 和 `std::array` 各有
更具体的逐元素或容器交换合同，应进入对应实体页核对失效规则。

## 来源

通用和数组重载、条件 `noexcept`、ADL 协议、数组复杂度与 C++98/11/20 边界由 manifest 的
Working Draft、N4861、历史草案和 P0879R0 验证。
