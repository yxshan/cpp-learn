# `std::transform`

`std::transform` 对输入范围的每个元素调用转换函数，并把结果写到输出范围。它表达的是“一
个输入对应一个输出”，类似数据管道中的映射步骤。

## 快速信息

- 头文件：`<algorithm>`
- 命名空间：`std`
- 标准：C++98 起；经典重载 C++20 起可用于常量求值
- 返回值：写入后的输出尾迭代器

## 什么时候使用

单位换算、提取字段、规范化标签或把两个等长输入逐项合并时使用 transform。需要筛选部分
元素时使用 `copy_if` 等过滤算法；只执行副作用而不产生输出时比较 `for_each`；把整个范围
折叠为一个值时使用 `std::accumulate`。

## 代表性声明

```cpp
template<class InputIt, class OutputIt, class UnaryOperation>
constexpr OutputIt transform(InputIt first, InputIt last,
                             OutputIt result, UnaryOperation op);

template<class InputIt1, class InputIt2, class OutputIt,
         class BinaryOperation>
constexpr OutputIt transform(InputIt1 first1, InputIt1 last1,
                             InputIt2 first2, OutputIt result,
                             BinaryOperation op);
```

这里展示经典非执行策略重载。C++17 的执行策略重载和 C++20 的 `ranges::transform` 具有额
外约束与返回类型，应在需要时单独查阅。

## 范围与输出前置条件

算法不会为输出自动分配存储。传入 `output.begin()` 前，容器必须已经拥有足够的可写元素；
或者使用 `std::back_inserter` 这类插入迭代器。仅调用 `reserve()` 不会改变 vector 的 size，
因此 `reserved.begin()` 仍不是一段可写的 N 元素范围。

`result == first` 的原地一元转换，以及规范允许的对应原地二元场景可以使用；其他未经保证
的输入/输出重叠不应依赖。操作对象不能让参与算法的迭代器或相关子范围失效。

## 返回值、复杂度与异常

返回迭代器指向最后一个写入结果之后，可继续用于追加或检查输出长度。对于 N 个输入元素，
经典重载恰好调用转换函数 N 次。

转换函数、读取或输出赋值抛出的异常会传播。算法不是事务：第 k 次转换失败时，之前的输出
可能已经写入。需要全有或全无时，应先写入临时结果并在成功后提交。

## 生命周期与并发

transform 不接管输入或输出所有权。捕获引用的 lambda 必须保证被捕获对象在整个调用期间
有效。经典重载按调用线程执行，但对同一对象的无同步冲突访问仍会产生数据竞争。

## 示例

“平方值”先创建等长输出 vector；“路由标签”把结构体映射为独立拥有的字符串。两个示例
均按返回顺序输出，不依赖地址、区域设置或外部状态。

## 常见错误

- 只 `reserve` 输出 vector，随后把 `begin()` 当成已存在元素。
- 在 lambda 内向输入 vector 追加，导致迭代器失效。
- 让输出与输入以未经允许的方式部分重叠。
- 忽略可能的部分写入并假设异常时自动回滚。
- 需要过滤却用占位值强行维持一一对应。

## 与 JavaScript 的区别

JavaScript `Array.prototype.map` 自动创建新数组；经典 `std::transform` 接收显式输出迭代器，
可以写入已有存储、插入迭代器或原地范围。调用者负责容量、生命周期和重叠条件。

## 相关内容

聚合为单一结果阅读 `std::accumulate`；按条件逻辑删除阅读 `std::remove_if`；动态连续输出
存储阅读 `std::vector`。

## 来源

重载、调用次数、输出范围和修改限制由 Entry manifest 中的 C++ Working Draft 与 C++20
版本资料验证。
