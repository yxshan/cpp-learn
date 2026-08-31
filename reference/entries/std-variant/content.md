# `std::variant`

`std::variant<Ts...>` 在编译期列出的候选类型中拥有一个当前激活值。它适合有限、可穷举的状态，
比把已知候选藏进运行时类型擦除更容易检查。

## 快速信息

- 头文件：`<variant>`
- 命名空间：`std`
- 标准：C++17 起
- 状态：通常恰有一个 active alternative，也可能因异常失值

## 什么时候使用

当值明确属于若干有限候选之一，并希望访问代码显式处理不同分支时使用 variant。如果只有“有值/
无值”两个状态，`std::optional` 更直接；如果成功和失败各自携带不同语义，C++23 的
`std::expected` 更准确；只有候选集合无法预列时才考虑 `std::any`。

## C++20 代表接口

```cpp
template<class... Types>
class variant;

template<class T, class... Types>
constexpr bool holds_alternative(const variant<Types...>& value) noexcept;

template<std::size_t I, class... Types>
constexpr variant_alternative_t<I, variant<Types...>>&
get(variant<Types...>& value);

template<std::size_t I, class... Types>
constexpr std::add_pointer_t<variant_alternative_t<I, variant<Types...>>>
get_if(variant<Types...>* value) noexcept;

template<class Visitor, class... Variants>
constexpr decltype(auto) visit(Visitor&& visitor, Variants&&... values);
```

上面省略构造、赋值、比较和索引/类型重载。C++20/C++23 使用非成员 `std::visit`；成员
`variant::visit` 是 C++26，不能回写到本页基线。

## 模板参数、状态与约束

`Types...` 是全部候选，类型可重复，但按类型的 `get<T>` 和 `holds_alternative<T>` 要求 `T` 恰好
出现一次。默认构造激活索引 0，所以首个候选必须可默认构造；需要显式空样状态时可把
`std::monostate` 放在第一项。

`index()` 返回当前索引；失值时返回 `variant_npos`。visitor 必须能以一致、合法的返回类型处理
调用中所有可能的 alternative 组合。

## 返回值与访问方式

`get` 返回当前 alternative 的引用；不匹配时抛异常。`get_if` 接收 variant 指针，匹配时返回元素
指针，指针为空或类型不匹配时返回 `nullptr`。`visit` 把 active value 按其 cv/ref 类别交给
visitor，并返回 visitor 的结果。

## 复杂度

一个或零个 variant 的 `visit` 相对候选数量为常数时间；多个 variant 的组合访问没有同样保证。
其他状态切换成本取决于被构造、销毁、移动或赋值的 alternative，标准不保证具体 jump table
实现或代码大小。

## 异常与错误

不匹配的 `get` 和访问失值 variant 的 `visit` 抛 `std::bad_variant_access`；`get_if` 不抛该异常。
切换类型时，新 alternative 的构造若抛异常，variant **可能**进入
`valueless_by_exception()` 状态。实现允许通过备份避免失值，因此不能断言每次失败后一定失值。

## 生命周期与失效规则

variant 只拥有 active alternative。切换状态、成功 `emplace`、赋值成另一类型或销毁 variant
会结束旧子对象生命周期，使先前由 `get`/`get_if` 得到的引用和指针失效。仅修改当前对象内部值
而不替换 alternative 时，引用按该类型自己的规则保持有效。

## 线程安全

不同 variant 对象可以独立使用；同一对象的并发只读观察可行。切换、赋值或修改 active value
时，必须同步对同一对象的冲突访问。先 `holds_alternative` 再读取不是并发同步协议；两步之间状态
仍可能被其他线程改变。

## 示例

第一个示例用同一个 visitor 处理整数状态和文本状态。第二个示例对正常分支使用 `get_if`，并捕获
错误 `get` 产生的 `bad_variant_access`，避免依赖不可移植的异常失值演示。

## 常见错误

- 把 variant 说成绝不会为空，而忽略异常失值状态。
- 断言某次构造异常后一定 `valueless_by_exception()`。
- 对重复候选类型使用按类型访问。
- 把状态检查与后续访问误当成原子操作。
- 只写 catch-all visitor，失去新增分支时的检查价值。
- 在 C++20 中调用并不存在的成员 `value.visit(...)`。

## 与 JavaScript 的区别

> TypeScript discriminated union 是最接近的类比：两者都依据 tag 处理当前分支。但 TS narrowing
> 是静态分析，C++ variant 真实拥有一个 alternative、管理其析构，并有
> `bad_variant_access` 与异常失值合同。

## 相关内容

正常缺失用 `std::optional`；成功/错误结果用 `std::expected`；候选集合无法预列才用
`std::any`。多个值同时存在时，应回到 `std::tuple` 或命名结构体。

## 来源

C++20 状态、访问、访问器复杂度、异常失值和生命周期由 manifest 中的 Working Draft、N4659、
N4861 与 P0088R3 验证；cppreference 仅用于二级结构核对。
