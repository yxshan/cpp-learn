# `std::chrono::time_point`

`std::chrono::time_point<Clock, Duration>` 保存相对于某个 Clock epoch 的 duration。Clock 是类型的
一部分，因此它表示“哪个时间轴上的点”，但不自动包含日历、时区或格式化文本。

## 快速信息

- 头文件：`<chrono>`
- 命名空间：`std::chrono`
- 标准：C++11 起；floor/ceil/round C++17；自增/减 C++20
- 默认构造：Clock epoch，不是现在

## 什么时候使用

表示某个 Clock 上的 deadline、采样点或 system instant 时使用。只表示间隔用 duration；civil
日期与时区显示要进入 calendar/time-zone 层；不同 Clock 之间不能靠裸 count 强行比较。

## C++20 代表接口

```cpp
template<class Clock, class Duration = typename Clock::duration>
class time_point {
public:
    using clock = Clock;
    using duration = Duration;
    using rep = typename duration::rep;
    using period = typename duration::period;
    constexpr time_point();
    constexpr explicit time_point(const duration& offset);
    template<class Duration2>
    constexpr time_point(const time_point<clock, Duration2>& other);
    constexpr duration time_since_epoch() const;
    constexpr time_point& operator+=(const duration& offset);
    constexpr time_point& operator-=(const duration& offset);
    static constexpr time_point min() noexcept;
    static constexpr time_point max() noexcept;
};

template<class ToDuration, class Clock, class Duration>
constexpr time_point<Clock, ToDuration>
time_point_cast(const time_point<Clock, Duration>& value);
```

这是学习用摘要；完整接口另含比较、加减、C++17 舍入和 C++20 自增减。

## 模板参数、构造与参数要求

Duration 必须是 duration specialization。默认构造得到 epoch；传 offset 得到 epoch + offset。同一
Clock、不同 Duration 仅在 duration 转换合法时构造。Clock 不同即使 rep/period 相同也不是同类
时间点。

## 返回值、算术与转换

`time_since_epoch()` 返回拥有的 duration 值。同 Clock 时间点相减返回 common duration；时间点加
duration 返回采用 common unit 的 time_point。`time_point_cast` 只改变同一 Clock 下的 Duration
精度，不改变 Clock；C++20 `clock_cast` 也需要唯一合法转换路径，不是任意 reinterpret cast。

## 复杂度

标准没有专属 Big-O；接口由固定数量的 duration/Rep 运算定义。具体成本与异常可继承自自定义 Rep，
不能把模板抽象直接承诺为单条指令。

## 异常、范围与未定义行为

cast、floor/ceil/round 的负数和溢出边界继承 duration。`min()`/`max()` 包装 duration 极值，在极值
继续加减可能 signed overflow/UB。序列化裸 count 前必须固定 Clock、epoch、unit、rep 宽度和标准
版本。

## 生命周期与线程安全

time_point 是拥有值，observer 返回值，没有引用/iterator 失效。复制值相互独立；同一非原子对象
并发读写仍是 data race。时间点本身不持有 OS timer，也不会随 Clock 继续推进而自动改变。

## 示例

两个示例使用固定 DemoClock 类型且不调用 now。第一个构造 epoch+1000ms、增加 750ms 并相减；
第二个对 epoch+2500ms 分别 cast/floor/ceil/round。

## 常见错误

- 认为默认构造是“现在”。
- 认为 time_point_cast 能转换 steady/system clocks。
- 按 count 比较不同 Clock 的时间点。
- 认为所有 Clock epoch 都是 1970。
- 只持久化 `time_since_epoch().count()` 而丢失协议信息。
- 在 min/max 上继续加减。

## 与 JavaScript 的区别

> JS `Date` 同时承担 instant、calendar formatting 与 mutable object；C++ time_point 只表示某 Clock
> 上的点。`performance.now()` 返回 number，而 steady time_point 仍保留 Clock 和 unit 类型。

## 相关内容

单位与舍入阅读 `duration`；elapsed/deadline 使用 `steady_clock`；system/civil 时间使用
`system_clock`；设施总览阅读 `<chrono>`。

## 来源

构造、算术、cast、舍入、clock_cast 和版本边界由 manifest 中的 Working Draft、N2661、N3337、
P0092R1、N4659、P0355R7 与 N4861 验证；cppreference 仅用于二级覆盖核对。
