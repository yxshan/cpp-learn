# `std::filesystem::exists`

`std::filesystem::exists` 判断一个已取得的 `file_status` 或路径所解析对象是否已知存在。它是瞬时
查询，不取得资源所有权，也不让下一步操作免于竞态。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起
- 路径重载：跟随 symlink，因为基于 `status`

## 什么时候使用

用于展示状态、诊断或在已有 file_status 上复用查询结果。准备 open/create/remove 时通常直接执行
目标操作并处理返回或错误；不要用 exists 作为安全预检查或访问控制边界。

## C++20 代表声明

```cpp
bool std::filesystem::exists(file_status status) noexcept;
bool std::filesystem::exists(const path& p);
bool std::filesystem::exists(const path& p,
                             std::error_code& ec) noexcept;
```

## 参数与查询行为

status overload 只检查传入值，不访问磁盘。path overload 先调用 `status(p)`/`status(p, ec)`，因此
跟随 symlink，再复用 status overload。若已有 directory_entry 或 file_status，可直接使用其状态，
但缓存可能已陈旧。

## 返回值

`exists(status)` 等价于 status 已知且类型不是 `not_found`。因此 regular、directory、symlink 等
已知类型为 true；`not_found` 为 false；`none` 也为 false，但表示状态未知而非确定不存在。

## 复杂度

标准没有规定 path 查询的专属复杂度或系统调用次数。status overload 是纯值判断；复用已取得状态
可避免为了同一时刻的同一判断再次按路径查询，但不会获得未来有效性。

## 异常与错误

throwing path overload 对无法取得状态的 OS 错误抛 `filesystem_error`。`exists(p, ec)` 为
`noexcept`：已知不存在时返回 false 并清除 ec；无法确定状态时返回 false 且 ec 非空。只看 bool
会混淆这两类结果。

## 生命周期与竞态

函数不保存 path/status，也不返回 handle。返回后对象可以立即被删除或替换；先 exists 再
open/remove/create 是 TOCTOU。独立 C++ 值不消除多个线程/进程访问同一外部对象的 filesystem race。

## 示例

第一个示例先取得并检查 file_status，再调用纯值 overload，避免第二次路径查询。第二个示例预置
非零 ec 后查询确定缺失路径，展示 `false + cleared ec` 表示已知不存在。

## 常见错误

- 把所有 false 都解释成确定不存在。
- 使用 ec overload 却不检查 ec。
- 认为 missing 会保留一个错误码。
- 认为查询不跟随 symlink。
- 把结果当成锁、快照或后续操作成功保证。
- 用 exists 预防创建/打开/删除失败。

## 与 JavaScript 的区别

> Node `fs.existsSync()` 只返回 bool 并折叠错误细节；C++ ec overload 能区分已知 missing 与状态
> 未知，但两者都不提供原子 check-then-act 保证。

## 相关内容

状态可能来自 `directory_entry`；路径模型阅读 `path`；实际副作用使用 `create_directories`、
`remove` 或文件流并直接处理结果。

## 来源

status 判断、symlink、ec 清除和竞态由 manifest 中的 Working Draft、N4659 与 LWG 2725 验证；
cppreference 仅用于二级覆盖核对。
