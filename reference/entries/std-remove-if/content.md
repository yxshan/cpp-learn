# `std::remove_if`

`std::remove_if` 把谓词为 false 的元素稳定地移动到范围前部，并返回新的“逻辑末尾”。它不
会调用容器的 `erase`，也不会改变容器的 `size()`。

## 快速信息

- 头文件：`<algorithm>`
- 命名空间：`std`
- 标准：C++98 起；经典重载 C++20 起可用于常量求值
- 返回值：保留范围的新尾后迭代器

## 什么时候使用

在 vector、deque 或 string 等可移动赋值的序列中原地过滤元素时使用，并随后调用容器的区
间 `erase`。C++20 对许多标准容器还提供 `std::erase_if(container, pred)` 便利接口。需要
产生独立的过滤副本时，应使用 `copy_if` 或 `remove_copy_if`。

对于 list/forward_list，成员删除操作能直接调整节点，通常比移动值的通用算法更合适。

## 代表性声明

```cpp
template<class ForwardIt, class UnaryPredicate>
constexpr ForwardIt remove_if(ForwardIt first, ForwardIt last,
                              UnaryPredicate pred);
```

元素必须可移动赋值。谓词用于决定“应被移走”的元素，并且不能修改被传入对象或使范围失
效。

## 逻辑删除与物理删除

调用结束后，`[first, new_end)` 是按原相对顺序保留的元素；`[new_end, last)` 仍包含有效对
象，但其值处于未指定状态。不要读取尾段并断言它保存了被删除元素。

对 vector 的完整惯用法是：

```cpp
const auto new_end = std::remove_if(values.begin(), values.end(), pred);
values.erase(new_end, values.end());
```

只有第二行才改变 size，并触发 vector 区间删除自己的迭代器和引用失效规则。

## 复杂度与异常

对 N 个元素恰好调用谓词 N 次，并进行至多线性数量的移动赋值。保留元素的相对顺序不变。

谓词、移动赋值或后续容器 erase 抛出异常时，范围可能已经部分移动；算法不承诺事务回
滚。对异常敏感的状态应先建立临时结果或使用更适合的提交策略。

## 生命周期

算法本身不销毁尾段对象；随后的 erase 才结束这些对象的生命周期。vector erase 会使删除
点及其后的迭代器和引用失效，因此不要在组合操作后继续使用旧位置。

## 示例

“删除负数”和“丢弃过期会话”都先取得逻辑末尾，立即擦除尾段，再遍历当前容器。第二个示
例同时验证保留记录的相对顺序。

## 常见错误

- 只调用 remove_if，看到 `size()` 未变就认为算法失败。
- 读取 `[new_end, end)` 并依赖其中的旧值。
- 忘记元素必须可移动赋值。
- erase 后继续使用旧迭代器或引用。
- 在谓词中直接删除容器元素，导致算法迭代器失效。

## 与 JavaScript 的区别

JavaScript `filter` 通常创建新数组；`remove_if` 在原范围内移动保留值，并把物理缩容留给
容器。它更接近“压紧 + 返回边界”，而不是一次完成的不可变过滤。

## 相关内容

一一转换阅读 `std::transform`；作为典型目标容器阅读 `std::vector`。

## 来源

逻辑尾端、稳定保留、调用次数、尾段状态和容器擦除边界由 Entry manifest 中的 C++
Working Draft 来源验证。
