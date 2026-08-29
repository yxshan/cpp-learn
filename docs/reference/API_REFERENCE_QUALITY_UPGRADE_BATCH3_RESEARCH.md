# C++ Reference 内容质量升级第三批：核心条目真实示例研究

> 状态：研究完成，供内容实现使用
> 研究日期：2026-08-28
> 审计范围：`std::vector`、`std::vector::push_back`、`std::vector::reserve`、`std::array`、`std::deque`、`std::unordered_map`、`std::sort`、`std::find`、`std::string`、`std::unique_ptr`、`std::cin`、`std::cout`
> 事实来源：当前 C++ Working Draft（eel.is）及 WG21/open-std 一级资料；本文不使用 cppreference、博客或问答网站作为规范事实依据

## 1. 研究目标与边界

本批为 12 个已经具备基础示例的实体页各补充一个“真实但足够小”的 C++20 示例。第二示例必须比现有的整数演示更接近软件与 Web 开发中的批处理、路由、请求、状态输出和资源所有权，同时仍能在离线判题环境中产生跨实现稳定的结果。

本文明确区分两类结论：

- **规范事实**：标准直接规定的语义、前置条件、复杂度、失效、异常或版本边界；每项都附一级来源。
- **教学建议**：为了让初学者建立可靠心智模型而选用的场景、命名、输出与讲解顺序；它不是标准对工程方案的推荐。

示例统一以项目的 C++20 编译基线运行，不读取时钟、随机源、网络、文件、地址或实现相关容量/桶数，不依赖无序容器遍历顺序、排序稳定性、移动后普通对象的具体值、区域设置相关的浮点格式，也不执行任何已失效句柄。

当前 Working Draft 包含晚于 C++20 的设施，因此实现时不能把 draft 中的 `constexpr`、范围重载或新增声明无条件写成 C++20 能力。历史边界需要以版本化 WG21 文本核实；当前行为则以 Working Draft 为主。[C++20 final working draft N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)；[current Working Draft library clauses](https://eel.is/c++draft/library)

## 2. 当前内容审计与批次结论

| 条目 | 现有示例作用 | 第二示例应补足 | 必须同步修正或强化的内容 |
| --- | --- | --- | --- |
| `std::vector` | 列表初始化并输出大小 | 聚合一批订单记录 | “连续”排除 `vector<bool>`；范围遍历不改变容器 |
| `push_back` | 追加两个整数 | 移动一个拥有字符串的请求进入队列 | 不观察移动后普通对象的具体内容；精确失效与异常边界 |
| `reserve` | `size()` 不变且 `capacity() >= n` | 已知批量规模下保存元素地址 | 必须先 `reserve` 再取得地址；不得输出确切容量 |
| `array` | 固定大小和首尾访问 | 固定构建流水线 | `N == 0` 的 `data()` 未指定；“不动态增长”不等于规定栈存储 |
| `deque` | 两端插入 | 有上限的最近延迟窗口 | 删除规则按首、尾、中间精确拆分 |
| `unordered_map` | 只读 `find`/`contains` | 用 `operator[]` 有意计数 | 平均/最坏复杂度；不能遍历生成期望输出 |
| `sort` | 整数升序 | 带确定性平局规则的候选人排名 | `sort` 不保证稳定；比较器必须建立严格弱序 |
| `find` | 找到后输出位置 | 查找首个失败流水线阶段 | 必须先与 `last` 比较；结果生命周期依赖原范围 |
| `string` | `+=` 追加 | 拆分 `key=value` 配置项 | 修正 `operator[]` 的 `pos == size()` 特例 |
| `unique_ptr` | 同类型所有权移动 | 工厂返回多态服务 | 基类默认删除需要虚析构；删除器不得抛出 |
| `cin` | 读取两个整数 | 读取至 EOF 的批量求和 | 循环测试提取结果；不要预先测试 `eof()` |
| `cout` | 拼接文本与整数 | 同一标识符的十进制/十六进制输出 | `hex` 会保持，示例必须恢复 `dec` |

## 3. 跨条目统一要求

### 3.1 只演示有效状态

容器引用、指针和迭代器的有效性是不同维度。示例若要教学失效规则，只能继续使用标准明确保证有效的观察者；不能通过“程序似乎还能输出旧值”来展示悬空指针或失效迭代器。`vector` 重分配使元素引用、指针和迭代器全部失效，而 `deque` 端点插入使全部迭代器失效、却保留已有元素引用。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)；[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

### 3.2 不把实现选择写进期望输出

`reserve(n)` 只保证必要时得到至少 `n` 的容量，不保证容量恰等于 `n`；无序容器绝对遍历顺序未指定，默认桶数及增长序列也不是可移植输出；`std::sort` 不提供稳定性保证。判题只能输出由值语义和显式规则决定的字段。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)；[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)；[Working Draft `[sort]`](https://eel.is/c++draft/sort)；[Working Draft `[stable.sort]`](https://eel.is/c++draft/stable.sort)

### 3.3 复杂度与工程建议分开

标准库复杂度通常按比较、移动、赋值或元素操作次数描述，不等同于实际延迟、分配次数、缓存命中率或 I/O 时间。内容可以把连续批处理、预留容量和哈希表计数标成常见工程用法，但不能把这些建议冒充标准性能承诺。[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)；[Working Draft `[algorithms.parallel.user]`](https://eel.is/c++draft/algorithms.parallel.user)

### 3.4 示例版本标签

12 个新增示例统一标记 `standard: "c++20"`。这表示项目实际编译模式，不表示示例使用的每项能力均始于 C++20。正文仍应分别写实体首次出现及关键演进，例如 `unique_ptr` 始于 C++11、`make_unique` 始于 C++14，经典 `sort`/`find` 的非策略重载在 C++20 成为 `constexpr`。[WG21 N3337 library clauses](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)；[WG21 N3656 `make_unique`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3656.htm)；[WG21 P0202R3 constexpr algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)

## 4. `std::vector`

### 4.1 规范事实

`vector` 提供尾端摊销常数时间插入/删除，中间插入/删除为线性；当元素类型不是 `bool` 时，它满足连续容器要求。`data()` 返回指向元素范围的指针，并保证从 `data()` 起、长度为 `size()` 的半开范围有效，因此可在指针保持有效期间把普通 `vector<T>` 交给接收连续 `T` 范围的接口。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[vector.data]`](https://eel.is/c++draft/vector.data)

重分配会使全部元素引用、指针、迭代器与尾后迭代器失效；未重分配并不自动意味着所有操作都保留句柄，仍要按具体成员规则判断。例如不重分配的插入会使插入点及之后的句柄失效。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

`vector` 从 C++98 已存在；C++20 使其大量成员可用于常量求值，但动态分配必须在同一常量求值中释放。新增示例只要求 C++20 项目基线，不应把“连续存储”表述成 C++20 才出现的能力。[WG21 1997 public review draft `[lib.vector]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html)；[WG21 P1004R2 Making `std::vector` constexpr](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1004r2.pdf)

### 4.2 教学建议与示例方案

新增 `sum-batch.cpp`：用 `std::vector<Order>` 保存一批订单记录，通过只读范围遍历累计 `units`，输出批量大小和总数量。该场景把 `vector` 用于同类型业务对象批处理，而不是继续演示裸整数下标。

- API/概念：聚合元素、列表初始化、`size()`、const 范围遍历。
- 前置条件：累计值不发生整数溢出；循环不修改容器结构。
- 复杂度：`size()` 为常数，求和循环线性于元素数；这是两个不同层次的成本。
- 生命周期：循环引用只在当前迭代中借用元素，不保存到容器外。
- 异常：构造 `vector` 可因分配或元素构造失败而抛异常；只读整数求和本身不引发库分配。
- 确定输出：`3 24\n`，不输出地址或容量。

正文需把“通常是首选”明确标为教学/工程建议，并增加 `vector<bool>` 不是普通连续 `bool` 元素容器的例外。[Working Draft `[vector.bool]`](https://eel.is/c++draft/vector.bool)

## 5. `std::vector::push_back`

### 5.1 规范事实

`push_back(const T&)` 从 C++98 即有，右值重载 `push_back(T&&)` 随 C++11 移动语义加入；两个非策略成员在 C++20 成为 `constexpr`。当前声明及统一的插入规则位于 `[vector.modifiers]`。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)；[WG21 N3337 `[vector.modifiers]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)；[WG21 P1004R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1004r2.pdf)

新大小大于旧容量时发生重分配，全部元素引用、指针和迭代器失效；否则，尾端插入点之前的元素句柄保持有效，旧 `end()` 失效。复杂度在重分配时线性于结果元素数，一系列尾插的容器级复杂度为摊销常数。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)；[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)

单元素尾插在 `T` 可复制插入或无抛移动构造时具有“抛异常则无效果”的保证；若非可复制元素只能使用可能抛异常的移动构造，发生该移动异常后的效果未指定。教学页不应把它压缩成无条件“强异常保证”。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

### 5.2 教学建议与示例方案

新增 `append-moved-request.cpp`：构造包含路径字符串的 `Request`，用 `std::move` 把它交给请求队列；只输出容器内请求数量和路径，不输出移动后源对象的内容。

- API/概念：`push_back(T&&)`、`std::move`、聚合业务对象、容器拥有元素。
- 前置条件：`Request` 满足 MoveInsertable 要求。
- 复杂度：尾插摊销常数，某次重分配可线性移动/复制已有元素。
- 生命周期：容器中的字符串是独立对象；移动后源字符串仍有效但状态未指定，示例不得断言其为空。[Working Draft `[lib.types.movedfrom]`](https://eel.is/c++draft/lib.types.movedfrom)
- 异常：分配、字符串构造或移动/复制都可能影响操作；正文采用上面的精确条件保证。
- 确定输出：`1 /health\n`。

## 6. `std::vector::reserve`

### 6.1 规范事实

若 `n > capacity()`，`reserve(n)` 发生重分配并使容量至少为 `n`；否则不重分配且容量保持原值。它不改变 `size()`。调用后，在一次插入会使 `size()` 超过当前 `capacity()` 之前，不得再次发生重分配。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)

重分配使全部元素引用、指针、迭代器和尾后迭代器失效；没有重分配则它们保持有效。`reserve` 最坏线性于当前大小，`n > max_size()` 抛 `length_error`，分配器也可抛出相应异常。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)

`reserve` 从 C++98 存在，C++20 起可为 `constexpr`。现有页面的版本边界正确，但“保存元素地址”必须补上操作顺序：先完成可能重分配的 `reserve`，再取得地址，并确保后续插入不越过容量且没有其他失效操作。[WG21 1997 draft `[lib.vector.capacity]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html)；[WG21 P1004R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1004r2.pdf)

### 6.2 教学建议与示例方案

新增 `retain-reference.cpp`：已知一批有三个服务名，先 `reserve(3)`，插入首个字符串后保存其指针，再追加至三个元素，最后输出首服务名并比较该指针仍等于 `&front()`。示例只使用保证仍有效的指针。

- API/概念：`reserve`、`capacity` 边界、尾插、元素指针。
- 前置条件：保存指针前已经调用 `reserve(3)`；最终大小不超过调用后的实际 `capacity()`。
- 复杂度：`reserve` 最坏线性于调用时已有元素数；之后三次尾插在该容量范围内不重分配。
- 生命周期：指针借用第一个元素，不能超过 `vector` 生命周期或后续失效操作。
- 异常：若 `reserve` 抛出标准所述异常，通常无效果，但非可复制元素的抛异常移动构造是标准列出的例外。
- 确定输出：`api true\n`；不得输出确切 `capacity()`。

## 7. `std::array`

### 7.1 规范事实

`array<T, N>` 存储恰好 `N` 个 `T`，`size() == N` 是不变量；它是连续容器，也是可用最多 `N` 个可转换元素进行列表初始化的聚合。`N` 是类型的一部分。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)

`N == 0` 时 `begin() == end()`，但 `data()` 返回值未指定，`front()` 和 `back()` 的非空前置条件不成立。内容应补充这一精确边界，而不是用“通常是 null”一类实现观察替代规范。[Working Draft `[array.zero]`](https://eel.is/c++draft/array.zero)；[Working Draft `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)

`array` 始于 C++11。标准规定固定元素数、聚合和连续容器语义，但不规定 `array` 对象必须在“栈上”；存储期取决于对象本身如何创建。现有“容器不分配可增长的动态存储”可以保留，但不要改写成存储位置承诺。[WG21 N3337 `[array]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)；[Working Draft `[basic.stc]`](https://eel.is/c++draft/basic.stc)

### 7.2 教学建议与示例方案

新增 `fixed-pipeline.cpp`：用 `constexpr std::array<std::string_view, 3>` 保存固定的 `build`、`test`、`deploy` 流水线，输出阶段数和第二阶段。

- API/概念：聚合列表初始化、固定大小、`constexpr` 对象、`size()` 和下标访问。
- 前置条件：下标 `1` 在固定大小 `3` 的有效范围内。
- 复杂度：`size()` 和下标访问为常数。
- 生命周期：元素与 `array` 对象同寿命；没有增长或重分配。
- 异常：示例使用只读 `string_view` 观察，不进行动态分配；一般 `array` 的元素操作仍可抛出元素类型自身的异常。
- 确定输出：`3 test\n`。

教学文字可推荐 `array` 用于编译期固定流水线或协议表，但这只是场景建议。

## 8. `std::deque`

### 8.1 规范事实

`deque` 是提供随机访问迭代器的顺序容器；首尾单元素插入/删除为常数时间，中间操作线性。标准没有把它规定为连续容器。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)

端点插入使全部迭代器失效，但不影响已有元素引用；中间插入使全部迭代器和引用失效。删除最后元素会额外使旧尾后迭代器失效；删除首元素但不是末元素只使被删元素句柄失效；严格中间删除使全部元素迭代器/引用及尾后迭代器失效。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

`deque` 始于 C++98。新增示例只使用 C++98 已有的 `push_back`/`pop_front` 语义并以 C++20 编译；不能因当前 draft 把成员标成 `constexpr` 就回写成 C++20 版本能力。[WG21 1997 draft `[lib.deque]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html)；[current Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)

### 8.2 教学建议与示例方案

新增 `recent-latencies.cpp`：按到达顺序 `push_back` 四个延迟值，若大小超过上限三则 `pop_front`，最后按顺序输出保留的最近三个值。

- API/概念：尾端追加、首端删除、固定窗口、顺序迭代。
- 前置条件：只在非空时 `pop_front`；示例通过 `size() > limit` 满足此前置条件。
- 复杂度：每次端点单元素插入/删除为常数，最终输出线性于保留元素数。
- 生命周期：示例在修改前不保存迭代器、指针或引用，因此不依赖失效后的观察。
- 异常：端点单元素插入若抛异常则无效果；输出仍可能通过流状态报告失败。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)
- 确定输出：`15 18 21\n`。

现有删除段落中的“通常”应替换为上面的精确三分规则。

## 9. `std::unordered_map`

### 9.1 规范事实

`unordered_map` 支持唯一键，元素按哈希和键等价关系组织。绝对遍历顺序未指定；大多数操作最坏为线性，常见查询和单元素插入平均为常数。内容不能只写“O(1)”也不能通过遍历生成判题输出。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)；[Working Draft unordered requirements table](https://eel.is/c++draft/unord.req)

对键调用 `operator[]` 等价于 `try_emplace(key).first->second`：键缺失时会插入并返回映射值引用。因此它适合“缺失计数从零开始”的写场景，不适合纯存在性查询。[Working Draft `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem)

插入可能 rehash 并使全部迭代器失效，但不会使已有元素指针/引用失效；删除只使被删元素句柄失效。`rehash` 平均线性于元素数，最坏二次，现有“最坏可以更高”应改为精确口径。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)；[Working Draft unordered requirements table](https://eel.is/c++draft/unord.req)

`unordered_map` 始于 C++11；`contains` 始于 C++20。第二示例只需 C++11 的 `operator[]`/`at`，但以项目 C++20 基线运行。[WG21 N3337 `[unord.map]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)；[WG21 P0458R2 contains](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0458r2.html)

### 9.2 教学建议与示例方案

新增 `count-events.cpp`：按固定事件序列执行 `++counts[event]`，最后只用固定键 `at("login")` 和 `at("logout")` 输出计数。

- API/概念：有意使用 `operator[]` 默认插入、`at` 只读访问、哈希键值计数。
- 前置条件：映射类型 `int` 能从空参数构造为零；输出的两个键均已插入。
- 复杂度：每次访问平均常数、最坏线性；不能承诺实时上界。
- 生命周期：示例不保留迭代器，插入触发 rehash 也不会造成后续非法使用。
- 异常：哈希、键比较、分配、键构造均可能抛异常；`at` 对缺失键抛 `out_of_range`。[Working Draft `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem)；[Working Draft `[unord.req.except]`](https://eel.is/c++draft/unord.req.except)
- 确定输出：`login=2\nlogout=1\n`；禁止遍历整个 map。

## 10. `std::sort`

### 10.1 规范事实

经典 `std::sort` 要求随机访问迭代器并原地重排 `[first, last)`；比较器必须建立严格弱序。其比较次数为 `O(N log N)`，值类型还必须满足可交换、可移动构造和可移动赋值要求。[Working Draft `[alg.sorting.general]`](https://eel.is/c++draft/alg.sorting.general)；[Working Draft `[sort]`](https://eel.is/c++draft/sort)

`std::sort` 没有稳定性保证；`std::stable_sort` 才明确标记为 stable。若判题需要等主键元素的确定次序，应在比较器中加入确定的次键，或明确选择 `stable_sort` 并保证输入等价元素原顺序本身确定。[Working Draft `[sort]`](https://eel.is/c++draft/sort)；[Working Draft `[stable.sort]`](https://eel.is/c++draft/stable.sort)

经典 `sort` 始于 C++98；执行策略重载始于 C++17；非策略重载及 `ranges::sort` 在 C++20 可用于常量求值/范围算法。当前实体页聚焦经典 `std::sort`，无需把 ranges 签名混入主声明，但版本说明应避免暗示只有两个重载存在。[WG21 1997 draft algorithms](https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html)；[WG21 P0024R2 parallel algorithms](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0024r2.html)；[WG21 P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)

### 10.2 教学建议与示例方案

新增 `rank-candidates.cpp`：保存 `{name, score}` 记录，先按分数降序，再按姓名字典序打破平局，输出排序后的三条记录。

- API/概念：自定义比较器、原地排序、显式次键、严格弱序。
- 前置条件：比较器不修改记录，且对所有记录建立严格弱序；范围有效且元素可移动/交换。
- 复杂度：`O(N log N)` 次比较；字符串次键比较自身成本不应被隐藏成一次机器指令。
- 生命周期：排序改变元素位置；此前依赖“某记录位于某下标”的观察必须重新建立。
- 异常：非执行策略重载传播比较、交换或移动中的异常；示例比较整数与字符串。
- 确定输出：`Lin:95\nMing:95\nZhao:80\n`。

这里的次键是教学上的可复现策略，不是标准要求所有排序都必须添加次键。

## 11. `std::find`

### 11.1 规范事实

经典 `find` 从 `[first, last)` 起点开始测试 `*i == value`，返回第一个成立的位置，未找到返回 `last`；最多执行 `last - first` 次对应比较。它只要求输入迭代器，不要求随机访问。[Working Draft `[alg.find]`](https://eel.is/c++draft/alg.find)

结果迭代器不拥有元素。解引用前必须检查结果不等于 `last`，且后续容器操作不能已经使结果失效。`find` 只返回第一个匹配项，不提供匹配数量。[Working Draft `[alg.find]`](https://eel.is/c++draft/alg.find)；[Working Draft `[iterator.requirements.general]`](https://eel.is/c++draft/iterator.requirements.general)

经典 `find` 始于 C++98；执行策略重载始于 C++17；经典非策略重载的 `constexpr` 与 `ranges::find` 始于 C++20。当前 draft 还包含晚于 C++20 的默认值类型演进，实现内容不应把当前完整声明倒灌到 C++20 示例。[WG21 1997 draft algorithms](https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html)；[WG21 P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)；[WG21 P0896R4 ranges](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)

### 11.2 教学建议与示例方案

新增 `find-failed-stage.cpp`：在固定的 `std::array<StageState, 4>` 中查找第一个 `failed`，先检查结果不等于 `end()`，再通过 `std::distance` 输出从零开始的位置。

- API/概念：半开范围、第一个命中、未命中哨兵、枚举相等、迭代器距离。
- 前置条件：范围有效，元素与目标的 `==` 表达式有效；仅在 `failed != end()` 后计算并使用位置。
- 复杂度：查找最多比较四个元素；`array` 随机访问迭代器的 `distance` 为常数。
- 生命周期：返回迭代器只在固定数组仍存活时有效；示例立即使用，不跨作用域保存。
- 异常：枚举相等比较与数组迭代不分配。
- 确定输出：`failed-at=2\n`。

“小型固定流水线用线性查找”是教学场景，不是对任意规模状态系统的性能建议。

## 12. `std::string`

### 12.1 规范事实

`std::string` 是 `basic_string<char>` 的别名；`basic_string` 保存可变数量的 char-like 对象并满足连续容器要求。从 `data()` 起、长度为 `size()` 的半开范围有效，`data() + size()` 指向值为 `charT()` 的终止对象。[Working Draft `[basic.string.general]`](https://eel.is/c++draft/basic.string.general)

现有内容把“越界使用 `operator[]`”笼统写成未定义行为，需要精确修正：当前标准前置条件为 `pos <= size()`；当 `pos` 恰好等于 `size()` 时，`operator[]` 返回终止字符。程序不得把该终止字符改成非 `charT()`。`at(pos)` 则在 `pos >= size()` 时抛 `out_of_range`。[Working Draft `[string.access]`](https://eel.is/c++draft/string.access)；[Working Draft `[basic.string.general]`](https://eel.is/c++draft/basic.string.general)

`find` 未找到时返回 `npos`；`substr(pos, n)` 构造并返回一个拥有内容的新 `basic_string`，若 `pos > size()` 则构造路径抛 `out_of_range`。示例必须先处理 `npos`，不能盲目计算 `npos + 1`。[Working Draft `[string.find]`](https://eel.is/c++draft/string.find)；[Working Draft `[string.substr]`](https://eel.is/c++draft/string.substr)；[Working Draft `[string.cons]`](https://eel.is/c++draft/string.cons)

`std::string` 始于 C++98；连续性在现代标准中为明确要求；大量 `basic_string` 操作在 C++20 成为 `constexpr`。第二示例使用的 `find`/`substr` 很早即存在，但仍统一以 C++20 编译。[WG21 1997 draft `[lib.basic.string]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-strings.html)；[WG21 P0980R1 constexpr string](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0980r1.pdf)

### 12.2 教学建议与示例方案

新增 `parse-setting.cpp`：把固定配置 `mode=release` 按首个 `=` 拆为拥有型 `key` 与 `value`；代码先检查 `npos` 再计算值起点。

- API/概念：`find`、`npos`、`substr`、拥有型结果、长度/位置。
- 前置条件：只有在 `marker != npos` 时才计算 `marker + 1`。
- 复杂度：示例包含搜索与构造新字符串；正文不为所有重载发明统一 O(1) 结论。
- 生命周期：`key` 和 `value` 是独立拥有内容的字符串，不依赖原 `setting` 的内部指针。
- 异常：`substr` 的无效起点可抛 `out_of_range`，分配也可失败；示例分支保证位置有效。
- 确定输出：`mode -> release\n`。

正文还应把“`size()` 对 UTF-8 返回字节数”改写得更严格：`size()` 返回 `char` 元素数；当对象保存 UTF-8 编码单元时，通常对应编码字节数，而不是 Unicode 标量值或用户感知字符数。

## 13. `std::unique_ptr`

### 13.1 规范事实

`unique_ptr` 表达独占所有权：复制操作不可用，移动构造把先前的指针值交给目标并保证源 `get() == nullptr`。转换移动构造允许 `unique_ptr<Derived>` 在指针和删除器满足约束时转为 `unique_ptr<Base>`。[Working Draft `[unique.ptr]`](https://eel.is/c++draft/unique.ptr)；[Working Draft `[unique.ptr.single.ctor]`](https://eel.is/c++draft/unique.ptr.single.ctor)

默认删除器最终对指针执行 `delete`。若静态类型为基类、动态对象为派生类，普通 delete 要求基类具有虚析构（除非使用标准所述 destroying delete 情况），否则行为未定义；多态工厂示例必须声明虚析构。[Working Draft `[unique.ptr.dltr.dflt]`](https://eel.is/c++draft/unique.ptr.dltr.dflt)；[Working Draft `[expr.delete]`](https://eel.is/c++draft/expr.delete)

`unique_ptr` 析构在非空时调用删除器；若删除器调用抛异常，行为未定义。当前页面只写“删除器必须正确释放资源”过于简略，应补上删除器不得抛出的边界。[Working Draft `[unique.ptr.single.dtor]`](https://eel.is/c++draft/unique.ptr.single.dtor)

`unique_ptr` 始于 C++11，`make_unique` 始于 C++14。示例返回 `unique_ptr<Base>`，使用 `make_unique<Derived>`，因此最早需要 C++14，项目仍以 C++20 编译。[WG21 N3337 `[unique.ptr]`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)；[WG21 N3656 `make_unique`](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3656.htm)

### 13.2 教学建议与示例方案

新增 `polymorphic-factory.cpp`：抽象 `Service` 声明虚析构与 `name()`，`Worker` 实现它；工厂返回 `std::unique_ptr<Service>`，内部用 `std::make_unique<Worker>()`，主函数输出服务名。

- API/概念：工厂返回所有权、多态访问、派生到基类的转换移动、RAII。
- 前置条件：`Service` 具有可访问虚析构；指针非空后才使用 `operator->`。
- 复杂度：`unique_ptr` 句柄转移为固定数量的指针/删除器操作；动态分配实际成本不由页面承诺。
- 生命周期：调用者独占处理器；离开作用域自动经虚析构销毁完整派生对象。
- 异常：`make_unique` 可因分配或对象构造失败抛异常，不会泄漏已交由它管理的资源；删除器不得抛出。
- 确定输出：`worker\n`。

“无需动态生命周期时优先按值保存”继续标为教学建议，不是标准对架构的要求。

## 14. `std::cin`

### 14.1 规范事实

`cin` 是与 C `stdin` 关联的预定义 `istream` 对象，初始化后 `cin.tie() == &cout`。格式化输入构造 sentry，通常按流的 `skipws` 设置跳过前导空白，并通过流状态报告结果。[Working Draft `[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects)；[Working Draft `[istream.sentry]`](https://eel.is/c++draft/istream.sentry)；[Working Draft `[istream.formatted.reqmts]`](https://eel.is/c++draft/istream.formatted.reqmts)

读取遇到 EOF 会设置 `eofbit`；输入期间异常会设置 `badbit`；数值转换越界会设置 `failbit` 并按目标类型边界存值。格式化提取在没有异常传播时返回 `*this`，因此 `while (std::cin >> value)` 同时尝试读取并检查 `fail()` 状态。[Working Draft `[istream.formatted.reqmts]`](https://eel.is/c++draft/istream.formatted.reqmts)；[Working Draft `[istream.formatted.arithmetic]`](https://eel.is/c++draft/istream.formatted.arithmetic)；[Working Draft `[basic.ios.members]`](https://eel.is/c++draft/basic.ios.members)

`cin` 始于 C++98；新增循环不依赖晚于 C++98 的流功能，但示例使用项目 C++20 代码风格和编译基线。[WG21 1997 draft iostream objects](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html)

### 14.2 教学建议与示例方案

新增 `sum-stream.cpp`：持续读取整数，成功一次就增加数量与总和，输入关闭或失败后输出汇总。manifest 显式提供有限 stdin。

- API/概念：格式化提取、提取表达式的布尔测试、EOF 终止、流状态。
- 前置条件：测试环境在提供完 stdin 后关闭输入；整数和总和不溢出。
- 复杂度：每个值读取一次；标准不为外部设备 I/O 提供统一时间复杂度。
- 生命周期/状态：循环退出后流处于失败状态，除非 `clear()` 并处理剩余输入，否则不应继续假定提取成功。
- 异常：默认通常通过状态位报告；若 `exceptions()` 掩码启用相应位，`setstate` 可抛异常。[Working Draft `[basic.ios.members]`](https://eel.is/c++draft/basic.ios.members)
- stdin：`10 20 30\n`。
- 确定输出：`3 60\n`。

示例不输出最终 `eofbit`/`failbit` 的具体组合，只教学“以提取成功作为循环条件”，避免把标志组合误当成所有输入协议的唯一结果。

## 15. `std::cout`

### 15.1 规范事实

`cout` 是与 C `stdout` 关联的预定义 `ostream` 对象。格式化输出创建 sentry，生成失败设置 `failbit`，输出期间发生异常设置 `badbit`；是否抛出还取决于 `exceptions()` 掩码。[Working Draft `[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects)；[Working Draft `[ostream.formatted.reqmts]`](https://eel.is/c++draft/ostream.formatted.reqmts)

整数格式由流的 `basefield` 等格式标志控制；`std::hex` 把 `basefield` 设为十六进制，`std::dec` 恢复十进制。这些标志保存在流上，不会像某些字段宽度一样在一次插入后自动恢复，因此共享 `cout` 时应有意识地重置。[Working Draft `[fmtflags.manip]`](https://eel.is/c++draft/fmtflags.manip)；[Working Draft `[ostream.formatted.arithmetic]`](https://eel.is/c++draft/ostream.formatted.arithmetic)

`'\n'` 只插入换行字符；`endl` 还调用 `flush()`。`cout` 与这些基础机制始于 C++98。[Working Draft `[ostream.manip]`](https://eel.is/c++draft/ostream.manip)；[WG21 1997 draft iostream objects](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html)

### 15.2 教学建议与示例方案

新增 `format-identifier.cpp`：先以默认十进制输出标识符 `42`，再写入字面量前缀 `0x` 并用 `std::hex` 输出 `2a`，最后显式恢复 `std::dec`。只使用正整数和 ASCII 文本，避免符号、浮点与区域设置差异。

- API/概念：链式 `operator<<`、`std::hex`、`std::dec`、持久格式状态、换行但不强制刷新。
- 头文件边界：`std::hex`/`std::dec` 由 `<ios>` 声明，而 `<iostream>` 明示包含 `<ios>`，所以该示例只需直接包含 `<iostream>`；`<iomanip>` 面向 `setw` 等带参数操纵器，并非此示例所需。`0x` 是示例显式输出的文本，不是 `showbase` 产生。[Working Draft `[ios.syn]`](https://eel.is/c++draft/ios.syn)；[Working Draft `[iostream.syn]`](https://eel.is/c++draft/iostream.syn)；[Working Draft `[iomanip.syn]`](https://eel.is/c++draft/iomanip.syn)
- 复杂度：标准不为通用 `cout` 写入给出统一时间复杂度；示例只承诺输出文本。
- 状态：`hex` 会影响之后的整数输出，所以示例结束前恢复 `dec`；不要让共享流的隐藏状态泄漏到后续代码。
- 异常：默认失败通过流状态报告；异常掩码可使操作抛 `ios_base::failure`。
- 确定输出：

```text
decimal=42
hex=0x2a
```

“普通换行优先 `\n`，确需刷新再用 `endl`”是避免无谓刷新开销的教学建议；规范事实只是两者效果不同。

## 16. 实现检查清单

### 16.1 文件与判题数据映射

| Entry ID | 新示例文件 | stdin | `expectedStdout` | 核心验收点 |
| --- | --- | --- | --- | --- |
| `std-vector` | `sum-batch.cpp` | 无 | `3 24\n` | 聚合业务对象并只读遍历 |
| `std-vector-push-back` | `append-moved-request.cpp` | 无 | `1 /health\n` | 右值移动；不观察移动后源值 |
| `std-vector-reserve` | `retain-reference.cpp` | 无 | `api true\n` | 先 reserve 后取指针，最终大小不越容量 |
| `std-array` | `fixed-pipeline.cpp` | 无 | `3 test\n` | 固定 constexpr 流水线、有效下标 |
| `std-deque` | `recent-latencies.cpp` | 无 | `15 18 21\n` | `push_back` + `pop_front`，不保留失效句柄 |
| `std-unordered-map` | `count-events.cpp` | 无 | `login=2\nlogout=1\n` | 只按固定键输出，不遍历容器 |
| `std-sort` | `rank-candidates.cpp` | 无 | `Lin:95\nMing:95\nZhao:80\n` | 比较器含次键，不依赖稳定性 |
| `std-find` | `find-failed-stage.cpp` | 无 | `failed-at=2\n` | 检查 `end` 后再求位置 |
| `std-string` | `parse-setting.cpp` | 无 | `mode -> release\n` | 先检查 `npos` 再加一 |
| `std-unique-ptr` | `polymorphic-factory.cpp` | 无 | `worker\n` | 基类虚析构，工厂返回独占所有权 |
| `std-cin` | `sum-stream.cpp` | `10 20 30\n` | `3 60\n` | `while (cin >> value)`，由 EOF 结束 |
| `std-cout` | `format-identifier.cpp` | 无 | `decimal=42\nhex=0x2a\n` | `hex` 后恢复 `dec`，不使用 `endl` |

### 16.2 内容实现要求

- [x] 12 个 manifest 各追加一个 `kind: "run"`、`standard: "c++20"` 的示例，并把 entry `version` 从 1 升为 2。
- [x] 每个示例单独编译运行，实际 stdout 与 manifest 完全一致；`std::cin` 示例同时验证 stdin 注入。
- [x] 所有源码直接包含自己使用实体所属的头文件，不依赖传递包含。
- [x] `std::vector` 增加 `vector<bool>` 连续性例外。
- [x] `push_back` 不断言普通移动后对象为空，并精确陈述异常保证条件。
- [x] `reserve` 强调先预留、后取地址，且不输出确切容量。
- [x] `std::array` 补 `N == 0` 的 `data()` 未指定与非“必在栈上”边界。
- [x] `std::deque` 把删除失效规则从“通常”改为首/尾/中间三种精确情况。
- [x] `std::unordered_map` 把 rehash 最坏复杂度明确为二次，并禁止依赖迭代顺序。
- [x] `std::sort` 增加“不保证稳定”以及比较器严格弱序的可操作解释。
- [x] `std::find` 保留返回 `last` 检查，并注明结果借用原范围。
- [x] `std::string` 修正 `operator[]` 在位置恰好等于 `size()` 时的终止字符特例，示例先处理 `npos`。
- [x] `std::unique_ptr` 增加多态删除的虚析构条件和删除器不得抛出。
- [x] `std::cin` 说明循环退出后的流状态，不使用 `while (!eof())`。
- [x] `std::cout` 增加 `hex`/`dec` 等格式标志会保持、需要有意识恢复的说明。
- [x] manifest 的 `sources` 补入本页实际陈述所依赖的一级来源，`verifiedAt` 更新为实现验证日期。

## 17. 一级来源索引

### 17.1 当前 Working Draft

- 容器通用复杂度与要求：[container.requirements.pre](https://eel.is/c++draft/container.requirements.pre)
- `vector` 概览、数据、容量与修改器：[vector.overview](https://eel.is/c++draft/vector.overview)、[vector.data](https://eel.is/c++draft/vector.data)、[vector.capacity](https://eel.is/c++draft/vector.capacity)、[vector.modifiers](https://eel.is/c++draft/vector.modifiers)
- `vector<bool>`：[vector.bool](https://eel.is/c++draft/vector.bool)
- 移动后库类型：[lib.types.movedfrom](https://eel.is/c++draft/lib.types.movedfrom)
- `array` 概览与零长度：[array.overview](https://eel.is/c++draft/array.overview)、[array.zero](https://eel.is/c++draft/array.zero)
- `deque` 概览与修改器：[deque.overview](https://eel.is/c++draft/deque.overview)、[deque.modifiers](https://eel.is/c++draft/deque.modifiers)
- 无序容器要求、元素访问与异常：[unord.req](https://eel.is/c++draft/unord.req)、[unord.req.general](https://eel.is/c++draft/unord.req.general)、[unord.map.elem](https://eel.is/c++draft/unord.map.elem)、[unord.req.except](https://eel.is/c++draft/unord.req.except)
- 排序规则：[alg.sorting.general](https://eel.is/c++draft/alg.sorting.general)、[sort](https://eel.is/c++draft/sort)、[stable.sort](https://eel.is/c++draft/stable.sort)
- 查找：[alg.find](https://eel.is/c++draft/alg.find)
- 字符串：[basic.string.general](https://eel.is/c++draft/basic.string.general)、[string.access](https://eel.is/c++draft/string.access)、[string.find](https://eel.is/c++draft/string.find)、[string.substr](https://eel.is/c++draft/string.substr)、[string.cons](https://eel.is/c++draft/string.cons)
- 独占指针与删除：[unique.ptr](https://eel.is/c++draft/unique.ptr)、[unique.ptr.single.ctor](https://eel.is/c++draft/unique.ptr.single.ctor)、[unique.ptr.single.dtor](https://eel.is/c++draft/unique.ptr.single.dtor)、[unique.ptr.dltr.dflt](https://eel.is/c++draft/unique.ptr.dltr.dflt)、[expr.delete](https://eel.is/c++draft/expr.delete)
- 标准输入：[narrow.stream.objects](https://eel.is/c++draft/narrow.stream.objects)、[istream.sentry](https://eel.is/c++draft/istream.sentry)、[istream.formatted.reqmts](https://eel.is/c++draft/istream.formatted.reqmts)、[istream.formatted.arithmetic](https://eel.is/c++draft/istream.formatted.arithmetic)
- 标准输出与格式状态：[ios.syn](https://eel.is/c++draft/ios.syn)、[iostream.syn](https://eel.is/c++draft/iostream.syn)、[iomanip.syn](https://eel.is/c++draft/iomanip.syn)、[ostream.formatted.reqmts](https://eel.is/c++draft/ostream.formatted.reqmts)、[ostream.formatted.arithmetic](https://eel.is/c++draft/ostream.formatted.arithmetic)、[fmtflags.manip](https://eel.is/c++draft/fmtflags.manip)、[ostream.manip](https://eel.is/c++draft/ostream.manip)
- 流状态与异常掩码：[basic.ios.members](https://eel.is/c++draft/basic.ios.members)

### 17.2 版本化 WG21 文本

- C++98 前公开审查文本：[N2356 containers](https://www.open-std.org/jtc1/sc22/open/n2356/lib-containers.html)、[algorithms](https://www.open-std.org/jtc1/sc22/open/n2356/lib-algorithms.html)、[strings](https://www.open-std.org/jtc1/sc22/open/n2356/lib-strings.html)、[iostreams](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html)
- C++11 工作草案：[N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- C++20 最终工作草案：[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)
- `make_unique`：[N3656](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3656.htm)
- 并行算法重载：[P0024R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0024r2.html)
- constexpr 标准算法：[P0202R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0202r3.html)
- ranges 算法：[P0896R4](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0896r4.pdf)
- `contains`：[P0458R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0458r2.html)
- constexpr `vector`：[P1004R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1004r2.pdf)
- constexpr `string`：[P0980R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0980r1.pdf)

## 18. 研究结论

第三批不需要再增加“最小 hello world”式示例。最有价值的升级是让每个实体承担一个软件开发语境中的明确责任：`vector` 聚合业务批次、`push_back` 接收拥有型请求、`reserve` 固定已知批量的重分配边界、`array` 表达固定流水线、`deque` 维护有界历史、`unordered_map` 计数、`sort` 生成确定排名、`find` 定位失败阶段、`string` 拆分配置项、`unique_ptr` 返回独占服务、`cin` 消费有限输入、`cout` 显式管理格式状态。

实现时必须把示例背后的限制与代码放在一起：不使用失效句柄，不依赖未指定顺序，不观察普通移动后对象的具体值，不把工程建议伪装成标准保证。完成清单后，这 12 个实体页才会从“会调用”提升到“知道何时安全调用、结果为何可移植”。
