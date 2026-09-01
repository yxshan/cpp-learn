# C++ Reference 第十一批：`chrono` 时间基础扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-01
>
> 精确范围：`<chrono>`、`std::chrono::duration`、
> `std::chrono::time_point`、`std::chrono::steady_clock`、
> `std::chrono::system_clock`
>
> 事实基线：C++11 工作草案 N3337、C++17 最终工作草案 N4659、C++20
> 工作草案 N4861、当前 C++ Working Draft，以及相关 WG21 原始提案和 LWG
> 缺陷报告。cppreference 与 zh.cppreference 只作二级结构和覆盖核对，正文与示例不得复制。

## 1. 批次目标与版本边界

本批恰好增加五个 Entry，建立“单位化时间间隔 → 某个时钟上的时间点 → 单调计时 →
民用/系统时间”的基础闭环。所有可运行示例都使用 C++20 编译，但页面必须区分 C++11
原始设施、C++14 字面量、C++17 舍入算法与 C++20 日历/时区扩展。

- `<chrono>`、`duration`、`time_point`、`steady_clock` 和 `system_clock` 均从 C++11 起提供。
- `h`、`min`、`s`、`ms`、`us`、`ns` duration 字面量从 C++14 起提供；直接构造
  `seconds{3}` 等写法不依赖字面量。
- `floor`、`ceil`、`round` 和 duration `abs` 来自 P0092，C++17 起提供。
- C++20 增加 civil calendar、time-zone database、`sys_time`/`sys_days`、更多 clocks、
  `clock_cast`、chrono 格式化/解析，以及 `time_point` 的自增/自减。P0355R7 是主要设计来源，
  P1466R3 和随后 wording/DR 修正了细节。
- `system_clock` 在 C++20 起明确测量从 `1970-01-01 00:00:00 UTC` 开始、不计 leap
  seconds 的 Unix time；C++11/C++14/C++17 只规定 system-wide realtime wall clock，epoch
  仍未指定。页面不能把 C++20 epoch 结论倒灌给旧标准模式。
- 本批示例不使用 time-zone database、当前时间、睡眠或格式化本地时间，因此不受 tzdb、locale、
  scheduler 和墙上时钟调整影响。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|
| `header-chrono` | `header` | `<chrono>` | `<chrono>` | `c++11` | `c++20` | [`[time.syn]`](https://eel.is/c++draft/time.syn) |
| `std-chrono-duration` | `type` | `std::chrono::duration` | `<chrono>` | `c++11` | `c++20` | [`[time.duration]`](https://eel.is/c++draft/time.duration) |
| `std-chrono-time-point` | `type` | `std::chrono::time_point` | `<chrono>` | `c++11` | `c++20` | [`[time.point]`](https://eel.is/c++draft/time.point) |
| `std-chrono-steady-clock` | `type` | `std::chrono::steady_clock` | `<chrono>` | `c++11` | `c++20` | [`[time.clock.steady]`](https://eel.is/c++draft/time.clock.steady) |
| `std-chrono-system-clock` | `type` | `std::chrono::system_clock` | `<chrono>` | `c++11` | `c++20` | [`[time.clock.system]`](https://eel.is/c++draft/time.clock.system) |

建议全部归类 `chrono`。Header Entry 使用缩减质量模板；每页恰好两个示例，共 10 个。

### 1.2 Manifest-ready 关系

| ID | 建议 `related` |
|---|---|
| `header-chrono` | `std-chrono-duration`、`std-chrono-time-point`、`std-chrono-steady-clock`、`std-chrono-system-clock` |
| `std-chrono-duration` | `header-chrono`、`std-chrono-time-point`、`std-ratio`（未来） |
| `std-chrono-time-point` | `header-chrono`、`std-chrono-duration`、`std-chrono-steady-clock`、`std-chrono-system-clock` |
| `std-chrono-steady-clock` | `header-chrono`、`std-chrono-duration`、`std-chrono-time-point`、`std-chrono-system-clock` |
| `std-chrono-system-clock` | `header-chrono`、`std-chrono-duration`、`std-chrono-time-point`、`std-chrono-steady-clock` |

若 catalog 要求 related ID 必须已存在，则实现本批时只引用本批五个稳定 ID；`std-ratio`
保留为正文链接，待 `<ratio>` 条目建立后再加入 manifest。

## 2. 共享时间模型与教学边界

### 2.1 `duration`、`time_point` 与 clock 是三个不同概念

[`[time.duration.general]`](https://eel.is/c++draft/time.duration.general) 规定 duration 保存
tick count，并以 `Period` 这个秒单位的有理数描述每个 tick；它表示间隔，不知道 epoch、时区或
日历。`time_point<Clock, Duration>` 保存相对于 `Clock` epoch 的 duration；它不是格式化日期。
Clock 则把 `rep`、`period`、`duration`、`time_point`、`is_steady` 与 `now()` 捆在一起；epoch
由 clock 定义。来源：[`[time.point.general]`](https://eel.is/c++draft/time.point.general)、
[`[time.clock.req]`](https://eel.is/c++draft/time.clock.req)。

因此页面统一使用下面的语言：

- `duration`：多少时间；
- `time_point`：某个 clock 的 epoch 加上多少时间；
- `steady_clock`：适合测间隔和 deadline 的不可调时钟；
- `system_clock`：适合与 civil/system time 互操作的系统墙上时钟。

不能把 `duration::count()` 的裸数跨 API 传递而丢失 `Period`；不能比较不同 Clock 的
`time_point`；也不能把 steady epoch 值保存到磁盘，期待下次进程或另一台机器仍有意义。

### 2.2 转换、舍入与表示范围

整数 duration 从粗单位转细单位时通常可隐式转换；从细单位转粗单位可能截断，所以需要
`duration_cast` 或显式选择 `floor`/`ceil`/`round`。`duration_cast` 以
`common_type<ToRep, Rep, intmax_t>` 做中间计算，按编译期 ratio 省略无用乘除，最后再转目标 rep。
整数除法仍是向零截断；`floor` 向负无穷，`ceil` 向正无穷，`round` 取最近值且正好等距时取偶数。
来源：[`[time.duration.cast]`](https://eel.is/c++draft/time.duration.cast)、
[P0092R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/p0092r1.html)。

类型约束只阻止一部分危险的隐式转换，**不检查运行时 count 是否超出目标范围**。有符号整数 rep
上的加减乘、取负、除零、余零或 duration_cast 中间乘法仍受底层整数规则约束；溢出可能是 UB。
浮点 duration 转整数 duration 时，NaN、infinity 或超出目标可表示范围同样落入浮点到整数转换的
undefined behavior。`abs(duration::min())` 也可能因最小有符号数取负而 UB。来源：
[`[conv.fpint]`](https://eel.is/c++draft/conv.fpint)、
[`[time.duration.arithmetic]`](https://eel.is/c++draft/time.duration.arithmetic)、
[LWG 3090](https://cplusplus.github.io/LWG/issue3090)。

页面应明确建议：外部数据先做范围检查；不要在 min/max 边界继续算术；不要把类型安全误解成
自动饱和或 checked arithmetic。当前 LWG 3503 还记录了浮点目标的 `floor`/`ceil` 规范问题，
教学示例只使用小范围整数 rep，不用极值或浮点舍入。

### 2.3 复杂度、异常、生命周期与并发

本批设施不拥有 OS timer、线程或动态资源。duration/time_point 值的观察、比较和算术由固定数量的
rep 操作定义，标准没有另列统一 Big-O 或“零成本/单条指令”承诺；自定义 rep 可能有自定义成本和
异常。`steady_clock::now()`、`system_clock::now()` 的系统调用路径、分辨率和开销均未规定，不能
写成 O(1) 意味着固定纳秒成本。

`duration::count()` 与 `time_point::time_since_epoch()` 都返回值，不产生悬空 view；复制值相互
独立，没有容器式 iterator/reference invalidation。若 Rep 自身是 class，则异常和复制语义仍继承
Rep；标准明确 duration member 除了 indicated representation operations 抛出的异常外不再抛。

Clock 满足 Cpp17TrivialClock 时 `now()` 不抛；standard library 的一般 data-race 规则允许多个
线程并发调用不经参数访问共享对象的 const/stateless API。独立 duration/time_point 值可并发使用；
同一非原子对象上并发读写仍需同步。时钟单调性是时间语义，不是 memory-order synchronization；
读取 `steady_clock::now()` 不能替代 mutex/atomic。来源：
[`[time.clock.req]`](https://eel.is/c++draft/time.clock.req)、
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)。

### 2.4 确定性示例红线

本批所有 expected stdout 必须只来自 constructed values 或 compile-time clock properties。
以下示例即使“通常能跑”，也必须拒绝：

- 打印 `system_clock::now()`、`steady_clock::now().time_since_epoch()` 或真实 elapsed time；
- `sleep_for` 后断言至少/恰好经过某个阈值，或比较 scheduler latency；
- 输出 `steady_clock::period`、epoch 或 `system_clock::duration` 的具体单位；它们均由实现选择；
- 用 `std::localtime`、`ctime`、`zoned_time/current_zone()` 或 locale-dependent formatting 生成
  expected stdout；
- 假设 tzdb 已安装、tzdb 版本固定、DST 规则固定或环境时区为 UTC；
- 假设 `system_clock::is_steady == false`；该值由实现指定，标准只保证可作常量表达式；
- 假设两个连续 `steady_clock::now()` 严格递增；steady 只保证不下降，分辨率有限时可以相等；
- 假设 `to_time_t` 总是向下取整、`time_t` 是 Unix 秒数、宽度固定，或任意
  `to_time_t`/`from_time_t` round trip 恢复原精度；标准允许按两者较粗精度舍入或截断。

## 3. `<chrono>`

### 3.1 C++20 facility map 与直接包含

```cpp
// <chrono>：C++20 学习用轮廓，不是完整 synopsis
namespace std::chrono {
template<class Rep, class Period = ratio<1>> class duration;
template<class Clock, class Duration = typename Clock::duration>
class time_point;

class system_clock;
class steady_clock;
class high_resolution_clock;
class utc_clock;
class tai_clock;
class gps_clock;

using nanoseconds  = duration</* signed integer */, nano>;
using microseconds = duration</* signed integer */, micro>;
using milliseconds = duration</* signed integer */, milli>;
using seconds      = duration</* signed integer */>;
using minutes      = duration</* signed integer */, ratio<60>>;
using hours        = duration</* signed integer */, ratio<3600>>;
using days         = duration</* signed integer */, ratio<86400>>;

template<class Duration> using sys_time = time_point<system_clock, Duration>;
using sys_seconds = sys_time<seconds>;
using sys_days = sys_time<days>;

class day; class month; class year; class weekday;
class year_month_day;
class time_zone;
template<class Duration, class TimeZonePtr = const time_zone*>
class zoned_time;
}
```

按任务组织页面：

| 任务 | 首选设施 | 不应混淆为 |
|---|---|---|
| 表示超时/间隔 | `duration` 与单位 aliases | 裸整数毫秒 |
| 表示某时钟上的 deadline | `time_point<Clock>` | civil date string |
| 测量 elapsed time | `steady_clock` | `system_clock` |
| 取得/保存 Unix/civil time | `system_clock`、`sys_time` | `steady_clock` epoch count |
| 日历日期 | `year_month_day`、`sys_days` | 固定 24h 代表所有“本地日” |
| 时区转换 | `zoned_time`、`time_zone`、tzdb | 手工加固定 UTC offset |

必须直接 `#include <chrono>`。输出需 `<iostream>`；`std::boolalpha` 也由 iostream 设施提供；
`std::ratio` 的直接使用应包含 `<ratio>`；不能依赖 `<chrono>` 的传递包含。

Header 没有统一复杂度、异常或线程合同；应转到具体 facility。`<chrono>` 不负责启动 timer、
异步 sleep 或 event loop，也不自动处理用户所在时区。C++20 tzdb 是另一层服务，不应暗示
`system_clock::time_point` 自带 timezone。

### 3.2 JS 对照与误区

JS 中常见的 `number` 毫秒会把 count 与 unit 混在一起；C++ duration 把单位编码进类型。
`Date` 更接近 `system_clock`/`sys_time`，浏览器 `performance.now()` 更接近单调 elapsed-time
用途，但两边的 epoch、精度、进程边界和 API 合同不同。JS Temporal 的 Duration/Instant 思路更
接近 chrono 的类型拆分，但可用性取决于运行环境，页面只做概念类比，不把它当兼容 API。

常见误区：`chrono` 只有计时器；`hours{24}` 总等于任意本地 civil day；所有 clock epoch 相同；
`high_resolution_clock` 必然 steady；包含 `<chrono>` 后可省略 `<ratio>`/`<iostream>`；C++20
calendar 意味着所有实现一定附带最新 tzdb。

### 3.3 两个示例

1. `compose-typed-interval.cpp`：只组合固定字面量并显式转成毫秒。

   ```text
   seconds=150
   milliseconds=150000
   ```

2. `validate-calendar-date.cpp`：构造 `2024y/February/29`，用 `ok()` 和从 `sys_days`
   构造的 `weekday::iso_encoding()` 输出固定事实。

   ```text
   valid=true
   weekday_iso=4
   ```

第二例要求 C++20；不格式化 locale 文本，不查询系统时间或 tzdb。

## 4. `std::chrono::duration`

### 4.1 C++20 代表接口与模板约束

```cpp
// <chrono>
namespace std::chrono {
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
  constexpr duration& operator-=(const duration& rhs);
  constexpr duration& operator*=(const rep& rhs);
  constexpr duration& operator/=(const rep& rhs);
  constexpr duration& operator%=(const rep& rhs);
  constexpr duration& operator%=(const duration& rhs);

  static constexpr duration zero() noexcept;
  static constexpr duration min() noexcept;
  static constexpr duration max() noexcept;
};

template<class ToDuration, class Rep, class Period>
constexpr ToDuration duration_cast(const duration<Rep, Period>& value);
template<class ToDuration, class Rep, class Period>
constexpr ToDuration floor(const duration<Rep, Period>& value); // C++17
template<class ToDuration, class Rep, class Period>
constexpr ToDuration ceil(const duration<Rep, Period>& value);  // C++17
template<class ToDuration, class Rep, class Period>
constexpr ToDuration round(const duration<Rep, Period>& value); // C++17
}
```

`Rep` 必须是 arithmetic type 或模拟 arithmetic 的 class；Rep 自身是 duration specialization
时程序 ill-formed。`Period` 必须是 `std::ratio` specialization，且 `Period::num > 0`。
当前 Working Draft 还禁止 cv-qualified Rep；这是 LWG 4481 纳入 C++26 后的强化，不能冒充
C++20 N4861 原始约束。构造器还约束 Rep 间可转换性：目标 integral rep 不接受 floating source
的隐式窄化；两个 integral duration 只有在单位换算不产生小数 tick 时才隐式转换。来源：
[`[time.duration.general]`](https://eel.is/c++draft/time.duration.general)、
[`[time.duration.cons]`](https://eel.is/c++draft/time.duration.cons)、
[LWG 4481](https://cplusplus.github.io/LWG/issue4481)。

`duration d;` 对 scalar rep 不应被当作已初始化零值；稳妥写法是 `duration d{0}` 或
`duration::zero()`。`count()` 返回 rep 值，不带运行时 unit 标签；unit 在静态 `period` 类型中。

### 4.2 返回、算术、错误和边界

- 两个不同单位的 duration 做 `+`/`-`/比较时，先转到 `common_type`；结果 unit 通常是能精确表示
  两者的公共 period。duration/duration 的 `/` 返回纯 rep 比值，而 `%` 返回 duration 余量。
- `duration_cast` 向 integral 粗单位转换按整数除法向零截断。负值 `-2500ms` 转 seconds 得
  `-2s`，而 `floor<seconds>` 得 `-3s`。
- `round` 目标 rep 必须不是 treat-as-floating-point；正负半值均按最近、ties-to-even。
- `zero/min/max` 来自 `duration_values<Rep>`；自定义 Rep 可以定制其数值模型。
- 除零、余零、signed overflow、`-min()`、超范围 cast 与 Rep 自身抛出的异常都不会由 duration
  自动修复。先验证输入和换算后的范围。

专属条款没有列出大 O；各接口由固定数量的 Rep 操作和编译期 ratio 运算定义。它是 owning value，
没有引用/迭代器失效；对同一个 mutable duration 并发写仍需同步。

### 4.3 生命周期、线程、误区与 JS 对照

duration 与 clock 无绑定，可在不同 clocks 的协议之间复用，但单位正确不代表语义正确：例如
`seconds{30}` 既可能是 timeout 也可能是 cache TTL。建议业务层再用命名类型或字段名区分含义。

JS 常把 duration 写成 `1500` 并靠变量名猜毫秒；C++ `milliseconds{1500}` 能在编译期参与单位
换算。TypeScript branded number 可模拟部分类型安全，但没有 chrono 的 ratio/common_type 合同。

常见误区：`count()` 永远是秒；所有转换自动且不会截断；`duration_cast` 自动 checked/saturating；
负数 cast 等于 floor；`round` 是传统的 half-away-from-zero；`duration d;` 必为零；
`abs(min())` 安全；用 `double` 就不会溢出或出现 NaN/infinity。

### 4.4 两个示例

1. `convert-and-round.cpp`：用 `2500ms` 与 `-2500ms` 对比 cast/floor/ceil/round。

   ```text
   cast_positive=2
   floor_positive=2
   ceil_positive=3
   round_positive=2
   cast_negative=-2
   floor_negative=-3
   ```

2. `mixed-unit-arithmetic.cpp`：`2s + 750ms`，再计算 250ms 单位的完整份数和 1s 余量。

   ```text
   total_ms=2750
   quarter_seconds=11
   remainder_ms=750
   ```

两例只用小范围 integral reps；不输出 chrono stream suffix，避免 microseconds suffix 的实现差异。

## 5. `std::chrono::time_point`

### 5.1 C++20 代表接口与约束

```cpp
// <chrono>
namespace std::chrono {
template<class Clock, class Duration = typename Clock::duration>
class time_point {
public:
  using clock = Clock;
  using duration = Duration;
  using rep = typename duration::rep;
  using period = typename duration::period;

  constexpr time_point();                    // epoch
  constexpr explicit time_point(const duration& offset);
  template<class Duration2>
  constexpr time_point(const time_point<clock, Duration2>& other);

  constexpr duration time_since_epoch() const;
  constexpr time_point& operator++();         // C++20
  constexpr time_point& operator--();         // C++20
  constexpr time_point& operator+=(const duration& offset);
  constexpr time_point& operator-=(const duration& offset);
  static constexpr time_point min() noexcept;
  static constexpr time_point max() noexcept;
};

template<class ToDuration, class Clock, class Duration>
constexpr time_point<Clock, ToDuration>
time_point_cast(const time_point<Clock, Duration>& value);
}
```

`Duration` 不是 duration specialization 时程序 ill-formed。默认构造明确得到 epoch；传 duration
构造得到 epoch + offset。同 Clock、不同 Duration 的转换只有在 `Duration2` 可转目标 duration
时参与。`time_since_epoch()` 返回 duration 值。

同一个 Clock 的 `time_point + duration` 返回采用 common duration 的 time_point；两个同 Clock
time_points 相减返回 common duration。标准非成员比较也要求相同 Clock template argument；
两个 clocks 即使“看起来单位一样”也不能直接比较。`time_point_cast` 只改变同一 Clock 下的
Duration 精度，不是 clock conversion；C++20 的 `clock_cast` 是另一组带路径选择约束的 API。
来源：[`[time.point]`](https://eel.is/c++draft/time.point)、
[`[time.clock.cast.fn]`](https://eel.is/c++draft/time.clock.cast.fn)。

### 5.2 舍入、范围、复杂度与生命周期

`time_point_cast<ToDuration>` 等价于对 `time_since_epoch()` 做 `duration_cast`；C++17
`floor/ceil/round` 则逐一委托对应 duration 舍入。所有溢出、负数截断和浮点边界都继承 duration。
`min/max` 分别包装 `duration::min/max`；在极值上继续加减仍可能 UB。

没有专属 Big-O；接口由固定数量的 duration/rep 操作定义。time_point 是 owning value，observer
不暴露内部引用，没有失效问题。独立值可并发读取；同一对象一边修改一边读取仍是普通 data race。

`time_since_epoch().count()` 只有与 Clock 和 Duration 类型一起才有意义。不要只序列化裸 count；
Clock epoch、period、rep width 和标准版本都是协议的一部分。

### 5.3 误区与 JS 对照

JS `Date` 同时承担 instant、calendar formatting 和 mutable object 等职责；C++ time_point 只表示
某 Clock 上的点，时区/日历是后续转换层。`performance.now()` 返回裸 number，而 steady
time_point 仍保留 clock 和 unit 类型。

常见误区：默认构造是“现在”；`time_point_cast` 能转换 steady/system clocks；不同 clocks 可按
count 比较；epoch 一定是 1970；`time_since_epoch()` 是可跨平台 Unix timestamp；`min/max`
可以安全再加减；保存 observer 结果会引用原对象（实际返回值）。

### 5.4 两个示例

两个示例都定义最小 `DemoClock`，并使用
`time_point<DemoClock, milliseconds>`；`now()` 返回固定 epoch，但示例不调用它。

1. `construct-and-offset.cpp`：从 1000ms offset 构造，增加 750ms，并计算差值。

   ```text
   start_ms=1000
   finish_ms=1750
   elapsed_ms=750
   ```

2. `round-time-points.cpp`：对 epoch +2500ms 做 cast/floor/ceil/round。

   ```text
   cast_seconds=2
   floor_seconds=2
   ceil_seconds=3
   round_seconds=2
   ```

自定义 Clock 只为隔离 epoch；不得用 wall-clock now 生成 expected stdout。

## 6. `std::chrono::steady_clock`

### 6.1 C++20 代表接口与合同

```cpp
// <chrono>
namespace std::chrono {
class steady_clock {
public:
  using rep = /* implementation-defined */;
  using period = std::ratio</* implementation-defined */>;
  using duration = chrono::duration<rep, period>;
  using time_point = chrono::time_point<steady_clock, duration>;
  static constexpr bool is_steady = true;
  static time_point now() noexcept;
};
}
```

N4861 的教学代表签名可写 `time_point<steady_clock>`；当前 Working Draft 的 synopsis 对底层
clock type/representation 保留实现自由，因此正文不应依赖精确 alias 展开。唯一核心合同是：随着
physical time 前进，time_point 值不下降，并以相对 real time 的稳定速率推进；该 clock 不被调整。
来源：[`[time.clock.steady]`](https://eel.is/c++draft/time.clock.steady)。

“不下降”不是“每次调用严格增加”，也不是纳秒分辨率。rep、period、epoch、范围和 `now()` 成本
均未指定。steady 不等于 high resolution，`high_resolution_clock` 也可能只是别名且不一定 steady。

### 6.2 用途、可移植性、线程与生命周期

适合 elapsed measurement、relative timeout 和 deadline。标准线程 timing 条款建议 relative
timeouts 使用 steady clock；如果需要在 wall-clock 调整时保持等待长度，deadline 也应基于
steady clock。它不适合显示日期、与数据库时间戳交换或跨重启持久化。

`now()` noexcept，返回 owning time_point。并发调用 clock API 可以，但 Clock 的单调性不建立
C++ happens-before；共享数据仍使用 atomic/mutex。标准没有保证 epoch 在两个进程间一致，也没有
提供 steady 与 system 的标准转换；通常 `clock_cast<system_clock>(steady_tp)` 不满足约束。

JS 浏览器 `performance.now()` 最接近 elapsed-time 用途；两者都是相对时间，不应当作 civil
timestamp。但 JS 数值单位/precision 和 time origin 由 Web API 定义，不能与 C++ steady count
互换。

常见误区：steady epoch 是进程启动；period 一定 nanosecond；连续 now 必然不同；steady 能防
CPU suspend 或所有硬件异常；`is_steady` 等于线程安全；steady count 能跨进程保存；它能直接
转换为 system_clock/date；测一次非常短操作就得到可靠 benchmark。

### 6.3 复杂度与两个示例

`now()` 的 complexity、实际 resolution 和 precision 都未规定；页面不得承诺 syscall 数或
固定成本。time_point 算术继承 duration 的范围和 overflow 边界。

1. `inspect-steady-contract.cpp`：只输出标准保证的 compile-time properties。

   ```text
   time_point_alias=true
   is_steady=true
   now_noexcept=true
   ```

2. `construct-steady-deadline.cpp`：使用
   `time_point<steady_clock, milliseconds>` 构造固定 start/deadline/finished，不调用 now。

   ```text
   deadline_ms=1250
   remaining_ms=75
   reached=false
   ```

第一个示例可 `static_assert(steady_clock::is_steady)` 和
`static_assert(noexcept(steady_clock::now()))`；第二个只验证 deadline 算术，不假装模拟时间流逝。

## 7. `std::chrono::system_clock`

### 7.1 C++20 代表接口与 epoch

```cpp
// <chrono>
namespace std::chrono {
class system_clock {
public:
  using rep = /* implementation-defined signed type */;
  using period = std::ratio</* implementation-defined */>;
  using duration = chrono::duration<rep, period>;
  using time_point = chrono::time_point<system_clock>;
  static constexpr bool is_steady = /* implementation-defined */;
  static time_point now() noexcept;
  static std::time_t to_time_t(const time_point& value) noexcept;
  static time_point from_time_t(std::time_t value) noexcept;
};

template<class Duration>
using sys_time = time_point<system_clock, Duration>; // C++20
using sys_seconds = sys_time<seconds>;              // C++20
using sys_days = sys_time<days>;                    // C++20
}
```

`system_clock` 表示 system-wide realtime wall clock。C++20 `sys_time<Duration>` 从
`1970-01-01 00:00:00 UTC` 开始测量并排除 leap seconds，即 Unix time；`sys_seconds{0s}`
对应 epoch。system_clock rep 必须能表示负 duration（`duration::min() < zero()`），但具体
能回溯多远由 period/rep range 决定，并不保证所有历史日期可表示。来源：
[`[time.clock.system.overview]`](https://eel.is/c++draft/time.clock.system.overview)、
[LWG 3318](https://cplusplus.github.io/LWG/issue3318)。

C++11/C++17 页面版本切换时必须显示：epoch 未指定；C++20 才可写固定 Unix epoch。

### 7.2 `time_t`、墙上时钟调整与 civil time

`to_time_t`/`from_time_t` 返回与输入表示同一时间点，但只按 time_t 和 time_point 两者中较粗的
precision 对齐；究竟 round 还是 truncate 是 implementation-defined。标准不保证 time_t 是
整数 Unix 秒、宽度、signedness 或能无损 round trip 任意 system time_point。页面可展示签名和
合同，但确定性示例不依赖其数值。

`is_steady` 的值由实现决定，不能固定输出 false。现实系统时钟可能被 OS/NTP/管理员向前或向后
调整，所以 elapsed measurement 应使用 steady_clock。timezone 或 DST 变化改变 civil display/
offset，不会把 sys_time 自身变成“本地时间”；需要 C++20 calendar/time-zone API 显式转换。

`system_clock` 排除 leap seconds；需要表达 UTC leap seconds 时使用 C++20 `utc_clock` 和
`clock_cast`。`clock_cast` 只有在标准/custom `clock_time_conversion` 中存在唯一最佳转换路径时
参与并成立，不能被描述成任意 Clock 间 reinterpret cast。来源：
[`[time.clock.cast.fn]`](https://eel.is/c++draft/time.clock.cast.fn)、
[P0355R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0355r7.html)。

### 7.3 复杂度、生命周期、并发、误区与 JS 对照

`now()` 和 time_t conversion 的实现成本未规定；calendar field conversion 也不应声称固定
syscall 数。返回 time_point 是 owning value，没有失效；多个线程可调用 now，但 clock jump
可能让后一次调用数值更小，不能用它生成单调 sequence ID。并发安全不等于单调性。

JS `Date.now()` 与 `Date` 最接近 system wall-clock/Unix-time 用途，常以 Number 毫秒表示；C++
system_clock 的 native period/rep 未指定，必须通过 duration_cast/`sys_time` 明确精度。两边的
本地字符串格式和 timezone 数据都不适合稳定序列化；协议应选择明确 epoch、unit 和时区语义。

常见误区：C++11 就保证 1970 epoch；system_clock 必定不 steady；`now()` 永不回退；native unit
一定纳秒；time_t 一定 Unix seconds 且 round trip 无损；sys_time 包含 timezone；24h 一定是
本地下一天；system/steady time_points 可直接相减；leap second 会计入 Unix count。

### 7.4 两个示例

1. `inspect-system-epoch.cpp`：用 C++20 `sys_seconds{0s}` 和固定 `sys_days{2000y/January/1}`
   展示标准给出的 epoch 与 Y2K 秒数。

   ```text
   epoch_seconds=0
   y2k_seconds=946684800
   ```

2. `split-constructed-system-time.cpp`：构造
   `sys_days{2024y/February/29} + 12h + 34min + 56s`，用 `floor<days>`、
   `year_month_day` 和 `hh_mm_ss` 拆分；手工输出整数，不走 locale formatting。

   ```text
   date=2024-2-29
   time=12:34:56
   ```

两例都要求 C++20。不得把它们改成 `now()`、`localtime`、`current_zone()` 或 time_t 的实现相关
round trip。

## 8. 十个示例的确定性清单

| # | Entry / 文件名 | 数据来源 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `<chrono>` / `compose-typed-interval.cpp` | 固定 literals | integral exact conversion | `seconds=150\nmilliseconds=150000\n` |
| 2 | `<chrono>` / `validate-calendar-date.cpp` | 固定 2024 leap day | calendar constexpr，无 tzdb | `valid=true\nweekday_iso=4\n` |
| 3 | `duration` / `convert-and-round.cpp` | ±2500ms | integral cast 与 C++17 rounding | `cast_positive=2\nfloor_positive=2\nceil_positive=3\nround_positive=2\ncast_negative=-2\nfloor_negative=-3\n` |
| 4 | `duration` / `mixed-unit-arithmetic.cpp` | 2s + 750ms | common duration + 非零除数 | `total_ms=2750\nquarter_seconds=11\nremainder_ms=750\n` |
| 5 | `time_point` / `construct-and-offset.cpp` | DemoClock constructed points | 不调用 now | `start_ms=1000\nfinish_ms=1750\nelapsed_ms=750\n` |
| 6 | `time_point` / `round-time-points.cpp` | epoch + 2500ms | 同 Clock 精度转换 | `cast_seconds=2\nfloor_seconds=2\nceil_seconds=3\nround_seconds=2\n` |
| 7 | `steady_clock` / `inspect-steady-contract.cpp` | compile-time properties | 不输出 period/epoch | `time_point_alias=true\nis_steady=true\nnow_noexcept=true\n` |
| 8 | `steady_clock` / `construct-steady-deadline.cpp` | fixed steady-tagged points | 不调用 now/sleep | `deadline_ms=1250\nremaining_ms=75\nreached=false\n` |
| 9 | `system_clock` / `inspect-system-epoch.cpp` | C++20 fixed sys values | 无 time_t/now | `epoch_seconds=0\ny2k_seconds=946684800\n` |
| 10 | `system_clock` / `split-constructed-system-time.cpp` | fixed sys date/time | 手工整数输出，无 locale/tzdb | `date=2024-2-29\ntime=12:34:56\n` |

示例实现要求：

- 全部只写 ASCII stdout；布尔值显式 `std::boolalpha`。
- 不读取环境变量、系统 locale、timezone、tzdb、当前时间或硬件 clock period。
- 不输出浮点数，避免 representation 与 formatting 差异。
- 不使用 sleep、busy loop、benchmark threshold 或运行时间断言。
- 只在小范围整数上算术，除数非零，远离 min/max；所有换算精确或有明确整数舍入合同。
- calendar 示例只使用标准定义的 proleptic Gregorian/sys_days 映射。
- 编译失败或逻辑失败时可写固定 stderr 并返回非零，但 expected stdout 只包含表中内容。

## 9. 版本与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| chrono 原始模型与 C++11 设计 | [N2661 “A Foundation to Sleep On”](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2661.html)、[C++11 draft N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) |
| C++14 chrono literals | [N3642](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3642.pdf) |
| C++17 状态与 rounding/abs | [C++17 final draft N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)、[P0092R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/p0092r1.html) |
| C++20 calendar、tzdb、Unix epoch、clock_cast | [P0355R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0355r7.html)、[P1466R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1466r3.html)、[C++20 draft N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) |
| header 与 Clock requirements | [`[time.syn]`](https://eel.is/c++draft/time.syn)、[`[time.clock.req]`](https://eel.is/c++draft/time.clock.req) |
| duration constraints、算术、转换、舍入 | [`[time.duration]`](https://eel.is/c++draft/time.duration)、[`[time.duration.cast]`](https://eel.is/c++draft/time.duration.cast)、[`[time.duration.alg]`](https://eel.is/c++draft/time.duration.alg)、[LWG 2094](https://cplusplus.github.io/LWG/issue2094)、[LWG 3090](https://cplusplus.github.io/LWG/issue3090)、[LWG 3503](https://cplusplus.github.io/LWG/issue3503) |
| time_point construction、arithmetic、cast | [`[time.point]`](https://eel.is/c++draft/time.point)、[`[time.point.cast]`](https://eel.is/c++draft/time.point.cast) |
| steady monotonicity | [`[time.clock.steady]`](https://eel.is/c++draft/time.clock.steady)、[`[thread.req.timing]`](https://eel.is/c++draft/thread.req.timing) |
| system wall clock、Unix epoch、time_t precision | [`[time.clock.system]`](https://eel.is/c++draft/time.clock.system)、[LWG 3318](https://cplusplus.github.io/LWG/issue3318) |
| clock_cast 路径与唯一性 | [`[time.clock.cast.fn]`](https://eel.is/c++draft/time.clock.cast.fn)、[P0355R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0355r7.html) |
| 浮点到整数 UB 与 library concurrency | [`[conv.fpint]`](https://eel.is/c++draft/conv.fpint)、[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races) |

二级页面只核对搜索别名、成员清单和栏目：
[`<chrono>`](https://zh.cppreference.com/w/cpp/header/chrono)、
[`duration`](https://zh.cppreference.com/w/cpp/chrono/duration)、
[`time_point`](https://zh.cppreference.com/w/cpp/chrono/time_point)、
[`steady_clock`](https://zh.cppreference.com/w/cpp/chrono/steady_clock)、
[`system_clock`](https://zh.cppreference.com/w/cpp/chrono/system_clock)。正文、表格和示例必须原创。

## 10. 每个 Entry 的 manifest-ready 来源建议

### `header-chrono`

- Current: `[time.syn]`、`[time.clock.req]`、`[time.cal]`、`[time.zone]`
- Historical/WG21: N2661、N3337、N4659、N4861、P0092R1、P0355R7、P1466R3
- Secondary: zh.cppreference `<chrono>`

### `std-chrono-duration`

- Current: `[time.duration.general]`、`[time.duration.cons]`、
  `[time.duration.arithmetic]`、`[time.duration.nonmember]`、`[time.duration.cast]`、
  `[time.duration.alg]`
- Historical/WG21/DR: N2661、N3337、N4659、N4861、P0092R1、LWG 2094、
  LWG 3090、LWG 3503、LWG 4481（C++26 cv-qualified Rep 边界）
- Core boundary: `[conv.fpint]`
- Secondary: zh.cppreference duration、duration_cast、floor/ceil/round

### `std-chrono-time-point`

- Current: `[time.point]`、`[time.point.nonmember]`、`[time.point.cast]`、
  `[time.clock.cast.fn]`
- Historical/WG21: N2661、N3337、N4659、N4861、P0092R1、P0355R7
- Secondary: zh.cppreference time_point、time_point_cast

### `std-chrono-steady-clock`

- Current: `[time.clock.req]`、`[time.clock.steady]`、`[thread.req.timing]`
- Historical: N2661、N3337、N4659、N4861
- Concurrency: `[res.on.data.races]`
- Secondary: zh.cppreference steady_clock

### `std-chrono-system-clock`

- Current: `[time.clock.req]`、`[time.clock.system.overview]`、
  `[time.clock.system.members]`、`[time.clock.cast.fn]`
- Historical/WG21/DR: N2661、N3337、N4659、N4861、P0355R7、P1466R3、LWG 3318
- Concurrency: `[res.on.data.races]`
- Secondary: zh.cppreference system_clock

## 11. 实施与终审清单

- 只新增五个建议 ID；每页两个 deterministic C++20 run 示例，共 10 个。
- Header Entry 覆盖 facility map、direct include、任务选择、版本边界、共同安全模型和两个示例。
- 四个普通 Entry 均覆盖：C++20 代表声明族、模板参数/约束、参数与返回、转换/舍入、错误与
  overflow/UB、规范复杂度边界、生命周期/失效、线程、clock epoch/monotonicity/civil-time
  可移植性、误区、JS 对照、版本和一级来源。
- 所有 examples 使用固定 constructed durations/time_points 或 compile-time properties；不调用
  `now()`、sleep、tzdb、locale 或环境时区来生成 stdout。
- expected stdout 与第 8 节逐字一致；只输出整数、ASCII label 和 boolalpha。
- `duration_cast` 页面明确“向零截断”，floor/ceil/round 分开讲；负数必须有教学说明。
- 明确 runtime overflow 不由 template constraints 自动检查；覆盖 signed overflow、除/余零、
  floating-to-integral NaN/infinity/out-of-range 与 `abs(min())`。
- 明确 `time_point_cast` 不改变 Clock，`clock_cast` 也不是任意 clocks 间转换。
- 明确 steady 只不下降而非严格增长；period/epoch/resolution/cost 未指定；不能持久化 count。
- 明确 system C++20 才保证 Unix epoch；`is_steady`、native period 与 time_t rounding/truncation
  由实现决定；system clock 不用于 elapsed measurement。
- 终审拒绝：`count()` 恒为秒；所有 conversion 无损；cast 等于 floor；round ties away from zero；
  duration 默认构造恒为零；clock epoch 都是 1970；连续 steady now 必增；steady/system 可直接
  相减；system now 必单调；time_t 必为 Unix 秒；sys_time 自带 timezone；24h 恒等于下一本地日；
  任意 wall-clock/timing-threshold/tzdb/locale-dependent 示例。
