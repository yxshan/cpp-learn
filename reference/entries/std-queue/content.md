# `std::queue`

`std::queue<T>` 是先进先出（FIFO）容器适配器：从队尾加入，从队首读取和移除。它刻意不
提供迭代器，让接口直接表达排队语义。

## 快速信息

- 头文件：`<queue>`
- 命名空间：`std`
- 标准：C++98 起
- 默认底层容器：`std::deque<T>`

## 什么时候使用

任务按到达顺序处理、广度优先搜索或生产者向消费者提交工作时，queue 能把允许操作限制
为 FIFO。需要按优先级而非到达顺序取元素时使用 `std::priority_queue`；需要遍历、按索引
访问或从中间删除时应直接选择合适的底层容器。

queue 本身不提供线程安全。多线程生产者/消费者队列还需要互斥、条件变量、关闭协议和背
压等更完整的抽象。

## 代表性声明

```cpp
template<class T, class Container = std::deque<T>>
class queue {
public:
    bool empty() const;
    size_type size() const;
    reference front();
    reference back();
    void push(const value_type& value);
    void push(value_type&& value);
    template<class... Args> decltype(auto) emplace(Args&&... args);
    void pop();
};
```

这是 C++20 的代表性子集，省略了 `front()`/`back()` 的 const 重载、构造、赋值、交换和
比较接口。底层 `Container` 必须支持 `front()`、`back()`、`push_back()` 和
`pop_front()`，并满足相应序列容器要求。常用的 `deque` 和 `list` 可以作为底层容器。

## 返回值与前置条件

`front()`、`back()` 返回底层元素引用；`pop()` 只删除队首且返回 `void`。因此要取出一个
值，必须先读取或移动 `front()`，再调用 `pop()`。在空 queue 上调用 `front()`、`back()`
或 `pop()` 不满足前置条件，应先检查 `empty()`。

## 复杂度、生命周期与异常

queue 操作的复杂度和异常行为来自对应底层操作。默认 deque 的两端访问与相关入队/出队
操作通常为常数复杂度。不要把这一结论推广到任意自定义底层容器。

从 `front()`/`back()` 得到的引用遵循底层容器的失效规则；`pop()` 后，被删除队首的引用
立即失效。其他观察位置是否保持有效也取决于底层容器，而非 queue 独立提供更强保证。

## 示例

“FIFO 顺序”展示最小的入队与出队；“调度任务”展示按提交顺序处理具名作业。循环均先检
查 `empty()`，读取队首后再删除。

## 常见错误

- 期待 `pop()` 返回被删除的元素。
- 在空队列上访问 `front()`。
- 需要遍历却试图从 queue 获取迭代器。
- 把 queue 当成并发队列，忽略同步和关闭语义。
- 保存队首引用后调用 `pop()`，再继续使用旧引用。

## 与 JavaScript 的区别

JavaScript 常用数组的 `push`/`shift` 模拟队列；`std::queue` 是限制接口的适配器，底层类
型和元素生命周期显式存在。它不会自动为异步任务提供并发安全。

## 相关内容

按优先级处理时阅读 `std::priority_queue`；后进先出时阅读 `std::stack`；需要直接访问底
层序列时比较 `std::deque`。

## 来源

queue 的底层容器要求、元素访问、修改器和适配器语义由 Entry manifest 中的 C++
Working Draft 来源验证。
