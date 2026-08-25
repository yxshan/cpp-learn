# `std::vector::size`

`size()` 返回 `std::vector` 当前包含的元素数量，而不是已分配容量。

## 快速信息

- 头文件：`<vector>`
- 所属类型：`std::vector`
- 标准：C++98 起
- 复杂度：常数

## 声明

C++20 起：

```cpp
constexpr size_type size() const noexcept;
```

C++20 前没有 `constexpr`，但仍是常数复杂度的只读观察操作。

## 参数

无。

## 返回值

返回无符号的容器 `size_type`，表示元素数量。它不等于 `capacity()`；容量可能更大，以便后续追加减少重新分配。

## 异常与生命周期

该操作不抛异常，也不修改容器，不会使迭代器、指针或引用失效。

## 示例

示例输出包含三个整数的 vector 的大小。

## 常见错误

与有符号整数比较时要留意转换。需要与整数索引协作时，可根据场景使用 C++20 的 `std::ssize`，而不是随意强制转换。

## 与 JavaScript 的区别

用途接近数组的 `length`，但返回类型是容器定义的无符号 `size_type`，而且不能通过给 `size()` 赋值改变容器。

## 相关内容

阅读 `std::vector` 的存储模型和 `push_back` 的容量增长行为。

## 来源

声明、异常和复杂度依据由 Entry manifest 提供。
