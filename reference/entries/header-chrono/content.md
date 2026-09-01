# `<chrono>`

`<chrono>` 把时间间隔、某个时钟上的时间点和时钟本身建模为不同类型；C++20 又加入日历、时区与
clock 转换设施。它不是自动启动的 timer、sleep 服务或 event loop。

## 快速信息

- 直接包含：`#include <chrono>`
- 命名空间：`std::chrono`
- 首次标准：C++11
- 本页示例基线：C++20

## 直接包含

使用 chrono 设施时显式包含 `<chrono>`。输出与直接使用 `std::ratio` 时仍分别包含 `<iostream>`、
`<ratio>`；不要依赖 `<chrono>` 的传递包含。

## 主要设施与版本

| 学习目的 | 代表设施 | 版本 | 选择边界 |
|---|---|---|---|
| 表示间隔 | `duration` 与单位 aliases | C++11；字面量 C++14；舍入 C++17 | 不含 epoch/时区 |
| 表示时钟上的点 | `time_point` | C++11；自增减 C++20 | Clock 是类型的一部分 |
| 测量 elapsed/deadline | `steady_clock` | C++11 | 单调但 epoch 未指定 |
| 系统/民用时间 | `system_clock`、`sys_time` | C++11；sys aliases C++20 | C++20 才明确 Unix epoch |
| 日历日期 | `year_month_day`、`sys_days` | C++20 | 24h 不等于所有本地日 |
| 时区转换 | `time_zone`、`zoned_time`、tzdb | C++20 | 数据库可用性是另一边界 |
| clock 转换 | `clock_cast` | C++20 | 需要唯一合法转换路径 |

## 如何选择

间隔/超时用 duration；同一 Clock 上的 deadline 用 time_point；测耗时用 steady_clock；交换系统
时间戳或进入 civil calendar 用 system_clock/sys_time。显示本地时间要显式进入时区层，不要给
system time_point 偷加一个固定 offset。

## 共同安全、复杂度与线程模型

duration/time_point 是拥有值，不持有 timer 资源。具体算术成本由 rep 操作决定，clock `now()` 的
系统调用、分辨率与成本未统一规定。类型单位不能阻止运行时整数溢出、除零或超范围浮点转整数。
并发调用时钟不建立 happens-before；共享数据仍需要 atomic/mutex。

## 示例

第一个示例组合固定 2min30s 并显式转单位。第二个示例只构造 2024-02-29，验证日期并从 sys_days
计算星期；不访问当前时间、locale、环境时区或 tzdb。

## 常见错误

- 用裸整数约定“默认毫秒”，丢失单位类型。
- 认为所有 clock epoch 相同或 high_resolution_clock 必然 steady。
- 用 system_clock 测 elapsed time。
- 认为 `hours{24}` 总是任意本地 civil day 的下一天。
- 假定 C++20 calendar 意味着运行环境一定有最新 tzdb。
- 包含 `<chrono>` 后省略 `<ratio>`/`<iostream>` 的直接包含。

## 与 JavaScript 的区别

> JS 常用 number 毫秒和 `Date`；C++ 把 unit、Clock 与 time point 编入类型。浏览器
> `performance.now()` 接近 steady elapsed 用途，Temporal 的概念拆分也相近，但 epoch、精度、
> 运行环境和 API 合同不能互换。

## 相关内容

单位换算阅读 `duration`；时间点算术阅读 `time_point`；elapsed 选择 `steady_clock`；civil/system
时间进入 `system_clock`。

## 来源

设施、版本、日历/时区、Clock 要求与舍入由 manifest 中的 Working Draft、N2661、N3337、N3642、
P0092R1、N4659、P0355R7、P1466R3 与 N4861 验证；cppreference 仅用于二级覆盖核对。
