# `<utility>`

`<utility>` 汇集标准库中反复使用的基础值工具：二元值、交换、显式值类别转换、完美转发和
少量编译期辅助设施。它是学习现代 C++ 值语义的入口，不是可以忽略边界的“杂物箱”。

## 快速信息

- 头文件：`<utility>`
- 主要命名空间：`std`
- 首次标准：C++98
- 本页基线：C++20；当前草案中的后续设施会单独标注

## 直接包含

```cpp
#include <utility>
```

直接使用本页设施时应显式包含 `<utility>`。不要依赖 `<memory>`、容器头文件或框架预编译头
偶然传递包含它；某个名字在当前实现中“顺带可见”不是可移植合同。

## 什么时候使用

需要表达二元值、交换对象、把命名对象交给消费型 API，或在泛型包装器中保留参数值类别时，
从本页进入对应实体。逐元素移动一个迭代器范围属于 `<algorithm>` 中的算法 `std::move`，不
是本页的值类别转换函数。

## 主要设施与版本

| 学习目的 | 代表设施 | 版本 | 下一步 |
|---|---|---|---|
| 二元异构值 | `pair`、`make_pair` | C++98 | 阅读 `std::pair` |
| 值交换 | 通用 `swap`、数组 `swap` | C++98 / C++11；C++20 `constexpr` | 阅读 `std::swap` |
| 值类别转换 | `move`、`move_if_noexcept` | C++11 | 阅读 `std::move` |
| 完美转发 | `forward` | C++11 | 阅读 `std::forward` |
| 替换并返回旧值 | `exchange` | C++14 | 状态和句柄更新 |
| 编译期索引序列 | `integer_sequence`、`index_sequence` | C++14 | 参数包展开 |
| 只读左值视图 | `as_const` | C++17 | 选择 const 重载 |
| 原位构造标签 | `in_place` 家族 | C++17 | optional/variant/any 构造 |
| 安全整数比较 | `cmp_equal`、`cmp_less`、`in_range` | C++20 | 有符号/无符号比较 |

这是学习导向的设施地图，不是完整 synopsis。`forward_like`、`to_underlying` 等晚于 C++20 的
设施不属于本项目的 C++20 声明基线。

## 关键边界

`std::move` 和 `std::forward` 都返回引用表达式，本身不移动对象，也不延长生命周期；真正的
资源转移发生在后续构造、赋值或函数调用中。泛型交换还涉及 ADL，不能简单把所有调用都写成
限定名 `std::swap`。

## 示例

第一个示例用 `std::exchange` 取得旧状态并安装新状态。第二个示例组合 `std::pair` 与标量
`std::swap`，展示同一头文件中两类不同职责的设施。两者均使用确定性 C++20 输出。

## 常见错误

- 把值类别转换 `std::move(value)` 与三迭代器范围算法混为一谈。
- 认为 `std::move` 单独调用就会清空对象。
- 在普通业务函数中滥用 `std::forward`，却没有 forwarding reference。
- 在泛型代码中写死 `std::swap`，绕过关联命名空间中的定制。
- 因其他头文件当前能编译而省略直接包含 `<utility>`。

## 与 JavaScript 的区别

> JavaScript/TypeScript 的模块导入负责模块依赖，不能等同于 C++ 预处理阶段提供声明的
> `#include`。JS 也没有 lvalue/xvalue、引用折叠或基于值类别选择移动重载的语言模型。

## 相关内容

按学习顺序阅读 `std::pair`、`std::swap`、`std::move` 和 `std::forward`。需要所有权类型时进入
`<memory>`；需要作用于迭代器范围的算法时进入 Algorithms。

## 来源

设施集合、直接包含、C++98/11/14/17/20 版本边界由 Entry manifest 中的 Working Draft、历史
草案与 WG21 提案验证；cppreference 只用于二级结构核对。
