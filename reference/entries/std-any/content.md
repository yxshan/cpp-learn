# `std::any`

`std::any` 拥有一个类型在运行时确定的可复制值，并通过 `any_cast` 做精确类型检查。它适合真正
无法预列类型集合的扩展点，不是把 C++ 变成动态语言的通用变量。

## 快速信息

- 头文件：`<any>`
- 命名空间：`std`
- 标准：C++17 起
- 所有权：拥有 contained value；该值内部的指针或引用仍可非拥有

## 什么时候使用

插件元数据、属性袋或跨层扩展点确实无法在接口类型中列出全部候选时，可以使用 any。如果候选
集合有限，应使用 `std::variant` 保留穷举检查；只表达缺失用 `std::optional`；长期领域模型也
不应靠任意字符串键和 any 隐藏结构。

## C++20 代表接口

```cpp
class any {
public:
    constexpr any() noexcept;
    any(const any& other);
    any(any&& other) noexcept;

    template<class T>
    any(T&& value);

    template<class T, class... Args>
    std::decay_t<T>& emplace(Args&&... args);

    void reset() noexcept;
    bool has_value() const noexcept;
    const std::type_info& type() const noexcept;
};

template<class T> T any_cast(const any& value);
template<class T> T* any_cast(any* value) noexcept;
```

这里只展示创建、观察、替换和两类 cast 的代表性子集。

## 参数、类型约束与所有权

转换构造保存 `decay_t<T>`，所存类型必须可复制构造，因此不能直接放入仅可移动类型。类型匹配
是精确的：保存 `int` 后请求 `double` 不会做数值转换，字符串字面量 decay 后也不会自动成为
`std::string`。

复制 any 会复制 contained value；移动后的源 any 仍有效但状态未指定，不能假设必为空。

## 返回值与类型检查

`has_value()` 报告是否包含值，`type()` 返回所存类型的 `type_info`，空 any 返回 `typeid(void)`。
值或引用形式 `any_cast<T>` 返回请求的值/引用；指针形式在精确匹配时返回内部对象指针，否则返回
`nullptr`，适合不把类型探测写成异常控制流。

## 复杂度与分配

构造、复制、赋值和 `emplace` 的成本取决于 contained value 及可能的动态分配。标准只把小对象
优化列为推荐实践，不保证缓冲区尺寸，也不保证某个“看起来很小”的类型一定零分配；实现采用
内部缓冲时还应限制在 nothrow move constructible 类型。

## 异常与错误

值/引用形式的类型不匹配抛 `std::bad_any_cast`；指针形式不匹配返回 `nullptr` 且不抛。
构造、复制和替换可传播 contained value 或分配器的异常。`emplace` 构造失败时旧值已经销毁，
any 变为空；它不会回滚旧值。

## 生命周期与失效规则

`reset()`、赋值替换、成功 `emplace` 和析构都会结束旧 contained value 的生命周期，使先前
`any_cast<T&>` 或指针 cast 得到的结果失效。若 contained value 自身是指针、视图或
`reference_wrapper`，any 只拥有这个句柄，不延长外部 referent 的生命周期。

## 线程安全

不同 any 对象可以独立使用；同一对象的并发只读观察可以进行。`reset`、赋值、`emplace` 或通过
cast 引用修改内部值时，必须同步冲突访问。复制出的两个 any 各自拥有值，但值内部仍可能共享
同一指针状态，线程安全由该状态的类型合同决定。

## 示例

第一个示例展示 `int` 精确取值成功而 `double*` 探测失败。第二个示例替换为字符串、捕获错误
cast，并用 `reset` 结束内部对象生命周期。

## 常见错误

- 期待 `any_cast` 执行数值或字符串隐式转换。
- 用抛异常 cast 做高频类型探测，而不使用指针形式。
- 把实现观察到的小对象缓冲尺寸当标准或 ABI 保证。
- 保存内部引用后替换、reset 或销毁 any。
- 认为移动后的源 any 必为空。
- 用 any 隐藏本来明确有限的 variant 候选集合。

## 与 JavaScript 的区别

> TypeScript 的 `unknown` 比 `any` 更接近：读取前必须缩窄；TS `any` 反而关闭类型检查。C++
> `std::any` 拥有一个按精确 RTTI 类型取回的具体对象，不执行 JavaScript 式隐式转换，也不是
> 由 GC 自动延长外部引用生命周期的变量。

## 相关内容

候选类型有限时阅读 `std::variant`；正常缺失阅读 `std::optional`；擦除 callable 类型但保留
调用签名时使用 `std::function`。

## 来源

C++20 类型约束、精确 cast、异常、推荐性小对象优化、生命周期和线程边界由 manifest 中的
Working Draft、N4659、N4861 与 N3804 验证；cppreference 仅用于二级覆盖核对。
