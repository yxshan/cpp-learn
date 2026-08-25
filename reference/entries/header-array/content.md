# `<array>`

`<array>` 声明固定大小容器 `std::array`，以及比较、交换、创建和 tuple 风格访问等
相关接口。

## 快速信息

- 头文件：`<array>`
- 命名空间：`std`
- 核心类型：`std::array`
- 标准：C++11 起

## 什么时候使用

代码直接声明或操作 `std::array` 时包含该头文件。元素数量是编译期常量并且是类型
的一部分；需要运行时改变大小时应考虑 `std::vector`。

## 代表性声明

```cpp
namespace std {
template<class T, std::size_t N>
struct array;
}
```

当前头文件还包含后来标准加入的接口。不能因为 `std::array` 起源于 C++11，就把
当前 synopsis 中每个声明都标成 C++11。

## 示例

示例对固定的三个整数求和。

## 常见错误

`<array>` 不等于语言内建数组语法。它提供标准容器接口，但大小仍不能在运行时增长。

## 相关内容

继续阅读 `std::array` 的固定大小、连续存储和零长度规则。

## 来源

头文件实体清单依据由 Entry manifest 提供。
