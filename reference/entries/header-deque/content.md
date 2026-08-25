# `<deque>`

`<deque>` 声明 `std::deque` 及其比较、交换和相关辅助操作。

## 快速信息

- 头文件：`<deque>`
- 命名空间：`std`
- 核心类型：`std::deque`
- 标准：C++98 起

## 什么时候使用

直接声明或操作 `std::deque` 时包含此头文件，不要依赖传递包含。

## 代表性声明

```cpp
namespace std {
template<class T, class Allocator = std::allocator<T>>
class deque;
}
```

## 示例

示例分别在容器首尾添加元素，再读取两端。

## 常见错误

“deque”来自 double-ended queue，但 `std::deque` 是支持随机访问的序列容器，
不是 `std::queue` 容器适配器。随机访问也不代表元素连续存储。

当前 synopsis 还包含后来标准加入的辅助接口，不能统一标成 C++98。

## 相关内容

继续阅读 `std::deque` 的复杂度、存储模型和精细失效规则。

## 来源

头文件清单依据由 Entry manifest 提供。
