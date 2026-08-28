# `<deque>`

`<deque>` 声明双端序列容器 `std::deque` 及其比较、交换、擦除和内存资源别名。deque
支持随机访问并针对首尾修改优化，但标准不把它规定为连续容器。

## 快速信息

- 头文件：`<deque>`
- 命名空间：`std`、`std::pmr`
- 核心类型：`std::deque`
- 首次标准：C++98

## 什么时候包含

当前源文件直接声明或操作 `std::deque`，或者调用本头文件声明的 `std::erase`、
`std::erase_if` 等非成员接口时，应包含 `<deque>`。标准只要求头文件可靠提供自身
synopsis 与明示传递内容，详见
[`[res.on.headers]`](https://eel.is/c++draft/res.on.headers)；不要依赖 `<queue>`、框架头文件
或另一个容器头文件偶然带入它。

## 头文件中的主要实体

| 实体组 | 作用 | 版本提示 |
|---|---|---|
| `std::deque<T, Allocator>` | 支持随机访问和双端修改的序列容器 | C++98 |
| `operator==`、`operator<=>` | 按容器值比较 | `==` C++98；`<=>` C++20 |
| `std::swap` | 交换两个 deque | C++98 |
| `std::erase`、`std::erase_if` | 按值或谓词擦除元素 | C++20 |
| `std::pmr::deque<T>` | 使用 `polymorphic_allocator` 的别名 | C++17 |

代表性主模板声明为：

```cpp
namespace std {
template<class T, class Allocator = allocator<T>>
class deque;
}
```

当前 [`<deque>` synopsis](https://eel.is/c++draft/deque.syn) 混合了多个版本的设施，表格
按学习用途分组，而不是复制整面声明墙。

## 核心行为预览

deque 提供常数时间随机访问；在首尾插入或删除单个元素为常数时间，中间修改为线性。
随机访问只规定操作能力和复杂度，并不推出元素地址连续，deque 也没有将整个容器暴露为
单一 `data()` 范围。详见 [`[deque.overview]`](https://eel.is/c++draft/deque.overview)。

最重要的导航边界是：在任一端插入会使所有旧迭代器失效，但指向已有元素的引用和指针
保持有效；在中间插入则两类观察位置都失效。删除端点、删除中间和旧 `end()` 的规则更加
精细，应进入 `std::deque` 类型页核对，避免头文件页维护第二份操作矩阵。完整条件见
[`[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)。

## 头文件边界

“double-ended queue” 描述的是可在两端操作的序列；`std::deque` 不是 FIFO 适配器
`std::queue`，后者在 `<queue>` 中声明。通用算法也有各自的头文件。

## 示例

最小示例从首尾加入元素并读取两端；第二个示例保存元素引用后继续在两端插入，只使用
标准仍保证有效的引用，不会尝试观察已经失效的迭代器。

## 常见错误

- 把 `<deque>` 与声明 `std::queue` 的 `<queue>` 混淆。
- 因为 deque 支持下标访问，就把它传给要求连续缓冲区的接口。
- 认为端点插入后旧引用和旧迭代器会一起保持有效。
- 认为在 deque 任意位置插入都是 O(1)。
- 在 C++17 项目中使用 C++20 的非成员 `std::erase_if`。

## 相关内容

继续阅读 `std::deque` 的完整异常与失效规则；需要连续存储时比较 `std::vector`，选型
不确定时阅读“选择顺序容器”。

## 来源

头文件实体、deque 概览、修改复杂度和精细失效规则由 Entry manifest 中的主要来源验证。
