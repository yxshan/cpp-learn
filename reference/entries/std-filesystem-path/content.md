# `std::filesystem::path`

`std::filesystem::path` 是 pathname 的平台感知值对象。它能组合、拆分和词法正规化路径，但构造
对象不会访问磁盘，也不保证文本指向的对象存在。

## 快速信息

- 头文件：`<filesystem>`
- 命名空间：`std::filesystem`
- 标准：C++17 起；`char8_t` 返回类型变化 C++20；formatter C++26
- 所有权：拥有自身 native path representation

## 什么时候使用

API 需要传递或处理路径时优先使用 path，而不是手工拼 string。只想处理 URL、虚拟资源键或与 OS
pathname 无关的标识符时不要使用；需要确认实际对象身份或解析 symlink 时应调用相应文件系统操作。

## C++20 代表接口

```cpp
namespace std::filesystem {
class path {
public:
    using value_type = /* operating-system-dependent character type */;
    using string_type = std::basic_string<value_type>;

    path() noexcept;
    path(const path&);
    path(path&&) noexcept;
    template<class Source> path(const Source& source, format fmt = auto_format);

    path& operator/=(const path& child);
    path& operator+=(const path& suffix);
    const string_type& native() const noexcept;
    std::string generic_string() const;
    std::u8string u8string() const; // C++20
    path parent_path() const;
    path filename() const;
    path stem() const;
    path extension() const;
    path lexically_normal() const;
};
}
```

这是学习用摘要；完整接口还包含赋值、替换、比较、迭代、其他字符类型转换和词法相对操作。

## 参数、要求与副作用

Source 必须是标准允许的 encoded character sequence；空指针不满足要求。`/=` 按路径元素合并，
若右侧为绝对路径或 root-name 不兼容，结果可能替换左侧；`+=` 只拼 native representation，不保证
插入 separator。上述值操作都不查询或修改磁盘。

## 返回值与表示

`parent_path()`、`filename()`、`stem()`、`extension()` 和 `lexically_normal()` 返回拥有的 path
值；`native()` 返回内部 string 的 const 引用。native 字符类型、编码、separator 和 root-name
取决于 OS；`string()` 不能被跨平台地宣称为 UTF-8。C++20 的 `u8string()` 返回 `std::u8string`。

## 复杂度

标准只为个别操作给出明确界限，例如 `swap` 为常数复杂度。构造、分解、组合、转换和
`lexically_normal()` 没有一条可统一套用的大 O 或零分配保证。

## 异常与错误

字符串转换和分配可以抛异常；无法表示的字符转换受平台编码合同约束。纯词法操作不通过
`error_code` 报告磁盘问题，因为它们根本不访问磁盘。

## 生命周期与失效规则

`native()` 引用、`c_str()` 指针和 element iterator 依赖 path 对象内容；任何非 const member 会
使该对象的所有 element iterator 失效，修改也可能使内部引用/指针失效。move 后源仍有效但状态未
指定。返回的分解 path 是独立拥有值。

## 线程安全与可移植性

不同 path 值可独立使用；同一对象并发修改或一读一写需要同步。相同文本可能因 current path、
挂载、大小写和外部状态变化解析到不同对象。跨平台断言使用相对 ASCII 和 `generic_string()`。

## 示例

第一个示例拆分固定相对路径；第二个示例展示 `/` 合并后再做纯词法正规化。两者都不访问磁盘，
也不把正规化误写成 canonical/symlink 解析。

## 常见错误

- 认为构造 path 会检查存在性。
- 把 `/` 和 `+=` 当作相同的字符串拼接。
- 认为 `lexically_normal()` 会访问磁盘或解析 symlink。
- 假定 `string()` 永远返回 UTF-8。
- 保存 `native()` 引用或 iterator 后继续修改原 path。
- 在跨平台测试中断言 native separator、drive 或 root-name。

## 与 JavaScript 的区别

> Node `path.join`/`normalize` 可类比词法组合，但返回普通 string；C++ path 拥有 OS 相关 native
> representation，并有内部引用和 iterator 失效规则。两边的 normalize 都不等于 realpath。

## 相关内容

设施地图阅读 `<filesystem>`；磁盘对象观察使用 `directory_entry`；实际存在性查询使用 `exists`；
文件流接收 path 的版本边界阅读 `<fstream>`。

## 来源

路径语法、转换、组合、迭代失效和版本边界由 manifest 中的 Working Draft、N4659、P0482R6、
N4861 与 P2845R8 验证；cppreference 仅用于二级覆盖核对。
