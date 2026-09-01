# `std::filesystem::directory_iterator`

`std::filesystem::directory_iterator` 同步枚举一个目录的直接子项。它是单遍输入迭代器，枚举顺序
未指定，不递归，也不提供目录快照。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起；C++20 opt in 为 ranges view 与 borrowed range
- 元素：`const directory_entry&`

## 什么时候使用

只需逐个处理直接子项时使用。需要稳定展示时复制 filename/path 后排序；需要递归时选择
`recursive_directory_iterator`；需要多遍、快照或在遍历中安全修改目录时应建立更高层协议。

## C++20 代表接口

```cpp
namespace std::filesystem {
class directory_iterator {
public:
    using iterator_category = std::input_iterator_tag;
    using value_type = directory_entry;
    using reference = const directory_entry&;

    directory_iterator() noexcept; // end condition
    explicit directory_iterator(const path& p);
    directory_iterator(const path& p, directory_options options);
    directory_iterator(const path& p, std::error_code& ec);
    directory_iterator(const path& p, directory_options options,
                       std::error_code& ec);
    const directory_entry& operator*() const;
    directory_iterator& operator++();
    directory_iterator& increment(std::error_code& ec);
};
}
```

这是学习用摘要；完整接口还包含复制/move、箭头、比较、非成员 begin/end 和 ranges opt-in。

## 参数、前置条件与副作用

p 指定要枚举的目录；options 可控制跟随目录 symlink 或跳过权限拒绝。默认构造产生 end，空目录
构造也直接得到 end。end 不可解引用；递增或解引用 end 不满足迭代器前置条件。遍历不产生 `.`/`..`。

## 返回值与单遍语义

解引用返回当前内部 `directory_entry` 的 const 引用。复制 iterator 可能共享遍历状态，不会得到
独立 cursor；递增一个副本可能影响另一个副本。要跨递增保存结果，应复制 entry 或 path 值。

## 复杂度

专属条款没有规定整个遍历的总复杂度或每次递增的系统调用数。输入迭代器类别描述多遍能力，不是
文件系统访问成本的 O(1) 保证。

## 异常与错误

throwing 构造/递增按共同模型抛 `filesystem_error`。ec 构造和 `increment(ec)` 报告预期 OS 错误，
但 C++20 中不是 `noexcept`，仍可能因分配失败抛出；错误或越过末项后 iterator 变为 end。

## 生命周期与失效规则

当前元素引用及其 `path()` 引用依赖 iterator 的当前状态；increment、move、赋值或销毁后不要继续
使用。构造后目录增加/删除对象时是否被观察到未指定，entry 缓存也不会自动 refresh。

## 线程安全与竞态

同一 iterator 或共享遍历状态的副本不能无同步并发递增/解引用。不同 iterator 操作同一外部目录
也不构成快照；遍历中删除或重命名条目尤其容易形成 filesystem race。

## 示例

两个示例都把 filename 复制到 vector 后排序。第一个建立两个文件；第二个建立一个文件和一个含
文件的子目录，证明普通 iterator 只返回两个直接子项而不进入 nested。

## 常见错误

- 依赖枚举按文件名排序。
- 把普通 iterator 当递归遍历或多遍 forward iterator。
- 复制 iterator 后假定获得独立 cursor。
- 保存元素引用后递增 iterator。
- 认为构造时冻结了目录快照。
- 遍历中直接删除对象而忽略竞态与失效。

## 与 JavaScript 的区别

> Node `fs.opendir`/`fs.Dir` 可类比逐项枚举；C++ directory_iterator 是同步 single-pass range。
> Node `readdir({withFileTypes:true})` 同样不应被理解成已排序的目录快照。

## 相关内容

元素模型阅读 `directory_entry`；路径值阅读 `path`；递归需求使用 `<filesystem>` 中的
`recursive_directory_iterator`。

## 来源

单遍、顺序、修改中目录、错误与 C++20/C++23 边界由 manifest 中的 Working Draft、N4659 与
LWG 3013/3480/3719 验证；cppreference 仅用于二级覆盖核对。
