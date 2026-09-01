# `std::chrono::duration`

`std::chrono::duration<Rep, Period>` 保存 tick count；Period 用编译期有理数描述每个 tick 对应多少
秒。它表示“多少时间”，不知道 epoch、Clock、时区或日历。

## 快速信息

- 头文件：`<chrono>`
- 命名空间：`std::chrono`
- 标准：C++11 起；字面量 C++14；floor/ceil/round/abs C++17
- 默认 Period：`std::ratio<1>`，即每 tick 一秒

## 什么时候使用

timeout、间隔、TTL 和采样周期应使用 duration 而不是裸数。它不区分业务语义，同为 seconds 的
timeout 与 TTL 仍应靠字段名或业务类型区分；绝对时间点则使用 time_point。

## C++20 代表接口

```cpp
template<class Rep, class Period = std::ratio<1>>
class duration {
public:
    using rep = Rep;
    using period = typename Period::type;

    constexpr duration() = default;
    template<class Rep2> constexpr explicit duration(const Rep2& value);
    template<class Rep2, class Period2>
    constexpr duration(const duration<Rep2, Period2>& other);
    constexpr rep count() const;
    constexpr duration& operator+=(const duration& rhs);
    constexpr duration& operator/=(const rep& rhs);
    static constexpr duration zero() noexcept;
    static constexpr duration min() noexcept;
    static constexpr duration max() noexcept;
};

template<class ToDuration, class Rep, class Period>
constexpr ToDuration duration_cast(const duration<Rep, Period>& value);
```

这是学习用摘要；完整接口还包含其他算术、比较、common_type 以及 C++17 floor/ceil/round/abs。

## 模板参数、构造与前置条件

Rep 必须是 arithmetic type 或模拟它的 class，且不能本身是 duration specialization；Period 必须
是正数 `std::ratio`。当前草案禁止 cv-qualified Rep，但这是 LWG 4481 纳入 C++26 后的强化，不能
冒充原始 C++20 约束。整数单位转换仅在不产生小数 tick 等约束满足时隐式参与。

## 返回值、转换与舍入

`count()` 返回 Rep 值，unit 只存在于静态 Period 类型。细单位转粗整数单位时 `duration_cast` 按
整数除法向零截断；`floor` 向负无穷，`ceil` 向正无穷，`round` 取最近且正好等距时取偶数。
不同单位算术先使用 common duration；duration/duration 的 `/` 返回纯 rep 比值。

## 复杂度

标准没有为 duration 给出统一 Big-O；操作由固定数量的 Rep 运算与编译期 ratio 计算定义。自定义
Rep 可能有自定义成本，不能把“类型安全”扩展成单指令或零成本承诺。

## 异常、溢出与未定义行为

Rep 运算可能抛出其自定义异常。模板约束不会检查运行时范围：signed overflow、除/余零、`-min()`、
cast 中间乘法溢出都按底层规则处理；浮点 NaN/infinity/超范围转整数也是 UB。`abs(min())` 同样可能
取负溢出。外部数值必须先校验范围，chrono 不会自动饱和。

## 生命周期与线程安全

duration 是拥有值，`count()` 返回值，没有引用/iterator 失效。复制值相互独立；同一个非原子
duration 上并发读写仍是 data race。duration 本身不启动 timer，也不与某个 Clock 绑定。

## 示例

第一个示例用 ±2500ms 对比 cast/floor/ceil/round，突出负值截断边界。第二个示例做小范围混合单位
算术、整份数和余量；两者均远离极值且除数非零。

## 常见错误

- 认为 `count()` 永远是秒。
- 认为所有转换自动、无损且自动范围检查。
- 把向零 cast 当成 floor，或把 round 当 half-away-from-zero。
- 认为 `duration d;` 对 scalar Rep 必然为零。
- 在 min/max 边界继续算术或调用 `abs(min())`。
- 认为浮点 Rep 不会出现 NaN、infinity 或转换 UB。

## 与 JavaScript 的区别

> JS 常用 `1500` 并靠变量名约定毫秒；C++ `milliseconds{1500}` 把单位编入类型并参与 ratio
> 换算。TypeScript branded number 可模拟部分意图，但没有 chrono 的 common_type/舍入合同。

## 相关内容

把间隔放到某 Clock 上阅读 `time_point`；elapsed/deadline 选择 `steady_clock`；system/civil 时间
使用 `system_clock`。

## 来源

约束、非成员算术、转换、舍入和 UB 边界由 manifest 中的 Working Draft、N2661、N3337、P0092R1、
N4659、N4861 与 LWG 2094/3090/3503/4481 验证；cppreference 仅用于二级覆盖核对。
