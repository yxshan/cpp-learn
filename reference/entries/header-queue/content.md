# `<queue>`

`<queue>` 同时声明两个访问策略不同的容器适配器：先进先出的 `std::queue` 与始终访问当前
最高优先级元素的 `std::priority_queue`。

## 快速信息

- 头文件：`<queue>`
- 命名空间：`std`
- 首次标准：C++98
- 核心选择：到达顺序还是优先级顺序

## 什么时候包含

源文件直接声明 queue 或 priority_queue 时必须显式包含 `<queue>`。底层容器自己的头文件
不能替代适配器头文件；反过来，也不应依赖 `<queue>` 传递包含完整的 vector/deque API。

## 头文件中的主要实体

| 实体 | 默认底层容器 | 可见访问 | 版本提示 |
|---|---|---|---|
| `std::queue<T>` | `std::deque<T>` | `front()`、`back()`，FIFO 弹出 | C++98 |
| `std::priority_queue<T>` | `std::vector<T>` | `top()`，按比较器优先级弹出 | C++98 |
| `queue` 比较运算 | `std::queue` | 比较完整底层序列 | 关系比较 C++98；`<=>` C++20 |
| 非成员 `swap` | 两个适配器 | 转发到成员 `swap` | C++11 |
| allocator 协议 | 两个适配器 | `uses_allocator` 特化 | C++11 |

`std::priority_queue` 没有与 `std::queue` 对应的完整对象比较运算组。

当前 draft 中的范围构造和 `push_range` 晚于 C++20，本项目示例不使用。

## 关键选择边界

queue 保留进入顺序；priority_queue 只保证当前顶部满足堆优先级，不暴露完整排序或等优先
级稳定性。两者都没有公开迭代器，也不提供并发同步。需要遍历或从中间删除时，应直接选择
底层容器或另一种数据结构。

`pop()` 只删除而不返回值；必须在非空时先观察元素。priority_queue 的 `top()` 是 const 引
用，不能作为通用的只移动元素提取接口。

## 头文件边界

`<queue>` 不声明底层堆算法；`push_heap`、`pop_heap` 位于 `<algorithm>`。选择适配器就是
主动接受受限接口，而不是得到底层容器的别名。

## 示例

第一个示例同时建立 FIFO queue 和带数值优先级的 priority_queue，分别输出最早到达项与
最高优先级项。第二个示例持续读取 `top()` 再 `pop()`，展示默认 priority_queue 按 9、4、2
的顺序取出整数。

## 常见错误

- 认为 priority_queue 默认是最小堆。
- 期待 `pop()` 返回被删元素。
- 在空适配器上调用 `front()`、`top()` 或 `pop()`。
- 假设能遍历适配器或稳定处理等优先级元素。
- 把当前 draft 的 `push_range` 当成 C++20。

## 相关内容

继续阅读 `std::queue` 和 `std::priority_queue` 的详细前置条件、复杂度与失效规则。后进先出
处理位于 `<stack>`。

## 来源

头文件 synopsis、两个适配器及其 C++20 边界由 Entry manifest 中的主要来源验证。
