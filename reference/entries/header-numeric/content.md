# `<numeric>`

`<numeric>` 声明数值与顺序折叠算法，包括累加、内积、相邻差、序列生成，以及 C++17 加
入的归约和扫描算法。它不是“所有数学函数”的聚合头文件。

## 快速信息

- 头文件：`<numeric>`
- 命名空间：`std`
- 首次标准：C++98
- 核心选择：确定顺序折叠、可重排归约、前缀扫描或数值序列

## 什么时候包含

使用 `accumulate`、`inner_product`、`adjacent_difference`、`partial_sum`、`iota`，或
C++17 的 reduce/scan 系列时，应显式包含 `<numeric>`。不要依赖 `<algorithm>` 或
`<vector>` 间接提供声明。

## 头文件中的主要实体

| 设施组 | 作用 | 首次标准 |
|---|---|---|
| `accumulate`、`inner_product` | 按顺序折叠或计算内积 | C++98 |
| `partial_sum`、`adjacent_difference` | 前缀累积与相邻差 | C++98 |
| `iota` | 从初值开始连续递增填充范围 | C++11 |
| `reduce`、`transform_reduce` | 允许重排、可带执行策略的归约 | C++17 |
| `exclusive_scan`、`inclusive_scan` 及 transform 版本 | 前缀扫描 | C++17 |
| `gcd`、`lcm`、`midpoint` | 整数/数值辅助 | gcd/lcm C++17；midpoint C++20 |

当前 Working Draft 还可能包含晚于 C++20 的数值设施；使用前要核对项目语言标准。

## 关键选择边界

`accumulate` 保证从左到右折叠，初值类型决定中间和返回类型。`reduce` 允许重排，因此只适
合满足相应结合/交换假设的操作；浮点结果可能不同。扫描算法产生每个前缀的结果，而不是一
个最终值。

`iota` 写入现有范围，不自动扩充空 vector。先建立元素数量，再传可写迭代器。

## 头文件边界

`<numeric>` 不替代 `<cmath>` 的数学函数，也不声明通用 `transform`、`copy`、`sort`。一些
命名相近算法在 `<algorithm>` 中，include 应按实际实体选择。

## 示例

第一个示例先创建四个可写位置，用 C++11 `iota` 填入 4 到 7，再用 `accumulate` 求和。
第二个示例以 `0LL` 为初值累计响应字节数，强调结果类型由初值参与决定。两个算法都显式
来自 `<numeric>`。

## 常见错误

- 认为 `iota` 自 C++98 就存在。
- 用 int 初值累加 64 位数据。
- 把允许重排的 reduce 当成严格左折叠。
- 对空 vector 的 begin 调用 iota，期待自动增长。
- 依赖 `<algorithm>` 传递包含 `<numeric>`。

## 相关内容

继续阅读 `std::accumulate` 的初值类型和折叠顺序。一一映射阅读 `std::transform`；通用算
法设施图阅读 `<algorithm>`。

## 来源

数值设施图与 C++98/C++11/C++17/C++20 边界由 Entry manifest 中的 Working Draft、N4861
与历史草案验证。
