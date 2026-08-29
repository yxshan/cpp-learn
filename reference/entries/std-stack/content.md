# `std::stack`

`std::stack<T>` 是后进先出（LIFO）容器适配器：只允许观察、加入和删除栈顶元素。受限接
口让代码明确表达嵌套、回溯和最近任务优先的处理方式。

## 快速信息

- 头文件：`<stack>`
- 命名空间：`std`
- 标准：C++98 起
- 默认底层容器：`std::deque<T>`

## 什么时候使用

括号匹配、非递归深度优先搜索、撤销记录或显式模拟调用栈时使用 stack。若要处理最早到
达的元素，选择 `std::queue`；需要遍历、从底部读取或访问任意位置时，直接使用 vector 或
deque 往往更诚实。

不要为了避免理解递归而机械改写成 stack。递归深度可能很大、必须显式控制内存或需要保
存额外状态时，显式栈才更有价值。

## 代表性声明

```cpp
template<class T, class Container = std::deque<T>>
class stack {
public:
    bool empty() const;
    size_type size() const;
    reference top();
    void push(const value_type& value);
    void push(value_type&& value);
    template<class... Args> decltype(auto) emplace(Args&&... args);
    void pop();
};
```

这是 C++20 的代表性子集，省略了 `top()` 的 const 重载、构造、赋值、交换和比较接口。
底层容器必须支持 `back()`、`push_back()` 和 `pop_back()`。`deque`、`vector` 和 `list` 都
可满足这些核心要求，但它们的失效、分配和局部性特征不同。

## 返回值与前置条件

`top()` 返回栈顶元素引用，`pop()` 删除栈顶且返回 `void`。空栈上调用二者不满足前置条
件。若需要取出值，应先从 `top()` 复制或移动，再 `pop()`；移动可能抛出时还要考虑操作
顺序和错误恢复。

## 复杂度、生命周期与异常

复杂度和异常行为转发给底层容器的末端操作。默认 deque 的栈顶访问、压栈和弹栈为常数
复杂度。`pop()` 后，指向旧栈顶的引用和指针失效；其他观察位置遵循底层容器规则。

stack 不提供迭代器，也不提供线程同步。跨线程共享需要在更高层建立互斥与所有权协议。

## 示例

“LIFO 顺序”展示最后压入者最先弹出；“分隔符校验”保存尚未匹配的左分隔符，遇到右分隔
符时只检查当前栈顶，展示真实的嵌套状态机。

## 常见错误

- 在空栈上调用 `top()` 或 `pop()`。
- 期待 `pop()` 返回元素。
- 需要迭代内容，却绕过适配器访问其受保护底层成员。
- 保存 `top()` 引用后弹栈，再读取悬空引用。
- 把 stack 当作线程安全的工作栈。

## 与 JavaScript 的区别

JavaScript 数组的 `push`/`pop` 可模拟栈，但数组仍暴露所有索引与遍历操作。`std::stack`
通过类型接口限制可用操作，并继承底层 C++ 对象的值类别和生命周期规则。

## 相关内容

先进先出阅读 `std::queue`；需要直接遍历或随机访问时比较 `std::deque` 与 `std::vector`。

## 来源

stack 的底层容器要求、访问、修改和适配器边界由 Entry manifest 中的 C++ Working Draft
条款验证。
