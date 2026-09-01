# `std::filesystem::create_directories`

`std::filesystem::create_directories` 沿 path 逐级创建缺失目录，类似递归 mkdir。它的 bool 返回值
区分“最终目录由本次新建”和“没有新建最终目录”，不等同于成功/失败二值。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起
- 复杂度：O(n)，n 为 path element 数量

## 什么时候使用

需要确保多层父目录存在时直接调用。只需创建单层目录可使用 `create_directory`；需要事务回滚、
权限策略或安全边界时应设计更高层协议，不要用先 exists 再 create 伪造原子性。

## C++20 代表声明

```cpp
bool std::filesystem::create_directories(const path& p);
bool std::filesystem::create_directories(const path& p,
                                         std::error_code& ec);
```

注意 C++20 的 ec overload **不是** `noexcept`。

## 参数、前置条件与副作用

p 是要建立的最终目录路径。函数对每个尚不存在的 path element 调用 create_directory，因此可能
先建立若干父目录；如果后续步骤失败，标准不承诺事务回滚。中间元素不是可遍历目录时会报告错误。

## 返回值

当且仅当最终目录由本次调用新建时返回 true。目标目录已存在时返回 false 且不是错误；ec overload
发生 OS 错误也返回 false，因此必须同时检查 ec。不要只由 false 推导最终对象类型，依赖其类型时
应按协议另行查询。

## 复杂度

标准明确为 O(n)，n 是 p 的 path element 数量。这不是 n 次系统调用、固定耗时或磁盘成本保证；
路径解析、分配和文件系统实现仍会影响实际成本。

## 异常与错误

throwing overload 对 OS 错误抛 `filesystem_error`。ec overload 把预期 OS 错误写入 ec，成功或
已存在时清除旧值，但 LWG 3014 移除了 `noexcept`，临时路径或缓冲分配失败仍可抛异常。

## 生命周期与竞态

函数不返回 handle，也不延长目录寿命。多个调用者并发创建同一路径时必须处理实际返回/ec；先
exists 后 create 仍有 TOCTOU。调用完成后目录也可能被其他进程删除或替换。

## 示例

第一个示例创建两层目录并单独验证类型。第二个示例连续创建同一路径：首次 true，第二次 false，
且预置的旧 ec 被清除，展示 false 并不自动表示失败。

## 常见错误

- 认为只创建最后一级或要求父目录预先存在。
- 把 false 一律解释为失败。
- 忘记 ec overload 仍可能抛分配异常。
- 认为失败会自动删除已经创建的父目录。
- 把 O(n) 解释为严格 n 次系统调用。
- 先 exists 再 create 并声称避免竞态。

## 与 JavaScript 的区别

> Node `fs.mkdirSync(path, {recursive:true})` 可类比递归创建，但返回值和错误细节不同。C++ bool
> 表示最终目录是否新建，ec 另行承载预期 OS 错误。

## 相关内容

路径模型阅读 `path`；查询类型可使用 `<filesystem>` 状态函数；删除空目录使用 `remove`；不要把
`exists` 预检查当成并发协议。

## 来源

逐级副作用、返回、O(n)、错误与缺陷修正由 manifest 中的 Working Draft、N4659、LWG 2935、
P1164R1 与 LWG 3014 验证；cppreference 仅用于二级覆盖核对。
