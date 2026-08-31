# `std::function`

`std::function<R(Args...)>` 把不同类型的可复制 callable 擦除为固定调用签名，并通常拥有其中保存的
target。它适合需要存储、替换或跨接口传递回调的场景，不是所有调用路径的零开销默认选择。

## 快速信息

- 头文件：`<functional>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权：通常拥有 callable 的 decay copy；引用包装和引用捕获仍非拥有

## 什么时候使用

事件处理器、可替换策略或长期保存的回调需要统一签名，同时具体 lambda/函数对象类型不应暴露在
接口中时使用。局部模板能保留具体 callable 类型且性能敏感时，可直接使用模板参数；仅可移动的
callable 不能放入 `std::function`，C++23 另有 `std::move_only_function`。

## C++20 代表接口

```cpp
template<class R, class... Args>
class function<R(Args...)> {
public:
    function() noexcept;
    function(std::nullptr_t) noexcept;
    function(const function& other);
    function(function&& other) noexcept;

    template<class F>
    function(F callable);

    explicit operator bool() const noexcept;
    R operator()(Args... args) const;
    const std::type_info& target_type() const noexcept;

    template<class T>
    T* target() noexcept;
};
```

`std::move_only_function` 是 C++23 的另一个类型，不是这里省略的重载。

## 模板参数、参数与所有权

模板参数描述完整调用签名，而不是 callable 的具体类型。转换构造通常保存 callable 的 decay copy，
它必须可复制构造且能以 `Args...` 调用并产生兼容 `R` 的结果。

从 `reference_wrapper<F>` 构造或使用 lambda 引用捕获时，包装器不拥有被引用对象；这些对象必须
活过所有调用。复制 function 会复制 owned target，但引用、指针和共享句柄仍可能让副本别名同一
外部状态。

## 返回值与调用

布尔转换只报告是否有 target。非空调用把参数交给 target，并按签名返回 `R`；`target<T>()` 只有
在具体 target 类型精确匹配时返回内部指针，否则返回 `nullptr`。

## 复杂度与分配

调用通常可能产生一次间接分派，并包含 target 自身工作；标准不承诺具体分派方式、固定纳秒或
必然内联。函数指针和
`reference_wrapper` 不要求动态分配；对一般小 callable 只建议避免分配，未规定通用 SBO 尺寸，
不能仅凭 lambda 很小就断言零分配。

## 异常与错误

调用空 function 抛 `std::bad_function_call`；非空调用传播 target 的异常。构造和复制可能传播
callable copy/初始化异常或 `std::bad_alloc`。函数指针和 `reference_wrapper` 的相关构造/复制有
更强的不抛分配保证，但不能推广到任意 target。

## 生命周期与失效规则

赋值替换、置空或析构 function 会结束 owned target 生命周期，使此前由 `target<T>()` 取得的指针
失效。引用捕获、指针字段或 `reference_wrapper` 不延长外部对象生命周期。

C++20 中，把返回 prvalue 的 callable 存进引用返回签名可能编译却留下悬空引用；C++23 的
P2255R2 将这类构造设为不良构。需要引用返回时，target 必须明确返回仍存活对象的引用。

## 线程安全

`operator()` 虽是 const，也可能调用会修改状态的 target。并发调用同一个 function 只有在 target
及其捕获状态支持该并发时才安全；与赋值、swap 或销毁并发需要外部同步。复制包装器也不保证引用
捕获的外部状态彼此独立。

## 示例

第一个示例让同一签名先保存加法再替换为乘法。第二个示例捕获空调用异常，并只在引用捕获对象仍
处于作用域内时调用回调。

## 常见错误

- 认为包装器接受任意 callable，包括 move-only lambda。
- 未检查空状态就调用。
- 把复制 function 误认为深复制引用或指针捕获的对象。
- 在 C++20 用引用返回签名包装返回临时量的 lambda。
- 保存引用捕获后让外部对象先结束生命周期。
- 假设小 lambda 必然不分配或一定被内联。

## 与 JavaScript 的区别

> JavaScript 函数是一等值，TypeScript 函数类型也能描述统一签名；`std::function` 还执行 C++
> 类型擦除、拥有并复制 target，并受确定析构和引用生命周期约束。GC 不会替 C++ 包装器延长引用
> 捕获对象的生命周期。

## 相关内容

擦除普通值类型时阅读 `std::any`；转发 callable 参数时理解 `std::forward`；资源捕获与所有权
转移还需要结合 `std::move` 判断包装器是否满足可复制要求。

## 来源

C++20 构造、调用、空状态异常、分配边界、引用生命周期和线程规则由 manifest 中的 Working
Draft、N3337、N4861、N1402 与 P2255R2 验证；cppreference 仅用于二级覆盖核对。
