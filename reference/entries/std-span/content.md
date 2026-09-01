# `std::span`

`std::span<ElementType, Extent>` 借用一段连续对象序列。它把 pointer 与长度合同组合成
view，但不拥有、不分配、不销毁元素，也不会延长 array、vector 或其他 owner 的生命周期。

## 快速信息

- 头文件：`<span>`
- 命名空间：`std`
- 标准：C++20 起
- range 模型：contiguous、sized、view、borrowed_range

## 什么时候使用

函数需要接收调用方已有的原生数组、`std::array`、vector 或其他连续范围，而不取得所有权时
使用 span。它适合替代容易分离的 `(pointer, count)` 参数。需要保存、增长或独立拥有元素时
使用 owning container；list/forward_list 不连续，不能构造 span。

## C++20 代表接口

```cpp
template<class ElementType, std::size_t Extent = std::dynamic_extent>
class span {
public:
    using element_type = ElementType;
    using value_type = std::remove_cv_t<ElementType>;
    using size_type = std::size_t;
    using pointer = element_type*;
    using reference = element_type&;
    using iterator = /* contiguous iterator */;
    static constexpr size_type extent = Extent;

    constexpr span() noexcept;
    template<class It>
    constexpr explicit(Extent != std::dynamic_extent)
    span(It first, size_type count);
    template<std::size_t N>
    constexpr span(element_type (&array)[N]) noexcept;
    template<class T, std::size_t N>
    constexpr span(std::array<T, N>& array) noexcept;
    template<class R>
    constexpr explicit(Extent != std::dynamic_extent) span(R&& range);

    template<std::size_t Count> constexpr auto first() const;
    template<std::size_t Offset,
             std::size_t Count = std::dynamic_extent>
    constexpr auto subspan() const;
    constexpr span<element_type> subspan(size_type offset,
                                         size_type count = std::dynamic_extent) const;
    constexpr size_type size() const noexcept;
    constexpr size_type size_bytes() const noexcept;
    constexpr reference operator[](size_type index) const;
    constexpr pointer data() const noexcept;
};
```

这是 C++20 学习摘要。C++23 constant iterator 成员、C++26 `at()` 和已被移除的
initializer_list 构造不在其中。

## 模板参数与构造前置条件

ElementType 必须是 complete、non-abstract object type。具体 Extent=N 把长度写入类型；
dynamic_extent 版本在对象中保存运行时大小。非零 static span 不能默认构造，dynamic span
默认构造为空。

iterator/range 构造要求连续且形成有效范围，range 还需 sized。元素类型必须允许相应数组
qualification conversion。range 构造还要求来源满足 `borrowed_range`，或者 ElementType 为
const：因此可变 `span<T>` 不能绑定普通临时 range；`span<const T>` 虽可在某些表达式内观察
临时连续 range，也不会延长其寿命，若把结果保存到完整表达式之后仍会悬空。构造 fixed span
时 source count 必须等于 N；从动态来源显式构造只阻止意外转换，不等于运行时检查。

## 返回值、访问与 subview

`size()` 返回元素数，`size_bytes()` 返回 `size()*sizeof(element_type)`；后者不是编码或网络
字节数。`data()` 返回借用区间首 pointer，空 span 的 pointer 不可统一假设为可解引用。

`first<Count>`、`last<Count>` 与编译期 `subspan<Offset,Count>` 可以在返回类型保留 static
extent；运行时 overload 返回 dynamic span。`operator[]`、front/back 和 subview 都要求索引、
Count 与 Offset 在当前范围内。

## 复杂度、异常与未定义行为

所有 span 成员都是常数复杂度。构造和复制 view 不分配、不复制元素；array 构造和 copy
constructor 声明为 `noexcept`。iterator/count overload 的 Throws 合同为不抛出但声明本身没有
`noexcept`；iterator/sentinel 与通用 range 构造分别可能传播 difference 或 data/size 操作的
异常。

C++20 没有 bounds-checked `at()`。越界 `operator[]`、空 span 的 front/back、越界 subview、
fixed extent 与运行时 count 不一致，以及无效 pointer range 都违反前置条件并可能导致 UB；
不要期待统一抛 `out_of_range`。

## 生命周期、失效与 borrowed view

span 的 pointer/iterator/reference 随底层 owner 一起有效。owner 析构、clear、vector
reallocation 或任何使所借 pointer 失效的操作也使 span 失效；owner 原地修改元素不会使
span 失效，变化会通过 alias 可见。

`enable_borrowed_range<span<...>>` 为 true，只表示 iterator 不依赖 span wrapper 自身存活；
临时 span 消失后 iterator 仍可在 owner 存活时使用。它完全不保证 owner 存活，也不能防止
函数返回指向局部数组的 dangling span。

## Const、aliasing 与线程安全

复制 span 只复制 view，多份 view 可指向相同元素。`const span<int>` 的 const 约束 wrapper，
`operator[] const` 仍返回 `int&`；要禁止经 view 修改元素，应使用 `span<const int>`。

并发只读底层对象可以；经 aliases 并发读写同一非原子元素是 data race。span 不追加同步或
容器级并发保证，是否能修改不同元素还取决于底层 owner 的合同。

## 示例

第一个示例从同一原生数组构造 static 和 dynamic spans，输出类型级 extent、运行时大小与
固定求和。第二个示例取得 `subspan<1,3>` 修改 owner 中间三个元素，展示共享存储与返回类型
保留的 extent；owner 在 view 全部使用期间保持存活。

## 常见错误

- 从局部数组返回 span，或在 vector 扩容后继续使用旧 span。
- 认为 borrowed_range 会持有 owner，或复制 span 会复制数据。
- 认为 `const span<int>` 使 int 只读。
- 认为 static extent 会自动检查动态 source 大小。
- 在 C++20 使用 `at()`，或让 operator[] 承担 bounds check。
- 把 as_bytes 结果当成跨平台序列化格式。

## 与 JavaScript 的区别

> JS `TypedArray.subarray()` 也创建共享 buffer 窗口，适合类比 `subspan()`；但 ArrayBuffer
> 的关联、分离与 GC 生命周期不同。C++ span 没有 GC 持有关系，owner 生命周期和所有使
> pointer 失效的操作都必须由调用方明确管理。

## 相关内容

头文件设施与版本地图阅读 `<span>`；需要拥有连续动态元素比较 vector；拥有稳定节点但不
连续的结构阅读 `std::list` 和 `std::forward_list`。

## 来源

构造约束、subview、访问、view/borrowed_range、对象表示、生命周期和版本边界由 manifest
中的当前草案、N4861、P0122R7、P1394R4、P1976R2、P2325R3、P2251R1、P2278R4、
P2821R5、P4144R1 与 LWG 3101/3255/3369 验证；cppreference 仅用于二级覆盖核对。
