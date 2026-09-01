# `std::list`

`std::list<T, Allocator>` 拥有一组双向链接节点。已知位置处可以在不搬动其他元素的
情况下插入、擦除或迁移节点；代价是没有连续存储和随机访问。

## 快速信息

- 头文件：`<list>`
- 命名空间：`std`
- 标准：C++98 起；本页代表接口与示例以 C++20 为基线
- iterator：bidirectional，不是 random-access/contiguous

## 什么时候使用

需要双向遍历、保存长期节点位置，或频繁在已知位置做 splice/erase 时考虑 list。若每次
修改前都要按索引线性寻找位置，O(1) 修改并不会消除查找成本。读取密集、缓存敏感或需要
随机访问时通常先评估 vector；只需单向节点结构时比较 forward_list。

## C++20 代表接口

```cpp
template<class T, class Allocator = std::allocator<T>>
class list {
public:
    using value_type = T;
    using size_type = /* unsigned integer type */;
    using iterator = /* bidirectional iterator */;
    using const_iterator = /* constant bidirectional iterator */;

    list();
    explicit list(size_type count);
    list(size_type count, const T& value);
    template<class InputIt> list(InputIt first, InputIt last);
    list(std::initializer_list<T> init);

    bool empty() const noexcept;
    size_type size() const noexcept;
    T& front();
    T& back();
    iterator insert(const_iterator pos, const T& value);
    iterator erase(const_iterator pos);
    void splice(const_iterator pos, list& other, const_iterator it);
    size_type remove(const T& value);
    template<class Pred> size_type remove_if(Pred pred);
    void merge(list& other);
    void sort();
    void reverse() noexcept;
};
```

这是学习摘要；allocator overload、范围成员和其他比较/修改接口被省略。`remove` 家族从
C++20 起返回删除数量；ranges-aware 成员是 C++23，广泛 constexpr 支持是 C++26。

## 类型要求、参数与返回

`T` 只需满足被调用操作的 Erasable、Insertable、EmplaceConstructible 等要求，不能把整个
类型粗略限制为 CopyConstructible。`insert(pos, value)` 在 `pos` 前插入并返回新节点 iterator；
`erase(pos)` 要求 `pos` 可解引用，返回被擦节点之后的位置。

`front()`/`back()` 返回节点中元素的 reference，空容器不满足调用前置条件。range erase
返回与原 `last` 对应的位置。返回的 iterator/reference 只在对应节点和容器合同仍有效时可用。

## 复杂度

`size()` 为常数时间。已知位置处单元素 insert/erase 为常数时间；范围操作与处理元素数线性。
整表和单节点 splice 通常为常数时间，跨不同 list 的 range splice 需要线性确定迁移数量。
`reverse()` 线性，成员 `sort()` 稳定且约做 N log N 次比较。

`merge()` 稳定、不会复制节点，最多比较两边总元素数减一；但调用前两边必须按同一比较关系
排序。不能把比较次数合同翻译为固定 CPU、分配次数或端到端性能胜过 vector。

## 异常、前置条件与未定义行为

插入可能因分配、构造或 allocator 操作抛异常；单元素插入失败通常无效果。比较器在 sort
中抛出时元素仍在容器内，但顺序可能 unspecified。

跨容器 splice/merge 要求 `get_allocator() == other.get_allocator()`；merge 还要求输入已排序。
`erase(end())`、空表 front/back/pop、错误容器 iterator、无效范围及禁止的 self-splice
位置都违反前置条件。标准不会把这些错误统一转换为 `out_of_range`。

## 生命周期、失效与线程安全

插入、sort、reverse 和合法 splice/merge 不使未擦节点的 iterator/reference 失效。迁移节点的
iterator 继续指向同一元素，但随后按目标容器 iterator 使用。erase/remove/unique 只使被删
节点对应者失效；clear、析构或节点删除后引用悬空。

独立容器可以并发操作；同一容器的只读访问可并发。标准容器规则允许不同元素内容的某些
并发修改，但结构性 insert/erase/splice、以及遍历同时修改链结构仍需要调用方同步。节点地址
稳定不会建立 happens-before。

## 示例

第一个示例保存指向 20 的 iterator，再在它之前插入 15，证明 iterator 仍指向原节点。第二个
示例在默认相等 allocator 的两个 list 间 splice 单个节点，并从保存 iterator 读取迁移后的值。

## 常见错误

- 认为 list 有下标、`at()` 或可交给要求 random-access iterator 的 `std::sort`。
- 只看到 O(1) insert/erase，忽略线性寻找位置和较差的数据局部性。
- 继续解引用 erased iterator，或把迁移 iterator 当作仍属于源容器。
- 对未排序输入调用 merge，或在 unequal stateful allocators 间 splice。
- 把 C++23 ranges 成员或 C++26 constexpr 能力当成 C++20。

## 与 JavaScript 的区别

> JS 标准库没有对应的 owning node container。可以把每个元素想成独立节点、splice 只重接
> 链接而不复制 payload；但 `Array.prototype.splice()` 仍是数组索引操作，其复杂度和引用规则
> 不能解释 `std::list::splice()`。

## 相关内容

头文件设施地图阅读 `<list>`；更轻的单向节点接口比较 `std::forward_list`；借用连续存储时
使用 `std::span`，不要尝试从 list iterator 构造 span。

## 来源

声明、参数、复杂度、allocator 前置条件、失效和 data-race 边界由 manifest 中的当前草案、
N3337、N4861、P0646R1、P1206R7、P3372R3 与 LWG 2123/2824/3017 验证；cppreference 仅用于
二级覆盖核对。
