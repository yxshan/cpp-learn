# `std::forward_list`

`std::forward_list<T, Allocator>` 拥有单向链接节点。它只提供 forward iterator，并通过
“前驱节点之后”的接口插入、擦除或迁移元素，以避免为反向链接、大小和尾端额外付费。

## 快速信息

- 头文件：`<forward_list>`
- 命名空间：`std`
- 标准：C++11 起；本页代表接口与示例以 C++20 为基线
- 明确没有：`size()`、`back()`、`push_back()`、反向 iterator、随机访问

## 什么时候使用

只需单向遍历，算法天然保存 predecessor，并希望在已知前驱后常数时间修改时考虑
forward_list。需要反向遍历、双端访问或更直观的“在当前位置前插入”时比较 list；需要
连续存储、随机访问或缓存友好扫描时通常先评估 vector。

## C++20 代表接口

```cpp
template<class T, class Allocator = std::allocator<T>>
class forward_list {
public:
    using value_type = T;
    using size_type = /* unsigned integer type */;
    using iterator = /* forward iterator */;
    using const_iterator = /* constant forward iterator */;

    forward_list();
    explicit forward_list(size_type count);
    template<class InputIt> forward_list(InputIt first, InputIt last);
    forward_list(std::initializer_list<T> init);

    iterator before_begin() noexcept;
    iterator begin() noexcept;
    iterator end() noexcept;
    bool empty() const noexcept;
    T& front();
    iterator insert_after(const_iterator pos, const T& value);
    iterator erase_after(const_iterator pos);
    iterator erase_after(const_iterator first, const_iterator last);
    void splice_after(const_iterator pos, forward_list& other,
                      const_iterator before);
    size_type remove(const T& value);
    template<class Pred> size_type remove_if(Pred pred);
    void merge(forward_list& other);
    void sort();
    void reverse() noexcept;
};
```

这是学习摘要。remove 家族从 C++20 起返回删除数量；ranges-aware 成员为 C++23，广泛
constexpr 能力为 C++26。

## 模板参数、类型要求、前驱与返回

Allocator 的 `value_type` 必须与 T 相同。T 不需要为所有成员统一满足 CopyConstructible；它只需
满足实际调用所要求的 Erasable、CopyInsertable、MoveInsertable 或
EmplaceConstructible。元素析构需满足标准库 Destructible 的非抛出要求。

`before_begin()` 是首元素之前的特殊 iterator：可以递增得到 begin，但不可解引用。
`insert_after(pos, value)` 在 pos 后插入并返回新节点；pos 必须是 before_begin 或可解引用
位置。range insert 保持输入顺序，不会因为单向链接而反转。

`erase_after(pos)` 要求 pos 的后继可解引用，返回被擦节点的后继。
`erase_after(first,last)` 擦除开区间 `(first,last)` 并返回 last；first 本身不被擦除。
`splice_after` 的单节点 overload 同样接收“待迁移节点的前一个位置”。

## 复杂度

已知前驱后的单元素 insert/erase/splice 为常数时间；寻找前驱仍为线性。范围插入、擦除与
元素数线性。整表 splice_after 需要遍历源表，复杂度与源距离线性，因为 forward_list 不保存
size/tail；不能套用 list 的整表复杂度。

成员 sort 稳定且约做 N log N 次比较，reverse 线性且 noexcept。`std::distance(begin,end)`
可以计算元素数，但每次都是线性遍历。

## 异常、前置条件与未定义行为

插入可能因分配、元素构造或 allocator 抛异常；forward_list modifier 条款明确这些成员抛异常时
容器无效果。sort 比较器抛出时元素仍在容器中，但顺序可能 unspecified。

空表 front/pop_front、解引用 before_begin/end、在没有后继时 erase_after、错误容器 iterator、
无效 after-range、禁止的 self-splice、unequal allocator 跨容器迁移以及未排序 merge 输入都
违反前置条件；标准不提供 bounds-checked 替代成员。

## 生命周期、失效与线程安全

插入、sort、reverse 和合法 splice/merge 不使未擦节点 iterator/reference 失效。被迁移节点的
iterator 继续指向同一对象，但按目标容器 iterator 使用。erase/remove/unique 只使被删节点
对应者失效；clear、析构和删除节点终止引用寿命。

独立容器与同一容器的只读访问可并发。不同元素内容的并发修改受标准容器特例约束；对链结构
做 insert/erase/splice 或在另一线程遍历时仍要同步。单向结构不会自动建立 memory ordering。

## 示例

第一个示例保存对 20 的引用，再在首节点后插入 15，观察引用仍有效。第二个示例保存节点 2
及其前驱，在默认相等 allocator 的两个容器间 splice_after 单节点，并继续读取保存 iterator。

## 常见错误

- 认为没有 size 只是库遗漏，或假定能 O(1) 得到末端和数量。
- 把 `before_begin()` 当成普通元素，或把 `(first,last)` 写成 `[first,last)` 心智模型。
- 将待移动节点本身传给要求“前一个节点”的 splice_after overload。
- 对 unequal allocators 做 splice/merge，或对未排序输入 merge。
- 因链接较少就断言 forward_list 一定快于 vector。

## 与 JavaScript 的区别

> 手写 JS `{value, next}` 链可以解释“保存前驱后 O(1) 删除下一节点”；但 JS 没有标准
> forward iterator、allocator、析构和失效合同。`before_begin()` 更像库提供的 sentinel head，
> 不是一个可读取业务值的节点。

## 相关内容

头文件设施地图阅读 `<forward_list>`；需要双向节点操作使用 `std::list`；借用连续存储使用
`std::span`，forward_list iterator 不是 contiguous iterator，不能构造 span。

## 来源

单链表设计、after-family 参数、复杂度、allocator 前置条件、失效和 data-race 边界由 manifest
中的 N2543、Working Draft、N3337、N4861、WG21 后续提案和 LWG 2045/2123/3088 验证；
cppreference 仅用于二级覆盖核对。
