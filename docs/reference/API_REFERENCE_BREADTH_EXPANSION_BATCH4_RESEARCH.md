# C++ Reference 第四批：关联容器、容器适配器与高频算法扩展研究

> 状态：研究完成，供内容实现使用
>
> 研究日期：2026-08-29
>
> 审计范围：`std::map`、`std::set`、`std::unordered_set`、`std::queue`、
> `std::priority_queue`、`std::stack`、`std::transform`、`std::count_if`、
> `std::all_of`、`std::lower_bound`、`std::remove_if`、`std::accumulate`
>
> 事实来源：C++ Working Draft（eel.is）、C++20 最终工作草案 N4861 与 WG21
> 一级资料；cppreference 仅用于导航核对，不作为本文规范事实的唯一依据

## 1. 研究目标与批次边界

前三批已经清除现有普通实体页的一示例债务。本批开始受控扩展目录宽度，但仍按“学习质量”
而不是条目数量验收。12 个条目必须补齐三种初学者在软件与 Web 开发中会高频遇到的能力：

1. 按键排序、集合去重和无序成员查询；
2. FIFO、优先级和 LIFO 三种受限访问策略；
3. 映射、计数、全称判断、二分定位、逻辑删除和左折叠。

本批只创建可直接搜索的实体页，不创建简短的 `<map>`、`<set>`、`<queue>` 等头文件页。
这是编辑取舍，不表示头文件页不在 120 条目规划内：实体页拥有足够多的复杂度、失效、前置条件
和示例内容，能立刻提升学习价值；头文件设施图可以在后续批次按 reduced-form 基线补齐。

本文中的标准事实以当前 Working Draft 为主，但示例和版本标签以 C++20 为边界。当前 draft 已含
C++23、C++26 及之后的声明，例如关联容器和容器适配器的更多 `constexpr` 成员、范围构造及
`push_range`；这些能力不得回写成 C++20 接口。C++20 边界以
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
复核；C++98/C++11 的首次标准边界分别以公开审阅草案和 N3337 交叉检查。
[1997 public review draft](https://www.open-std.org/jtc1/sc22/open/n2356/)；
[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)

## 2. 精确的 12 条目清单

| ID 建议 | 规范符号 | 头文件 | 分类 | 首次标准 | 本批选入原因 |
| --- | --- | --- | --- | --- | --- |
| `std-map` | `std::map` | `<map>` | `containers` | C++98 | 有序键值、范围查询和稳定元素句柄 |
| `std-set` | `std::set` | `<set>` | `containers` | C++98 | 有序唯一值与不可原地改键 |
| `std-unordered-set` | `std::unordered_set` | `<unordered_set>` | `containers` | C++11 | 平均常数成员查询与哈希约束 |
| `std-queue` | `std::queue` | `<queue>` | `containers` | C++98 | FIFO 请求/任务处理 |
| `std-priority-queue` | `std::priority_queue` | `<queue>` | `containers` | C++98 | 按优先级取出而非完整排序 |
| `std-stack` | `std::stack` | `<stack>` | `containers` | C++98 | LIFO 解析、回退与撤销模型 |
| `std-transform` | `std::transform` | `<algorithm>` | `algorithms` | C++98 | 从输入范围映射到输出范围 |
| `std-count-if` | `std::count_if` | `<algorithm>` | `algorithms` | C++98 | 按谓词统计，不修改输入 |
| `std-all-of` | `std::all_of` | `<algorithm>` | `algorithms` | C++11 | 校验全部元素并讲清空范围语义 |
| `std-lower-bound` | `std::lower_bound` | `<algorithm>` | `algorithms` | C++98 | 已分区范围中的首个“不小于”位置 |
| `std-remove-if` | `std::remove_if` | `<algorithm>` | `algorithms` | C++98 | 逻辑删除与 erase-remove 边界 |
| `std-accumulate` | `std::accumulate` | `<numeric>` | `algorithms` | C++98 | 确定顺序的左折叠与初值类型陷阱 |

本批不加入 `std::pair`、`std::tuple` 等 utility vocabulary。`map::value_type` 会解释
`pair<const Key, T>`，但正式 utility 页面留到下一批，避免关联容器、适配器和算法三个主题之外
再引入第四条内容线。

## 3. 跨条目实现约束

### 3.1 C++20 声明与当前 draft 分离

所有示例使用 `standard: "c++20"`。`std::transform`、`std::count_if`、
`std::all_of`、`std::lower_bound` 和 `std::remove_if` 的经典非执行策略重载在 C++20
可用于常量求值；C++20 同时加入对应 ranges 算法。执行策略重载始于 C++17，但其异常和调用
规则不同，正文只做版本提示，不把它们与经典重载混讲。
[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)；
[C++ Working Draft algorithms](https://eel.is/c++draft/algorithms)

`std::accumulate` 的非策略重载由 C++20 变为 `constexpr`，并从 C++20 起按顺序使用
`std::move(acc)` 更新累加器。容器适配器及关联容器在当前 draft 中出现的全面 `constexpr`
不能标成 C++20 能力。
[P1645R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1645r1.html)；
[P0571R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0571r2.html)；
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

### 3.2 不执行未满足前置条件的操作

三个适配器的 `front()`、`back()`、`top()` 和 `pop()` 都必须在非空状态使用；它们将调用转发给
底层容器或堆算法，空状态不是“返回默认值”。`lower_bound` 的输入必须对所用表达式保持分区；
`remove_if` 需要可移动赋值的元素；算法的谓词和变换函数不能破坏标准禁止修改的范围。
[Sequence container requirements](https://eel.is/c++draft/sequence.reqmts)；
[`[lower.bound]`](https://eel.is/c++draft/lower.bound)；
[`[alg.remove]`](https://eel.is/c++draft/alg.remove)；
[`[alg.transform]`](https://eel.is/c++draft/alg.transform)

### 3.3 确定输出不依赖实现细节

无序集合示例不得遍历生成期望输出，也不得输出桶数、负载因子或地址。优先队列若多个任务拥有
相同优先级，比较器必须显式提供次键，否则这些任务的弹出次序不可作为判题依据。容器示例不输出
内存分配次数或树/堆的内部布局。

### 3.4 容器适配器不是容器视图

`queue`、`priority_queue` 与 `stack` 有意隐藏底层容器的迭代器和随机位置操作。其操作效果、
复杂度、引用有效性和异常传播取决于底层 `Container` 以及元素/比较器行为。正文应写默认底层类型，
并避免把“通常是常数/对数”写成脱离底层容器的绝对保证。
[Container adaptors](https://eel.is/c++draft/container.adaptors.general)；
[`[queue.defn]`](https://eel.is/c++draft/queue.defn)；
[`[priqueue.overview]`](https://eel.is/c++draft/priority.queue)；
[`[stack.general]`](https://eel.is/c++draft/stack.general)

### 3.5 线程安全边界

标准将 `find`、`lower_bound`、`at` 等观察操作按数据竞争规则视为 const，并要求不同元素内容的
并发修改（`vector<bool>` 例外）不会仅因共享容器而形成数据竞争；这不授权并发修改容器结构。
使迭代器失效的操作会与该容器迭代器上的操作冲突。关联容器的键本身不可通过普通迭代器修改；
适配器也没有为同一对象上的并发 `push`/`pop` 提供额外同步。内容页应要求调用方在共享可变容器
和适配器外部建立同步，而不是把“const 查询”泛化为任意组合均线程安全。
[`[container.requirements.dataraces]`](https://eel.is/c++draft/container.requirements.dataraces)；
[`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)

## 4. `std::map`

### 4.1 规范事实

`std::map<Key, T, Compare, Allocator>` 是唯一键的有序关联容器，支持双向迭代；
`value_type` 为 `std::pair<const Key, T>`。迭代顺序由 `Compare` 定义，唯一键的元素严格按该
顺序递增。查找、`lower_bound`、`at` 和普通单元素插入为对数复杂度。
[`[map.overview]`](https://eel.is/c++draft/map.overview)；
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)；
[`[map.access]`](https://eel.is/c++draft/map.access)

`operator[]` 在键不存在时通过 `try_emplace` 插入值初始化的映射值；`at` 不插入，缺失时抛
`std::out_of_range`。纯查询不要使用 `operator[]`。若需要更新已存在或插入新值，
`insert_or_assign` 比“先查再写”更直接；若构造值昂贵且已有键不应构造新值，使用
`try_emplace`。
[`[map.access]`](https://eel.is/c++draft/map.access)；
[`[map.modifiers]`](https://eel.is/c++draft/map.modifiers)

插入和 `emplace` 不使现有迭代器或引用失效；`erase` 只使被删元素的句柄失效。单元素
`insert`/`emplace` 内部操作抛异常时，插入无效果。比较器必须建立严格弱序；不要在元素仍作为键
存在时绕过 `const Key` 修改其排序依据。
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)；
[`[associative.reqmts.except]`](https://eel.is/c++draft/associative.reqmts.except)

### 4.2 选择与非使用建议

需要按键稳定排序、区间查询、前驱/后继定位或最坏对数查找时使用。只需按键平均常数查询且不关心
顺序时比较 `unordered_map`；只需唯一键而没有 mapped value 时使用 `set`；重复等价键使用
`multimap`。不要为了“字典语法”默认选择 `map`，要先判断是否真正需要顺序。

### 4.3 确定性示例方案

文件建议：`update-status-codes.cpp`。创建 `std::map<std::string, int>`，用
`insert_or_assign` 更新 `ok` 并插入 `accepted`，最后按 map 顺序输出。

- 关键接口：初始化、`insert_or_assign`、有序遍历。
- 复杂度：每次更新/插入对数，遍历线性。
- 生命周期：遍历中不修改容器；不保存删除元素句柄。
- 异常：字符串、分配和比较可抛；单元素插入失败不留下新元素。
- 期望输出：`accepted=202\ncreated=201\nok=204\n`。

## 5. `std::set`

### 5.1 规范事实

`std::set<Key, Compare, Allocator>` 保存唯一键并按 `Compare` 排序，支持双向迭代。
`key_type` 与 `value_type` 均为 `Key`。`iterator` 和 `const_iterator` 都是常量迭代器语义，
不能通过迭代器原地修改键；要改变键，应擦除后重新插入，或在满足节点句柄规则时使用
`extract`/重插入。
[`[set.overview]`](https://eel.is/c++draft/set.overview)；
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)

唯一键插入返回 `pair<iterator, bool>`；布尔值表示是否真正插入，迭代器总指向等价键元素。
查找和单元素插入为对数复杂度。插入不使现有迭代器/引用失效，擦除只使被删元素句柄失效；
异常保证与有序关联容器通用规则相同。
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)；
[`[associative.reqmts.except]`](https://eel.is/c++draft/associative.reqmts.except)

### 5.2 选择与非使用建议

需要唯一值、确定排序、范围查询或有序输出时使用。只要去重且不关心顺序时比较
`unordered_set`；需要保留重复次数时使用 `multiset` 或键值计数容器；需要保持首次出现顺序时，
单独使用 `set` 不符合需求。

### 5.3 确定性示例方案

文件建议：`deduplicate-permissions.cpp`。依次插入 `write`、`read`、`read`、`admin`，输出
集合大小及有序权限。

- 关键接口：`insert` 的唯一性与有序遍历。
- 复杂度：每次插入对数，遍历线性。
- 生命周期：示例不修改存入的键。
- 异常：分配、复制/移动和比较可抛；失败插入无效果。
- 期望输出：`3\nadmin read write\n`。

## 6. `std::unordered_set`

### 6.1 规范事实

`std::unordered_set<Key, Hash, Pred, Allocator>` 保存唯一键，`key_type` 和 `value_type`
均为 `Key`。键按 bucket 组织，绝对迭代顺序未指定。等价键必须产生相同哈希值；元素留在容器
期间，哈希和等价判断结果必须保持稳定。其迭代器为常量迭代器语义，不能原地改键。
[`[unord.set.overview]`](https://eel.is/c++draft/unord.set.overview)；
[`[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

唯一键的单元素 `insert`/`emplace` 平均常数、最坏线性；查询同样不能承诺最坏 O(1)。rehash
会使全部迭代器失效并改变遍历/bucket，但不使已有元素指针和引用失效。插入可能触发 rehash；
若插入后元素数量未超过 `max_load_factor() * bucket_count()` 的边界，标准保证迭代器不因该插入
失效。擦除只使被删元素句柄失效。
[`[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

若单元素插入中的非哈希操作抛异常，插入无效果；哈希函数抛异常是该保证的明确例外。自定义哈希
和相等谓词应保持一致且最好不抛异常。
[`[unord.req.except]`](https://eel.is/c++draft/unord.req.except)

### 6.2 选择与非使用建议

需要唯一成员查询、平均常数插入/查找且不要求顺序时使用。需要稳定排序、范围查询或最坏对数查询
时使用 `set`。输入可被对手控制且无法保证哈希质量时，不应把平均常数复杂度当作延迟上界。

### 6.3 确定性示例方案

文件建议：`track-request-ids.cpp`。插入 `req-2`、`req-1`、`req-2`，只按固定键调用
`contains` 并输出大小，不遍历容器。

- 关键接口：唯一插入、`size`、C++20 `contains`。
- 复杂度：插入/查询平均常数、最坏线性。
- 生命周期：示例不保存可能被 rehash 失效的迭代器。
- 异常：标准字符串哈希与分配可能影响插入；不声明事务边界之外的保证。
- 期望输出：`2\nreq-1=true\nreq-3=false\n`。

`contains` 的版本边界来自
[P0458R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0458r2.html)，
不能依据当前 synopsis 反推它在更早标准已经存在。

## 7. `std::queue`

### 7.1 规范事实

`std::queue<T, Container = std::deque<T>>` 是 FIFO 容器适配器。底层序列容器必须支持
`front()`、`back()`、`push_back()` 和 `pop_front()`；`deque` 是默认类型，`list` 也满足
所需接口。`front`/`back` 返回底层引用，`push` 转发到 `push_back`，`pop` 转发到
`pop_front`。C++20 页面不得展示当前 draft 中更晚加入的范围构造和 `push_range`。
[`[queue.defn]`](https://eel.is/c++draft/queue.defn)；
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

适配器没有迭代器接口；查看和移除是两个操作，`pop()` 不返回被删值。必须先在非空时读取
`front()`，必要时移动/复制到本地，再 `pop()`。操作复杂度、引用失效和异常传播等同于相应底层
操作；默认 `deque` 的端点单元素插入/删除为常数复杂度，但替换底层容器后应重新评估。
[`[queue.defn]`](https://eel.is/c++draft/queue.defn)；
[`[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)；
[`[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

### 7.2 选择与非使用建议

请求必须按进入顺序处理、且调用方不应随机访问中间元素时使用。需要按优先级处理选
`priority_queue`，需要从最近压入的一端取出选 `stack`，需要遍历、删除中间元素或批量查找时直接
选择底层容器。

### 7.3 确定性示例方案

文件建议：`process-requests-fifo.cpp`。依次压入 `/health`、`/jobs`、`/metrics`，循环在非空时
读取 `front`、输出并 `pop`。

- 关键接口：`push`、`front`、`pop`、`empty`。
- 复杂度：默认 deque 下每次端点操作为常数。
- 生命周期：`front` 引用只在对应 `pop` 前使用。
- 异常：`push` 可因元素构造/分配失败抛出；不要声称任意底层容器都相同。
- 期望输出：`/health\n/jobs\n/metrics\n`。

## 8. `std::priority_queue`

### 8.1 规范事实

`std::priority_queue<T, Container = std::vector<T>, Compare =
std::less<typename Container::value_type>>` 使用随机访问底层容器维护堆；默认 `top()` 是按
`std::less` 意义最大的元素。`Compare(a, b) == true` 表示 `a` 在比较器建立的弱序中排在
`b` 之前，因此 `a` 的优先级比 `b` 低；初学者常把它误写成“a 应更优先”。比较器必须建立
严格弱序。
[`[priqueue.overview]`](https://eel.is/c++draft/priority.queue)；
[`[alg.sorting.general]`](https://eel.is/c++draft/alg.sorting.general)

`push` 先向底层 `push_back`，再调用 `push_heap`；`pop` 调用 `pop_heap` 后
`pop_back`。因此默认随机访问容器下，`top` 为常数，单元素 push/pop 的堆比较次数为对数数量级，
但 push 还包括底层追加成本。`top()` 返回 `const_reference`；适配器不提供迭代器，也不承诺堆中
除 top 外的可见顺序。空队列不能 `top` 或 `pop`。
[`[priqueue.members]`](https://eel.is/c++draft/priority.queue)；
[`[push.heap]`](https://eel.is/c++draft/push.heap)；
[`[pop.heap]`](https://eel.is/c++draft/pop.heap)

元素移动、底层分配或比较器都可能抛异常。标准没有为“底层追加成功而后续堆比较抛出”的组合过程
提供适合初学者概括成无条件事务的保证；教学页应建议比较器保持纯函数并尽量 `noexcept`，而非
发明强异常保证。

### 8.2 选择与非使用建议

反复需要当前最高优先级，并进行插入/取出时使用。若需要完整排序结果且不再插入，直接排序通常更
清晰；若需要更新任意已有任务的优先级、删除中间任务或稳定 FIFO 同优先级顺序，标准
`priority_queue` 没有直接接口，需要额外索引/版本策略或其他数据结构。

### 8.3 确定性示例方案

文件建议：`schedule-tasks.cpp`。任务具有 `priority` 和 `name`；比较器用“优先级降序、同优先级
名称升序”形成完整的确定次键，循环 `top`/`pop`。

- 关键接口：自定义比较器、`push`、`top`、`pop`。
- 复杂度：每次 push/pop 对数级堆比较，top 常数。
- 生命周期：复制 `top()` 内容后再 pop，不保存其引用。
- 异常：示例比较器只比较整数和字符串，正文仍说明一般异常边界。
- 期望输出：`deploy:3\napi:2\nlint:2\n`。

## 9. `std::stack`

### 9.1 规范事实

`std::stack<T, Container = std::deque<T>>` 是 LIFO 容器适配器。底层序列容器必须支持
`back()`、`push_back()` 和 `pop_back()`；标准列出的可用类型包括 `vector`、`list` 和
`deque`。`top`、`push`、`pop` 分别转发到这些底层操作。C++20 不包含当前 draft 的
`push_range`，也不能把当前全面 `constexpr` 声明回写成 C++20。
[`[stack.general]`](https://eel.is/c++draft/stack.general)；
[`[stack.defn]`](https://eel.is/c++draft/stack.defn)；
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

`stack` 不提供迭代器；`pop` 不返回元素。必须在非空时使用 `top`/`pop`。复杂度、引用失效和异常
行为来自底层容器；默认 deque 的尾端单元素操作为常数。若改用 vector，增长可能重分配并使已有
元素引用失效。

### 9.2 选择与非使用建议

用于括号/语法解析、深度优先搜索待办项、最近状态回退等真正的 LIFO 过程。需要遍历所有层级、
访问底部或删除中间元素时不要用 `stack`；需要递归调用语义时，也不必为了“显式数据结构”强行
替换清晰且深度受控的递归。

### 9.3 确定性示例方案

文件建议：`unwind-route.cpp`。依次压入 `home`、`settings`、`security`，循环输出 top 并 pop。

- 关键接口：`push`、`top`、`pop`、`empty`。
- 复杂度：默认 deque 下每次操作常数。
- 生命周期：只在 pop 前读取 top。
- 异常：push 可能因元素/底层操作抛出；top/pop 在示例中由 empty 守卫。
- 期望输出：`security\nsettings\nhome\n`。

## 10. `std::transform`

### 10.1 规范事实

经典一元 `transform(first, last, result, op)` 对每个输入元素求值并写入对应输出位置，返回
输出尾后迭代器；二元重载还读取第二输入范围。经典重载对变换函数恰好调用 N 次。`result` 可以
等于第一或第二输入起点，从而支持标准允许的原地变换；除此之外，输出范围必须有足够可写空间，
并避免未经保证的重叠。
[`[alg.transform]`](https://eel.is/c++draft/alg.transform)

调用对象不得使涉及的迭代器/子范围失效，也不得修改标准列出的输入和输出闭区间元素。经典重载会
传播调用、读取和写入中的异常；若中途抛出，先前输出可能已写入，不应宣称整体回滚。C++20 有
`constexpr` 经典重载和独立的 `std::ranges::transform`；本页主示例聚焦经典接口。
[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)；
[`[alg.transform]`](https://eel.is/c++draft/alg.transform)

### 10.2 选择与非使用建议

输入与输出一一对应、每个结果能独立由当前元素（或一对元素）计算时使用。需要过滤元素时选择
`copy_if`，需要副作用而不产生输出时比较 `for_each`，需要累计成单一值时选择 `accumulate` 或
其他归约算法。

### 10.3 确定性示例方案

文件建议：`convert-payload-kib.cpp`。把字节数 `{1024, 2048, 512}` 映射到预先等长的 KiB
整数数组，并按顺序输出。

- 关键接口：一元重载、预分配输出范围、返回尾迭代器。
- 前置条件：输出 vector 已调整为输入大小；整数除法行为确定。
- 复杂度：恰好 3 次转换函数调用。
- 异常：示例 lambda 与整数赋值不抛；一般调用/写入可抛且可能部分完成。
- 期望输出：`1 2 0\n`。

## 11. `std::count_if`

### 11.1 规范事实

`count_if(first, last, pred)` 返回 `[first, last)` 中谓词为真的元素数，返回类型为输入迭代器的
`difference_type`。经典重载恰好调用谓词 N 次，因此它不是找到一个匹配后就停止的存在性查询。
它支持输入迭代器。
[`[alg.count]`](https://eel.is/c++draft/alg.count)

C++20 起经典重载为 `constexpr`，并有 `std::ranges::count_if`；执行策略重载始于 C++17。
谓词应只观察元素，不应修改被传入对象或使范围失效。经典重载传播谓词异常；中断时没有返回计数。
[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)；
[`[alg.count]`](https://eel.is/c++draft/alg.count)

### 11.2 选择与非使用建议

需要完整统计满足条件的数量时使用。只需要知道是否存在一个匹配时使用 `any_of` 或 `find_if`，它们
表达意图并允许更早结束；需要保留匹配元素则使用复制/过滤方案。

### 11.3 确定性示例方案

文件建议：`count-success-responses.cpp`。对 `{200, 404, 201, 500, 204}` 统计
`200 <= status && status < 300`。

- 关键接口：谓词计数。
- 复杂度：恰好 5 次谓词调用。
- 生命周期：不修改输入范围。
- 异常：示例整数谓词不抛；一般谓词异常向上传播。
- 期望输出：`success=3\n`。

## 12. `std::all_of`

### 12.1 规范事实

`all_of(first, last, pred)` 在存在一个谓词为假的元素时返回 false，否则返回 true；空范围没有
反例，因此返回 true。复杂度至多调用谓词 N 次，这允许非策略实现找到反例后停止，但调用方不应
依赖具体访问次数产生副作用。
[`[alg.all.of]`](https://eel.is/c++draft/alg.all.of)

`all_of` 始于 C++11；执行策略重载始于 C++17；经典重载在 C++20 为 `constexpr`，C++20
另有 ranges 版本。谓词应是可重复观察的判断，而不是改变元素/外部状态的控制流工具。
[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)；
[`[alg.all.of]`](https://eel.is/c++draft/alg.all.of)

### 12.2 选择与非使用建议

用于校验“全部满足”的不变量。若空集合在业务上应判失败，需要另写 `!range.empty() && all_of(...)`；
标准的空范围 true 不是 bug。需要取得首个失败元素时用 `find_if_not`，而不是再扫描一次。

### 12.3 确定性示例方案

文件建议：`validate-ports.cpp`。验证 `{443, 3000, 8080}` 均在 `1..65535`，再明确演示空范围
的结果。

- 关键接口：全称判断、空范围语义。
- 复杂度：每次调用至多检查范围大小次。
- 生命周期：谓词只读整数。
- 异常：示例谓词不抛；一般谓词异常向上传播。
- 期望输出：`configured=true\nempty=true\n`。

## 13. `std::lower_bound`

### 13.1 规范事实

`lower_bound(first, last, value, comp)` 返回最靠后的那个位置 `i`，使 `[first, i)` 中每个元素
都满足“元素小于 value”；通常可表述为首个“不小于 value”的位置。找不到时返回 `last`。输入
必须针对该表达式保持分区；完整排序足以满足但不是必要条件。
[`[lower.bound]`](https://eel.is/c++draft/lower.bound)

比较/投影次数最多为 `log2(N) + O(1)`，但经典接口只要求前向迭代器；对非随机访问迭代器，
迭代器递增仍可能是线性数量。因此不要把它笼统写成对所有容器“总耗时 O(log N)”。对
`std::map`/`std::set` 应优先用成员 `lower_bound`，树结构成员查找为对数步进。
[`[lower.bound]`](https://eel.is/c++draft/lower.bound)；
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)

经典重载始于 C++98，C++20 为 `constexpr`；ranges 版本始于 C++20。比较器必须与用于建立
分区的规则一致，违反此前置条件不能用“碰巧找到”验证正确性。

### 13.2 选择与非使用建议

在已排序/分区范围中寻找插入位置、阈值或重复值的起点时使用。无序数据应先选择线性查找或建立
合适索引；只找确切存在性可用 `binary_search`，但需要迭代器位置时仍用 `lower_bound`。

### 13.3 确定性示例方案

文件建议：`select-rate-limit-tier.cpp`。阈值 `{100, 200, 500, 1000}` 中寻找请求量 350 的首个
不小于阈值并输出位置与值。

- 关键接口：默认比较重载、尾后检查、距离。
- 前置条件：输入按升序排列。
- 复杂度：vector 随机访问下对数比较与常数时间位置差。
- 异常：整数比较不抛；一般比较器异常传播。
- 期望输出：`index=2\ntier=500\n`。

## 14. `std::remove_if`

### 14.1 规范事实

`remove_if(first, last, pred)` 通过移动赋值把“不删除”的元素稳定地压到范围前部，返回新逻辑
尾端；它不调用容器的 `erase`，不会改变容器 `size()`。`[new_end, last)` 中的元素仍是有效对象，
但状态未指定，不得读取并断言旧值。经典接口要求元素可移动赋值。
[`[alg.remove]`](https://eel.is/c++draft/alg.remove)

算法恰好调用谓词 N 次，并保持保留元素的相对顺序。对 `vector` 等容器，通常随后调用
`container.erase(new_end, container.end())`；该擦除具有容器自己的失效规则。C++20 还提供
`std::erase_if(container, pred)` 非成员便利接口，但它是不同 API，不应混成 `remove_if` 的返回
语义。
[`[alg.remove]`](https://eel.is/c++draft/alg.remove)；
[`[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)；
[`[container.erasure]`](https://eel.is/c++draft/container.erasure)

经典 `remove_if` 始于 C++98，C++20 为 `constexpr`；ranges 版本始于 C++20。谓词、移动赋值
或后续 erase 抛异常时可能已有元素被移动，不能承诺整体回滚。

### 14.2 选择与非使用建议

需要在可变顺序容器中原地保留不匹配元素时使用 erase-remove，或在 C++20 直接考虑
`std::erase_if`。只需要生成过滤后的副本时使用 `remove_copy_if`/`copy_if`；对 `list`、
`forward_list` 应比较其成员删除操作，避免不必要的值移动。

### 14.3 确定性示例方案

文件建议：`erase-disabled-routes.cpp`。`vector<Route>` 包含 `api(true)`、`admin(false)`、
`health(true)`；执行 remove_if 后立刻 erase 尾段，再按保留顺序输出。

- 关键接口：erase-remove 组合、稳定保留顺序。
- 复杂度：恰好 3 次谓词，移动/erase 成本至多线性。
- 生命周期：不访问 new_end 后的未指定状态；erase 后重新使用容器当前迭代器。
- 异常：示例字符串移动通常不应被写成规范上绝对不抛；正文不给整体事务保证。
- 期望输出：`api\nhealth\n`。

## 15. `std::accumulate`

### 15.1 规范事实

`accumulate(first, last, init, op)` 按输入顺序执行左折叠：以 `init` 初始化累加器，C++20 起每步
等价于 `acc = op(std::move(acc), *i)`（默认重载使用加法）。因此它与可重排/并行归约的
`std::reduce` 不同，适合顺序有意义的折叠。空范围返回初值。
[`[accumulate]`](https://eel.is/c++draft/accumulate)；
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

返回类型和中间累加器类型由 `T`，也就是 `init` 的类型决定。用 `0` 累加大型 `std::int64_t`
值仍可能先在 `int` 累加器中溢出；应显式使用 `std::int64_t{0}` 等正确初值。操作不得修改输入
元素或使输入迭代器/子范围失效。调用次数线性于范围长度；经典规范为每个元素按顺序应用一次。
[`[accumulate]`](https://eel.is/c++draft/accumulate)；
[C++20 N4861 `[accumulate]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

`accumulate` 始于 C++98，并由 P1645R1 在 C++20 变为 `constexpr`。二元操作或赋值抛异常时
异常传播且没有返回值；外部副作用可能已发生，因此推荐纯折叠函数。
[P1645R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1645r1.html)

### 15.2 选择与非使用建议

需要确定的从左到右累加、字符串拼接或状态折叠时使用。只做数值求和但希望允许重排/并行时比较
`reduce`，但浮点和非结合操作会产生不同结果；需要一一映射到输出范围时使用 `transform`。

### 15.3 确定性示例方案

文件建议：`sum-transfer-bytes.cpp`。对三条传输记录 `{1200, 300, 500}` 使用
`std::int64_t{0}` 与 lambda 累加 `bytes`，输出记录数和总量。

- 关键接口：自定义二元操作、显式初值类型、左到右折叠。
- 前置条件：示例总和不溢出 `int64_t`。
- 复杂度：3 次折叠操作，按输入顺序。
- 生命周期：lambda 只读当前记录，不保存引用。
- 异常：示例整数计算不抛；一般操作异常传播且可能已有外部副作用。
- 期望输出：`transfers=3\nbytes=2000\n`。

## 16. 实现矩阵

| 条目 | 示例文件 | kind | 标准 | 确定输出关键点 | 推荐关系 |
| --- | --- | --- | --- | --- | --- |
| `std::map` | `update-status-codes.cpp` | run | c++20 | 有序遍历 + 显式键 | `containers`、`std-unordered-map` |
| `std::set` | `deduplicate-permissions.cpp` | run | c++20 | 标准比较顺序 | `containers`、`std-unordered-set` |
| `std::unordered_set` | `track-request-ids.cpp` | run | c++20 | 固定键 contains，不遍历 | `containers`、`std-set` |
| `std::queue` | `process-requests-fifo.cpp` | run | c++20 | FIFO | `containers`、`std-deque` |
| `std::priority_queue` | `schedule-tasks.cpp` | run | c++20 | 比较器含确定次键 | `containers`、`std-vector` |
| `std::stack` | `unwind-route.cpp` | run | c++20 | LIFO | `containers`、`std-deque` |
| `std::transform` | `convert-payload-kib.cpp` | run | c++20 | 预分配输出 | `algorithms`、`std-vector` |
| `std::count_if` | `count-success-responses.cpp` | run | c++20 | 整数谓词 | `algorithms` |
| `std::all_of` | `validate-ports.cpp` | run | c++20 | 明确空范围 true | `algorithms` |
| `std::lower_bound` | `select-rate-limit-tier.cpp` | run | c++20 | 已排序 vector | `algorithms`、`std-sort` |
| `std::remove_if` | `erase-disabled-routes.cpp` | run | c++20 | erase 后才输出 | `algorithms`、`std-vector` |
| `std::accumulate` | `sum-transfer-bytes.cpp` | run | c++20 | int64 初值 | `algorithms`、`std-vector` |

每个普通实体应最终拥有两个例子才能达到长期 learning-quality 基线。本批作为新建 breadth slice，
建议直接提供上表真实示例，并同时添加一个更短的最小示例；若实现批次为控制规模只先交付一个例子，
实现报告必须把第二例子列为明确内容债务，不能把技术激活等同于学习质量完成。

## 17. 实现与审查清单

- [ ] 目录只增加上述 12 个实体，不临时扩入 header 或 utility 页面。
- [ ] 所有签名按 C++20 写，不复制当前 draft 的未来 `constexpr`、范围构造或 `push_range`。
- [ ] 三个关联容器分别讲清排序、哈希、唯一键、迭代顺序与句柄失效差异。
- [ ] 三个适配器均说明底层容器、非空前置条件、`pop` 不返回值和无迭代接口。
- [ ] `priority_queue` 比较器具有严格弱序和确定次键，正文解释“比较为真意味着优先级靠后”。
- [ ] `transform` 输出范围预先可写，不用未初始化普通迭代器充当存储。
- [ ] `count_if` 与 `all_of` 区分“恰好 N 次”和“至多 N 次”。
- [ ] `lower_bound` 区分比较次数与非随机访问迭代器步进次数。
- [ ] `remove_if` 不声称改变 size，也不读取逻辑尾端后的未指定值。
- [ ] `accumulate` 使用显式宽整数初值并说明顺序与 `reduce` 不同。
- [ ] 每个期望输出不依赖地址、桶数、无序遍历、未指定同优先级次序或区域设置。
- [ ] 每个 manifest 至少包含对应 Working Draft 条款、N4861 版本核对和必要 WG21 版本资料。
- [ ] 全部示例以项目 C++20 警告配置编译运行并绑定源码摘要。

## 18. 一级来源索引

### 18.1 跨版本与算法演进

- [C++20 final working draft N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
- [WG21 1997 public review draft](https://www.open-std.org/jtc1/sc22/open/n2356/)
- [WG21 N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- [P0202R3: Add constexpr modifiers to `<algorithm>` and `<utility>`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)
- [P1645R1: constexpr for `<numeric>` algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1645r1.html)
- [P0571R2: Type Requirements for `<numeric>` Algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0571r2.html)
- [P0458R2: `contains` for associative containers](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0458r2.html)
- [P0896R4: The One Ranges Proposal](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)
- [Current Working Draft library clauses](https://eel.is/c++draft/library)

### 18.2 容器与适配器

- [`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)
- [`[associative.reqmts.except]`](https://eel.is/c++draft/associative.reqmts.except)
- [`[map]`](https://eel.is/c++draft/map)
- [`[set]`](https://eel.is/c++draft/set)
- [`[unord.req]`](https://eel.is/c++draft/unord.req)
- [`[unord.req.except]`](https://eel.is/c++draft/unord.req.except)
- [`[unord.set]`](https://eel.is/c++draft/unord.set)
- [`[container.adaptors]`](https://eel.is/c++draft/container.adaptors)
- [`[queue]`](https://eel.is/c++draft/queue)
- [`[priority.queue]`](https://eel.is/c++draft/priority.queue)
- [`[stack]`](https://eel.is/c++draft/stack)
- [`[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)
- [`[container.requirements.dataraces]`](https://eel.is/c++draft/container.requirements.dataraces)
- [`[res.on.data.races]`](https://eel.is/c++draft/res.on.data.races)

### 18.3 算法与数值操作

- [`[alg.transform]`](https://eel.is/c++draft/alg.transform)
- [`[alg.count]`](https://eel.is/c++draft/alg.count)
- [`[alg.all.of]`](https://eel.is/c++draft/alg.all.of)
- [`[lower.bound]`](https://eel.is/c++draft/lower.bound)
- [`[alg.remove]`](https://eel.is/c++draft/alg.remove)
- [`[accumulate]`](https://eel.is/c++draft/accumulate)
- [`[push.heap]`](https://eel.is/c++draft/push.heap)
- [`[pop.heap]`](https://eel.is/c++draft/pop.heap)

## 19. 研究结论

这 12 个条目构成一个边界清晰的 breadth slice：关联容器建立“有序键值、有序唯一值、无序唯一
值”的选择三角；适配器建立 FIFO、优先级、LIFO 的访问策略；算法覆盖映射、统计、校验、定位、
删除和折叠。每个条目都有独立搜索意图、不同的正确性陷阱和可离线判定的 C++20 场景，因此不会
为了扩目录而重复已有内容。

实现时最高风险不是代码能否编译，而是把当前 Working Draft 的未来声明误标为 C++20、把平均
复杂度写成最坏保证、把适配器行为脱离底层容器、或让判题依赖无序/等优先级次序。本研究给出的
版本边界、非使用建议和确定输出约束应作为内容审查的强制检查项。
