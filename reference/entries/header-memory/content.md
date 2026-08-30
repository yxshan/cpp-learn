# `<memory>`

`<memory>` 是标准库资源管理设施的入口，覆盖智能指针、对象创建、分配器、指针 traits 和
未初始化存储算法。它不等同于“所有东西都应动态分配”。

## 快速信息

- 头文件：`<memory>`
- 主要命名空间：`std`
- 首次标准：C++98
- C++11 关键扩展：标准智能指针与现代所有权工厂

## 直接包含

```cpp
#include <memory>
```

不要依赖容器、算法或框架头文件偶然传递包含 `<memory>`；首次使用智能指针或本页设施前应直接
包含其所属头文件。

## 主要设施与版本

| 设施组 | 代表实体 | 版本 | 核心责任 |
|---|---|---|---|
| 独占所有权 | `unique_ptr`、`make_unique` | C++11 / C++14 | 一个所有者，可移动不可复制 |
| 共享所有权 | `shared_ptr`、`make_shared` | C++11 | 控制块协调共同所有者 |
| 非拥有观察 | `weak_ptr` | C++11 | 观察共享控制块，不增加强引用计数 |
| 从自身取得共享所有权 | `enable_shared_from_this` | C++11 | 对象必须已经处于合适的 shared ownership group |
| 分配器模型 | `allocator`、`allocator_traits`、`uses_allocator` | C++98 / C++11 | 分离存储获取、对象构造与 allocator-aware 协议 |
| allocator-aware 共享创建 | `allocate_shared` | C++11 | 由调用者提供 allocator；不同于 make_shared |
| 指针元数据与取地址 | `pointer_traits`、`addressof`、`to_address` | C++11 / C++11 / C++20 | 统一原始和 fancy pointer 访问 |
| 未初始化存储 | `uninitialized_copy`、`destroy`、`construct_at` | C++98 / C++17 / C++20 | 在原始存储中显式管理对象生命周期 |
| 对齐工具 | `align`、`assume_aligned` | C++11 / C++20 | `assume_aligned` 只适用于满足其窄前置条件的地址 |
| 原子智能指针 | `atomic<shared_ptr<T>>`、`atomic<weak_ptr<T>>` | C++20 | 协调同一智能指针值的并发发布，不保护 T 的字段 |

C++20 已包含 `make_shared` 数组重载、`*_for_overwrite` 和原子智能指针。当前 Working Draft 还
包含晚于 C++20 的 constexpr 智能指针及更多生命周期工具。正文与示例必须按实体逐项标版本，
不能把整个现代 synopsis 统一标成 C++11 或 C++20。

## 所有权选择

1. 能直接按值或作为成员保存对象时，优先不使用动态分配。
2. 只有一个释放责任时使用 unique_ptr。
3. 确实存在无法自然归属单一对象的共同生命周期时才使用 shared_ptr。
4. 观察共享对象但不能延长其生命周期时使用 weak_ptr。

引用计数不能自动解决所有图结构：两个对象互持 shared_ptr 会形成环，使强计数永远不归零。
至少一条非拥有边应改为 weak_ptr，或者重新设计所有权方向。

## 示例

示例同时建立 unique_ptr 与 shared_ptr，展示独占值和两个共享所有者。`use_count()` 只用于教学
观察；并发程序不应据此做“最后一个所有者”的竞争性决策。

## 常见错误

- 为所有局部对象无条件使用智能指针。
- 从同一裸指针分别构造两个 shared_ptr，创建两个不相干控制块。
- 认为 weak_ptr 能直接解引用。
- 把引用计数线程安全误解为被管理对象自动线程安全。

## 与 JavaScript 的区别

> JavaScript 通常由垃圾回收器追踪对象可达性；C++ 智能指针编码显式所有权。最后一个强所有者
> 消失时对象按确定时机析构，但 shared_ptr 环不会像追踪式 GC 那样自动被识别。

## 相关内容

独占路径阅读 `unique_ptr`/`make_unique`；共享路径阅读 `shared_ptr`、`weak_ptr`、`make_shared`。

## 来源

设施分组和版本边界由 manifest 的 Working Draft 与版本化 WG21 文本核实；cppreference 仅作为
学习页面覆盖范围的二级参考。
