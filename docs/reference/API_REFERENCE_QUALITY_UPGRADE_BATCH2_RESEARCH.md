# C++ Reference 内容质量升级第二批：容器头文件与顺序容器选型研究

> 状态：研究完成，供内容实现使用
> 研究日期：2026-08-28
> 审计范围：`<vector>`、`<array>`、`<deque>`、`<unordered_map>` 四个现有头文件导航页，以及“选择顺序容器”指南
> 事实来源：当前 C++ Working Draft（eel.is）及 WG21/open-std 一级资料；本文不使用 cppreference、博客或问答网站作为规范事实依据

## 1. 研究目标与边界

本批不是把四个头文件页面改写成完整类参考，而是要让“头文件导航页”真正回答四个学习问题：这个头文件可靠地提供什么、主要实体之间是什么关系、学习者下一步应进入哪个实体、哪些看似合理的推断并不是标准保证。标准规定库实体通过适当的头文件或头文件单元进入翻译单元，并要求在第一次引用相关实体之前完成包含或导入；因此“直接包含声明所用实体的头文件”不仅是构建习惯，也是标准规定的使用模型。[Working Draft `[using.headers]`](https://eel.is/c++draft/using.headers)

标准允许一个 C++ 头文件包含其他 C++ 头文件，但只保证它提供自身 synopsis，以及 synopsis 明示包含的其他头文件中的声明与定义。由此可得可移植性边界：不能因为某个实现当前通过传递包含暴露了额外名字，就把该名字当作目标头文件的契约。[Working Draft `[res.on.headers]`](https://eel.is/c++draft/res.on.headers)

本文中的“复杂度”首先按标准口径理解。容器子句的复杂度仅以对所含对象执行的操作次数表述，不等价于字节数、分配次数、缓存未命中或真实耗时；缓存局部性判断必须明确标成工程推论，并用测量验证。[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)

本文以项目现有 C++20 可运行示例为实现基线，同时引用当前 Working Draft 获取最新规范事实。当前 draft synopsis 可能包含晚于 C++20、甚至尚未成为已发布国际标准的声明，所以内容页不能把 synopsis 中的所有设施统一标记为头文件首次出现时的版本；版本标签应按实体分别维护。[Working Draft `<vector>` synopsis](https://eel.is/c++draft/vector.syn)；[Working Draft `<unordered_map>` synopsis](https://eel.is/c++draft/unord.map.syn)

## 2. 当前内容审计

### 2.1 总体结论

| 页面 | 当前优点 | 当前不足 | 第二批建议 |
| --- | --- | --- | --- |
| `<vector>` | 正确强调直接包含，现有示例自包含 | 只提 `std::vector`，遗漏比较、`swap`、`erase`、`erase_if`、`pmr::vector`、`vector<bool>`；没有说明连续性例外与版本边界 | 重写为“头文件地图 + 关键边界 + 两个学习入口” |
| `<array>` | 已提固定大小、tuple 风格接口、版本不可一刀切 | 没列出 `to_array`、`get`、`tuple_size`、零长度边界；没有解释聚合初始化和线性 `swap` | 补齐实体分组与零长度/初始化陷阱 |
| `<deque>` | 正确区分 `deque` 与 `queue`，正确指出非连续 | 未说明 `pmr::deque`、`erase(_if)`；没有给出两端插入时“迭代器失效、引用不失效”的重要差异 | 以“两端高效但非连续”为主线深化 |
| `<unordered_map>` | 正确避免依赖遍历顺序，正确区分 unique/equivalent keys | 哈希与等价关系、平均/最坏复杂度、桶与负载因子、rehash 失效规则均未展开 | 增加哈希契约和 rehash 心智模型 |
| 选择顺序容器 | 已采用 `vector` 默认、按修改位置与稳定性决策的正确方向 | 没有精确矩阵；“随机访问或连续”被放在同一问句；未区分引用、指针、迭代器；缺少到达插入位置的成本 | 重构为约束优先的决策表和失效表 |

### 2.2 现有示例审计

- `<vector>` 的 `include-vector.cpp` 只做编译验证，能证明直接包含足以声明和使用 `std::vector`，但没有可见输出，也没有覆盖该头文件的非成员设施。它适合保留为“最小自包含”示例，不足以承担学习示例。
- `<array>` 的 `include-array.cpp` 输出固定和 `6`，确定性良好，但内容与 `std::array` 实体页容易重复，未体现头文件还提供 tuple 接口和 `to_array`。
- `<deque>` 的 `include-deque.cpp` 确定性地输出两端元素，方向正确，但没有展示最容易误判的“端点插入保留元素引用、却使迭代器失效”。
- `<unordered_map>` 的 `include-unordered-map.cpp` 通过 `at("ok")` 输出 `200`，刻意不依赖迭代顺序，值得保留；但没有教授哈希/等价契约、负载因子或 rehash。
- 指南的 `vector-default.cpp` 只遍历三个整数，没有证明为什么选 `vector`，也没有把“连续性、增长方式、稳定性”映射到选择结果。

## 3. 跨页面必须统一的规范事实

### 3.1 顺序、随机访问与连续存储是三个不同维度

顺序容器把同类型对象组织成严格线性排列；当前 draft 将 `vector`、`inplace_vector`、`forward_list`、`list`、`deque` 列为基本顺序容器，并说明 `array` 因固定元素数量只提供受限的顺序容器操作。页面若以 C++20 为教学基线，应明确主要比较 `array`、`vector`、`deque`、`list`、`forward_list`，而把更晚标准的类型放入版本化扩展区。[Working Draft `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)

随机访问迭代器保证常数时间的前进、后退、距离计算和下标形式，但这不推出元素地址连续。`deque` 支持随机访问迭代器，却没有被规定为连续容器；因此指南必须把“是否需要 `data()`/连续范围”和“是否需要 O(1) 下标访问”拆成两个问题。[Working Draft `[iterator.concept.random.access]`](https://eel.is/c++draft/iterator.concept.random.access)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)

连续容器的迭代器除随机访问要求外还要建模 `contiguous_iterator`。普通 `vector<T>`（`T` 不是 `bool`）满足连续容器要求，`array` 也是连续容器；这才是把它们交给需要连续范围的接口的规范基础。[Working Draft `[container.reqmts]`](https://eel.is/c++draft/container.reqmts)；[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)

连续布局通常有利于空间局部性和批量遍历，但这属于由布局保证推导出的工程倾向，不是标准性能承诺。标准只保证 `vector::data()` 返回形成 `[data(), data() + size())` 有效范围的指针；真实缓存收益应以目标数据、元素类型、硬件和访问模式测量。[Working Draft `[vector.data]`](https://eel.is/c++draft/vector.data)；[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)

### 3.2 必须分别写“迭代器、指针、引用”

标准的一般规则是：除非具体操作另有规定，调用容器成员函数或把容器传给库函数不会使迭代器失效，也不会改变其中对象的值；容器页面随后用更具体的操作规则覆盖该默认值。因此内容不能笼统写“句柄失效”，必须逐类列出迭代器、元素指针、元素引用以及 past-the-end 迭代器。[Working Draft `[container.reqmts]`](https://eel.is/c++draft/container.reqmts)

容器 `swap` 的一般规则也提醒学习者不要把“迭代器仍有效”误解为“仍属于原容器”：除 `array` 等特殊情况外，指向元素的迭代器在交换后仍指向同一个元素，但该元素已属于另一个容器；原来的 `end()` 是否对应另一容器的 `end()` 并未统一规定。[Working Draft `[container.requirements.general]`](https://eel.is/c++draft/container.requirements.general)

### 3.3 复杂度表不能隐藏前置成本

`list` 在已知位置插入单个元素是常数时间且不使其他迭代器和引用失效，但如果只有索引，遍历到该位置本身仍是线性成本；随机访问迭代器才提供常数时间距离与位移。指南应写“给定有效位置后的插入成本”，不能把它简化成“list 任意位置插入 O(1)”。[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[iterator.operations]`](https://eel.is/c++draft/iterator.operations)

同理，`vector` 尾部插入是摊销常数时间，而不是每一次都为常数；中间插入与删除是线性。`deque` 两端单元素插入和删除是常数时间，中间操作线性。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)

## 4. `<vector>` 页面研究

### 4.1 头文件职责与主要实体

当前 `<vector>` synopsis 不只声明主模板 `std::vector<T, Allocator>`；还声明相等/三路比较、非成员 `swap`、按值删除的 `std::erase`、按谓词删除的 `std::erase_if`、`std::pmr::vector` 别名，以及 `vector<bool, Allocator>` 特化和与其代理引用相关的 hash/formatter 支持。头文件页应按“核心类型、非成员操作、内存资源别名、特殊化”分组，不必复制完整签名。[Working Draft `[vector.syn]`](https://eel.is/c++draft/vector.syn)

头文件 synopsis 明示包含 `<compare>` 与 `<initializer_list>`，这些明示传递内容属于标准保证；其他实现偶然暴露的名字不属于 `<vector>` 契约。页面应保留“直接包含所用实体所属头文件”的可移植性提醒，而不要制造一张实现相关的传递包含清单。[Working Draft `[vector.syn]`](https://eel.is/c++draft/vector.syn)；[Working Draft `[res.on.headers]`](https://eel.is/c++draft/res.on.headers)

### 4.2 学习者需要掌握的边界

普通 `vector<T>` 支持尾端摊销常数时间插入/删除，中间插入/删除线性；当 `T` 不是 `bool` 时它还是连续容器。`vector<bool>` 是单独规定的特化，不能把普通 `vector<T>` 的“元素引用就是 `T&`、连续元素对象”心智模型不加条件地套到它身上。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[vector.bool]`](https://eel.is/c++draft/vector.bool)

`capacity()` 是无需重新分配即可容纳的元素总数；`reserve(n)` 只在当前容量小于 `n` 时重分配，不改变 `size()`。一旦重分配，所有元素引用、指针、迭代器和 past-the-end 迭代器全部失效；没有重分配则它们保持有效。调用一次 `reserve` 后，在 `size()` 超过该容量之前的插入不得再次重分配。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)

`shrink_to_fit()` 是非约束请求，允许实现不缩减容量；若它实际触发重分配，同样使所有元素引用、指针和迭代器失效。页面不能教成“调用后 capacity 必定等于 size”。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)

插入导致重分配时所有观察位置均失效；不重分配时，插入点之前的引用、指针和迭代器保持有效，插入点及之后（含旧 `end()`）失效。`erase` 则使删除位置及之后的迭代器与引用失效。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

`vector` 可在分配器满足 completeness 要求时以不完整 `T` 实例化，但在引用该特化的任何成员之前 `T` 必须完整。这是高级边界，适合放入折叠式“类型要求”而非首屏主线。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[allocator.requirements.completeness]`](https://eel.is/c++draft/allocator.requirements.completeness)

### 4.3 推荐页面结构

1. **快速信息**：头文件、命名空间、最早标准、核心实体。
2. **何时直接包含**：声明/构造/调用 `std::vector` 或本头文件非成员设施时显式包含。
3. **头文件地图**：`vector`、比较/交换、`erase`/`erase_if`、`pmr::vector`、`vector<bool>`。
4. **核心行为预览**：动态大小、普通 `T` 连续、尾端摊销常数、中间线性。
5. **容量与失效预览**：只给最常用矩阵，并链接 `std::vector`、`reserve`、`push_back` 实体页。
6. **特殊边界**：`vector<bool>` 与当前 synopsis 的版本混合。
7. **示例**：一个最小自包含示例，一个非成员 `erase_if` 或连续范围示例。
8. **常见错误、相关内容、一级来源**。

### 4.4 常见误区清单

- “`reserve(n)` 把 `size()` 变成 `n`。”错误；它只影响容量，不改变元素数量。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)
- “调用 `reserve` 总会使迭代器失效。”错误；仅发生重分配时失效。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)
- “`shrink_to_fit` 必定释放多余内存。”错误；它是非约束请求。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)
- “所有 `vector<T>` 都可作为连续 `T` 数组。”需要排除 `T = bool` 特化。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[vector.bool]`](https://eel.is/c++draft/vector.bool)
- “尾插 O(1) 表示每次都 O(1)。”规范说的是摊销常数时间。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)
- “只要没扩容，所有旧迭代器就有效。”错误；不扩容的中间插入仍使插入点及之后失效。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

### 4.5 确定性示例设计

**示例 A：`erase_if` 展示头文件边界。** 只显式包含 `<vector>` 与输出所需头文件，构造 `{1, 2, 3, 4, 5}`，调用 `std::erase_if` 删除偶数，按顺序输出 `1 3 5`。这既保持确定性，也证明页面介绍的是头文件而非只介绍类模板；`erase_if` 确实由 `<vector>` synopsis 声明。[Working Draft `[vector.syn]`](https://eel.is/c++draft/vector.syn)；[Working Draft `[vector.erasure]`](https://eel.is/c++draft/vector.erasure)

**示例 B：预留容量后的引用边界。** `reserve(4)` 后插入不超过四个元素，保存首元素引用，再尾插并输出该引用；示例只展示标准保证的“容量未超出时不重分配”，不要展示失效引用的解引用。预期输出可固定为 `10 4`（首元素与最终大小）。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)

## 5. `<array>` 页面研究

### 5.1 头文件职责与主要实体

当前 `<array>` synopsis 包含 `std::array<T, N>`、相等/三路比较、非成员 `swap`、两个 `to_array` 重载，以及 `tuple_size`、`tuple_element` 与四个值类别的 `get<I>` tuple 接口。页面当前只笼统写“比较、交换、创建和 tuple 风格访问”，应把这些设施列成可跳转的头文件地图。[Working Draft `[array.syn]`](https://eel.is/c++draft/array.syn)

`std::array<T, N>` 存储恰好 `N` 个 `T`，`size() == N` 是不变量；它是连续容器，也是可用最多 `N` 个可转换元素进行列表初始化的聚合。大小是类型的一部分，`array<int, 3>` 与 `array<int, 4>` 是不同类型。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)

`array` 不使用分配器；容器要求明确把 `array` 排除在 allocator-aware 容器之外。不要把它描述为“固定容量、仍在堆上分配的 vector”，标准只规定其值语义和连续元素，不规定对象必须位于某种存储区。[Working Draft `[container.alloc.reqmts]`](https://eel.is/c++draft/container.alloc.reqmts)；[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)

### 5.2 初始化、零长度与交换边界

`array` 依赖隐式声明的特殊成员函数，并且是聚合类型；页面应解释 `std::array<int, 3> a{1};` 会按聚合初始化规则处理未显式给出的元素，而不是调用一个“大小加初值”构造函数。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)；[Working Draft `[array.cons]`](https://eel.is/c++draft/array.cons)

`N == 0` 是标准明确支持的特例：`begin() == end()`，但 `data()` 的返回值未指定。因此空 `array` 上不能从 `data()` 是否为 null 推断任何语义，也不能调用要求非空的 `front()`/`back()`。[Working Draft `[array.zero]`](https://eel.is/c++draft/array.zero)；[Working Draft `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)

`array::swap` 与非成员 `swap` 逐元素交换，复杂度为 `N` 的线性，而不是大多数动态容器交换内部句柄时的常数复杂度。标准还特别说明，`array::swap` 不会让迭代器转而关联另一容器；位置中的值已经逐元素交换，所以教学文字应区分“观察位置仍有效”和“该位置仍含原值”。[Working Draft `[array.members]`](https://eel.is/c++draft/array.members)；[Working Draft `[array.special]`](https://eel.is/c++draft/array.special)

`to_array` 从内建数组构造 `std::array`，左值数组要求元素可复制构造，右值数组要求可移动构造，并明确拒绝元素类型本身为数组的情况；因此不能用它直接把多维内建数组整体转换为嵌套 `std::array`。[Working Draft `[array.creation]`](https://eel.is/c++draft/array.creation)

### 5.3 推荐页面结构

1. **快速信息与固定大小心智模型**。
2. **头文件地图**：主模板、比较/交换、`to_array`、tuple 接口。
3. **初始化与类型边界**：聚合、`N` 是类型的一部分、无动态增长。
4. **连续性与接口互操作**：`data()` 与固定范围。
5. **零长度规则**：`begin == end`、`data()` 未指定、不可访问首尾元素。
6. **复杂度例外**：`swap` 线性。
7. **两个示例**：结构化绑定/`get`，以及 `to_array`。
8. **常见错误、相关内容、一级来源**。

### 5.4 常见误区清单

- “`std::array<int, 3> a;` 像 `vector(3)` 一样构造三个零。”错误的心智模型；`array` 是聚合，初始化方式决定元素初始状态，教学示例应优先用 `{}` 明确值初始化。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)；[Working Draft `[dcl.init.aggr]`](https://eel.is/c++draft/dcl.init.aggr)
- “`array<T, 0>::data()` 必须为 `nullptr`。”标准明确说返回值未指定。[Working Draft `[array.zero]`](https://eel.is/c++draft/array.zero)
- “交换两个 `array` 是 O(1)。”标准要求线性于 `N`。[Working Draft `[array.special]`](https://eel.is/c++draft/array.special)
- “大小固定意味着元素值不可修改。”错误；固定的是元素数量，非 `const array` 的元素仍可修改。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)
- “`to_array` 可以直接转换多维内建数组。”它要求元素类型不是数组。[Working Draft `[array.creation]`](https://eel.is/c++draft/array.creation)

### 5.5 确定性示例设计

**示例 A：tuple 接口与结构化绑定。** 构造 `std::array<int, 3>{2, 4, 8}`，用结构化绑定或 `std::get<1>`，输出 `2 4 8`。页面文字解释 `<array>` 提供 `tuple_size`/`tuple_element`/`get`，而不是把结构化绑定本身错误归因于一个成员函数。[Working Draft `[array.tuple]`](https://eel.is/c++draft/array.tuple)；[Working Draft `[array.syn]`](https://eel.is/c++draft/array.syn)

**示例 B：`std::to_array` 保留长度。** 从内建 `int raw[]{3, 5, 8};` 创建 `auto values = std::to_array(raw);`，输出 `3 8 3`（首元素、尾元素、大小）。不输出地址或实现布局。[Working Draft `[array.creation]`](https://eel.is/c++draft/array.creation)

## 6. `<deque>` 页面研究

### 6.1 头文件职责与主要实体

当前 `<deque>` synopsis 声明 `std::deque<T, Allocator>`、比较、非成员 `swap`、`std::erase`、`std::erase_if` 与 `std::pmr::deque`。页面应像 `<vector>` 一样按核心类型、非成员操作、内存资源别名分组，而不是只列主模板。[Working Draft `[deque.syn]`](https://eel.is/c++draft/deque.syn)

`deque` 是支持随机访问迭代器的顺序容器，首尾单元素插入和删除为常数时间，中间插入和删除线性，专门优化首尾 push/pop。标准没有把它列为连续容器，且 synopsis 不提供 `data()`；因此“可以 O(1) 下标访问”不能推导出“可传给要求连续 `T*` 范围的接口”。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)；[Working Draft `[deque.syn]`](https://eel.is/c++draft/deque.syn)

### 6.2 精细失效规则

在中间插入会使全部迭代器和全部元素引用失效；在任一端插入会使全部迭代器失效，但不影响指向已有元素的引用。这个差异是 `deque` 页面最值得教授的规则，因为它直接反驳“引用和迭代器总是一起失效”的错误心智模型。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

删除最后一个元素时，只有旧 past-the-end 迭代器及指向被删元素的迭代器/引用失效；删除第一个但不是最后一个元素时，只有指向被删元素的迭代器/引用失效；删除既非首也非尾的元素时，past-the-end 以及指向全部元素的迭代器/引用都会失效。`pop_front` 与 `pop_back` 属于这些 erase 规则。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

中间插入的复杂度为插入元素数加上到首尾较短距离的线性量；单元素端点插入严格为常数时间并恰调用一次 `T` 构造。内容可据此说明 `deque` 的优势是端点操作，不应暗示任意位置都高效。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

### 6.3 推荐页面结构

1. **快速信息**：双端可增长、随机访问、非连续保证。
2. **头文件地图**：`deque`、比较/交换、`erase`/`erase_if`、`pmr::deque`。
3. **何时选择**：频繁两端增长，且不要求单一连续缓冲区。
4. **复杂度预览**：两端常数，中间线性，随机访问常数。
5. **失效矩阵**：端点插入、中间插入、首删、尾删、中间删分别列迭代器和引用。
6. **与 `queue`、`vector` 的区别**。
7. **两个示例**：首尾操作；端点插入后的引用稳定性。
8. **常见错误、相关内容、一级来源**。

### 6.4 常见误区清单

- “`deque` 只是不能随机访问的队列。”错误；它提供随机访问迭代器。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)
- “随机访问说明底层连续。”错误；随机访问概念只规定操作及复杂度，`deque` 未被规定为连续容器。[Working Draft `[iterator.concept.random.access]`](https://eel.is/c++draft/iterator.concept.random.access)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)
- “在两端 push 后，旧引用和旧迭代器都有效。”旧引用有效，但所有迭代器失效。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)
- “在中间插入接近 O(1)。”规范为线性于插入数加到较近端的距离。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)
- “`deque` 与 `queue` 是同一抽象。”`deque` 是完整序列容器，`queue` 是基于底层容器限制接口的适配器。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)；[Working Draft `[queue.defn]`](https://eel.is/c++draft/queue.defn)

### 6.5 确定性示例设计

**示例 A：两端工作队列。** 保留当前 `{2}` 后 `push_front(1)`、`push_back(3)` 的确定性输出，但扩展为按索引输出 `1 2 3`，同时说明随机访问并不表示连续存储。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)

**示例 B：元素引用与迭代器规则分离。** 创建 `{20, 30}`，保存 `int& kept = values.front()`，随后 `push_front(10)` 与 `push_back(40)`，只使用仍受保证的 `kept` 输出 `20 4`；代码绝不再使用此前取得的迭代器。正文明确指出示例有意不演示失效迭代器的运行时行为，因为使用失效迭代器本身不合法。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)

## 7. `<unordered_map>` 页面研究

### 7.1 头文件职责与主要实体

当前 `<unordered_map>` synopsis 同时声明 unique-key 的 `std::unordered_map` 与 equivalent-key 的 `std::unordered_multimap`，各自的相等比较、`swap`、`erase_if`，以及对应的 `std::pmr` 别名。页面当前对两个类的区分方向正确，但应把非成员设施和 `pmr` 别名补齐。[Working Draft `[unord.map.syn]`](https://eel.is/c++draft/unord.map.syn)

`unordered_map<Key, T>` 的 `key_type` 为 `Key`，`mapped_type` 为 `T`，`value_type` 为 `pair<const Key, T>`；键部分为 `const` 是重要 API 边界，不能通过普通迭代器直接改键并破坏桶组织。[Working Draft `[unord.map.overview]`](https://eel.is/c++draft/unord.map.overview)

### 7.2 哈希与等价关系契约

无序关联容器由 `Key`、哈希函数对象 `Hash` 和诱导键等价关系的二元谓词 `Pred` 参数化。若 `Pred(k1, k2)` 判定两个键等价，`Hash` 必须为二者产生相同哈希值；同一容器生命周期内，对同一键的 predicate 与 hash 结果必须保持一致。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

反方向并不成立：哈希值相同只表示键进入同一桶的候选集合，不表示两个键等价。优秀哈希应使不同值碰撞概率较低，但容器仍必须使用 `Pred` 确认键等价。[Working Draft `[hash.requirements]`](https://eel.is/c++draft/hash.requirements)；[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

`unordered_map` 支持 unique keys，每个等价键至多一个元素；`unordered_multimap` 支持 equivalent keys。无序容器的绝对遍历顺序未指定，multimap 只额外保证等价键形成相邻组，并在未另行规定的修改中维护组内相对顺序。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

### 7.3 复杂度、桶与负载因子

无序关联容器大多数操作的最坏复杂度为线性，但平均情况更快；具体地，`find` 平均 O(1)、最坏 O(size)，unique-key 单元素 `emplace` 也为平均 O(1)、最坏 O(size)。页面不能只写“O(1) 查找”，必须同时给平均与最坏口径。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)

元素按桶组织，相同哈希值的键位于同一桶。`load_factor()` 是每桶平均元素数；`max_load_factor()` 返回容器尝试维持的正上界，容器会按需要增加桶数。这里的“尝试”与 `max_load_factor(z)` 的 hint 语义不应被夸大为某个确定桶数或确定布局。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)

`rehash(n)` 完成后桶数至少为 `n`，并满足当前大小与最大负载因子的约束；其平均复杂度线性于元素数，最坏二次。`reserve(n)` 等价于按 `ceil(n / max_load_factor())` 调用 `rehash`，它面向“预计元素数”，而 `rehash` 的参数面向“至少桶数”。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)

默认构造后的桶数量由实现决定，构造函数规定的默认 `max_load_factor()` 为 `1.0`。示例与测试不得断言默认 `bucket_count()`，也不应把特定实现的桶增长序列写入预期输出。[Working Draft `[unord.map.cnstr]`](https://eel.is/c++draft/unord.map.cnstr)

### 7.4 rehash 与失效规则

rehash 会使迭代器失效、改变元素迭代顺序和桶归属，但不会使指向元素的指针或引用失效。这是本页必须醒目呈现的规则，也是与 `vector` 重分配完全不同的地方。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

`insert`、`insert_range`、`emplace` 不影响已有元素引用的有效性，但可能使所有迭代器失效；若插入后的元素数量仍不超过 `max_load_factor * bucket_count`，标准保证迭代器不失效。`erase` 只使指向被删元素的迭代器与引用失效。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

页面可以教 `reserve` 降低批量插入期间的 rehash 机会，但不能把它宣传成引用稳定性的必要条件，因为 rehash 本来就不使元素引用失效；它主要影响迭代器、桶布局与性能。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)；[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)

### 7.5 推荐页面结构

1. **快速信息**：映射/多重映射、哈希组织、无顺序保证。
2. **头文件地图**：两个类、比较/交换、`erase_if`、两个 `pmr` 别名。
3. **键—值类型模型**：`pair<const Key, T>`。
4. **哈希与等价契约**：等价必同 hash，同 hash 未必等价。
5. **复杂度**：查找与插入的平均/最坏双口径。
6. **桶与负载因子**：`bucket_count`、`load_factor`、`max_load_factor`、`reserve`、`rehash`。
7. **失效矩阵**：rehash、insert、erase 分别列 iterator/reference/pointer。
8. **顺序边界**：任何普通遍历顺序均不得进入确定性输出。
9. **两个示例**：按键访问；rehash 后元素引用仍有效或自定义等价关系。
10. **常见错误、相关内容、一级来源**。

### 7.6 常见误区清单

- “哈希相同就代表键相等。”错误；等价键必须同 hash，但碰撞的非等价键也可同 hash。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- “自定义 `key_equal` 时默认 hash 总能继续用。”若新的等价关系把两个值视为等价，配套 hash 也必须给出相同结果。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- “查找严格 O(1)。”标准只给平均 O(1)，最坏 O(size)。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)
- “rehash 让所有元素引用失效。”错误；迭代器失效，元素指针和引用保持有效。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- “`reserve(100)` 保证恰有 100 个桶。”错误；它按预计元素数和最大负载因子换算为 rehash 请求，最终桶数仍只受下界约束。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)
- “无序容器保持插入顺序，或每次运行顺序随机。”两种说法都不是规范；绝对顺序未指定，不能依赖。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- “用 `operator[]` 查询不存在键不会修改容器。”`operator[]` 等价于 `try_emplace` 后返回 mapped value，会在键不存在时插入；只读查询应使用 `find`、`contains` 或 `at` 等符合意图的接口。[Working Draft `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem)

### 7.7 确定性示例设计

**示例 A：保留当前按键读取。** 继续通过 `at("ok")` 输出 `200`，不遍历整个容器；可再用 `contains("not-found")` 输出 `true`。这展示确定性查询而不把实现相关桶顺序写进测试。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)；[Working Draft `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem)

**示例 B：rehash 后引用保持有效。** 构造映射，取得 `std::string& kept = values.at("primary")`，记录并显式调用一个大于当前桶数的 `rehash`，然后只输出 `kept` 与按键读取结果。不要使用 rehash 前取得的迭代器，也不要输出桶数。该示例直接演示标准保证且输出跨实现确定。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)；[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)

**可选高级示例 C：大小写无关键。** 同时提供大小写无关 `Hash` 与 `Pred`，证明 `"Content-Type"` 和 `"content-type"` 等价；实现必须确保等价输入归一化后 hash 相同。该示例适合高级折叠区，不宜替代基础按键访问示例。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)；[Working Draft `[hash.requirements]`](https://eel.is/c++draft/hash.requirements)

## 8. “选择顺序容器”指南研究

### 8.1 建议的教学立场

指南应继续以 `std::vector` 作为“可增长顺序的默认候选”，但应把它表述为基于需求的工程默认，而不是标准规范命令。规范事实是：普通 `vector<T>` 连续、支持随机访问、尾部操作摊销常数、中间操作线性；在常见顺序遍历中，连续布局通常形成更好的局部性机会，但最终选择仍需测量。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[vector.data]`](https://eel.is/c++draft/vector.data)；[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)

指南需要区分“强约束”和“偏好”。需要把数据传给连续内存 API 是强约束；预计两端高频增长是访问模式；希望更好缓存局部性是性能假设；必须跨修改保存引用则是生命周期约束。先处理强约束，再比较复杂度和测量结果，能避免只凭容器名字或 Big-O 选型。

### 8.2 推荐决策顺序

1. **元素数量是否是编译期固定值？** 若是，优先评估 `std::array<T, N>`；它存储恰好 `N` 个连续元素，大小是类型的一部分。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)
2. **是否必须提供连续 `T` 范围或 `data()`？** 若是且大小可增长，优先评估普通 `std::vector<T>`；不要选择 `deque`，也要单独审视 `vector<bool>`。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[vector.data]`](https://eel.is/c++draft/vector.data)
3. **是否需要常数时间随机访问？** `vector`、`array`、`deque` 满足；`list`/`forward_list` 不满足。随机访问与连续性必须分问。[Working Draft `[iterator.concept.random.access]`](https://eel.is/c++draft/iterator.concept.random.access)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)
4. **增长主要发生在哪？** 仅尾部通常从 `vector` 开始；首尾都频繁且不需要连续存储时评估 `deque`；已知位置的频繁节点插入/删除才进入链式容器评估。[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)；[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)
5. **是否必须保存跨修改的元素引用或迭代器？** 明确需要哪一种。`deque` 端点插入保留引用但不保留迭代器；`list` 插入保留两者；`vector` 可能因重分配使两者全部失效。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)；[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)
6. **是否已经拥有插入位置？** 链表的常数插入以已有有效位置为前提；从索引寻找位置仍是线性。[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[iterator.operations]`](https://eel.is/c++draft/iterator.operations)
7. **性能差异是否对当前规模重要？** 标准复杂度不包含所有硬件成本，应基于真实元素类型、规模和工作负载测量。[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)

### 8.3 建议决策表

| 候选 | 大小模型 | 连续存储 | 随机访问 | 主要高效修改 | 插入后的观察位置 | 首要代价/边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `array<T, N>` | 编译期固定 | 是 | O(1) | 不支持改变元素数 | 无增长导致的重定位；swap 逐元素且线性 | `N` 是类型一部分；`N==0` 有特殊访问边界 |
| `vector<T>` | 运行期可增长 | 普通 `T` 为是；`bool` 特化除外 | O(1) | 尾部摊销 O(1) | 重分配使全部引用/指针/迭代器失效；不重分配的插入仍使插入点及之后失效 | 首部/中间修改线性；容量管理 |
| `deque<T>` | 运行期可增长 | 无连续保证 | O(1) | 两端单元素 O(1) | 端点插入使迭代器失效，但已有元素引用有效；中间插入全部失效 | 不能作为单一连续缓冲区；规则精细 |
| `list<T>` | 运行期可增长 | 否 | 不支持 | 已知位置单元素插入/删除 O(1) | 插入不使其他迭代器/引用失效；删除只影响被删元素 | 找位置通常 O(n)，逐节点成本与较弱局部性 |
| `forward_list<T>` | 运行期可增长 | 否 | 仅前向 | 已知前驱后插入/删除 O(1) | 插入保持其他迭代器/引用；删除只影响被删元素 | 无 `size()`，无反向遍历，需要前驱位置 |

表中 `array`、`vector`、`deque` 的布局与复杂度来自各自 overview；链式容器的插入与失效规则来自其 modifiers。局部性一栏只能作为布局推论，不应写成标准保证。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)；[Working Draft `[vector.overview]`](https://eel.is/c++draft/vector.overview)；[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)；[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[forward.list.modifiers]`](https://eel.is/c++draft/forward.list.modifiers)

### 8.4 建议失效速查表

| 操作 | `vector` | `deque` | `list` / `forward_list` |
| --- | --- | --- | --- |
| 尾部插入 | 若重分配全部失效；否则旧 `end()` 与插入点及之后失效 | 所有迭代器失效，已有元素引用/指针有效 | 其他元素的迭代器/引用有效 |
| 首部插入 | 线性；按 vector 插入规则失效 | 所有迭代器失效，已有元素引用/指针有效 | 其他元素的迭代器/引用有效 |
| 中间插入 | 重分配则全部；否则插入点及之后 | 所有迭代器和引用失效 | 其他元素的迭代器/引用有效 |
| 删除元素 | 删除位置及之后的迭代器/引用失效 | 端点与中间规则不同，必须查精细规则 | 只使被删元素的迭代器/引用失效 |

以上 `vector` 规则来自 `[vector.modifiers]`，`deque` 规则来自 `[deque.modifiers]`，链表规则来自各自 modifiers；指南不应把这张速查表替代具体 API 页，因为 past-the-end 与范围操作仍有细节。[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)；[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)；[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[forward.list.modifiers]`](https://eel.is/c++draft/forward.list.modifiers)

### 8.5 指南常见误区

- “需要 O(1) 下标，所以必须 vector。”`deque` 也支持随机访问；真正区分项可能是连续性、两端增长或失效规则。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)
- “需要稳定引用，所以必须 list。”若只在 deque 两端插入，已有元素引用也保持有效；但迭代器不保持有效。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)
- “list 中间插入 O(1)，所以大量按索引插入更快。”获取该位置可能 O(n)，且标准 Big-O 不包含节点分配和硬件局部性成本。[Working Draft `[list.modifiers]`](https://eel.is/c++draft/list.modifiers)；[Working Draft `[iterator.operations]`](https://eel.is/c++draft/iterator.operations)；[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)
- “固定最大数量就应使用 array。”只有实际元素数量也固定并由类型表达时才直接匹配 `array`; “最多 N 个但当前大小变化”是另一个需求模型。[Working Draft `[array.overview]`](https://eel.is/c++draft/array.overview)
- “reserve 能让 vector 永远不失效。”它只保证在 size 不超过当前 capacity 的后续插入中不重分配；中间插入仍会使插入点及之后失效。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)；[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

### 8.6 指南示例与交互设计

**示例 A：把需求映射到容器。** 同一程序建立三个场景：固定三维坐标使用 `array<int, 3>`；运行时追加日志批次使用 `vector<int>`；需要在首尾调度任务使用 `deque<int>`。只输出业务结果，例如 `6 / 3 / 10 40`，不输出容量、地址或桶数。示例注释应写选择约束，而不是只写容器名称。

**示例 B：安全保存位置。** 对已 `reserve` 足够容量且只尾插的 `vector` 保存索引而非迭代器，修改后重新通过索引访问；输出固定值。正文同时说明索引也不是跨任意插入/删除都稳定的通用句柄，插入位置之前的索引语义才可能保持。[Working Draft `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)；[Working Draft `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)

**交互式决策表建议。** UI 可依次询问“固定大小”“需要连续”“需要随机访问”“主要修改位置”“保存引用还是迭代器”，然后显示候选而非唯一答案。每个结果必须带一条规范理由和一条需测量项；不能把工程启发式伪装成标准结论。

## 9. 内容实现优先级与验收标准

### 9.1 建议实施顺序

1. 先升级“选择顺序容器”指南，建立统一术语：连续、随机访问、引用、指针、迭代器、重分配。
2. 同步升级 `<vector>` 与 `<deque>`，因为二者的对比承担指南主要分支。
3. 升级 `<array>`，补齐固定大小与零长度边界。
4. 独立升级 `<unordered_map>`，建立哈希/等价/rehash 心智模型。
5. 最后交叉检查所有相关实体页，避免头文件页与实体页对同一失效规则出现冲突。

### 9.2 每页学习质量验收

- 头文件页明确列出当前 synopsis 的实体分组，但不复制完整声明墙。
- 每个规范事实在正文附近附具体 draft 子条款链接；manifest 再保存一份结构化一级来源。
- 明确指出当前 draft 与项目 C++20 示例基线的版本差异，不把所有声明统一标成 C++98/C++11。
- 至少包含一个“不要依赖传递包含”的可移植性说明，并链接 `[using.headers]` 或 `[res.on.headers]`。
- 至少包含一个确定性运行示例；核心页面建议两个示例，且不得解引用失效观察位置。
- 任何输出都不依赖地址、`capacity()`、默认桶数、bucket 分布或 unordered 遍历顺序。
- 对复杂度使用“平均、最坏、摊销、给定位置后”等准确限定词。
- 对失效分别写 iterator、pointer、reference 和必要时的 past-the-end。
- 对缓存局部性只写工程倾向，并提示基准测量，不标成 ISO 保证。

## 10. 推荐写入各 Entry manifest 的一级来源

### `<vector>`

- [Working Draft `<vector>` synopsis `[vector.syn]`](https://eel.is/c++draft/vector.syn)
- [Working Draft vector overview `[vector.overview]`](https://eel.is/c++draft/vector.overview)
- [Working Draft vector capacity `[vector.capacity]`](https://eel.is/c++draft/vector.capacity)
- [Working Draft vector modifiers `[vector.modifiers]`](https://eel.is/c++draft/vector.modifiers)
- [Working Draft `vector<bool>` `[vector.bool]`](https://eel.is/c++draft/vector.bool)
- [Working Draft library header conformance `[res.on.headers]`](https://eel.is/c++draft/res.on.headers)

### `<array>`

- [Working Draft `<array>` synopsis `[array.syn]`](https://eel.is/c++draft/array.syn)
- [Working Draft array overview `[array.overview]`](https://eel.is/c++draft/array.overview)
- [Working Draft array members `[array.members]`](https://eel.is/c++draft/array.members)
- [Working Draft array specialized algorithms `[array.special]`](https://eel.is/c++draft/array.special)
- [Working Draft zero-sized arrays `[array.zero]`](https://eel.is/c++draft/array.zero)
- [Working Draft array creation `[array.creation]`](https://eel.is/c++draft/array.creation)
- [Working Draft array tuple interface `[array.tuple]`](https://eel.is/c++draft/array.tuple)

### `<deque>`

- [Working Draft `<deque>` synopsis `[deque.syn]`](https://eel.is/c++draft/deque.syn)
- [Working Draft deque overview `[deque.overview]`](https://eel.is/c++draft/deque.overview)
- [Working Draft deque modifiers `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)
- [Working Draft library header conformance `[res.on.headers]`](https://eel.is/c++draft/res.on.headers)

### `<unordered_map>`

- [Working Draft `<unordered_map>` synopsis `[unord.map.syn]`](https://eel.is/c++draft/unord.map.syn)
- [Working Draft unordered container requirements `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
- [Working Draft unordered requirements table `[unord.req]`](https://eel.is/c++draft/unord.req)
- [Working Draft unordered_map overview `[unord.map.overview]`](https://eel.is/c++draft/unord.map.overview)
- [Working Draft unordered_map element access `[unord.map.elem]`](https://eel.is/c++draft/unord.map.elem)
- [Working Draft Cpp17Hash requirements `[hash.requirements]`](https://eel.is/c++draft/hash.requirements)

### 选择顺序容器指南

- [Working Draft sequence container requirements `[sequence.reqmts]`](https://eel.is/c++draft/sequence.reqmts)
- [Working Draft general container requirements `[container.reqmts]`](https://eel.is/c++draft/container.reqmts)
- [Working Draft container complexity preamble `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)
- [Working Draft vector overview/modifiers](https://eel.is/c++draft/vector.overview)
- [Working Draft deque overview/modifiers](https://eel.is/c++draft/deque.overview)
- [Working Draft list modifiers](https://eel.is/c++draft/list.modifiers)
- [Working Draft forward_list overview](https://eel.is/c++draft/forward.list.overview)

## 11. 最关键的编辑结论

1. 头文件页必须从“include 提示”升级为“设施地图”，但详细成员语义仍下沉到实体页。
2. 指南必须把“随机访问”和“连续存储”拆开；`deque` 是最直接的反例。[Working Draft `[deque.overview]`](https://eel.is/c++draft/deque.overview)
3. 所有失效说明必须拆分引用、指针和迭代器；`deque` 端点插入与 unordered rehash 都证明三者不能混写。[Working Draft `[deque.modifiers]`](https://eel.is/c++draft/deque.modifiers)；[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
4. `unordered_map` 必须同时教授 hash 与 key equivalence；自定义其中一个时不能忽略另一个。[Working Draft `[unord.req.general]`](https://eel.is/c++draft/unord.req.general)
5. “O(1)”必须注明平均、摊销或给定位置；标准复杂度也不能替代真实工作负载测量。[Working Draft `[unord.req]`](https://eel.is/c++draft/unord.req)；[Working Draft `[container.requirements.pre]`](https://eel.is/c++draft/container.requirements.pre)
6. 示例应只观察标准确定的业务值，绝不输出实现相关容量、桶数、地址或 unordered 遍历顺序。
