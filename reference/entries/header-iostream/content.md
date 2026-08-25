# `<iostream>`

`<iostream>` 声明程序最常用的预定义标准输入输出流，包括 `std::cin`、
`std::cout`、`std::cerr` 和 `std::clog`，以及对应的宽字符流对象。

## 快速信息

- 头文件：`<iostream>`
- 命名空间：`std`
- 标准：C++98 起
- 主要实体：标准输入、输出和诊断流对象

## 什么时候使用

程序需要通过标准输入读取数据，或向标准输出、标准错误输出写入文本时，直接包含
`<iostream>`。不要依赖其他头文件间接包含它。

## 代表性声明

```cpp
namespace std {
extern istream cin;
extern ostream cout;
extern ostream cerr;
extern ostream clog;
}
```

这只是窄字符流对象的代表性声明，不是该头文件的完整清单。

## 生命周期与并发

标准流对象在进入 `main` 前已经建立关联，并且不会在程序执行期间被销毁。保持与 C
标准流同步时，对这些对象的并发访问不会产生数据竞争，但不同线程输出的字符仍可能
互相穿插；“无数据竞争”并不等于“每行原子输出”。

## 示例

示例包含 `<iostream>` 并使用 `std::cout` 输出一行确定性文本。

## 常见错误

`<iosfwd>` 只提供部分前置声明，不能替代 `<iostream>` 来完成常规流输入输出。
宽字符流也不是自动解决 Unicode 编码问题的方案，字符编码与 locale 需要另行理解。

## 相关内容

继续阅读 `std::cout` 的输出状态和 `std::cin` 的输入状态模型。

## 来源

头文件清单、初始化和生命周期依据由 Entry manifest 提供。
