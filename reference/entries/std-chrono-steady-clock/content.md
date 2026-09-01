# `std::chrono::steady_clock`

`std::chrono::steady_clock` 是不会随 physical time 前进而倒退、以相对 real time 稳定速率推进的
时钟。它适合测量间隔和建立 deadline，不适合显示民用日期或持久化时间戳。

## 快速信息

- 头文件：`<chrono>`
- 命名空间：`std::chrono`
- 标准：C++11 起
- `is_steady`：标准保证为 true

## 什么时候使用

测 elapsed time、relative timeout 和不应受 wall-clock 调整影响的 deadline 时使用。需要数据库/
协议时间戳或日历显示时使用 system_clock；高分辨率诉求不能只凭 `high_resolution_clock` 名称判断。

## C++20 代表接口

```cpp
class steady_clock {
public:
    using rep = /* implementation-defined */;
    using period = std::ratio</* implementation-defined */>;
    using duration = std::chrono::duration<rep, period>;
    using time_point = std::chrono::time_point<steady_clock, duration>;
    static constexpr bool is_steady = true;
    static time_point now() noexcept;
};
```

## 返回值与单调合同

`now()` 返回拥有的 steady time_point。随着 physical time 前进，其值不下降，并以稳定速率推进；
这不保证每次调用严格增大，有限分辨率可让连续结果相等。

## 表示、参数与可移植性

rep、period、epoch、范围和实际 resolution 都由实现选择。steady epoch 不保证是进程启动、boot
时间或跨进程稳定点；count 不适合持久化，也没有标准 steady↔system 转换。

## 复杂度

标准没有规定 `now()` 的 complexity、系统调用数或固定成本。period 也不等于实际 precision；测量
极短代码仍需合理 benchmark 方法和统计。

## 异常与范围

`now()` 为 `noexcept`。返回后的 time_point 算术仍继承 duration 的 signed overflow、极值和单位
转换边界；steady 单调性不会自动饱和 count。

## 生命周期与线程安全

时钟 API 不返回悬空引用，time_point 是值。多线程可调用 now，但“时钟单调”不是 memory-order
synchronization，不能替代 mutex/atomic 或建立 happens-before。

## 示例

第一个示例只输出标准保证的 compile-time Clock 属性。第二个示例构造固定 steady-tagged 起点、
deadline 和 finished，不调用 now/sleep，也不伪造真实时间流逝。

## 常见错误

- 认为 epoch 是进程启动或 period 一定为纳秒。
- 假定连续 now 严格不同。
- 把 steady 等同于 high resolution。
- 持久化 steady count 并跨进程解释。
- 认为 steady 可直接转换为 system_clock/date。
- 用一次极短测量声称得到可靠 benchmark。

## 与 JavaScript 的区别

> 浏览器 `performance.now()` 最接近 elapsed-time 用途；二者都不应当作 civil timestamp。JS 的
> time origin、number unit/precision 与 C++ 的 Clock/period 合同不同，count 不能互换。

## 相关内容

间隔与换算阅读 `duration`；deadline 类型阅读 `time_point`；wall/civil 时间使用 `system_clock`。

## 来源

单调性、Clock 要求、线程 timing 与并发边界由 manifest 中的 Working Draft、N2661、N3337、
N4659 与 N4861 验证；cppreference 仅用于二级覆盖核对。
