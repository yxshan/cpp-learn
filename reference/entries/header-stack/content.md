# `<stack>`

`<stack>` 声明后进先出（LIFO）的 `std::stack` 容器适配器。它只暴露栈顶相关操作，隐藏底
层容器的迭代和随机位置访问。

## 快速信息

- 头文件：`<stack>`
- 命名空间：`std`
- 首次标准：C++98
- 核心类型：`std::stack<T, Container>`

## 什么时候包含

直接声明 `std::stack` 时显式包含 `<stack>`。即使默认底层是 deque，`#include <deque>` 也
不保证声明 stack；同样不要依赖 `<stack>` 传递包含完整 deque/vector 接口。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::stack<T, Container>` | `top`/`push`/`pop` 的 LIFO 适配器 | C++98 |
| 关系比较 | 比较底层容器表示的两个 stack | C++98；三路比较 C++20 |
| `std::swap` | 交换两个 stack | C++11 提供专门重载 |

当前 draft 的范围构造、`push_range` 和全面 constexpr 化都晚于 C++20，不能用于本项目
C++20 示例。

## 关键选择边界

stack 默认包装 `std::deque`，也可使用满足 `back`、`push_back` 与 `pop_back` 要求的其他
序列容器。复杂度、异常与观察位置失效来自所选底层类型。

stack 没有迭代器。若业务需要列出整个历史、读取栈底或删除中间项，直接使用 vector/deque
更符合真实需求。`top()`/`pop()` 要求非空，且 `pop()` 不返回被删除值。

## 头文件边界

`<stack>` 不是语言调用栈接口，也不负责递归深度、线程同步或撤销事务。它只是标准容器适
配器。

## 示例

示例按 home、search、details 顺序压栈，再按相反顺序弹出，展示明确的 LIFO 页面回退。

## 常见错误

- 在空栈上调用 `top()`。
- 期待 `pop()` 返回元素。
- 需要遍历却选择 stack。
- 把适配器误认为线程安全工作栈。
- 把 C++23/26 的新增接口误标成 C++20。

## 相关内容

继续阅读 `std::stack`。先进先出与优先级处理阅读 `<queue>`；需要公开迭代器时比较
`std::deque` 和 `std::vector`。

## 来源

头文件 synopsis、底层要求与版本边界由 Entry manifest 中的 C++ 标准资料验证。
