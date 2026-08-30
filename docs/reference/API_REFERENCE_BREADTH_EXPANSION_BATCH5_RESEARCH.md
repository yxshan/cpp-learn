# C++ Reference 第五批：头文件导航与高频算法扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-08-29
>
> 精确范围：`<map>`、`<set>`、`<unordered_set>`、`<queue>`、`<stack>`、
> `<numeric>`、`std::binary_search`、`std::any_of`、`std::copy`、
> `std::reverse`、`std::unique`、`std::for_each`
>
> 事实来源：C++20 最终工作草案 N4861、当前 C++ Working Draft 和 WG21
> 历史文档；本文不使用二手资料支持规范事实

## 1. 研究目标与边界

第四批已经加入六个容器实体和六个算法实体。本批补齐其中五组容器头文件导航，加入
`<numeric>` 设施图，并覆盖六个仍在编辑积压中的高频算法。头文件页采用 reduced-form：
它们负责设施发现、直接包含、版本边界和选择分流，不复制实体页的完整成员合同。普通算法页则必须
完整说明声明、约束、返回、复杂度、异常、生命周期和不适用场景。

本批所有可运行示例固定为 C++20。当前 Working Draft 已包含 C++23、C++26 以及更晚草案的
接口，不能仅凭当前 synopsis 把下列能力标成 C++20：

- 容器的 `from_range` 构造、适配器的 `push_range` 和 `std::ranges::iota` 是 C++23 后加入的
  能力；
- 容器适配器的 formatter 是 C++23 能力；
- C++26 的饱和算术和容器/适配器更广泛的常量求值支持不属于 C++20；
- 当前草案中的 execution-policy `std::ranges` 算法重载晚于 C++20；N4861 的 ranges 算法没有
  这些执行策略重载。它们来自 C++26 的
  [P3179R9](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3179r9.html)，且该工作没有
  给原本无 policy counterpart 的 `binary_search` 增加 policy 重载。

C++20 边界以 [N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
逐条复核。C++98、C++11 和 C++17 的首次标准边界分别用
[1997 public review draft N2356](https://www.open-std.org/jtc1/sc22/open/n2356/)、
[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf) 和
[N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) 直接核实。

## 2. 条目与目录身份

| 建议 ID                | 符号                 | kind       | `since` | 分类         | 主要分流目标                 |
| ---------------------- | -------------------- | ---------- | ------- | ------------ | ---------------------------- |
| `header-map`           | `<map>`              | `header`   | `c++98` | `containers` | `map` / `multimap`           |
| `header-set`           | `<set>`              | `header`   | `c++98` | `containers` | `set` / `multiset`           |
| `header-unordered-set` | `<unordered_set>`    | `header`   | `c++11` | `containers` | 唯一键 / 等价键哈希集合      |
| `header-queue`         | `<queue>`            | `header`   | `c++98` | `containers` | FIFO / priority-first        |
| `header-stack`         | `<stack>`            | `header`   | `c++98` | `containers` | LIFO                         |
| `header-numeric`       | `<numeric>`          | `header`   | `c++98` | `algorithms` | 顺序折叠 / 可重排归约 / 扫描 |
| `std-binary-search`    | `std::binary_search` | `function` | `c++98` | `algorithms` | 排序范围中的存在性查询       |
| `std-any-of`           | `std::any_of`        | `function` | `c++11` | `algorithms` | 存在性谓词                   |
| `std-copy`             | `std::copy`          | `function` | `c++98` | `algorithms` | 范围复制                     |
| `std-reverse`          | `std::reverse`       | `function` | `c++98` | `algorithms` | 原地逆序                     |
| `std-unique`           | `std::unique`        | `function` | `c++98` | `algorithms` | 相邻去重                     |
| `std-for-each`         | `std::for_each`      | `function` | `c++98` | `algorithms` | 逐项副作用或修改             |

N2356 的 `[lib.map]`、`[lib.set]`、`[lib.queue]`、`[lib.stack]`、
`[lib.numeric.ops]` 和对应算法条款直接证明十个 C++98 `since` 声明。N3337 的
`[unord.set]` 与 `[alg.any_of]` 直接证明另外两个 C++11 声明；不要以“今天所有编译器都有”
代替首次标准证据。

## 3. 跨条目版本与合同规则

### 3.1 三组算法不能混成一个重载集

本批算法必须显式区分：

| 家族     | 命名空间 / 调用形态                   | 本批版本边界                                            | 关键差异                                                                    |
| -------- | ------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| 经典     | `std::name(first, last, ...)`         | 实体首次标准；本批六个经典重载在 C++20 均为 `constexpr` | 使用 Cpp17 iterator 命名约束；通常返回单个迭代器、布尔值、`void` 或函数对象 |
| 执行策略 | `std::name(policy, first, last, ...)` | 除 `binary_search` 外，本批其余五个始于 C++17           | 通常要求 forward iterator；调用顺序、线程与异常规则由 policy 改变           |
| ranges   | `std::ranges::name(...)`              | C++20                                                   | concept 约束、投影或 range 重载；常返回结果对象或 borrowed-aware 类型       |

经典算法的 C++20 `constexpr` 由
[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)
和 N4861 的 `[algorithm.syn]` 复核；执行策略算法来自
[P0024R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0024r2.html)；
C++20 ranges 家族来自
[P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)。

`std::binary_search` 是本表的明确例外：N4861 有经典和 ranges 重载，没有 execution-policy
重载。当前 Working Draft 的 `[binary.search]` 也不能用来臆造一个执行策略版本。

### 3.2 异常与部分完成

普通无执行策略重载不提供事务回滚。比较器、谓词、函数对象、赋值或交换抛出时，异常按普通调用
退出；已经完成的目标写入、交换或元素修改仍可能保留。非修改算法自身不改范围，但谓词的外部副作用
同样不会回滚。

执行策略重载适用 N4861 `[algorithms.parallel.exceptions]` 和 `[execpol]`：并行化需要临时内存
而不可用时抛 `std::bad_alloc`；标准执行策略下 element access function 的未捕获异常导致
`std::terminate`。因此算法页不能把普通重载的“异常传播”无条件套到 policy 重载。
[N4861 parallel algorithm exceptions](https://timsong-cpp.github.io/cppwp/n4861/algorithms.parallel.exceptions)；
[N4861 execution policies](https://timsong-cpp.github.io/cppwp/n4861/execpol)

### 3.3 生命周期与回调纪律

算法不取得输入范围所有权，也不延长容器、迭代器、投影或回调捕获的生命周期。返回迭代器只在其
所属范围仍存活且没有被后续操作失效时可用。回调不得通过结构修改使当前算法正在使用的范围失效；
普通 `Predicate`/`BinaryPredicate` 也不得通过解引用参数调用非常量操作。`for_each` 是特别允许
经可变迭代器修改当前元素的设施，但这不授权在回调中 `push_back` 当前 `vector`。
[N4861 algorithm requirements](https://timsong-cpp.github.io/cppwp/n4861/algorithms.requirements)

### 3.4 直接包含不是风格偏好

N4861 `[using.headers]` 要求标准库实体由适当头文件提供，并要求翻译单元在首次引用前包含或导入
对应头文件；不能把另一头文件的实现细节性传递包含当成接口保证。六个 header 页均应把这一点写成
可操作提示。
[N4861 `[using.headers]`](https://timsong-cpp.github.io/cppwp/n4861/using.headers)

## 4. `<map>` 头文件页

### 4.1 学习者可见设施图与版本

| 目的                | 设施                                                        | 首次标准 | C++20 页应说明                                                               |
| ------------------- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 唯一键有序映射      | `std::map`                                                  | C++98    | 一个比较等价类最多一个键值对                                                 |
| 可重复键有序映射    | `std::multimap`                                             | C++98    | 等价键可有多个值；使用 `equal_range` 处理整组                                |
| 非成员比较与 `swap` | `operator==`、关系比较、`swap`                              | C++98    | C++20 synopsis 有重写后的比较与 `<=>`；不要复制当前 draft 的全面 `constexpr` |
| 多态分配器别名      | `std::pmr::map`、`std::pmr::multimap`                       | C++17    | 只是 allocator 别名，不改变排序语义                                          |
| 按谓词擦除          | `std::erase_if(map, pred)`、`std::erase_if(multimap, pred)` | C++20    | 非成员便利接口，不是成员 `erase` 的别名写法                                  |

C++20 精确 synopsis 见
[N4861 `[associative.map.syn]`](https://timsong-cpp.github.io/cppwp/n4861/associative.map.syn)；
当前设施集合见
[`[associative.map.syn]`](https://eel.is/c++draft/associative.map.syn)。历史 `map`/`multimap`
来自 N2356 `[lib.map]`，C++17 pmr 别名由 N4659 复核。

### 4.2 直接包含、语义边界和关系

- 使用上述实体必须直接 `#include <map>`；不可依赖另一个容器头偶然传递包含 `<map>`。
- `map` 与 `multimap` 都按 `Compare` 的严格弱序迭代；核心分界是每个等价键允许一个还是多个
  元素，而不是“是否排序”。
- 仅需值集合时转到 `<set>`；不需要排序且可接受平均复杂度时转到 `<unordered_map>`；普通
  `map` 的完整操作合同转到 `std::map` 实体页。
- 推荐 `relatedEntryIds`：`std-map`、`header-set`、`std-set`、
  `header-unordered-map`、`std-unordered-map`、`containers`。

有序关联容器的等价、排序和复杂度边界见
[`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)。

### 4.3 确定性 C++20 示例

1. `ordered-statuses.cpp`：用 `std::map<std::string, int>` 插入 `ok` 与 `created`，按键遍历。
   精确 stdout：`created=201\nok=200\n`。
2. `count-route-variants.cpp`：用 `std::multimap` 保存两个 `api` 和一个 `web`，只输出
   `count(key)`，不依赖同键值的展示次序。精确 stdout：`api=2\nweb=1\n`。

## 5. `<set>` 头文件页

### 5.1 学习者可见设施图与版本

| 目的                | 设施                                  | 首次标准 | C++20 页应说明                                     |
| ------------------- | ------------------------------------- | -------- | -------------------------------------------------- |
| 唯一值有序集合      | `std::set`                            | C++98    | 比较等价的值最多一个                               |
| 可重复值有序集合    | `std::multiset`                       | C++98    | 相等/等价值可重复                                  |
| 非成员比较与 `swap` | 比较运算、`swap`                      | C++98    | C++20 有 `<=>`；当前 draft 的 `constexpr` 不能回写 |
| 多态分配器别名      | `std::pmr::set`、`std::pmr::multiset` | C++17    | 分配策略变化，不改变键约束                         |
| 按谓词擦除          | 两个 `std::erase_if`                  | C++20    | 返回擦除数量                                       |

设施与 C++20 边界由
[N4861 `[associative.set.syn]`](https://timsong-cpp.github.io/cppwp/n4861/associative.set.syn)
核实；当前条款是
[`[associative.set.syn]`](https://eel.is/c++draft/associative.set.syn)，首次标准证据是 N2356
`[lib.set]`。

### 5.2 直接包含、语义边界和关系

- 必须直接 `#include <set>`。
- `set`/`multiset` 的元素同时就是键；迭代器提供常量访问语义，不能原地改变排序依据。需要映射值
  时选 `<map>`，不需要顺序时选 `<unordered_set>`。
- 高影响边界是“有序唯一值”不等于“保持插入顺序”；迭代顺序由 `Compare` 决定。
- 推荐关系：`std-set`、`header-map`、`std-map`、`header-unordered-set`、
  `std-unordered-set`、`containers`。

类型、键和值关系见 [`[set.overview]`](https://eel.is/c++draft/set.overview) 和
[`[multiset.overview]`](https://eel.is/c++draft/multiset.overview)。

### 5.3 确定性 C++20 示例

1. `unique-features.cpp`：向 `std::set<std::string>` 插入重复 `api`，输出按默认比较得到的
   唯一值。精确 stdout：`api cache web\n`。
2. `count-tags.cpp`：用 `std::multiset` 保存重复标签并按固定键调用 `count`。精确 stdout：
   `backend=2\nfrontend=1\n`。

## 6. `<unordered_set>` 头文件页

### 6.1 学习者可见设施图与版本

| 目的              | 设施                      | 首次标准 | C++20 页应说明                         |
| ----------------- | ------------------------- | -------- | -------------------------------------- |
| 唯一值哈希集合    | `std::unordered_set`      | C++11    | 平均常数查询，最坏线性；迭代顺序未指定 |
| 可重复值哈希集合  | `std::unordered_multiset` | C++11    | 等价键成组但整体无排序                 |
| 相等比较与 `swap` | `operator==`、`swap`      | C++11    | 相等不要求相同桶布局或遍历次序         |
| 多态分配器别名    | 两个 `std::pmr` 别名      | C++17    | 不改变 Hash/Pred 一致性要求            |
| 按谓词擦除        | 两个 `std::erase_if`      | C++20    | 不要误标成 C++11                       |

首次标准由 N3337 `[unord.set]` 核实；C++20 synopsis 是
[N4861 `[unord.set.syn]`](https://timsong-cpp.github.io/cppwp/n4861/unord.set.syn)，当前设施见
[`[unord.set.syn]`](https://eel.is/c++draft/unord.set.syn)。

### 6.2 直接包含、语义边界和关系

- 必须直接 `#include <unordered_set>`；`<unordered_map>` 不保证替你声明集合类型。
- 如果 `Pred(a, b)` 判等，则 `Hash(a)` 与 `Hash(b)` 必须相同。元素留在容器中时不能改变影响
  哈希或相等性的状态。
- 插入可能 rehash 并使全部迭代器失效，但 rehash 不使元素指针和引用失效。不要把平均 O(1)
  写成最坏 O(1)，也不要把遍历输出写入确定性断言。
- 推荐关系：`std-unordered-set`、`header-set`、`std-set`、
  `header-unordered-map`、`std-unordered-map`、`containers`。

哈希一致性、复杂度和失效规则见
[`[unord.req.general]`](https://eel.is/c++draft/unord.req.general)。

### 6.3 确定性 C++20 示例

`check-capabilities.cpp`：插入 `read`、`write`，仅按固定键调用 C++20 `contains`，不遍历集合、
不输出 bucket/load factor。精确 stdout：`read=true\ndelete=false\n`。

## 7. `<queue>` 头文件页

### 7.1 学习者可见设施图与版本

| 目的           | 设施                                           | 首次标准      | C++20 页应说明                                    |
| -------------- | ---------------------------------------------- | ------------- | ------------------------------------------------- |
| 先进先出访问   | `std::queue<T, Container = deque<T>>`          | C++98         | `front` 读下一个，`back` 读最新，`pop` 不返回值   |
| 最高优先级访问 | `std::priority_queue<T, vector<T>, less<...>>` | C++98         | 默认 `top` 是最大元素，不提供稳定同优先级顺序     |
| `queue` 比较   | 关系比较；C++20 `<=>`                          | C++98 / C++20 | 依赖底层容器比较；`priority_queue` 没有对应比较组 |
| `swap`         | 两个适配器的非成员 `swap`                      | C++11         | 转发到成员 swap                                   |
| allocator 协议 | `uses_allocator` 特化                          | C++11         | 不是新的拥有模型                                  |

C++20 可见声明以
[N4861 `[queue.syn]`](https://timsong-cpp.github.io/cppwp/n4861/queue.syn) 为准；当前
[`[queue.syn]`](https://eel.is/c++draft/queue.syn) 还显示晚于 C++20 的 formatter 与更广泛
`constexpr`，不得照抄。`push_range` 和范围构造来自
[P1206R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p1206r7.pdf)，formatter
来自 [P2286R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2286r8.html)；两者都是
C++23，不属于 C++20。

### 7.2 直接包含、语义边界和关系

- 两个适配器都必须直接 `#include <queue>`。
- `queue` 按到达顺序；`priority_queue` 按比较器维护堆顶。两者都隐藏迭代器和中间元素访问。
- `top`/`front` 与 `pop` 是分开的非空前置操作；要取得值，应先复制/移动可见元素，再 pop。
- 默认 `queue` 基于 `deque`，默认 `priority_queue` 基于 `vector`；复杂度、引用失效和异常会受
  底层容器影响。
- 推荐关系：`std-queue`、`std-priority-queue`、`std-deque`、`std-vector`、
  `containers`。

规范映射见 [`[queue.defn]`](https://eel.is/c++draft/queue.defn) 与
[`[priority.queue]`](https://eel.is/c++draft/priority.queue)。

### 7.3 确定性 C++20 示例

1. `process-requests.cpp`：依次 push `/health`、`/jobs`，循环 `front` 后 `pop`。精确 stdout：
   `/health\n/jobs\n`。
2. `process-priorities.cpp`：向 `std::priority_queue<int>` 放入 `2, 9, 4`，循环 `top`/`pop`。
   精确 stdout：`9 4 2\n`。

## 8. `<stack>` 头文件页

### 8.1 学习者可见设施图与版本

| 目的                  | 设施                                  | 首次标准      | C++20 页应说明                              |
| --------------------- | ------------------------------------- | ------------- | ------------------------------------------- |
| 后进先出访问          | `std::stack<T, Container = deque<T>>` | C++98         | `top` 访问尾部，`push`/`pop` 转发到底层尾端 |
| 比较                  | 关系比较；C++20 `<=>`                 | C++98 / C++20 | 比较整个底层序列，不只是 top                |
| 交换与 allocator 协议 | `swap`、`uses_allocator`              | C++11         | 行为来自底层容器                            |

C++20 声明见
[N4861 `[stack.syn]`](https://timsong-cpp.github.io/cppwp/n4861/stack.syn)。当前
[`[stack.syn]`](https://eel.is/c++draft/stack.syn) 中的 formatter、全面 `constexpr` 和类定义中
的 `push_range` 均不能进入 C++20 页面；对应 C++23 证据同第 7.1 节的 P2286R8 与 P1206R7。

### 8.2 直接包含、语义边界和关系

- 必须直接 `#include <stack>`。
- 核心边界是只暴露 LIFO；没有标准迭代接口，`pop()` 不返回值，空栈不能 `top`/`pop`。
- 需要 FIFO 选 `queue`，需要查看或删中间元素时直接选序列容器。默认底层 `deque` 可替换为满足
  `back`、`push_back`、`pop_back` 的合适容器。
- 推荐关系：`std-stack`、`header-queue`、`std-queue`、`std-deque`、
  `std-vector`、`containers`。

规范映射见 [`[stack.general]`](https://eel.is/c++draft/stack.general) 与
[`[stack.defn]`](https://eel.is/c++draft/stack.defn)。

### 8.3 确定性 C++20 示例

`unwind-route.cpp`：push `home`、`settings`、`security`，循环 `top` 后 `pop`。精确 stdout：
`security\nsettings\nhome\n`。

## 9. `<numeric>` 头文件页

### 9.1 学习者可见设施图与版本

| 学习目的      | 设施                                                        | 首次标准 | 高影响边界                                       |
| ------------- | ----------------------------------------------------------- | -------- | ------------------------------------------------ |
| 确定顺序折叠  | `accumulate`、`inner_product`                               | C++98    | 左到右；初值决定累加器类型                       |
| 前缀/相邻输出 | `partial_sum`、`adjacent_difference`                        | C++98    | 写入目标范围；目标必须有空间或使用输出适配器     |
| 递增填充      | `iota`                                                      | C++11    | 与 C++23 `ranges::iota` 分开                     |
| 可重排归约    | `reduce`、`transform_reduce`                                | C++17    | 即使无 policy 也允许重排；非结合运算结果可能不同 |
| 扫描          | `exclusive_scan`、`inclusive_scan`、两个 `transform_*_scan` | C++17    | 为每个位置生成前缀结果，可有 policy 重载         |
| 整数工具      | `gcd`、`lcm`                                                | C++17    | 对整数公共类型运算；有规范前置条件               |
| 安全中点      | `midpoint`                                                  | C++20    | 整数/浮点/同数组指针重载                         |

C++20 完整设施集合直接来自
[N4861 `[numeric.ops.overview]`](https://timsong-cpp.github.io/cppwp/n4861/numeric.ops.overview)。
N2356 证明四个 C++98 数值算法，N3337 证明 `iota`，N4659 证明 C++17 归约、扫描和
`gcd`/`lcm`，N4861 证明 `midpoint`。C++20 为经典数值算法增加 `constexpr` 的变更来自
[P1645R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1645r1.html)。

### 9.2 C++23/26 泄漏防线

- `std::ranges::iota` 来自
  [P2440R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2440r1.html)，是 C++23，
  不得出现在 C++20 示例或 C++20 设施表中。
- 饱和算术来自
  [P0543R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p0543r3.html)，属于
  C++26 线；当前 live draft 可能还有更晚的拼写演进，C++20 页一律不展示。
- 当前 [`[numeric.ops.overview]`](https://eel.is/c++draft/numeric.ops.overview) 用于发现后续变化，
  不能替代 N4861 作为本页接口清单。

### 9.3 直接包含、选择边界、关系与示例

- 使用这些设施必须直接 `#include <numeric>`；`<algorithm>` 不保证声明它们。
- 最重要的选择边界是 `accumulate` 的确定左折叠与 `reduce` 的可重排语义。字符串拼接、顺序敏感
  状态机或非结合运算优先 `accumulate`；只有运算满足所需代数性质时才利用 `reduce`。
- 推荐关系：`std-accumulate`、`std-transform`、`algorithms`、`header-algorithm`。

示例建议：

1. `sum-bytes.cpp`：用 `std::accumulate` 和 `std::int64_t{0}` 求和。精确 stdout：
   `bytes=2000\n`。
2. `assign-sequence.cpp`：用 C++20 经典 `std::iota` 填充四个整数。精确 stdout：
   `1 2 3 4\n`。

## 10. `std::binary_search`

### 10.1 C++20 代表声明与家族

```cpp
template<class ForwardIterator, class T>
constexpr bool binary_search(ForwardIterator first, ForwardIterator last,
                             const T& value);

template<class ForwardIterator, class T, class Compare>
constexpr bool binary_search(ForwardIterator first, ForwardIterator last,
                             const T& value, Compare comp);

template<forward_iterator I, sentinel_for<I> S, class T,
         class Proj = identity,
         indirect_strict_weak_order<const T*, projected<I, Proj>> Comp = ranges::less>
constexpr bool ranges::binary_search(I first, S last, const T& value,
                                     Comp comp = {}, Proj proj = {});
```

经典接口始于 C++98，C++20 为 `constexpr`；ranges 接口始于 C++20。没有 C++17 execution
policy 重载。当前草案为 `T` 增加的默认模板实参来自 C++26
[P2248R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p2248r8.html)，N4861 的
`T` 没有默认值，C++20 页面必须保持上面的声明。声明与合同来自
[N4861 `[alg.binary.search]`](https://timsong-cpp.github.io/cppwp/n4861/alg.binary.search) 和
当前 [`[binary.search]`](https://eel.is/c++draft/binary.search)。

### 10.2 精确合同

- 经典接口要求 Cpp17ForwardIterator；ranges 接口要求 `forward_iterator`、相容 sentinel，且
  比较/投影满足间接严格弱序。
- 范围必须分别对“`element < value`”和“`!(value < element)`”形成规范要求的分区；完整按同一
  比较规则排序足以满足，但排序不是必要条件。经典比较器还要求 `comp(e, value)` 为真蕴含
  `comp(value, e)` 为假。
- 当且仅当范围中存在与 `value` 在比较器意义下等价的元素时返回 `true`；不返回元素位置。
- 至多 `log2(N) + O(1)` 次比较/投影。ForwardIterator 非随机访问时仍可能有线性次迭代器步进，
  因而不能笼统承诺总耗时 O(log N)。
- 不取得所有权、不修改范围、不保存迭代器。比较/投影抛异常时普通重载退出；没有输出状态需要
  回滚，但回调外部副作用可能已发生。

### 10.3 使用、非使用与 JavaScript 对照

在已分区/已排序范围中只问“是否存在”等价值时使用。需要位置、插入点或第一个重复值时使用
`lower_bound`；关联容器应优先成员 `find`/`contains`，避免在线性迭代器上做隐藏的线性步进；
未排序数据不要调用。JavaScript `Array.prototype.includes()` 是线性扫描且使用不同的相等语义，
不是二分查找的直接对应物。

推荐关系：`std-lower-bound`、`std-sort`、`header-algorithm`、`algorithms`。

### 10.4 两个确定性示例

1. `check-number.cpp`：在 `{1, 4, 7, 9}` 中查询 7 和 8。精确 stdout：
   `7=true\n8=false\n`。
2. `check-route.cpp`：`vector<Route>` 按 path 排序，自定义比较器同时提供
   `Route/string_view` 两个方向，再查询 `/health` 与 `/admin`。精确 stdout：
   `health=true\nadmin=false\n`。这同时验证双向比较前置条件，且不依赖临时字符串生命周期。

## 11. `std::any_of`

### 11.1 C++20 代表声明与家族

```cpp
template<class InputIterator, class Predicate>
constexpr bool any_of(InputIterator first, InputIterator last, Predicate pred);

template<class ExecutionPolicy, class ForwardIterator, class Predicate>
bool any_of(ExecutionPolicy&& exec, ForwardIterator first,
            ForwardIterator last, Predicate pred);

template<input_iterator I, sentinel_for<I> S, class Proj = identity,
         indirect_unary_predicate<projected<I, Proj>> Pred>
constexpr bool ranges::any_of(I first, S last, Pred pred, Proj proj = {});
```

经典 `any_of` 始于 C++11，执行策略重载始于 C++17，ranges 重载始于 C++20；经典和 ranges
重载在 C++20 可常量求值。首次采用资料是
[N2666](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2008/n2666.pdf)，标准存在性由
N3337 `[alg.any_of]` 核实，C++20 合同见
[N4861 `[alg.any.of]`](https://timsong-cpp.github.io/cppwp/n4861/alg.any.of)。

### 11.2 精确合同

- 经典普通重载接受 InputIterator；policy 重载要求 ForwardIterator；ranges 接口用
  `indirect_unary_predicate` 约束并支持投影。
- 若至少一个元素使谓词为真则返回 `true`，否则返回 `false`；空范围返回 `false`。
- 至多应用谓词/投影 N 次。普通重载可在找到见证后停止，但程序不能依赖确切调用次数承载副作用。
- 不修改或拥有范围，也不返回元素位置。普通谓词不得经解引用参数修改元素；需要首个匹配位置时
  改用 `find_if`。
- 普通重载的谓词异常向外退出；policy 重载适用第 3.2 节的 `terminate`/`bad_alloc` 边界。

规范事实见 [`[alg.any.of]`](https://eel.is/c++draft/alg.any.of) 和
[`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)。

### 11.3 使用、非使用、JavaScript 与示例

用于“至少一个满足条件”的验证。需要数量用 `count_if`，需要元素位置用 `find_if`，需要全部满足用
`all_of`。它接近 JavaScript `Array.prototype.some()`，空集合也返回 false；C++ 的区别在于它
作用于迭代器/range，谓词和投影受静态类型约束。

推荐关系：`std-all-of`、`std-count-if`、`std-find`、`header-algorithm`。

1. `has-large-value.cpp`：检查 `{3, 12, 7}` 是否有大于 10 的值。精确 stdout：
   `has-large=true\n`。
2. `needs-retry.cpp`：检查固定 HTTP 状态列表是否有 `>= 500`。精确 stdout：
   `needs-retry=true\n`。示例不统计谓词调用次数。

## 12. `std::copy`

### 12.1 C++20 代表声明与家族

```cpp
template<class InputIterator, class OutputIterator>
constexpr OutputIterator copy(InputIterator first, InputIterator last,
                              OutputIterator result);

template<class ExecutionPolicy, class ForwardIterator1, class ForwardIterator2>
ForwardIterator2 copy(ExecutionPolicy&& exec, ForwardIterator1 first,
                      ForwardIterator1 last, ForwardIterator2 result);

template<input_iterator I, sentinel_for<I> S, weakly_incrementable O>
  requires indirectly_copyable<I, O>
constexpr ranges::copy_result<I, O>
ranges::copy(I first, S last, O result);
```

经典接口始于 C++98，policy 接口始于 C++17，ranges 接口始于 C++20；普通经典接口在 C++20
为 `constexpr`。N4861 精确声明和合同见
[`[alg.copy]`](https://timsong-cpp.github.io/cppwp/n4861/alg.copy)。

### 12.2 精确合同

- 普通经典接口接受 InputIterator 和可写 OutputIterator。调用者必须提供 N 个可写输出位置，或
  使用如 `back_inserter` 的输出适配器；算法本身不会为普通迭代器扩容。
- 对非 policy `std::copy`，`result` 不得位于 `[first, last)`；从 first 到 last 正向复制。向右
  重叠应改用 `copy_backward`。policy 重载要求完整输入与输出范围不重叠。
- 对每个 `n` 执行 `*(result + n) = *(first + n)`，返回 `result + N`；ranges 返回
  `{last, result + N}`。
- 恰好 N 次赋值。复制或赋值抛异常时，目标前缀可能已经写入，没有整体回滚。
- 返回输出迭代器依赖目标范围生命周期。向可增长容器写入可能按该容器规则使旧迭代器/引用失效；
  不要从同一 `vector` 读取又通过 `back_inserter` 追加到它自己。

精确重叠、返回和复杂度规则见当前
[`[alg.copy]`](https://eel.is/c++draft/alg.copy)。

### 12.3 使用、非使用、JavaScript 与示例

需要保留输入并把每个元素复制到独立目标时使用。需要移动所有权用算法 `std::move`，逐项变换用
`transform`，向右重叠用 `copy_backward`。JavaScript spread/`slice()` 通常创建新数组；
`std::copy` 只写入调用者提供的输出位置，是否分配取决于输出迭代器及目标容器。

推荐关系：`std-transform`、`std-vector`、`header-algorithm`、`algorithms`。

1. `copy-values.cpp`：从 `array{2,4,6}` 复制到等长 array 并输出。精确 stdout：
   `2 4 6\n`。
2. `copy-routes.cpp`：把两个字符串复制到独立 vector 的 `back_inserter`，再输出目标。
   精确 stdout：`GET /health\nPOST /users\n`。

## 13. `std::reverse`

### 13.1 C++20 代表声明与家族

```cpp
template<class BidirectionalIterator>
constexpr void reverse(BidirectionalIterator first,
                       BidirectionalIterator last);

template<class ExecutionPolicy, class BidirectionalIterator>
void reverse(ExecutionPolicy&& exec, BidirectionalIterator first,
             BidirectionalIterator last);

template<bidirectional_iterator I, sentinel_for<I> S>
  requires permutable<I>
constexpr I ranges::reverse(I first, S last);
```

经典接口始于 C++98，policy 接口始于 C++17，ranges 接口始于 C++20；经典接口在 C++20 为
`constexpr`。C++20 文本见
[N4861 `[alg.reverse]`](https://timsong-cpp.github.io/cppwp/n4861/alg.reverse)。

### 13.2 精确合同

- 经典接口要求 Cpp17BidirectionalIterator，且值满足 Cpp17ValueSwappable；ranges 接口要求
  bidirectional iterator 和 `permutable`。
- 对称位置通过 `iter_swap` 交换，经典接口返回 `void`；ranges 接口返回原 `last` 对应迭代器。
- 恰好 `N / 2` 次交换。
- 算法不改变范围长度或对象生命周期，只交换值；容器迭代器不会因这个算法自身的结构修改而失效，
  但同一位置的引用/迭代器现在观察到逆序后的值。
- 交换抛异常时范围可能只完成部分逆序。policy 重载适用并行算法异常规则。

规范事实见当前 [`[alg.reverse]`](https://eel.is/c++draft/alg.reverse)。

### 13.3 使用、非使用、JavaScript 与示例

需要原地反转可交换的双向范围时使用。需要保留原序列选 `reverse_copy`；只需逆向访问可使用反向
迭代器或 view，避免无谓修改。它接近 JavaScript 的 mutating `Array.prototype.reverse()`，
而不是创建副本的 `toReversed()`。

推荐关系：`std-copy`、`std-vector`、`header-algorithm`、`algorithms`。

1. `reverse-values.cpp`：逆序 `{1,2,3,4}`。精确 stdout：`4 3 2 1\n`。
2. `reverse-route.cpp`：把 `{"auth","v1","api"}` 逆序后用 `/` 连接。精确 stdout：
   `api/v1/auth\n`。

## 14. `std::unique`

### 14.1 C++20 代表声明与家族

```cpp
template<class ForwardIterator>
constexpr ForwardIterator unique(ForwardIterator first,
                                 ForwardIterator last);

template<class ForwardIterator, class BinaryPredicate>
constexpr ForwardIterator unique(ForwardIterator first,
                                 ForwardIterator last,
                                 BinaryPredicate pred);

template<class ExecutionPolicy, class ForwardIterator,
         class BinaryPredicate>
ForwardIterator unique(ExecutionPolicy&& exec, ForwardIterator first,
                       ForwardIterator last, BinaryPredicate pred);

template<permutable I, sentinel_for<I> S, class Proj = identity,
         indirect_equivalence_relation<projected<I, Proj>> C = ranges::equal_to>
constexpr subrange<I> ranges::unique(I first, S last,
                                    C comp = {}, Proj proj = {});
```

经典接口始于 C++98，policy 接口始于 C++17，ranges 接口始于 C++20；经典接口在 C++20 为
`constexpr`。声明见
[N4861 `[alg.unique]`](https://timsong-cpp.github.io/cppwp/n4861/alg.unique)。

### 14.2 精确合同

- 经典接口要求 ForwardIterator；`*first` 的类型满足 Cpp17MoveAssignable。自定义 `pred` 必须
  是等价关系；ranges 用 `permutable` 与 `indirect_equivalence_relation` 表达。
- 只从每一组**连续**等价元素中保留第一个；不移除不相邻重复值，也不改变容器 `size()`。
- 经典接口返回新逻辑尾 `j`；ranges 返回 `{j, last}`。`[first, j)` 是结果，`[j, last)` 的值
  不受结果合同保证；对象仍存在，直到调用者执行容器 erase。
- 非空范围恰好 N−1 次谓词应用；ranges 投影至多 twice as many。空范围不调用谓词。
- 移动赋值/谓词抛异常时范围可能已部分压缩。返回迭代器只在容器仍存活且未失效时有效；后续
  `vector.erase(j, end)` 会按 vector 擦除规则使相应迭代器失效。

合同见当前 [`[alg.unique]`](https://eel.is/c++draft/alg.unique)。

### 14.3 使用、非使用、JavaScript 与示例

用于压缩连续重复组，常见全局去重流程是先 `sort`，再 `unique`，最后 `erase`。只想保留原容器并
输出去重副本用 `unique_copy`；不能把它当成会缩小容器的成员操作。JavaScript `new Set(array)`
通常删除所有重复值并创建新集合，和 `std::unique` 的相邻、原地、逻辑尾语义不同。

推荐关系：`std-sort`、`std-remove-if`、`std-vector`、`header-algorithm`。

1. `deduplicate-adjacent.cpp`：对 `{1,1,2,2,2,3}` 执行 unique + erase。精确 stdout：
   `1 2 3\n`。
2. `deduplicate-services.cpp`：对 `{"api","web","api","cache","web"}` 先 sort，
   再 unique + erase。精确 stdout：`api cache web\n`。

## 15. `std::for_each`

### 15.1 C++20 代表声明与家族

```cpp
template<class InputIterator, class Function>
constexpr Function for_each(InputIterator first, InputIterator last,
                            Function f);

template<class ExecutionPolicy, class ForwardIterator, class Function>
void for_each(ExecutionPolicy&& exec, ForwardIterator first,
              ForwardIterator last, Function f);

template<input_iterator I, sentinel_for<I> S, class Proj = identity,
         indirectly_unary_invocable<projected<I, Proj>> Fun>
constexpr ranges::for_each_result<I, Fun>
ranges::for_each(I first, S last, Fun f, Proj proj = {});
```

经典接口始于 C++98，policy 接口始于 C++17，ranges 接口始于 C++20；经典接口在 C++20 为
`constexpr`。N4861 精确声明与合同见
[`[alg.foreach]`](https://timsong-cpp.github.io/cppwp/n4861/alg.foreach)。

### 15.2 精确合同

- 普通经典接口接受 InputIterator，`Function` 满足 Cpp17MoveConstructible，不要求
  CopyConstructible；policy 接口要求 ForwardIterator 与 Cpp17CopyConstructible Function；
  ranges 接口要求 `indirectly_unary_invocable`。
- 普通经典接口从 first 到 last−1 按顺序对每次解引用应用 f，恰好 N 次；如果迭代器可变，f 可以
  修改当前元素。f 的返回值被忽略。
- 经典接口返回执行后的 f；policy 重载返回 `void`，因为并行执行不能提供同一状态累积；ranges
  返回 `{last, std::move(f)}`。
- 算法不延长回调捕获引用的生命周期。回调可以改当前元素，不能结构修改并失效当前遍历范围。
- 普通回调抛异常时后续元素不再由该调用处理，已完成副作用不回滚，也得不到返回的 f；policy
  重载适用 `terminate`/`bad_alloc` 规则。

当前规范见 [`[alg.foreach]`](https://eel.is/c++draft/alg.foreach)。普通与并行返回差异的设计解释
也直接记录在
[P3179R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3179r4.html)；该论文中的
并行 ranges 提案晚于 C++20，只用于解释，不能加入 C++20 声明。

### 15.3 使用、非使用、JavaScript 与示例

当核心意图是对每个元素执行副作用，或在原范围中逐项修改时使用。需要产生一一对应输出选
`transform`，需要折叠成一个值选 `accumulate`，只做输出时 range-for 往往更直接。它接近
JavaScript `Array.prototype.forEach()`，但经典 C++ 版本会返回函数对象，而且作用于任意满足要求
的迭代器范围。

推荐关系：`std-transform`、`std-accumulate`、`header-algorithm`、`algorithms`。

1. `double-values.cpp`：以 `int&` 把 `{1,2,3}` 原地加倍并输出。精确 stdout：
   `2 4 6\n`。
2. `collect-stats.cpp`：传入拥有 `count`/`total` 的函数对象，接收 classic `for_each` 返回值。
   输入 `{100,250,400}`，精确 stdout：`count=3\ntotal=750\n`。

## 16. 实现矩阵与确定性审查

| 条目              | 示例 1                 | 示例 2                 | C++20 确定性风险防线           |
| ----------------- | ---------------------- | ---------------------- | ------------------------------ |
| `<map>`           | `ordered-statuses`     | `count-route-variants` | 依赖规范排序；同键只计数       |
| `<set>`           | `unique-features`      | `count-tags`           | 默认 string 排序、固定键计数   |
| `<unordered_set>` | `check-capabilities`   | 可省略                 | 不遍历、不输出桶信息           |
| `<queue>`         | `process-requests`     | `process-priorities`   | FIFO 与唯一整数优先级          |
| `<stack>`         | `unwind-route`         | 可省略                 | top/pop 前检查非空             |
| `<numeric>`       | `sum-bytes`            | `assign-sequence`      | 宽初值；只用经典 iota          |
| `binary_search`   | `check-number`         | `check-route`          | 输入排序；比较器双向一致       |
| `any_of`          | `has-large-value`      | `needs-retry`          | 不输出谓词调用次数             |
| `copy`            | `copy-values`          | `copy-routes`          | 目标有空间或独立 back inserter |
| `reverse`         | `reverse-values`       | `reverse-route`        | 不依赖异常后的部分状态         |
| `unique`          | `deduplicate-adjacent` | `deduplicate-services` | 只读取逻辑前缀；随后 erase     |
| `for_each`        | `double-values`        | `collect-stats`        | 使用无 policy 经典顺序重载     |

所有示例都应：

- manifest 声明 `standard: "c++20"` 与完整 `expectedStdout`；
- 不输出地址、哈希桶、执行策略访问次序、异常后的部分范围或实现定义信息；
- 不使用 `using namespace std;`；
- 使用直接头文件，不靠传递包含；
- 以项目警告配置编译并运行。

## 17. 实现审查清单

- [ ] 目录恰好新增本文 12 个条目，没有顺手加入 `multimap`、`multiset`、`iota` 等实体页。
- [ ] `<map>` 与 `<set>` 使用标准条款名 `[associative.map.syn]`、
      `[associative.set.syn]`，不伪造 `[map.syn]`、`[set.syn]`。
- [ ] 六个 header 页都有直接 include 警告、设施图、版本边界、选择边界和 outgoing links。
- [ ] `<queue>` 同时覆盖 queue 与 priority_queue，并提供两个不同示例。
- [ ] `<numeric>` 把 `iota` 标为 C++11、`reduce`/scans 标为 C++17、`midpoint` 标为 C++20。
- [ ] 没有把 C++23 ranges iota、push_range、formatter 或 C++26 容器 constexpr/饱和算术写成
      C++20。
- [ ] `binary_search` 没有 execution-policy 重载，并区分对数比较与非随机迭代器线性步进。
- [ ] `any_of` 明确空范围 false 和“至多 N 次”，不依赖谓词副作用次数。
- [ ] `copy` 明确目标容量、重叠方向、返回输出尾和部分完成。
- [ ] `reverse` 是恰好 N/2 swaps，经典返回 `void`。
- [ ] `unique` 只消除相邻重复，不改变 size，不读取逻辑尾内容。
- [ ] `for_each` 区分 classic 返回 f、policy 返回 void、ranges 返回 result object。
- [ ] 每个普通算法有两个确定性 C++20 示例和精确 stdout。
- [ ] 每组 substantive fact 的 manifest source 使用对应 Working Draft 条款、N4861 和必要历史
      WG21 资料。

## 18. 一级来源索引

### 18.1 版本与演进

- [WG21 1997 public review draft N2356](https://www.open-std.org/jtc1/sc22/open/n2356/)
- [C++11 working draft N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- [C++17 working draft N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
- [C++20 final working draft N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
- [P0024R2: The Parallelism TS Should be Standardized](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0024r2.html)
- [P0202R3: Add constexpr modifiers to `<algorithm>` and `<utility>`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)
- [P0896R4: The One Ranges Proposal](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)
- [P1645R1: constexpr for `<numeric>` algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1645r1.html)
- [P2440R1: ranges::iota, ranges::shift_left, and ranges::shift_right](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2440r1.html)
- [P0543R3: Saturation arithmetic](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p0543r3.html)
- [P1206R7: Conversions from ranges](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p1206r7.pdf)
- [P2286R8: Formatting ranges](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2286r8.html)
- [P2248R8: Enabling list-initialization for algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p2248r8.html)
- [P3179R9: C++ parallel range algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3179r9.html)

### 18.2 头文件与容器

- [`[associative.map.syn]`](https://eel.is/c++draft/associative.map.syn)
- [`[associative.set.syn]`](https://eel.is/c++draft/associative.set.syn)
- [`[unord.set.syn]`](https://eel.is/c++draft/unord.set.syn)
- [`[queue.syn]`](https://eel.is/c++draft/queue.syn)
- [`[stack.syn]`](https://eel.is/c++draft/stack.syn)
- [`[numeric.ops.overview]`](https://eel.is/c++draft/numeric.ops.overview)
- [`[associative.reqmts]`](https://eel.is/c++draft/associative.reqmts)
- [`[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- [`[container.adaptors]`](https://eel.is/c++draft/container.adaptors)

### 18.3 算法合同

- [`[alg.binary.search]`](https://eel.is/c++draft/alg.binary.search)
- [`[alg.any.of]`](https://eel.is/c++draft/alg.any.of)
- [`[alg.copy]`](https://eel.is/c++draft/alg.copy)
- [`[alg.reverse]`](https://eel.is/c++draft/alg.reverse)
- [`[alg.unique]`](https://eel.is/c++draft/alg.unique)
- [`[alg.foreach]`](https://eel.is/c++draft/alg.foreach)
- [`[algorithms.requirements]`](https://eel.is/c++draft/algorithms.requirements)
- [`[algorithms.parallel.exceptions]`](https://eel.is/c++draft/algorithms.parallel.exceptions)

## 19. 研究结论

第五批形成两个完整闭环：六个头文件页把第四批容器实体和数值算法放回可导航的标准设施图；六个
算法页覆盖存在性查询、范围复制、逆序、相邻去重和逐项执行。每个条目都有独立搜索意图和不同的
正确性边界，不是为了增加条目数而拆分同一内容。

实现中最高风险是当前草案泄漏、`binary_search` 的虚构 policy 重载、`copy` 的重叠/容量错误、
`unique` 被误解为容器删除，以及 `for_each` 三个家族的返回与执行语义被合并。本研究把这些风险
转化为可检查的声明、示例输出和 source 关系，内容实现应逐项遵守。
