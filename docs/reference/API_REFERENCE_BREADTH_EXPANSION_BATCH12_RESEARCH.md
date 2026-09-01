# C++ Reference 第十二批：链式序列与连续视图扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-01
>
> 精确范围：`<list>`、`std::list`、`<forward_list>`、
> `std::forward_list`、`<span>`、`std::span`
>
> 事实基线：C++11 工作草案 N3337、C++20 工作草案 N4861、C++23
> 工作草案 N4950、当前 C++ Working Draft，以及相关 WG21 原始提案和 LWG
> 缺陷报告。cppreference 与 zh.cppreference 只作二级信息架构和覆盖核对，正文、
> 表格和示例不得复制。

## 1. 批次目标与版本边界

本批恰好增加六个 Entry，建立“两种 owning 链式序列 + 一种 non-owning 连续视图”的
对照：`list` 用双向节点换取双向遍历和任意位置常数时间节点操作，`forward_list`
用单向节点和 after-family API 降低常数开销，`span` 则完全不拥有元素，只把一段连续存储
包装成带长度的 view。

- `<list>` 与 `std::list` 自 C++98 起提供；页面示例统一以 C++20 编译，但不能把
  C++23 range 成员或 C++26 constexpr 容器能力倒灌到 C++20 代表接口。
- `<forward_list>` 与 `std::forward_list` 自 C++11 起提供。N2543 是单链表提案的主要
  设计来源：forward iterator、`before_begin()`、after-family，以及不提供 `size()`
  都服务于“不比手写 C 单链表多付空间或时间”的目标。
- `<span>` 与 `std::span` 自 C++20 起提供，主要设计来源为 P0122R7；P1394R4、
  P1976R2 等在 C++20 定稿前修正了 range 构造与 fixed-extent 构造边界。
- C++20 将 `list`/`forward_list` 的 `remove`、`remove_if`、`unique` 返回值改为被删除
  元素个数（P0646R1）；旧代码常见的 `void` 认知需要标注版本。
- C++23 为容器增加 `from_range` 构造及 `assign_range`、`insert_range`、
  `append_range`/`prepend_range` 等接口（P1206R7）；本批示例不用这些接口。
- C++23 为 `span` 增加真正的 constant iterator 成员族（P2278R4），并明确要求
  `span` trivially copyable（P2251R1）。C++20 页面不要展示 `cbegin()`/`cend()` 为
  基线成员，也不要依赖后续 wording 才明确的性质。
- P2325R3 是追溯应用到 C++20 的 defect correction：所有 extent 的 `span` 都应启用
  `enable_view`。因此 fixed nonzero span 也应满足 `view`；页面要标注这是 DR-corrected
  C++20，而不是误写成独立的 C++23 新功能。
- C++26 工作增加 `span::at()`（P2821R5）和 node-based containers 的 constexpr
  支持（P3372R3）；两者都不属于 C++20 示例配置。曾提议的 `span(initializer_list)`
  后来又在 2026 年被移除，当前页面不应教成可用接口。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|
| `header-list` | `header` | `<list>` | `<list>` | `c++98` | `c++20` | [`[list.syn]`](https://eel.is/c++draft/list.syn) |
| `std-list` | `type` | `std::list` | `<list>` | `c++98` | `c++20` | [`[list]`](https://eel.is/c++draft/list) |
| `header-forward-list` | `header` | `<forward_list>` | `<forward_list>` | `c++11` | `c++20` | [`[forward.list.syn]`](https://eel.is/c++draft/forward.list.syn) |
| `std-forward-list` | `type` | `std::forward_list` | `<forward_list>` | `c++11` | `c++20` | [`[forward.list]`](https://eel.is/c++draft/forward.list) |
| `header-span` | `header` | `<span>` | `<span>` | `c++20` | `c++20` | [`[span.syn]`](https://eel.is/c++draft/span.syn) |
| `std-span` | `type` | `std::span` | `<span>` | `c++20` | `c++20` | [`[views.span]`](https://eel.is/c++draft/views.span) |

六页均归类现有 `containers`。Header Entry 使用缩减质量模板；每页恰好两个示例，
共 12 个，全部为 deterministic、self-contained C++20 程序。

### 1.2 Manifest-ready 关系

| ID | 建议 `related` |
|---|---|
| `header-list` | `std-list`、`header-forward-list`、`std-forward-list`、`header-span` |
| `std-list` | `header-list`、`std-forward-list`、`std-span` |
| `header-forward-list` | `std-forward-list`、`header-list`、`std-list`、`header-span` |
| `std-forward-list` | `header-forward-list`、`std-list`、`std-span` |
| `header-span` | `std-span`、`header-list`、`header-forward-list` |
| `std-span` | `header-span`、`std-list`、`std-forward-list` |

实现时只引用本批六个稳定 ID，避免 related 指向尚未落库的 `std-array` 或 `std-ranges-*`。

## 2. 共享模型与教学边界

### 2.1 Owning node containers 与 non-owning contiguous view

[`[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts) 把 sequence container 定义为
同类型对象的有限、严格线性排列。`list` 与 `forward_list` 拥有各个元素及其节点，负责构造、
销毁和 allocator 交互；两者都不是连续存储。`span` 在规范中位于 views，而不是 sequence
containers：它观察由其他对象拥有的连续序列，自身通常只携带 pointer 与可选 runtime size。
来源：[`[list.overview]`](https://eel.is/c++draft/list.overview)、
[`[forward.list.overview]`](https://eel.is/c++draft/forward.list.overview)、
[`[span.overview]`](https://eel.is/c++draft/span.overview)。

教学页面统一使用下面的选择语言：

- 需要双向遍历、稳定节点身份和任意已知位置前插/删除：考虑 `list`；
- 只需单向遍历、能围绕“前驱节点”组织修改且重视节点常数：考虑 `forward_list`；
- 调用方已经拥有连续数组/vector，只想传递不拥有的 `(data, size)`：考虑 `span`；
- 需要缓存友好、随机访问或高吞吐顺序扫描时，默认先评估 `vector`，不能把链表的 O(1)
  插入自动等同于更快的端到端程序。

`list`/`forward_list` iterator 不是 contiguous iterator，不能从它们直接构造 `span`。
反过来，`span` 没有 allocator、不会增长、不会销毁元素，也不能承担 owning container 角色。

### 2.2 节点稳定性不等于所有操作都安全

`list` 插入不使已有 iterator/reference 失效；擦除只使指向被擦除元素的 iterator/reference
失效。[`[list.modifiers]`](https://eel.is/c++draft/list.modifiers) 明确给出这两条。
`forward_list` 的 modifier 条款给出相同节点稳定性规则：插入不影响已有 iterator/reference，
擦除只使被擦除元素对应者失效。来源：
[`[forward.list.modifiers]`](https://eel.is/c++draft/forward.list.modifiers)。

但以下推论是错误的：

- `end()`、`before_begin()` 或容器对象本身可以跨任意 move/swap/销毁无条件保存；
- 擦除后仍能读被擦节点；
- 一个 iterator 指向的节点被 splice 到目标容器后，iterator 仍“属于”源容器；规范明确它继续
  指向同一元素，但随后按目标容器 iterator 行为使用；
- 节点地址稳定意味着多个线程可同时修改链结构；结构操作仍会访问共享容器状态，需要同步。

### 2.3 `splice`/`merge` 的 allocator 与范围前置条件

节点从一个容器转到另一个容器时不重建元素，因此 allocator 必须兼容。当前 `list::splice`
条款明确：若 `get_allocator() != x.get_allocator()`，行为未定义；`list::merge` 的前置条件要求
两个范围已按同一个 comparator 排序且 allocators 相等。来源：
[`[list.ops]`](https://eel.is/c++draft/list.ops)。

`forward_list::splice_after` 与 `merge` 同样要求 allocator 相等；各 overload 还要求
`position`、`first`、`last` 来自规定的容器并形成有效范围。`splice_after(position, x, first,
last)` 移动的是 **开区间** `(first, last)`，这与常见 `[first, last)` 直觉不同；原因是单链表
修改必须拿到待处理首元素之前的节点。来源：
[`[forward.list.ops]`](https://eel.is/c++draft/forward.list.ops)、
[N2543](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2543.htm)。

页面必须把前置条件放在示例之前：

- `merge` 前先分别排序；comparator 必须为两个输入定义一致的排序关系；
- 跨容器 splice/merge 先确保 allocator equality；默认 `std::allocator` 的同类型容器可满足，
  但自定义 stateful allocators 不能靠猜；
- self-splice 只在相应 overload 明确允许且 position 不落入禁止范围时使用；
- 违反 iterator/range/allocator/sortedness 前置条件不是可捕获的业务错误，不能期待抛异常。

LWG 2045 与 LWG 2123 专门修正过两种链表对 unequal allocator 的描述，因此终审必须拒绝
“splice/merge 永远安全、因为只是换指针”的表述。

### 2.4 复杂度、异常、线程与数据竞争

链表的“常数时间插入/擦除”前提是修改位置或其前驱已经获得；查找第 n 个元素仍为线性时间。
`list::size()` 为常数时间；`forward_list` 刻意没有 `size()`，需要
`std::distance(begin(), end())` 做线性遍历。单元素插入通常常数时间但可能分配并构造元素，
因此可抛 `bad_alloc` 或元素/allocator 异常；成功前失败时 modifiers 通常保证 no effects。
单元素擦除为常数时间且只销毁该元素，范围擦除与被擦数量线性。

list/forward_list 的 member `sort` 是 stable，约 N log N comparisons，并通过节点操作支持
不可 move-assign 的元素；比较器若抛异常，容器内元素次序可能变为 unspecified，但节点不会凭空
泄漏。`reverse()` 线性且不使 iterator/reference 失效。merge 最多做两边元素总数减一的比较，
且不复制节点中的元素。各项以具体条款为准，不能把一个操作的强异常保证套给所有成员。

[`[container.requirements.dataraces]`](https://eel.is/c++draft/container.requirements.dataraces)
要求实现允许同一普通容器的不同元素内容并发修改（`vector<bool>` 例外），并把若干观察函数按
const 处理；这不许可并发 insert/erase/splice/merge，也不许可一线程遍历、另一线程修改同一
链结构。`span` 只是 view：多个 span aliases 指向同一元素时，底层对象的普通 C++ data-race
规则照常生效。view 是 borrowed 并不等于 atomic 或 synchronized。

### 2.5 确定性示例红线

本批示例必须拒绝以下不稳定或误导写法：

- 打印节点/iterator/data pointer 地址，或据地址推断节点稳定性；
- 输出 allocator 实例、节点大小、分配次数或实现布局；
- 依赖比较器违反 strict weak ordering，或 merge 未排序输入；
- 用 unequal stateful allocators 做 splice/merge；
- 解引用 erased/dangling iterator，调用空链表的 `front()`/`pop_front()`，或越界访问 span；
- 假设 linked container traversal/cache 性能一定优于 vector，并输出 benchmark timing；
- 从临时 vector/array 返回 span，或让 span 活过 owner；
- 输出 `as_bytes` 的具体多字节整数表示、pointer 地址、locale、时钟、随机数或未指定顺序；
- 使用 C++23 range members、C++26 `span::at()`/constexpr list，却将 manifest profile 标为 C++20。

## 3. `<list>`

### 3.1 C++20 facility map 与直接包含

```cpp
// <list>：C++20 教学轮廓，不是当前草案完整 synopsis
namespace std {
template<class T, class Allocator = allocator<T>> class list;

template<class T, class Allocator>
bool operator==(const list<T, Allocator>& x,
                const list<T, Allocator>& y);

template<class T, class Allocator>
void swap(list<T, Allocator>& x,
          list<T, Allocator>& y)
  noexcept(noexcept(x.swap(y)));

template<class T, class Allocator, class U>
typename list<T, Allocator>::size_type
erase(list<T, Allocator>& c, const U& value);

template<class T, class Allocator, class Predicate>
typename list<T, Allocator>::size_type
erase_if(list<T, Allocator>& c, Predicate pred);
}
```

必须直接 `#include <list>`。示例用 `std::cout` 时另含 `<iostream>`；用 `std::next` 时另含
`<iterator>`；不能依赖 `<list>` 的传递包含。C++20 已提供 non-member `erase`/`erase_if`，
C++23 才添加 ranges-aware construction/insertion，当前草案大量 `constexpr` 来自 C++26。

Header Entry 应按任务组织：构造/遍历、双端访问、位置插入与擦除、splice、remove/unique、
merge/sort/reverse、non-member erase。header 本身没有统一异常合同，必须链接具体成员。

### 3.2 JS 对照与误区

JS `Array` 是动态连续/类连续索引集合，不是双链表；`unshift`/`splice` 的名字相似但性能模型、
iterator/reference 和对象身份合同完全不同。若 JS 代码用对象节点手写 linked list，概念上才更
接近 `std::list`，但 C++ 容器同时管理 allocator、元素析构和 iterator requirements。

常见误区：`<list>` 提供随机访问；`std::list` 有 `operator[]`；所有插入都快，即使先线性查找；
`std::sort` 可直接接受 list iterators（它要求 random access，应使用 member `sort`）；
splice 会复制/移动元素；node stability 允许继续使用 erased iterator；当前 synopsis 全是 C++20。

### 3.3 两个示例

1. `use-both-ends.cpp`：构造 `{2, 3}`，`push_front(1)`、`push_back(4)`，输出
   `front`、`back`、`size` 和顺序。只含 `<list>`、`<iostream>`。

   ```text
   front=1
   back=4
   size=4
   values=1,2,3,4
   ```

2. `erase-even-values.cpp`：构造 `{1, 2, 3, 4, 5, 6}`，使用 C++20
   `std::erase_if(values, predicate)` 删除偶数并输出返回计数及剩余顺序。

   ```text
   erased=3
   values=1,3,5
   ```

两个示例的迭代顺序由 sequence container 合同确定，不输出地址、capacity 或 allocator 数据。

## 4. `std::list`

### 4.1 C++20 代表接口与类型要求

```cpp
// <list>；省略 allocator overloads 与非核心 overloads
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
  T& front(); const T& front() const;
  T& back();  const T& back() const;

  iterator insert(const_iterator pos, const T& value);
  iterator insert(const_iterator pos, T&& value);
  template<class... Args> iterator emplace(const_iterator pos, Args&&... args);
  iterator erase(const_iterator pos);
  iterator erase(const_iterator first, const_iterator last);

  void splice(const_iterator pos, list& other);
  void splice(const_iterator pos, list& other, const_iterator it);
  void splice(const_iterator pos, list& other,
              const_iterator first, const_iterator last);
  size_type remove(const T& value);                 // C++20 return
  template<class Pred> size_type remove_if(Pred);  // C++20 return
  void merge(list& other);
  template<class Compare> void merge(list& other, Compare comp);
  void sort();
  template<class Compare> void sort(Compare comp);
  void reverse() noexcept;
};
```

`list` 满足 Container、ReversibleContainer、AllocatorAwareContainer 和 sequence container
的大部分要求；因 iterator 仅 bidirectional，不提供 `operator[]` 和 `at()`。`T` 必须满足具体
操作所需的 Erasable/Insertable/EmplaceConstructible 等要求，不能粗写成“所有成员都要求
CopyConstructible”。来源：[`[list.overview]`](https://eel.is/c++draft/list.overview)、
[`[container.reqmts]`](https://eel.is/c++draft/container.reqmts)、
[`[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)。

### 4.2 参数、返回、复杂度与异常

- `insert`/`emplace` 在 `pos` 前插入；单元素版本成功时返回新元素 iterator，常数时间；
  多元素版本的时间与插入数量线性。构造或分配抛异常时没有效果。
- `erase(pos)` 要求 `pos` 可解引用，返回被擦元素之后的 iterator；单元素为常数时间。
  `erase(first,last)` 返回 `last` 对应位置，时间与范围长度线性。擦除不抛，但元素析构函数仍必须
  遵守标准库对 Destructible 的非抛出要求。
- `front()`/`back()` 返回 reference；空容器不满足前置条件。返回引用的寿命依赖对应节点。
- `splice` 不复制也不移动 `T`。整表和单节点 overload 为常数时间；跨不同 list 的 range
  overload 需要线性计算移动元素数量，self-range 情况可为常数。具体见 `[list.ops]`。
- `merge` 要求两边已按相同 comparator 排序且 allocator 相等；稳定、无元素复制，至多
  `size() + other.size() - 1` 次比较。成功后非 self 的 `other` 为空。
- `sort` stable，约 N log N comparisons；比较器抛出时元素顺序 unspecified。`reverse`
  线性、`noexcept`，不使 iterator/reference 失效。

不要写“所有 list 操作 O(1)”：遍历、查找、构造 N 个元素、range erase、sort、reverse 都是
线性或 N log N。也不要把 comparison-count 合同换算成固定 CPU/分配次数。

### 4.3 生命周期、失效、线程、UB 与 JS 对照

插入、sort、reverse 以及合法 splice/merge 保留未擦元素的 iterator/reference；被迁移节点的
iterator/reference 继续指向同一对象，但节点现在属于目标容器。erase/remove/unique 只使被擦
节点对应 iterator/reference 失效。容器析构、清空或对应节点擦除后引用即悬空。

关键错误边界：空表 `front/back/pop_*`；`erase(end())`；使用不属于相应容器的 iterator；
range 不合法；跨容器 splice/merge allocators 不相等；merge 输入未排序；self range splice 的
position 落在禁止范围。这些是前置条件问题，不是 `std::out_of_range` 接口。

独立 list 可并发操作；同一 list 的只读访问可并发；规范允许不同元素的内容并发修改，但结构性
修改、iterator traversal 与结构修改组合必须由调用方同步。节点地址稳定不提供 happens-before。

JS 没有标准 node-container 对应物。最接近的类比是“每个元素都是独立对象节点，splice 重新接线
而不是复制 payload”；但 JS `Array.prototype.splice()` 会按数组索引语义移动/替换值，不能拿其
复杂度或引用规则解释 `std::list::splice`。

### 4.4 两个示例

1. `preserve-iterator-through-insert.cpp`：在 `{10, 20, 30}` 中保存指向 `20` 的 iterator，
   于其前插入 `15`，再输出 iterator 所指值和完整顺序，展示合法插入不使节点 iterator 失效。

   ```text
   saved=20
   values=10,15,20,30
   ```

2. `splice-one-node.cpp`：`source={1,2,3}`、`target={10,20}`，保存 source 中 `2` 的
   iterator，用相同默认 allocator 在 target 的 `20` 前 splice 该节点，再从保存 iterator
   读取 `2` 并输出两表。不得比较或打印地址。

   ```text
   moved=2
   source=1,3
   target=10,2,20
   ```

两例直接包含 `<list>`、`<iostream>`、`<iterator>`（若使用 `std::next`）。第二例只使用同类型
默认 allocator，满足 equality 前置条件。

## 5. `<forward_list>`

### 5.1 C++20 facility map 与直接包含

```cpp
// <forward_list>：C++20 教学轮廓
namespace std {
template<class T, class Allocator = allocator<T>> class forward_list;

template<class T, class Allocator>
bool operator==(const forward_list<T, Allocator>& x,
                const forward_list<T, Allocator>& y);

template<class T, class Allocator>
void swap(forward_list<T, Allocator>& x,
          forward_list<T, Allocator>& y)
  noexcept(noexcept(x.swap(y)));

template<class T, class Allocator, class U>
typename forward_list<T, Allocator>::size_type
erase(forward_list<T, Allocator>& c, const U& value);

template<class T, class Allocator, class Predicate>
typename forward_list<T, Allocator>::size_type
erase_if(forward_list<T, Allocator>& c, Predicate pred);
}
```

必须直接 `#include <forward_list>`；输出另含 `<iostream>`，距离计算另含 `<iterator>`。
Header Entry 应突出 `before_begin/cbefore_begin`、front、after-family modifiers、splice_after、
remove/unique/merge/sort/reverse，以及“没有 back、size、reverse iterator、随机访问”。

C++23 才有 `prepend_range`、`insert_range_after`、`assign_range` 与 `from_range` 构造；当前草案
的 `constexpr` member 轮廓来自 C++26。C++20 non-member erase/erase_if 和 remove-family 的
计数返回值可以进入页面。

### 5.2 JS 对照与误区

JS 标准库没有 singly-linked container。用 `{value, next}` 节点手写的链更接近概念模型；
`before_begin()` 类似一个不含用户值的 sentinel head，使首元素也能统一使用 insert-after。
JS 对象模型没有 C++ allocator、destructor 或 iterator category 合同，这个类比只解释结构。

常见误区：forward 表示可从尾向头；存在 `back()`/`push_back()`；`size()` 为 O(1)；
`insert_after(pos, first, last)` 会反转输入；`erase_after(pos,last)` 擦除 `[pos,last)`；
`before_begin()` 可解引用；forward_list 因节点更少就总比 vector 快。

### 5.3 两个示例

1. `build-after-sentinel.cpp`：从空表开始，以 `before_begin()` 为位置连续插入 `1`，再在
   返回的新节点后插入 `2`、`3`，输出顺序。

   ```text
   values=1,2,3
   ```

2. `erase-with-predecessor.cpp`：构造 `{1,2,3,4,5}`，维护 predecessor iterator；当下一元素
   为偶数时调用 `erase_after(prev)`，否则推进 prev。输出剩余奇数与删除数。只解引用
   `std::next(prev)` 在确认不为 end 后的结果。

   ```text
   erased=2
   values=1,3,5
   ```

第二例讲清单链表修改必须掌握前驱，且不依赖不存在的 `size()`。

## 6. `std::forward_list`

### 6.1 C++20 代表接口与类型要求

```cpp
// <forward_list>；省略 allocator overloads 与非核心 overloads
template<class T, class Allocator = std::allocator<T>>
class forward_list {
public:
  using value_type = T;
  using size_type = /* unsigned integer type */;
  using iterator = /* forward iterator */;
  using const_iterator = /* constant forward iterator */;

  forward_list();
  explicit forward_list(size_type count);
  forward_list(size_type count, const T& value);
  template<class InputIt> forward_list(InputIt first, InputIt last);
  forward_list(std::initializer_list<T> init);

  iterator before_begin() noexcept;
  iterator begin() noexcept;
  iterator end() noexcept;
  bool empty() const noexcept;
  T& front(); const T& front() const;

  iterator insert_after(const_iterator pos, const T& value);
  template<class... Args>
  iterator emplace_after(const_iterator pos, Args&&... args);
  iterator erase_after(const_iterator pos);
  iterator erase_after(const_iterator first, const_iterator last);

  void splice_after(const_iterator pos, forward_list& other);
  void splice_after(const_iterator pos, forward_list& other,
                    const_iterator before);
  void splice_after(const_iterator pos, forward_list& other,
                    const_iterator first, const_iterator last);
  size_type remove(const T& value);                 // C++20 return
  template<class Pred> size_type remove_if(Pred);  // C++20 return
  void merge(forward_list& other);
  template<class Compare> void merge(forward_list& other, Compare comp);
  void sort();
  template<class Compare> void sort(Compare comp);
  void reverse() noexcept;
};
```

`forward_list` 满足 container requirements，但明确没有 `size()`；`operator==` 为线性。
iterator 仅 forward，不能递减，也没有 reverse iteration。`before_begin()` 返回不可解引用的
sentinel-like iterator，递增一次得到 `begin()`；它是首元素前插/擦的必要位置。

### 6.2 参数、返回、复杂度与异常

- `insert_after(pos, value)` 要求 `pos` 为 `before_begin()` 或可解引用 iterator，在其后插入并
  返回新节点 iterator；单元素常数时间。range 插入保持输入顺序，不反转。
- `erase_after(pos)` 要求 `pos` 后一个 iterator 可解引用，擦除该节点并返回其后继。
  `erase_after(first,last)` 擦除开区间 `(first,last)` 并返回 `last`。
- modifiers 的插入不影响已有 iterator/reference；擦除只使被擦元素对应者失效。插入中抛异常
  时无效果；插入/擦除 n 个元素与 n 线性。
- `splice_after(pos, other)` 将 other 全部节点接到 pos 后。当前规范对 whole-list overload
  给出与 source distance 线性的复杂度，因为 `forward_list` 不保存 size/tail；单节点 overload
  为常数，range overload 与 `distance(first,last)` 线性。不能沿用 list 的 whole-list O(1)
  结论。
- merge 前置条件同 list：两边已按 comparator 排序、allocator 相等；稳定且不复制元素。
  sort 约 N log N comparisons；reverse 线性、noexcept。

### 6.3 生命周期、失效、线程、UB 与 JS 对照

插入、sort、reverse 与合法 splice/merge 保留未擦节点 iterator/reference。跨容器迁移后，
保存的 iterator 继续指向同一元素，但作为目标容器中的 iterator 使用。被 erase/remove/unique
删除的节点、clear 和析构会终止相应引用寿命。

关键前置条件错误：解引用 `before_begin/end`；空表 `front/pop_front`；erase_after 的下一节点
不存在；传入错误容器 iterator；把 `(first,last)` 当 `[first,last)`；self-splice 落入禁止位置；
unequal allocator；merge 未排序。标准 API 不通过 runtime bounds check 修复这些错误。

并发规则与 list 相同：不同元素内容可按容器 data-race 特例并发修改，但链结构修改必须同步。
JS 手写单链表的“保存前驱后 O(1) 删除下一节点”是合理类比；区别是 C++ iterator 受明确的
validity、allocator 和 object lifetime 合同约束。

### 6.4 两个示例

1. `preserve-reference-through-insert.cpp`：构造 `{10,20,30}`，保存对 `20` 的 reference，
   在首元素后插入 `15`，输出保存引用与完整顺序，展示插入不使现有节点引用失效。

   ```text
   saved=20
   values=10,15,20,30
   ```

2. `splice-after-one-node.cpp`：`source={1,2,3}`、`target={10,20}`；取得 source 中节点 `2`
   的前驱（即指向 `1` 的 iterator），保存指向 `2` 的 iterator，再调用单节点
   `target.splice_after(target.before_begin(), source, before_two)`。输出保存 iterator、source 与
   target；默认 allocator 保证相等。

   ```text
   moved=2
   source=1,3
   target=2,10,20
   ```

注意单节点 overload 的 iterator 参数指向“待移动节点的前一个节点”，不是待移动节点本身。

## 7. `<span>`

### 7.1 C++20 facility map 与直接包含

```cpp
// <span>：C++20 基线轮廓
namespace std {
inline constexpr size_t dynamic_extent = numeric_limits<size_t>::max();

template<class ElementType, size_t Extent = dynamic_extent>
class span;

template<class ElementType, size_t Extent>
inline constexpr bool ranges::enable_view<span<ElementType, Extent>> = true;

template<class ElementType, size_t Extent>
inline constexpr bool
ranges::enable_borrowed_range<span<ElementType, Extent>> = true;

template<class ElementType, size_t Extent>
span<const byte, Extent == dynamic_extent
                   ? dynamic_extent
                   : sizeof(ElementType) * Extent>
as_bytes(span<ElementType, Extent> s) noexcept;

template<class ElementType, size_t Extent>
span<byte, Extent == dynamic_extent
             ? dynamic_extent
             : sizeof(ElementType) * Extent>
as_writable_bytes(span<ElementType, Extent> s) noexcept;
}
```

必须直接 `#include <span>`。原生数组示例无需 `<array>`；使用 `std::array`、`std::vector`、
`std::byte`、`std::ranges` concepts 或 `std::cout` 时分别直接包含拥有声明的 header。
`as_writable_bytes` 只接受非-const element span。

Header Entry 应覆盖 `dynamic_extent`、span、as_bytes/as_writable_bytes、view/borrowed_range；
同时指出 header 不拥有 storage、不做分配，也不提供 C++20 bounds-checked `at()`。

### 7.2 C++20 与后续版本边界

P0122R7 引入 span；P1394R4 把构造统一到 range 模型，P1976R2 允许显式从动态大小范围构造
fixed span，但长度不匹配仍违反前置条件。N4861 是页面的 C++20 最终基线。

P2325R3 修正了旧 `view` concept 对 default initialization 的偶然要求，并作为 C++20 DR
使所有 `span<T, Extent>`（包括 nonzero static extent）都明确启用 `enable_view=true`。本批
header 示例按 DR-corrected C++20 实现验证这一点；若非常旧的标准库失败，应升级库实现，而不是
把示例改成只测 dynamic span。

后续增量必须独立标注：

- P2251R1 在 C++23 明确 span trivially copyable；
- P2278R4 在 C++23 增加 `const_iterator`、`cbegin/cend/crbegin/crend`；
- P2821R5 在 C++26 增加 `at()`，越界抛 `out_of_range`；C++20 的 `operator[]` 不检查；
- 当前 working draft 的 hardened precondition 术语属于更新后的 contract wording，解释 C++20
  行为时仍应说“不满足长度/下标前置条件导致 undefined behavior”，而不是承诺运行时诊断；
- P2447 曾为 C++26 增加 initializer_list constructor，但 P4144R1 已在 2026-03 移除；
  不要在当前 Entry 宣称 `f({1,2,3})` 能绑定 `span<const int>`。

### 7.3 JS 对照与误区

JS 的 `TypedArray`/`DataView` 最接近“对既有连续 buffer 的视图”，尤其 subarray 创建共享存储
view 的行为；普通 JS `Array` 不是固定 element representation 的 contiguous byte range。
TypedArray 通常持有 ArrayBuffer 关联，而 `span` 只借用 C++ object storage，不延长 owner 寿命。

常见误区：span 是小 vector；复制 span 会复制元素；`const span<int>` 使元素 const（它只使 view
对象 const，元素仍可改；只读元素需 `span<const int>`）；borrowed_range 保证 owner 存活；
static extent 会自动 runtime 检查；`as_bytes` 提供可移植序列化；任意 range 都能构造 span；
C++20 有 `at()` 或 initializer_list constructor。

### 7.4 两个示例

1. `inspect-header-facilities.cpp`：原生 `int values[4]{1,2,3,4}` 构造 static span；用
   `static_assert(std::ranges::view<...>)` 与 `borrowed_range`，只输出 extent、size 和 bool。

   ```text
   extent=4
   size=4
   view=true
   borrowed=true
   ```

2. `view-object-bytes-size.cpp`：对 `std::array<unsigned short, 3>` 建立 span，再调用
   `as_bytes`，只输出 element 数与 byte-view 的 `size()`，不输出字节值，因数值对象表示和
   endianness 可变。`sizeof(unsigned short)` 至少 2 但不固定，因此输出使用关系式而非具体字节数：

   ```text
   elements=3
   bytes_match=true
   ```

第二例用 `bytes.size() == values.size() * sizeof(values[0])` 生成 `std::boolalpha`，从而跨实现稳定。

## 8. `std::span`

### 8.1 C++20 代表接口、extent 与构造约束

```cpp
// <span>：C++20 基线，省略 deduction guides
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

  constexpr span() noexcept;  // 仅 dynamic_extent 或 Extent == 0
  template<class It>
  constexpr explicit(Extent != dynamic_extent)
  span(It first, size_type count);
  template<class It, class End>
  constexpr explicit(Extent != dynamic_extent)
  span(It first, End last);
  template<size_t N> constexpr span(element_type (&arr)[N]) noexcept;
  template<class T, size_t N> constexpr span(std::array<T, N>& arr) noexcept;
  template<class R>
  constexpr explicit(Extent != dynamic_extent) span(R&& range);

  template<size_t Count> constexpr span<element_type, Count> first() const;
  template<size_t Count> constexpr span<element_type, Count> last() const;
  template<size_t Offset, size_t Count = dynamic_extent>
  constexpr span<element_type, /* computed extent */> subspan() const;
  constexpr span<element_type> subspan(size_type offset,
                                       size_type count = dynamic_extent) const;

  constexpr size_type size() const noexcept;
  constexpr size_type size_bytes() const noexcept;
  constexpr bool empty() const noexcept;
  constexpr reference operator[] (size_type index) const;
  constexpr reference front() const;
  constexpr reference back() const;
  constexpr pointer data() const noexcept;
};
```

`ElementType` 必须是 complete、non-abstract object type。`Extent` 若为具体 N，类型层面记录固定
长度；`dynamic_extent` 版本在对象中保存 runtime length。static span 只能在 extent 为 0 时默认
构造；dynamic span 默认构造为空且 `data()==nullptr`。

pointer/count 与 iterator/sentinel 构造要求 contiguous iterator、有效范围和 element qualification
conversion；static extent 还要求 runtime count 与 N 相等。range 构造要求 contiguous_range +
sized_range，且 mutable span 不能从不满足 borrowed_range 的临时 range 构造；`span<const T>`
可在一次调用内观察某些临时 contiguous ranges，但一旦 owner 销毁仍会悬空。

从 dynamic range/`span<T>` 构造 `span<T,N>` 是 explicit，**但 explicit 不是 runtime check**；
source size 不等于 N 仍违反前置条件。来源：[`[span.cons]`](https://eel.is/c++draft/span.cons)、
[P1976R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1976r2.html)。

### 8.2 返回、复杂度、错误与边界

所有 span member functions 均为常数时间。`size()` 返回元素数，`size_bytes()` 返回
`size()*sizeof(element_type)`；后者不是编码长度或网络序字节数。`data()` 返回首元素 pointer，
空 span 的 data 不应通过统一假设解引用。

compile-time `first<Count>/last<Count>/subspan<Offset,Count>` 可在返回类型保留 static extent；
runtime overload 返回 dynamic-extent span。Count/Offset 必须落在当前 size 内；违反前置条件在
C++20 不抛异常。`operator[]`、front、back 同理：C++20 没有 bounds check，空 span 调 front/back
或 index >= size 是 UB。C++26 `at()` 才以 `out_of_range` 报错，页面必须加版本徽标。

构造和复制 span 不分配、不复制元素；array 构造和 copy 为 noexcept。通用 range/iterator
构造的异常只可能来自相应 data/size/difference 操作，但普通 pointer/array 用法无异常。

### 8.3 生命周期、失效、borrowed view、线程与 JS 对照

span 不拥有对象，也不延长数组、vector、string 或自定义 contiguous range 的寿命。任何使
`[data(), data()+size())` 内 pointer 失效的 owner 操作，也使 span 的 pointer/iterator/reference
失效；例如 vector reallocation、owner clear/destruction、局部数组离开作用域。owner 原地修改
元素不会使 span 失效，但会通过 view 可见。

`ranges::enable_view<span<...>>` 与 `enable_borrowed_range<span<...>>` 均为 true。borrowed_range
只说明 iterator 的有效性不依赖 **span 对象自身** 的寿命：从一个临时 span 取 iterator 可以在
span wrapper 消失后继续使用；它完全不保证底层 owner 存活。来源：
[`[span.syn]`](https://eel.is/c++draft/span.syn)、
[`[range.range]`](https://eel.is/c++draft/range.range)。

复制 `span<int>` 产生 alias；一份 view 写元素，其他 view 会观察到。`const span<int>` 的
`operator[] const` 仍返回 `int&`，因为 top-level const 约束 wrapper；用 `span<const int>` 才禁止
经 view 修改元素。多个线程只读底层对象可以；并发写同一元素或读写同一非原子元素是 data race。
不同元素能否并发修改取决于底层对象/容器合同，不是 span 自己追加的保证。

JS `TypedArray.prototype.subarray()` 也创建共享存储窗口，适合类比 `subspan()`；但 ArrayBuffer
的寿命/分离规则与 C++ owner lifetime 不同。不能从“JS 有 GC”推出 span 会持有 owner。

### 8.4 两个示例

1. `compare-static-dynamic-extents.cpp`：用同一个 `int values[4]{2,4,6,8}` 构造
   `span<int,4>` 和 `span<int>`，输出类型级 extent、runtime size 和总和。总和用 range-for，
   不依赖 C++23 ranges 算法。

   ```text
   static_extent=4
   dynamic_extent=true
   dynamic_size=4
   sum=20
   ```

2. `mutate-subspan.cpp`：`std::array<int,5>{1,2,3,4,5}` 构造 span，取得
   `subspan<1,3>()`，将其中每项乘 10，再从 owner 输出完整数组与 subspan extent。展示 aliasing
   与 compile-time extent，不让 span 活过 array。

   ```text
   sub_extent=3
   values=1,20,30,40,5
   ```

两例直接包含 `<span>`、`<array>`（第二例）、`<iostream>`；不使用 `at()`、临时 owner、越界
subspan 或 pointer 输出。

## 9. 十二个示例的确定性清单

| # | Entry / 文件名 | 数据来源 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `<list>` / `use-both-ends.cpp` | 固定 `{2,3}` | sequence order | `front=1\nback=4\nsize=4\nvalues=1,2,3,4\n` |
| 2 | `<list>` / `erase-even-values.cpp` | 固定 1..6 | C++20 erase_if count | `erased=3\nvalues=1,3,5\n` |
| 3 | `list` / `preserve-iterator-through-insert.cpp` | 固定 nodes | 不打印地址 | `saved=20\nvalues=10,15,20,30\n` |
| 4 | `list` / `splice-one-node.cpp` | 默认相等 allocator | 合法单节点 splice | `moved=2\nsource=1,3\ntarget=10,2,20\n` |
| 5 | `<forward_list>` / `build-after-sentinel.cpp` | 固定 inserts | 使用返回 iterator | `values=1,2,3\n` |
| 6 | `<forward_list>` / `erase-with-predecessor.cpp` | 固定 1..5 | 先检查 next != end | `erased=2\nvalues=1,3,5\n` |
| 7 | `forward_list` / `preserve-reference-through-insert.cpp` | 固定 nodes | 不打印地址 | `saved=20\nvalues=10,15,20,30\n` |
| 8 | `forward_list` / `splice-after-one-node.cpp` | 默认相等 allocator | 参数为待移动节点前驱 | `moved=2\nsource=1,3\ntarget=2,10,20\n` |
| 9 | `<span>` / `inspect-header-facilities.cpp` | 原生 4 元素数组 | compile-time concepts | `extent=4\nsize=4\nview=true\nborrowed=true\n` |
| 10 | `<span>` / `view-object-bytes-size.cpp` | 3 个 ushort | 只验证 sizeof 关系 | `elements=3\nbytes_match=true\n` |
| 11 | `span` / `compare-static-dynamic-extents.cpp` | 固定 2,4,6,8 | 小整数/明确顺序 | `static_extent=4\ndynamic_extent=true\ndynamic_size=4\nsum=20\n` |
| 12 | `span` / `mutate-subspan.cpp` | owner array | owner 活过 view | `sub_extent=3\nvalues=1,20,30,40,5\n` |

示例实现要求：

- 全部使用 `-std=c++20`；ASCII stdout，布尔值显式 `std::boolalpha`。
- 每个使用到的标准设施都有 direct include，不依赖传递包含。
- 链表示例使用默认同类型 allocator；splice/merge 示例不得替换为 unequal stateful allocator。
- 遍历 sequence 按规范顺序输出；不输出 pointer、iterator、节点大小、allocator 或分配次数。
- span owner 必须覆盖 view 的全部使用；不从函数返回指向局部数组/临时 vector 的 span。
- 不读环境、时钟、locale、随机源；不做 benchmark；不输出 object representation bytes。
- 不使用 C++23 range members、C++26 `at()`/constexpr node container 或尚不存在的
  initializer_list span constructor。

## 10. 版本与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| C++11 list/forward_list 基线 | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、[N2543 singly linked list proposal](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2543.htm) |
| C++20 最终状态与 span | [N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、[P0122R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0122r7.pdf)、[P1394R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1394r4.pdf)、[P1976R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1976r2.html)、[P2325R3（C++20 DR）](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2325r3.html) |
| C++20 list remove-family 返回计数 | [P0646R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0646r1.html) |
| C++23 ranges-aware container members | [P1206R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p1206r7.html)、[N4950](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/n4950.pdf) |
| C++23 span const iterators/trivial copy | [P2278R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2278r4.html)、[P2251R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2251r1.pdf) |
| C++26 span at 与 constexpr node containers | [P2821R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p2821r5.html)、[P3372R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3372r3.html) |
| initializer_list span 的移除边界 | [P4144R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2026/p4144r1.html) |
| sequence/container 要求 | [`[container.reqmts]`](https://eel.is/c++draft/container.reqmts)、[`[container.alloc.reqmts]`](https://eel.is/c++draft/container.alloc.reqmts)、[`[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts) |
| list 声明、复杂度与失效 | [`[list]`](https://eel.is/c++draft/list)、[`[list.modifiers]`](https://eel.is/c++draft/list.modifiers)、[`[list.ops]`](https://eel.is/c++draft/list.ops) |
| forward_list 声明、复杂度与失效 | [`[forward.list]`](https://eel.is/c++draft/forward.list)、[`[forward.list.modifiers]`](https://eel.is/c++draft/forward.list.modifiers)、[`[forward.list.ops]`](https://eel.is/c++draft/forward.list.ops) |
| unequal allocator 与历史修正 | [LWG 2045](https://cplusplus.github.io/LWG/issue2045)、[LWG 2123](https://cplusplus.github.io/LWG/issue2123)、[LWG 3017](https://cplusplus.github.io/LWG/issue3017)、[LWG 3088](https://cplusplus.github.io/LWG/issue3088) |
| span 声明、构造、subviews、访问 | [`[span.syn]`](https://eel.is/c++draft/span.syn)、[`[views.span]`](https://eel.is/c++draft/views.span)、[`[span.cons]`](https://eel.is/c++draft/span.cons)、[`[span.sub]`](https://eel.is/c++draft/span.sub)、[`[span.elem]`](https://eel.is/c++draft/span.elem) |
| view、borrowed range 与并发 | [`[range.view]`](https://eel.is/c++draft/range.view)、[`[range.range]`](https://eel.is/c++draft/range.range)、[`[container.requirements.dataraces]`](https://eel.is/c++draft/container.requirements.dataraces)、[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races) |

二级页面只核对搜索别名、成员清单与栏目：
[`<list>`](https://zh.cppreference.com/w/cpp/header/list)、
[`std::list`](https://zh.cppreference.com/w/cpp/container/list)、
[`<forward_list>`](https://zh.cppreference.com/w/cpp/header/forward_list)、
[`std::forward_list`](https://zh.cppreference.com/w/cpp/container/forward_list)、
[`<span>`](https://zh.cppreference.com/w/cpp/header/span)、
[`std::span`](https://zh.cppreference.com/w/cpp/container/span)。正文与示例必须原创。

## 11. 每个 Entry 的 manifest-ready 来源建议

### `header-list`

- Current: `[list.syn]`、`[sequences.general]`、`[sequence.reqmts]`
- Historical/WG21: N3337、N4861、P0646R1、P1206R7、P3372R3
- Secondary: zh.cppreference `<list>`

### `std-list`

- Current: `[list.overview]`、`[list.cons]`、`[list.capacity]`、
  `[list.modifiers]`、`[list.ops]`、`[list.erasure]`
- Requirements/concurrency: `[container.reqmts]`、`[container.alloc.reqmts]`、
  `[container.requirements.dataraces]`
- Historical/DR: N3337、N4861、P0646R1、P1206R7、P3372R3、LWG 2123、
  LWG 2824、LWG 3017
- Secondary: zh.cppreference `std::list`

### `header-forward-list`

- Current: `[forward.list.syn]`、`[sequences.general]`、`[sequence.reqmts]`
- Historical/WG21: N2543、N3337、N4861、P0646R1、P1206R7、P3372R3
- Secondary: zh.cppreference `<forward_list>`

### `std-forward-list`

- Current: `[forward.list.overview]`、`[forward.list.cons]`、
  `[forward.list.modifiers]`、`[forward.list.ops]`、`[forward.list.erasure]`
- Requirements/concurrency: `[container.reqmts]`、`[container.alloc.reqmts]`、
  `[container.requirements.dataraces]`
- Historical/DR: N2543、N3337、N4861、P0646R1、P1206R7、P3372R3、
  LWG 2045、LWG 2123、LWG 3088
- Secondary: zh.cppreference `std::forward_list`

### `header-span`

- Current: `[span.syn]`、`[views.contiguous]`、`[range.view]`、`[range.range]`
- Historical/WG21: N4861、P0122R7、P1394R4、P1976R2、P2325R3、P2251R1、P2278R4、
  P2821R5、P4144R1
- Secondary: zh.cppreference `<span>`

### `std-span`

- Current: `[span.overview]`、`[span.cons]`、`[span.sub]`、`[span.obs]`、
  `[span.elem]`、`[span.iterators]`、`[span.objectrep]`
- Range/lifetime: `[range.view]`、`[range.range]`、`[res.on.data.races]`
- Historical/WG21/DR: N4861、P0122R7、P1394R4、P1976R2、P2325R3、P2251R1、
  P2278R4、P2821R5、P4144R1、LWG 3101、LWG 3255、LWG 3369
- Secondary: zh.cppreference `std::span`

## 12. 实施与终审清单

- 只新增六个建议 ID；每页两个 deterministic C++20 run 示例，共 12 个。
- 两个 Header Entry（list/forward_list）覆盖 direct include、facility map、版本边界、任务选择、
  shared invalidation/allocator/concurrency 模型；span Header 另覆盖 view/borrowed/as_bytes。
- 三个普通类型 Entry 均覆盖：C++20 代表声明、模板参数/类型要求、参数、返回、前置条件、
  复杂度、异常、生命周期/失效、线程与 data races、UB、误区、JS 对照、版本和一级来源。
- list/forward_list 明确：insert 保留已有节点 iterator/reference；erase 只使被擦节点失效；
  splice/merge 保留被迁移节点身份，但 iterator 随后按目标容器行为使用。
- list/forward_list 的 splice/merge 明确 allocator equality；merge 明确双方先排序；不把前置
  条件违例描述为异常。
- forward_list 明确没有 `size/back/push_back`，`before_begin` 不可解引用，after-range 是开区间
  语义；whole-list splice_after 不能照抄 list 的复杂度。
- span 明确 non-owning、contiguous、view + borrowed_range；borrowed 只解除 iterator 对 wrapper
  生命周期的依赖，不延长 owner 寿命。
- span 明确 static/dynamic extent 的类型与 runtime 边界；fixed-from-dynamic 为 explicit 仍需
  size == extent；subview/index/front/back 所有前置条件必须写出。
- span 页面以 C++20 为基线，C++23 const iterators/trivial-copy wording 与 C++26 `at()`/
  后续变化单列；不展示已移除的 initializer_list constructor 为现行 API。
- expected stdout 与第 9 节逐字一致；不打印地址、allocator、实现布局、byte values、timing、
  locale、随机值或未指定顺序。
- 终审拒绝：链表支持随机访问；所有 list 操作 O(1)；node stability 包含 erased node；
  splice/merge 可跨 unequal allocator；merge 无需排序；forward_list 有 size/back；
  erase_after 擦 `[first,last)`；span 拥有数据或延长 owner；const span 使元素 const；
  borrowed_range 防悬空；static extent 自动检查；C++20 span 有 `at()`；as_bytes 是可移植序列化；
  current draft 所有 `constexpr`/成员都属于 C++20。
