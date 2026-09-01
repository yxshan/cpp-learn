# `std::chrono::system_clock`

`std::chrono::system_clock` 表示 system-wide realtime wall clock，并连接系统时间、C++20 sys_time
与 civil calendar。它可能随 OS/NTP/管理员调整，不适合测量 elapsed time。

## 快速信息

- 头文件：`<chrono>`
- 命名空间：`std::chrono`
- 标准：C++11 起；C++20 明确 Unix epoch 并加入 sys_time/calendar
- `is_steady`：由实现决定，不能固定假设 false

## 什么时候使用

需要系统/协议时间戳、持久化 instant 或进入 calendar/time-zone 转换时使用。测量操作耗时、timeout
和 deadline 应使用 steady_clock；显示本地时间要显式指定时区与格式化协议。

## C++20 代表接口

```cpp
class system_clock {
public:
    using rep = /* implementation-defined signed type */;
    using period = std::ratio</* implementation-defined */>;
    using duration = std::chrono::duration<rep, period>;
    using time_point = std::chrono::time_point<system_clock>;
    static constexpr bool is_steady = /* implementation-defined */;
    static time_point now() noexcept;
    static std::time_t to_time_t(const time_point& value) noexcept;
    static time_point from_time_t(std::time_t value) noexcept;
};

template<class Duration>
using sys_time = time_point<system_clock, Duration>; // C++20
using sys_seconds = sys_time<seconds>;
using sys_days = sys_time<days>;
```

## 返回值、epoch 与表示

`now()` 返回拥有的 system time_point。C++20 起 sys_time 从 1970-01-01 00:00:00 UTC 开始且不计
leap seconds，即 Unix time；C++11/C++17 没有这个固定 epoch 保证。rep、period、range 与
`is_steady` 仍由实现选择。

## `time_t` 参数与转换

to/from_time_t 表示同一时间点，但只按 time_t 与 time_point 两者中较粗的 precision 对齐；round
还是 truncate 由实现决定。标准不保证 time_t 是整数 Unix 秒、固定宽度/符号，也不保证任意高精度
round trip 无损，因此示例不依赖它的数值。

## 复杂度

标准没有规定 now、time_t 转换或 calendar 分解的具体复杂度、系统调用数或固定成本。native period
也不等于实际 resolution/precision。

## 异常、范围与民用时间边界

Clock 的 now 与列出的 time_t 转换为 `noexcept`；后续 time_point/duration 算术仍可能溢出。
system_clock 排除 leap seconds；表达 UTC leap second 使用 utc_clock。sys_time 本身没有本地时区，
DST/offset 必须通过 C++20 time-zone 层显式解释。

## 生命周期与线程安全

返回 time_point 是值，没有失效。多线程可调用 now，但墙上时钟可跳变，后一次数值可能更小，不能
把它当单调 sequence ID。并发安全也不建立业务数据的 happens-before。

## 示例

第一个示例只使用 C++20 固定 sys epoch 与 2000-01-01，输出规范化秒数。第二个构造固定
2024-02-29 12:34:56 并手工拆分整数；不调用 now、time_t、locale、环境时区或 tzdb。

## 常见错误

- 把 C++20 的 1970 epoch 保证倒灌到 C++11/17。
- 假定 system_clock 必然不 steady、now 永不回退或 native unit 一定纳秒。
- 认为 time_t 一定是 Unix 秒且 round trip 无损。
- 认为 sys_time 自带本地 timezone。
- 用 system_clock 测 elapsed time。
- 直接把 system 与 steady time_points 相减。

## 与 JavaScript 的区别

> JS `Date.now()`/`Date` 接近 system wall-clock/Unix-time 用途，常用 number 毫秒；C++ native
> period/rep 未指定，应通过 duration_cast/sys_time 明确协议。两边的本地字符串都不适合稳定序列化。

## 相关内容

间隔和精度阅读 `duration`；时间点类型阅读 `time_point`；elapsed/deadline 使用 `steady_clock`；
日历/时区设施地图阅读 `<chrono>`。

## 来源

墙上时钟、C++20 Unix epoch、time_t、clock_cast、calendar 与并发边界由 manifest 中的 Working
Draft、N2661、N3337、N4659、P0355R7、P1466R3、N4861 与 LWG 3318 验证；cppreference 仅用于
二级覆盖核对。
