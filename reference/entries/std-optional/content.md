# `std::optional`

`std::optional<T>` 在对象内部管理一个“可能存在”的 `T`。它适合表达“没有结果是正常分支，
而且不需要解释原因”的接口，不是通用错误处理或指针替代品。

## 快速信息

- 头文件：`<optional>`
- 命名空间：`std`
- 标准：C++17 起
- 所有权：拥有内部的 `T`；如果 `T` 本身是视图或指针，只拥有这个句柄

## 什么时候使用

查找可能没有命中、配置项允许省略、对象中的某个值允许稍后才建立时，可以使用
`optional<T>`。调用者能从类型上看到“缺失”是合法结果，而不必依赖特殊数字、空字符串
或魔法枚举值。

如果失败原因会影响重试、日志或用户提示，应使用能携带错误信息的结果类型。如果值必须
始终存在，应在构造阶段建立不变量；不要用 `optional` 推迟必要校验。动态多态、独立对象
身份和共享所有权也应由相应的智能指针表达。

## 代表性声明

以下是面向 C++17/C++20 的代表性子集，省略了部分转换、赋值和比较重载：

```cpp
namespace std {
template<class T>
class optional {
public:
    constexpr optional() noexcept;
    constexpr optional(nullopt_t) noexcept;

    constexpr explicit operator bool() const noexcept;
    constexpr bool has_value() const noexcept;

    constexpr T& operator*() & noexcept;
    constexpr const T& operator*() const& noexcept;
    constexpr T& value() &;
    constexpr const T& value() const&;

    template<class U>
    constexpr T value_or(U&& fallback) const&;

    template<class... Args>
    constexpr T& emplace(Args&&... args);

    constexpr void reset() noexcept;
};
} // namespace std
```

`and_then`、`transform` 和 `or_else` 是 C++23 增加的操作，不属于本项目示例采用的 C++20
基线。

## 约束与前置条件

C++17/C++20 的 `T` 必须是可销毁的完整非数组对象类型。构造和 `emplace` 只有在 `T`
能由对应参数构造时才可用。

`operator*` 和 `operator->` 要求当前包含值；它们不会检查空状态。先使用布尔转换或
`has_value()` 分支，或者在“空值应成为异常”时调用 `value()`。

`value_or` 的 `const&` 重载需要能够复制 `T`，右值重载需要能够移动 `T`；备用值还必须
能够转换成 `T`。

## 返回值与值类别

`has_value()` 和布尔转换只报告当前是否包含值。对左值 optional 调用 `operator*` 或
`value()` 会返回内部对象的引用；对右值调用相应重载会返回右值引用。

`value_or` 始终按值返回一个新的 `T`：有值时复制或移动内部值，无值时把备用值转换为
`T`。它不会返回指向内部值或备用值的引用。

移动一个有值的 optional 不会自动清空源 optional。源对象仍然是有值状态，但其中的
`T` 已成为移动后状态；是否还能读取具体内容取决于 `T` 自己的保证。

## 复杂度

optional 自身只检查一个状态，并至多销毁或构造一个 `T`。实际成本取决于被选中的 `T`
操作：`value_or` 可能复制或移动 `T`，`emplace` 可能执行任意复杂的构造。不能因为
optional 外形很小就把所有操作都描述成廉价常数时间。

## 异常与错误

- `value()` 在无值时抛出 `std::bad_optional_access`。
- 空 optional 的 `operator*` 和 `operator->` 不满足前置条件，不会转换成上述受检异常。
- 构造和赋值可以传播 `T` 的构造或赋值异常。
- `emplace()` 会先销毁旧值，再构造新值；如果新值构造抛出异常，optional 最终为空，
  不会恢复旧值。
- `reset()` 为 `noexcept`，并在需要时销毁当前值。

## 生命周期与失效规则

optional 直接拥有内部的 `T`。从 `*opt`、`value()`、`operator->` 或 `emplace()` 得到的
引用和指针，都只在当前那一个内部对象存活时有效。`reset()`、赋值为 `nullopt`、替换值
或销毁 optional 都会结束旧对象的生命周期。

`optional<std::string_view>` 只拥有一个视图，不拥有视图引用的字符；外部字符失效后，
optional 仍可能显示为“有值”，但内部视图已经悬空。

## 示例

“解析端口”示例展示成功和缺失分支；“配置覆盖”示例展示内部对象的建立、访问和重置。
两个示例都使用确定性输入并由本地 C++20 工具链验证。

## 常见错误

- 认为空值解引用会抛出异常；需要受检访问时应使用 `value()`。
- 认为 `value_or` 返回引用，从而忽略一次复制、移动或转换。
- 认为移动 optional 会让源对象变为空。
- 在 `reset()` 或 `emplace()` 后继续使用先前取得的内部引用。
- 用 optional 隐藏所有错误原因，导致调用者无法采取正确恢复措施。

## 与 JavaScript 的区别

JavaScript 常用 `undefined` 或 `null` 表示缺失，但变量的类型通常不会单独记录这一状态。
`optional<T>` 把“可能缺失”放入静态类型，并明确管理内部 `T` 的生命周期。它的布尔状态
只表示是否包含值，与 `T` 自身是否为 `0`、空字符串或其他“假值”无关。

## 相关内容

如果内部值只是借用文本，请继续阅读 `std::string_view` 的生命周期规则。需要动态独占
所有权时，应使用 `std::unique_ptr`；需要携带失败原因时，应选择明确的错误结果模型。

## 来源

观察器、构造、修改器、内部对象生命周期和首次标准版本分别由 Entry manifest 中的
C++ Working Draft 与 WG21 历史草案来源验证。
