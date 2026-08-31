# `std::pair`

`std::pair<T1, T2>` 把两个可能不同类型的公开子对象组合成固定二元值，成员名为 `first` 和
`second`。它适合局部含义清楚的两个结果，不应替代具有长期领域语义的命名结构体。

## 快速信息

- 头文件：`<utility>`
- 命名空间：`std`
- 标准：C++98 起
- 存储：直接包含两个公开子对象，不承诺无填充或特定布局

## 什么时候使用

函数需要轻量返回两个值、标准 API 已经定义 pair 合同，或两个位置在很小作用域内含义明确时
使用。若字段需要稳定业务名称、三个以上成员、验证规则或成员行为，优先定义命名 `struct`，
避免远距离代码只能猜测 `.first` 和 `.second`。

## C++20 代表接口与版本

```cpp
template<class T1, class T2>
struct pair {
    using first_type = T1;
    using second_type = T2;

    T1 first;
    T2 second;

    pair(const pair&) = default;
    pair(pair&&) = default;

    template<class U1, class U2>
    constexpr explicit(/* 取决于可转换性 */)
    pair(U1&& first_value, U2&& second_value);

    constexpr void swap(pair& other)
      noexcept(std::is_nothrow_swappable_v<T1> &&
               std::is_nothrow_swappable_v<T2>);
};

template<class T1, class T2>
pair(T1, T2) -> pair<T1, T2>; // C++17
```

C++11 加入移动、转发、piecewise construction 和 tuple-like `get`；C++17 加入 CTAD；C++20
以 `==` 与字典序 `<=>` 组织比较，并扩展部分 constexpr 操作。当前草案中的 pair-like、更多
const 操作和异构比较晚于 C++20，不属于上面的基线。

## 构造参数与成员

`T1`、`T2` 是两个成员的静态类型。双参数构造分别初始化 `first`、`second`，转发构造只有在
对应成员可由 `U1`、`U2` 构造时可用，并按隐式可转换性决定是否 `explicit`。

`std::make_pair` 会 decay 参数并特别解包 `std::reference_wrapper`；直接 CTAD `std::pair{x, y}`
按 by-value deduction guide 推导，但不要假定它与 `make_pair(std::ref(x), y)` 的引用处理完全
相同。piecewise construction 用两个 tuple 分别提供两个子对象的构造参数。

## 比较与结果

比较按字典序进行：先比较 `first`，只有前者等价时才比较 `second`。本页 C++20 基线中的比较
参数属于同一个 `pair<T1, T2>` 特化；不要把当前草案更宽的异构签名回写为 C++20 能力。

赋值返回 `*this`，结构化绑定可把两个成员分别绑定到局部名字。pair 本身没有“成功/失败”语义；
成员代表什么必须由调用接口说明。

## 复杂度

标准没有给整个 pair 页面一个统一渐进复杂度。普通构造、赋值和 swap 固定处理两个子对象；
元素操作自身可能很昂贵。相等比较因短路进行一次或两次元素相等比较，字典序比较也只在
`first` 等价时继续比较 `second`。

## 异常与错误

构造、赋值、比较和交换会传播对应元素操作的异常。移动赋值只有在两个成员都 nothrow move
assignable 时才不抛；swap 同样取决于两个成员是否 nothrow swappable。pair 不会为逐元素操作
增加通用事务回滚。

## 生命周期与失效规则

普通 `pair<T, U>` 直接拥有两个子对象，pair 销毁时两者随之结束生命周期。复制或移动 pair 会
逐元素调用相应操作，源成员状态分别由其类型合同决定，不能统一声称为空。

`pair<T&, U&>` 只保存两个别名，不拥有 referent，也不延长生命周期。C++20 中把临时对象绑定到
引用成员可能在完整表达式结束后留下悬空引用；当前草案更严格的删除规则不能冒充 C++20 已有
保护。成员若是指针、视图或迭代器，其失效仍由外部对象决定。

## 示例

第一个示例返回拥有型 `pair<string, int>` 并用结构化绑定读取状态与代码。第二个示例比较两个
同类型 pair，展示先看 `first`、相等后再比较 `second` 的字典序规则。

## 常见错误

- 用 `.first`、`.second` 承载跨模块业务含义，而不定义命名结构体。
- 把 pair 当作可增长容器或假设两个成员无填充地连续排列。
- 让引用成员绑定临时对象并跨过完整表达式使用。
- 认为 CTAD 与 `make_pair(std::ref(...))` 的引用处理完全相同。
- 假定 C++20 可以直接比较任意不同 pair 特化。
- 忘记字典序先比较 `first`，只有等价时才看 `second`。

## 与 JavaScript 的区别

> JavaScript `[value, error]` 数组和 TypeScript tuple 可以表达两个位置，但 TS 约束在运行时会
> 被擦除，底层仍是可变长 Array。`std::pair<T, U>` 是固定两个 C++ 子对象的静态类型，复制、
> 移动、析构和比较都逐元素发生。语义不清时，两种语言都更适合具名对象或 struct。

## 相关内容

使用 `std::swap` 交换两个 pair，使用 `std::move` 或 `std::forward` 控制构造参数值类别。需要
按键组织多个 pair 时阅读 `std::map`；需要三个以上异构位置时后续进入 `std::tuple`。

## 来源

C++20 接口、比较、逐元素异常与生命周期边界，以及 C++98/11/17/20 演进由 manifest 的 Working
Draft、N4861、历史草案和 WG21 提案验证；cppreference 仅用于二级覆盖参考。
