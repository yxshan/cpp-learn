# `std::filesystem::directory_entry`

`std::filesystem::directory_entry` 拥有一个 path，并可能保存枚举或查询时得到的文件属性缓存。它是
可刷新观察值，不是已打开的文件 handle，也不保证外部对象保持不变。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起；三路比较 C++20
- 所有权：拥有 path；实现可缓存部分属性

## 什么时候使用

目录遍历后需要名称、类型、大小等属性时使用，可能复用枚举阶段已有信息。只需携带路径时使用
`path` 更清楚；需要稳定访问已打开文件时应使用相应 OS/流资源，而不是把 entry 当 handle。

## C++20 代表接口

```cpp
namespace std::filesystem {
class directory_entry {
public:
    directory_entry() noexcept = default;
    explicit directory_entry(const path& p);
    directory_entry(const path& p, std::error_code& ec);

    void assign(const path& p);
    void assign(const path& p, std::error_code& ec);
    void replace_filename(const path& p, std::error_code& ec);
    void refresh();
    void refresh(std::error_code& ec) noexcept;

    const filesystem::path& path() const noexcept;
    bool exists(std::error_code& ec) const noexcept;
    bool is_regular_file(std::error_code& ec) const noexcept;
    std::uintmax_t file_size(std::error_code& ec) const noexcept;
    file_status status(std::error_code& ec) const noexcept;
};
}
```

这是学习用摘要；每个主要 observer 还具有 throwing 重载，完整接口另含其他类型、时间、权限和链接
属性 observer 以及比较操作。

## 参数、要求与缓存副作用

构造、assign 和 replace_filename 接收要观察的 path，并刷新属性；`directory_entry(p, ec)` 出错时
存储 path 为空。实现可能缓存 status、size、link count 或时间，但是否缓存、缓存哪些属性不对调用
者公开。`refresh` 重新查询当前 path，不修改磁盘对象。

## 返回值

`path()` 返回内部 path 的 const 引用，不是副本。属性 observer 在缓存可用时可返回缓存，否则调用
对应 namespace 操作。entry 的比较只比较存储路径，不证明两个路径指向同一文件。

## 复杂度

标准没有为构造、refresh 或 observer 给出统一复杂度或系统调用次数。缓存可能减少访问，但不能据此
承诺 observer 为 O(1) 或永远不访问磁盘。

## 异常与错误

无 `error_code` 的操作按共同模型抛 `filesystem_error`；带 ec 的 observer/`refresh(ec)` 用值通道
报告 OS 错误，其中列出的 observer 为 `noexcept`。分配发生在其他非 noexcept 操作时仍可能抛出。
修改操作出错后，缓存内容可能未指定，不能继续当作成功快照。

## 生命周期与失效规则

外部文件变化不会自动刷新 entry。`path()` 引用依赖 entry；assign、replace、move 或销毁后不能继续
依赖旧引用。refresh 更新观察状态但不延长磁盘对象寿命，旧的复制 entry 也不会收到失效通知。

## 线程安全与竞态

同一 entry 上 refresh/assign 与 observer 并发需要同步；不同 entry 也不能把外部文件系统变成快照。
检查属性后再操作仍有 TOCTOU，目录迭代器也不会自动为当前 entry 调用 refresh。

## 示例

第一个示例建立固定三字节文件并查询名称、类型、大小。第二个示例追加一字节后显式 refresh，再观察
更新后的大小；它不依赖实现是否缓存属性。

## 常见错误

- 把 entry 当成打开文件 handle 或锁。
- 假定所有 observer 永远实时或所有实现缓存同一属性。
- 认为 refresh 会修改磁盘。
- 把 `path()` 返回值当独立副本长期保存。
- 用 entry 相等判断两个 path 是否指向同一文件。
- 忽略带 ec 构造失败后存储 path 为空。

## 与 JavaScript 的区别

> Node `fs.Dirent` 可类比枚举结果包装；C++ entry 还能按需查询更多属性并显式 refresh。两者都不是
> 稳定文件 handle，也不会阻止检查后使用之间的竞态。

## 相关内容

路径值阅读 `std::filesystem::path`；entry 通常来自 `directory_iterator`；只需存在性判断时使用
`std::filesystem::exists`，但不要把结果当锁。

## 来源

缓存、修改、observer、错误和生命周期由 manifest 中的 Working Draft、P0317R1 与 N4659 验证；
cppreference 仅用于二级覆盖核对。
