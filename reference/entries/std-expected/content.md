# `std::expected`

`std::expected<T, E>` 在成功值 `T` 与错误值 `E` 之间维护严格二选一状态。它适合调用者需要显式
检查和传递的同步业务错误，不是异步任务或异常机制的机械替代品。

## 快速信息

- 头文件：`<expected>`
- 命名空间：`std`
- 标准：**C++23 起**
- 状态：始终持有 value 或 error，不存在 variant 式异常失值状态

## 什么时候使用

解析、校验或同步服务调用存在可预期失败，而且调用者需要错误值决定提示、重试或恢复时使用
expected。如果缺失本身已表达全部含义，`std::optional` 更简洁；异常仍适合无法在局部正常处理的
失败。Promise/Future 表达未来完成与调度，不应与 expected 混为一谈。

## C++23 代表接口

```cpp
template<class T, class E>
class expected;

template<class E>
class unexpected;

template<class T, class E>
class expected {
public:
    constexpr bool has_value() const noexcept;
    constexpr T& value() &;
    constexpr E& error() & noexcept;

    template<class F> constexpr auto and_then(F&& function) &;
    template<class F> constexpr auto or_else(F&& function) &;
    template<class F> constexpr auto transform(F&& function) &;
    template<class F> constexpr auto transform_error(F&& function) &;
};
```

四个 monadic operations 已由 P2505R5 纳入 C++23/N4950。`has_error()` 不在 C++23，应使用
`!has_value()`；不要把后续草案接口回写到本页。

## 模板参数、构造与约束

`T` 可以是 cv `void`，或完整的非数组对象类型；上面的 `T& value()` 代表普通非 void
specialization，`expected<void, E>` 另有无返回值观察接口。`E` 必须是可作为 `unexpected<E>`
参数的完整、可析构非数组对象类型，不能是 cv-qualified 类型。两者的构造、移动、赋值与析构
能力继续决定具体 overload 是否可用。

使用 `std::unexpected(error)` 或 `std::unexpect` 标签明确构造错误分支。标准通过操作约束保持
“总有一个分支”不变量，不需要也不保证动态分配。

`and_then` 的成功回调返回另一个 expected；把成功值映射成普通新值通常使用 `transform`。
`or_else` 和 `transform_error` 只处理错误分支。

## 返回值与观察方式

`has_value()` 和布尔转换报告当前分支。`value()`、`error()`、`operator*` 按对象值类别返回内部
对象引用；`value_or`/`error_or` 按值产生结果。monadic 操作只调用对应分支并返回新的结果对象，
失败分支不会错误执行成功回调。

## 复杂度

观察接口只检查当前状态，不遍历数据。分支切换与 monadic 操作的成本取决于 `T`、`E` 和回调的
构造、移动及执行；标准没有赋予 expected 固定分配、对象大小或“零成本”保证。

## 异常与错误

错误分支调用 `value()` 会抛携带错误的 `std::bad_expected_access<E>`。`operator*`、`operator->`
要求存在成功值；`error()` 要求处于错误分支，它的 `noexcept` 不表示会在错误前提下返回默认值。
构造、赋值和回调可传播相应用户操作的异常，但 expected 仍保持 value/error 二选一不变量。

## 生命周期与失效规则

expected 拥有当前 contained object。切换分支、替换状态或销毁 expected 会结束旧 value/error 的
生命周期，使此前取得的引用和指针失效。若 `T` 或 `E` 自身是视图、指针或引用包装器，expected
只拥有该句柄，不延长外部 referent 的生命周期。

## 线程安全

不同 expected 对象可以独立使用；同一对象的并发只读观察可以进行。切换状态、赋值或经引用修改
内部 value/error 时，必须同步冲突访问。检查 `has_value()` 后再访问不是跨线程原子事务。

## 示例

第一个 C++23 示例分别处理正数成功值与错误文本。第二个示例用 `transform` 只映射成功分支，并
证明错误分支会保留原错误而跳过成功回调。

## 常见错误

- 把 `std::expected` 标成 C++20 或用 polyfill 冒充标准类型。
- 未检查状态就解引用，并误以为会抛 `bad_expected_access`。
- 在 C++23 写不存在的 `has_error()`。
- 误以为 `and_then` 回调返回裸值；普通映射应使用 `transform`。
- 把同步结果对象当成 Promise、Future 或后台任务。
- 保存内部引用后切换 value/error 分支。

## 与 JavaScript 的区别

> TypeScript 的 `{ ok: true; value: T } | { ok: false; error: E }` 是很好的类比。Promise 解决
> 未来完成和调度，而 expected 表示一个现在已经完成的同步结果，并按 C++ 对象生命周期管理
> 当前分支。

## 相关内容

没有错误原因时使用 `std::optional`；多个普通候选状态使用 `std::variant`。错误或成功值若借用
文本，还需要遵守 `std::string_view` 的外部生命周期规则。

## 来源

C++23 身份、value/error 不变量、观察器、monadic operations、异常和生命周期由 manifest 中的
Working Draft、N4950、P0323R12 与 P2505R5 验证；cppreference 仅用于二级覆盖核对。
