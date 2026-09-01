# `std::filesystem::remove`

`std::filesystem::remove` 删除一个文件系统对象：普通文件、symlink 本身或空目录。它不递归，并用
bool 区分“实际删除一个对象”和“路径原本不存在”。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起
- ec overload：`noexcept`

## 什么时候使用

明确只删除一个文件、链接或已知空目录时使用。删除整棵目录树应显式选择 `remove_all` 并审查范围；
需要回收站、事务恢复、安全擦除或跨平台 opened-file 语义时需要更高层方案。

## C++20 代表声明

```cpp
bool std::filesystem::remove(const path& p);
bool std::filesystem::remove(const path& p,
                             std::error_code& ec) noexcept;
```

## 参数、前置条件与副作用

p 指定要删除的目录项。函数基于 `symlink_status` 删除 p 本身，所以传入 symlink 删除链接而不是
目标。目录必须为空；非空目录不是本函数的递归工作范围。

## 返回值

成功实际删除一个对象返回 true；路径不存在返回 false，且不是错误。ec overload 发生实际错误也
返回 false，因此必须同时检查 ec。它不返回删除后的 handle、回收标识或可撤销令牌。

## 复杂度

标准没有规定 remove 的专属复杂度、系统调用次数、原子性、事务或耐久保证。它删除一个目录项/链接，
不是按树大小工作的 `remove_all`。

## 异常与错误

throwing overload 对 OS 错误抛 `filesystem_error`。ec overload 为 `noexcept`，成功或已知不存在时
清除旧错误；非空目录、权限或共享限制等实际失败通过 ec 报告。

## 生命周期与失效规则

remove 不拥有 path，也不会更新已有 directory_entry 缓存或 iterator。成功后这些观察值可能陈旧；
已打开文件、hard link 和 Windows sharing 的后续行为取决于 OS/文件系统，标准不作统一扩展保证。

## 线程安全与竞态

先 exists 后 remove 仍可能竞态，应直接调用 remove 并处理 bool/ec。多个执行者操作同一路径可能
形成 filesystem race；遍历过程中删除或重命名还会使迭代观察更难推理。

## 示例

第一个示例写入并显式关闭文件后删除，再查询确认缺失。第二个示例创建空目录并删除两次，展示首次
true、再次 false 且预置 ec 被清除。

## 常见错误

- 认为 remove 会递归删除非空目录。
- 认为传入 symlink 会删除其目标。
- 把 false 一律解释为错误。
- 认为 directory_entry 缓存会收到自动失效通知。
- 假定删除已打开文件在所有 OS 上行为相同。
- 与 `std::remove` 算法或 `<cstdio>` 的 `remove` 混淆。

## 与 JavaScript 的区别

> Node `fs.rmSync(path)` 可近似类比；其 `recursive:true` 更接近 C++ `remove_all`，不是本函数。
> C++ bool 区分实际删除和原本缺失，ec 再区分 OS 错误。

## 相关内容

路径语义阅读 `path`；创建目录使用 `create_directories`；存在性查询使用 `exists`，但不要先查询再
删除；递归删除设施在 `<filesystem>` 总览中单独识别。

## 来源

symlink、空目录、missing、返回、错误和竞态由 manifest 中的 Working Draft 与 N4659 验证；
cppreference 仅用于二级覆盖核对。
