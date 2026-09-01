# `<filesystem>`

`<filesystem>` 提供路径值、状态查询、目录遍历和同步文件系统操作。它把常见 OS 文件系统能力纳入
标准库，但不提供异步 I/O、事务、目录快照或竞态保护。

## 快速信息

- 直接包含：`#include <filesystem>`
- 命名空间：`std::filesystem`
- 首次标准：C++17，仅 hosted implementation 必须提供
- 本页示例基线：C++20

## 直接包含

使用这些设施时显式包含 `<filesystem>`。文件流、输出、`std::error_code` 和排序仍分别直接包含
`<fstream>`、`<iostream>`、`<system_error>`、`<algorithm>`；不要依赖 `<filesystem>` 的传递包含。

## 主要设施与版本

| 学习目的 | 代表设施 | 版本 | 选择边界 |
|---|---|---|---|
| 表示与拆分路径 | `path` | C++17；char8_t 变化 C++20 | 值对象，不检查磁盘 |
| 观察目录项 | `directory_entry` | C++17；三路比较 C++20 | 可能缓存属性，不是 handle |
| 枚举一层目录 | `directory_iterator` | C++17；ranges opt-in C++20 | 单遍且顺序未指定 |
| 查询状态 | `status`、`exists`、`is_directory` | C++17 | 查询后仍可能竞态 |
| 创建、复制与移动 | `create_directories`、`copy`、`rename` | C++17 | 同步、有外部副作用 |
| 删除对象 | `remove`、`remove_all` | C++17 | 单个删除与递归删除不同 |
| 格式化路径 | `formatter<path>` | C++26 | C++20 不能直接使用 |

## 如何选择

纯路径组合与分解使用 `path`；观察枚举结果使用 `directory_entry`；只遍历直接子项使用
`directory_iterator`，递归需求另选 `recursive_directory_iterator`。要执行目标操作时直接调用
create/remove/open 并处理结果，不要先用 `exists` 构造看似安全的 check-then-act 协议。

## 共同错误与复杂度模型

不带 `error_code&` 的重载把 OS 错误报告为 `filesystem_error`；带 `error_code&` 的重载把预期 OS
错误写入值通道，成功时通常清除旧错误。只有签名明确 `noexcept` 才能排除分配等其他异常。
该头没有统一复杂度或系统调用次数保证，应以具体操作条款为准。

## 生命周期、并发与可移植性

路径值不拥有磁盘对象，查询结果不锁定目标。多个线程、进程或计算机交错访问同一对象可能形成
filesystem race；由本库调用引入这种竞态时行为未定义。native 分隔符、root-name、编码、权限、
大小写和目录顺序均可能依赖平台，跨平台输出优先使用固定 ASCII 相对路径和 generic format。

## 示例

第一个示例只做路径组合，不访问磁盘。第二个示例在隔离相对根中创建目录、查询类型并删除空叶
目录；每一步检查 `error_code`，退出时由 RAII 清理根目录。

## 常见错误

- 把 `path` 当成已打开文件或已验证存在的对象。
- 认为 filesystem 操作异步、原子或自动形成事务。
- 先 `exists` 再 create/remove，忽略两步之间的竞态。
- 把 `error_code` 重载一概描述成不抛异常。
- 依赖目录原生顺序、native 分隔符或实现的传递包含。
- 在 freestanding 环境假定完整文件系统库存在。

## 与 JavaScript 的区别

> Node 的 `node:path` 与 `node:fs` 分别接近词法路径和文件系统操作；C++ 使用强类型 `path`，操作
> 默认同步，错误可走异常或 `error_code`。它不等同于 Promise API，也不会自动消除 TOCTOU。

## 相关内容

路径语义阅读 `std::filesystem::path`；目录观察进入 `directory_entry`/`directory_iterator`；常见
副作用进入 `exists`、`create_directories` 与 `remove`。

## 来源

设施、hosted 边界、错误模型和竞态由 manifest 中的 Working Draft、Filesystem TS、P0218R1 与
N4659 验证；cppreference 仅用于二级覆盖核对。
