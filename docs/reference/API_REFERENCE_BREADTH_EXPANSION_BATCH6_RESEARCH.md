# C++ Reference 第六批：字符串转换与共享所有权扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-08-30
>
> 精确范围：`<string>`、`<string_view>`、`<charconv>`、`<memory>`、
> `std::string::substr`、`std::string::find`、`std::string::append`、
> `std::from_chars`、`std::to_chars`、`std::shared_ptr`、`std::weak_ptr`、
> `std::make_shared`
>
> 规范事实来源：C++20 最终工作草案 N4861、当前 C++ Working Draft 和 WG21
> 历史提案。学习信息架构另参考 zh.cppreference，但不以其证明规范事实。

## 1. 研究目标与边界

第六批落实积压清单中的“字符串转换与共享所有权”切片，恰好增加 12 个条目：4 个
reduced-form 头文件设施图和 8 个 ordinary entity 页面。它不顺手加入 `std::getline`、
`std::string_view` 实体、`std::unique_ptr` 新页面、`std::enable_shared_from_this`、
`std::allocate_shared` 或 utility vocabulary。

所有可运行示例固定为 C++20。规范接口基线必须取自
[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)，当前草案只用于：

1. 给实现者提供稳定的条款锚点；
2. 发现 C++23、C++26 及更晚变更；
3. 防止把 live draft 的接口误写成 C++20。

首次标准边界分别用
[N2356（1997 public review draft）](https://www.open-std.org/jtc1/sc22/open/n2356/)、
[N3337（C++11 working draft）](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、
[N4659（C++17 final working draft）](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
与 N4861 复核。本文只把 eel.is 当前草案和 open-std/WG21 文件用于规范与历史事实。

## 2. 条目身份、版本与主锚点

| 建议 ID | 符号 | kind | `since` | 分类 | 当前草案主锚点 |
|---|---|---|---|---|---|
| `header-string` | `<string>` | `header` | `c++98` | `strings` | [`[string.syn]`](https://eel.is/c++draft/string.syn) |
| `header-string-view` | `<string_view>` | `header` | `c++17` | `strings` | [`[string.view.synop]`](https://eel.is/c++draft/string.view.synop) |
| `header-charconv` | `<charconv>` | `header` | `c++17` | `strings` | [`[charconv.syn]`](https://eel.is/c++draft/charconv.syn) |
| `std-string-substr` | `std::string::substr` | `member` | `c++98` | `strings` | [`[string.substr]`](https://eel.is/c++draft/string.substr) |
| `std-string-find` | `std::string::find` | `member` | `c++98` | `strings` | [`[string.find]`](https://eel.is/c++draft/string.find) |
| `std-string-append` | `std::string::append` | `member` | `c++98` | `strings` | [`[string.append]`](https://eel.is/c++draft/string.append) |
| `std-from-chars` | `std::from_chars` | `function` | `c++17` | `strings` | [`[charconv.from.chars]`](https://eel.is/c++draft/charconv.from.chars) |
| `std-to-chars` | `std::to_chars` | `function` | `c++17` | `strings` | [`[charconv.to.chars]`](https://eel.is/c++draft/charconv.to.chars) |
| `header-memory` | `<memory>` | `header` | `c++98` | `memory` | [`[memory.syn]`](https://eel.is/c++draft/memory.syn) |
| `std-shared-ptr` | `std::shared_ptr` | `type` | `c++11` | `memory` | [`[util.smartptr.shared]`](https://eel.is/c++draft/util.smartptr.shared) |
| `std-weak-ptr` | `std::weak_ptr` | `type` | `c++11` | `memory` | [`[util.smartptr.weak]`](https://eel.is/c++draft/util.smartptr.weak) |
| `std-make-shared` | `std::make_shared` | `function` | `c++11` | `memory` | [`[util.smartptr.shared.create]`](https://eel.is/c++draft/util.smartptr.shared.create) |

`basic_string`、`substr`、`find`、`append` 和 `<memory>` 的 C++98 身份由 N2356 的
`[lib.string.classes]`、`[lib.basic.string]` 与 `[lib.memory]` 直接证明；共享指针家族由 N3337
的 `[util.smartptr.shared]`、`[util.smartptr.weak]`、`[util.smartptr.shared.create]` 证明；
`string_view` 与 `charconv` 出现在 N4659，并分别由
[P0220R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0220r1.html) 和
[P0067R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0067r5.html) 给出引入历史。

## 3. 跨条目 C++20 版本防线

### 3.1 C++20 字符串接口不是当前 synopsis 的无条件子集复制

C++20 的 `basic_string` 大部分成员因
[P0980R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0980r1.pdf)
成为 `constexpr`，但当前草案继续演进：

- `substr` 的 `const &` / `&&` 重载来自 C++23 的
  [P2438R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2438r2.html)；C++20 只有一个
  未 ref-qualified 的 `const` 成员；
- `append_range` 及其他 range-aware 字符串成员来自 C++23 的
  [P1206R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p1206r7.pdf)；
- `contains` 来自 C++23 的
  [P1679R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1679r3.html)；
- 当前草案的 `subview` 来自更晚的
  [P3044R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3044r2.pdf)，不得进入
  C++20 页面。

### 3.2 C++20 `<charconv>` 结果只是两个数据成员

N4861 的 `to_chars_result` / `from_chars_result` 只有 `ptr` 与 `ec`。C++20 的整数
`to_chars` / `from_chars` 也不是 `constexpr`。当前草案中的比较和显式 `operator bool` 来自
[P2497R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p2497r0.html)，整数转换的
`constexpr` 来自 C++23 的
[P2291R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2291r3.pdf)。因此 C++20
示例必须检查 `result.ec == std::errc{}`，不能写 `if (result)`，也不能用 `static_assert`
执行整数转换。

P0067R5 的设计目标是接口本身不内在要求动态分配、无 locale、调用者提供缓冲区；规范合同直接保证
相关转换 `Throws: Nothing`。页面可以准确说“无需由接口创建 `std::string`，不会抛出转换异常”，
不能扩大成无法由接口文字证明的“实现内部绝不分配”。

### 3.3 C++20 共享指针并非全面 `constexpr`

当前草案给 `shared_ptr`、`weak_ptr` 和创建函数加了大范围 `constexpr`，该工作来自 C++26 的
[P3037R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3037r5.pdf)，不能回写。
所有权哈希与相等来自 C++26 的
[P1901R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p1901r2.html)，也不属于 C++20。

C++20 已经包含的高影响增量必须保留：

- `make_shared<T[]>` / `make_shared<T[N]>` 数组重载来自
  [P0674R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0674r1.html)；
- `atomic<shared_ptr<T>>` 与 `atomic<weak_ptr<T>>` 来自
  [P0718R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0718r2.html)；
- `make_shared_for_overwrite` 家族是 C++20 的
  [P1973R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1973r1.pdf)，不是 C++23
  泄漏，但不扩成独立条目。

### 3.4 直接包含与生命周期

每页应要求直接包含其声明头文件。N4861 `[using.headers]` 不保证某个标准头的实现细节性传递包含；
首次引用前必须包含适当头文件。字符串 view 和 charconv 的指针对范围均不延长底层存储生命周期；
`substr` 返回的新 `string` 则独立拥有字符。共享指针延长被管理对象生命期，但不自动让被管理对象的
非 const 数据访问线程安全。

当前直接包含规则见 [`[using.headers]`](https://eel.is/c++draft/using.headers)，字符串失效规则见
[`[string.require]`](https://eel.is/c++draft/string.require)，共享指针数据竞争边界见
[`[util.smartptr.shared.general]`](https://eel.is/c++draft/util.smartptr.shared.general)。

## 4. `<string>` 头文件页

### 4.1 Reduced facility map

| 学习目的 | C++20 设施 | 首次标准 / 演进 | 分流说明 |
|---|---|---|---|
| 拥有可变文本 | `basic_string`、`string`、`wstring` | C++98 | 完整拥有、连续存储、可修改 |
| UTF code-unit 类型别名 | `u16string`、`u32string`、`u8string` | C++11 / C++20 | 不是 Unicode 规范化或 grapheme API |
| 字符策略 | `char_traits` | C++98 | 比较、长度和字符操作策略 |
| 拼接、比较、交换 | `operator+`、比较、`swap` | C++98；C++20 `<=>`/`constexpr` | 实体成员合同转到 `std::string` 及本批 3 页 |
| 流式整行输入 | `getline` | C++98 | 后续可建独立 I/O 实体页 |
| 抛异常数值转换 | `stoi` 等、`to_string` | C++11 | locale/异常模型不同于 `<charconv>` |
| 字面量 | `operator""s` | C++14 | 产生拥有字符串，不是 `sv` |
| polymorphic allocator 别名 | `pmr::string` 等 | C++17 | 所有权语义不变 |
| 按值/谓词擦除 | `erase`、`erase_if` | C++20 | 非成员便利接口 |

当前设施锚点为 [`[string.syn]`](https://eel.is/c++draft/string.syn)，C++20 精确集合以 N4861
`[string.syn]` 为准。`u8string` 的 C++20 边界由
[P0482R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0482r6.html) 复核。

### 4.2 选择、所有权、错误与关系

- 需要拥有和修改文本时用 `std::string`；只读借用连续字符时转 `<string_view>`。
- 数值转换若需要异常、locale 相关或直接返回 `string`，看 `<string>` 转换；高吞吐、显式错误、
  caller-owned buffer 转 `<charconv>`。
- `basic_string` 是连续容器且 `data()+size()` 指向空终止字符；size 仍可包含内嵌 `\0`。
- 可能超过 `max_size()` 的操作抛 `length_error`；字符串成员抛异常时对字符串无其他效果。
- 非 const 成员通常可能失效现有引用、指针和迭代器；不能缓存 `data()` 后无条件 append。

推荐关系：`std-string`、`header-string-view`、`header-charconv`、`std-string-substr`、
`std-string-find`、`std-string-append`。

### 4.3 头文件示例规格

`string-family.cpp`：创建 `std::string text = "cpp-learn"`，输出文本和 `size()`。
精确 stdout：`text=cpp-learn\nsize=9\n`。

## 5. `<string_view>` 头文件页

### 5.1 Reduced facility map

| 学习目的 | C++20 设施 | 版本 | 高影响边界 |
|---|---|---|---|
| 非拥有连续字符视图 | `basic_string_view`、`string_view` 等 | C++17 | 不延长底层存储生命期 |
| UTF-8 code-unit view | `u8string_view` | C++20 | 仍不做 Unicode 文本分割 |
| 比较与输出 | 比较运算、`operator<<` | C++17；C++20 `<=>` | 输出不要求 null terminator |
| hash | `hash<string_view>` 等 | C++17 | 内容哈希，不取得所有权 |
| 字面量 | `operator""sv` | C++17 | literal storage 具有静态生命期 |
| Ranges 集成 | `enable_view`、`enable_borrowed_range` | C++20 | borrowed_range 不代表任意来源都不悬空 |

规范入口是 [`[string.view.synop]`](https://eel.is/c++draft/string.view.synop) 和
[`[string.view.template]`](https://eel.is/c++draft/string.view.template)。首次标准以 P0220R1 与
N4659 核实。

### 5.2 选择、生命周期与关系

- 适合函数参数、解析窗口与无需复制的切片；需要跨越源字符串销毁或修改时复制为 `string`。
- 从临时 `std::string` 保存 view 会悬空；从 `string` 取得 view 后，导致 string 重分配的修改也会
  使 view 的指针失效。
- view 不保证 `data()[size()]` 可读或为 `\0`；向 C API 传递前必须确认协议或复制。
- `substr` 产生的 view 仍借用原存储；与 `std::string::substr` 的拥有副本明确分流。

推荐关系：`header-string`、`std-string`、`std-string-substr`、`header-charconv`。

### 5.3 头文件示例规格

`view-family.cpp`：以 `"api/v1/users"sv` 创建静态存储 view，在第一个 `/` 处分成两个 view。
精确 stdout：`prefix=api\nsuffix=v1/users\n`。

## 6. `<charconv>` 头文件页

### 6.1 Reduced facility map

| 方向 | C++20 设施 | 支持 | 结果 / 错误 |
|---|---|---|---|
| 数值到字符 | `to_chars` | 整数；`float`/`double`/`long double` | `{ptr, ec}`，缓冲不足为 `value_too_large` |
| 字符到数值 | `from_chars` | 整数；`float`/`double`/`long double` | `{ptr, ec}`，无匹配或越界可区分 |
| 浮点格式 | `chars_format` | `scientific`、`fixed`、`hex`、`general` | 不采用全局 locale |

当前入口为 [`[charconv.syn]`](https://eel.is/c++draft/charconv.syn)，C++17 引入与设计目标见
P0067R5，C++17 定稿前的 `errc` 修复见
[P0682R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0682r1.html)。C++20
精确声明必须以 N4861 `[charconv.syn]` 为准，排除第 3.2 节列出的后续成员和 `constexpr`。

### 6.2 选择、错误、生命周期与关系

- 适合协议、日志、配置解析等需要 locale-independent、无异常错误通道的低层转换。
- 它不创建拥有字符串：调用者提供 `[first,last)`，并按 `ptr` 决定已写或已消费范围。
- 不自动跳过前导空白，也不自动要求消费到 `last`；完整字段解析必须同时检查成功和
  `ptr == last`。
- `from_chars` 的输入范围必须在调用期间有效；结果 `ptr` 只是指向该范围的指针。
- 需要宽字符、locale 或格式化布局时不要强行使用 `<charconv>`。

推荐关系：`std-from-chars`、`std-to-chars`、`header-string`、`header-string-view`。

### 6.3 头文件示例规格

`integer-round-trip.cpp`：向 `std::array<char, 8>` 以 base 16 写入 `255`，再从实际写入范围解析；
检查两个 `ec`，只构造已写片段。精确 stdout：`value=255\nhex=ff\n`。

## 7. `<memory>` 头文件页

### 7.1 Reduced facility map

| 学习目的 | C++20 代表设施 | 首次标准 / 演进 | 分流说明 |
|---|---|---|---|
| 指针特征与取地址 | `pointer_traits`、`to_address`、`addressof` | C++11 / C++20 / C++11 | 不表达所有权 |
| 分配器协议 | `allocator`、`allocator_traits`、`uses_allocator` | C++98 / C++11 | 容器与原始存储基础设施 |
| 独占所有权 | `unique_ptr`、`make_unique` | C++11 / C++14 | 一个 owner，首选默认模型 |
| 共享/弱所有权 | `shared_ptr`、`weak_ptr`、`make_shared`、`allocate_shared` | C++11 | 本批三个实体页 |
| shared-from-this | `enable_shared_from_this` | C++11 | 必须已处于合适 ownership group |
| 原始存储构造销毁 | `uninitialized_*`、`destroy*`、`construct_at` | C++17 / C++20 | 手工 lifetime 的高级设施 |
| 对齐 | `align`、`assume_aligned` | C++11 / C++20 | `assume_aligned` 的前置条件很窄 |
| 原子共享指针 | `atomic<shared_ptr<T>>`、`atomic<weak_ptr<T>>` | C++20 | 同一 smart-pointer 对象的并发协调 |

当前完整 synopsis 是 [`[memory.syn]`](https://eel.is/c++draft/memory.syn)，其中
`out_ptr`/`inout_ptr` 来自 C++23 的
[P1132R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p1132r8.html)，显式
`start_lifetime_as` 来自 C++23 的
[P2590R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2590r2.pdf)，均不得写入
C++20 facility map。

### 7.2 选择、错误与关系

- 默认优先值语义；需要动态独占时 `unique_ptr`；确实有多个共同 owner 才使用 `shared_ptr`；
  只观察不延长生命期用 `weak_ptr`。
- `<memory>` 不是“所有动态内存都应手写 allocator”的信号。普通应用优先容器和创建函数。
- 智能指针管理对象生命期，不替代对对象内容的互斥或原子协议。
- 必须直接 `#include <memory>`；不要依赖某个容器头偶然包含它。

推荐关系：`std-unique-ptr`、`std-make-unique`、`std-shared-ptr`、`std-weak-ptr`、
`std-make-shared`。

### 7.3 头文件示例规格

`ownership-family.cpp`：以 `make_unique<int>(7)` 与一个复制后的 `shared_ptr<int>` 展示两种
ownership family，不输出地址。精确 stdout：`unique=7\nshared-count=2\n`。

## 8. `std::string::substr`

### 8.1 C++20 代表声明与版本

```cpp
constexpr basic_string substr(size_type pos = 0,
                              size_type n = npos) const;
```

实体符号用常见特化名 `std::string::substr`，正文说明它是
`basic_string<charT, traits, Allocator>` 成员。C++98 已有该成员；C++20 由 P0980R1 加入
`constexpr`。不要复制当前 [`[string.substr]`](https://eel.is/c++draft/string.substr) 的
`const &`、`&&` 或 `subview` 声明。

### 8.2 参数、返回、错误、复杂度与生命周期

- `pos` 是从 0 开始的位置；若 `pos > size()` 抛 `out_of_range`。`pos == size()` 合法并返回空串。
- 结果长度为 `min(n, size() - pos)`；`n == npos` 表示取到末尾。
- 返回新的 owning `basic_string`，修改或销毁源字符串不会使结果悬空。
- C++20 效果等价于 `basic_string(*this, pos, n)`。该 substring constructor 的 allocator 参数
  默认是 `Allocator()`；结果不继承源字符串当前 allocator 对象。状态化 allocator 页面必须提醒。
- 分配可抛 `bad_alloc`；越界抛 `out_of_range`；源字符串不修改。
- `[string.substr]` 没有独立 Complexity 段，页面应明确“标准未为该成员单独规定渐进复杂度上界”，
  不自创精确 O；它构造一个新 owning string，不应暗示零拷贝。

构造器合同锚点：[`[string.cons]`](https://eel.is/c++draft/string.cons)。字符串异常保证锚点：
[`[string.require]`](https://eel.is/c++draft/string.require)。

### 8.3 选择、非使用、JS 类比与关系

用于需要独立拥有切片的结果。只在调用栈内借用并避免分配时选 `string_view::substr`；需要按 delimiter
定位时先用 `find`。JavaScript `String.prototype.slice` 也返回文本值，但 JS 字符串不可变且索引按
UTF-16 code unit；C++ `std::string` 通常按字节/`charT` 单元，不能把二者都当 grapheme 切片器。

推荐关系：`std-string`、`std-string-find`、`header-string`、`header-string-view`。

### 8.4 确定性示例

1. `copy-suffix.cpp`：对 `"cpp-learner"` 从位置 4 取到末尾。
   精确 stdout：`result=learner\n`。
2. `extract-route-segment.cpp`：从 `"/api/users/42"` 取得固定的 resource segment。
   精确 stdout：`resource=users\n`。

## 9. `std::string::find`

### 9.1 C++20 代表声明

```cpp
template<class T>
constexpr size_type find(const T& t, size_type pos = 0) const
  noexcept(/* see standard */);

constexpr size_type find(const basic_string& str,
                         size_type pos = 0) const noexcept;
constexpr size_type find(const charT* s, size_type pos,
                         size_type n) const;
constexpr size_type find(const charT* s,
                         size_type pos = 0) const;
constexpr size_type find(charT c,
                         size_type pos = 0) const noexcept;
```

所有重载始于 C++98，除 `StringViewLike` 模板始于 C++17；C++20 由 P0980R1 使它们可用于
constant evaluation。声明与等价转发见当前 [`[string.find]`](https://eel.is/c++draft/string.find)，
精确 C++20 spelling 以 N4861 为准。

### 9.2 合同、错误、复杂度与生命周期

- 返回不小于 `pos` 的最小匹配起点；没有匹配返回 `npos`。`npos` 不是异常，也不能直接转换成
  `int` 作为可靠哨兵。
- 模式必须完整落在字符串内，字符相等由 `traits::eq` 决定。
- 空模式在 `pos <= size()` 时匹配 `pos`；`pos > size()` 时返回 `npos`。
- `(s, pos, n)` 要求 `[s,s+n)` 有效；C-string 重载要求 `s` 指向有效 null-terminated sequence。
  无效指针/范围违反前置条件，不是 `npos` 错误结果。
- `find` 不修改字符串，不返回指针，也不引入新的生命周期。后续修改字符串前，应把位置作为索引
  使用或重新检查边界。
- `[string.find]` 自身没有独立 Complexity 段。当前等价转发到 `basic_string_view`，其搜索条款
  [`[string.view.find]`](https://eel.is/c++draft/string.view.find) 给出最坏
  `O(size() * str.size())`；页面若引用此上界必须标成被委托搜索合同，不能承诺某个实现一定线性，
  也不能发明精确比较次数。

### 9.3 选择、非使用、JS 类比与关系

用于找第一个子串/字符和从已知位置继续搜索。只判断前后缀用 C++20 `starts_with` / `ends_with`；
复杂模式或 Unicode 文本规则不要用原始字节 find 冒充。JavaScript `String.prototype.indexOf`
同样返回位置或 `-1`，而 C++ 返回无符号 `size_type` 或 `npos`；两者哨兵不可机械互换。

推荐关系：`std-string`、`std-string-substr`、`header-string`、`header-string-view`。

### 9.4 确定性示例

1. `find-delimiter.cpp`：在 `"api/v1"` 中查第一个 `/` 并输出位置。
   精确 stdout：`delimiter=3\n`。
2. `handle-missing-route.cpp`：在 `"/api/users"` 中查 `"admin"`，显式比较 `npos`。
   精确 stdout：`admin=missing\n`。

## 10. `std::string::append`

### 10.1 C++20 代表声明

```cpp
constexpr basic_string& append(const basic_string& str);
constexpr basic_string& append(const basic_string& str,
                               size_type pos, size_type n = npos);
template<class T> constexpr basic_string& append(const T& t);
template<class T> constexpr basic_string& append(
  const T& t, size_type pos, size_type n = npos);
constexpr basic_string& append(const charT* s, size_type n);
constexpr basic_string& append(const charT* s);
constexpr basic_string& append(size_type n, charT c);
template<class InputIterator>
constexpr basic_string& append(InputIterator first, InputIterator last);
constexpr basic_string& append(initializer_list<charT> il);
```

这里按学习者可见输入来源分组，明确省略完整约束措辞。核心 string、pointer、count/char 与 iterator
overload 始于 C++98，`initializer_list` overload 始于 C++11，StringViewLike overload 始于
C++17，C++20 `constexpr` 来自 P0980R1。当前
[`[string.append]`](https://eel.is/c++draft/string.append) 中的 `append_range` 及其他晚期扩充
不可写入 C++20 声明。

### 10.2 合同、错误、复杂度与失效

- 所有 overload 都把字符追加到现有末尾并返回 `*this`，可链式调用。
- `(s,n)` 要求 `[s,s+n)` 有效并追加其副本；C-string overload 以 `traits::length(s)` 决定长度。
- substring overload 对 `pos` 适用 substring 越界合同；实际长度截断为源中剩余长度。
- InputIterator overload 必须接收有效输入范围；不能把一对无关容器迭代器拼成范围。
- `s.append(s)`、从自身取 substring 的 overload，以及 `[s.data(), s.data()+s.size())` 这类调用都
  受 copy / equivalent-to 合同保护：实现即使需要重分配，也必须产生仿佛从调用开始时有效 source
  复制的结果，不能在重分配后继续从已失效地址边读边写。该保证只覆盖调用开始时满足前置条件的
  self-overlap；它不会把原本无效的 pointer range 或 iterator range 变合法。
- 如果新 size 超过 `max_size()`，抛 `length_error`；分配可抛 `bad_alloc`；字符串成员异常时对目标
  string 无其他效果。
- 成功的 append 是非 const 修改，可能使目标字符串既有引用、指针、迭代器及 `string_view`
  失效；不要先保存 `data()` 再假设地址稳定。
- `[string.append]` 没有独立 Complexity 段。不要把某一实现的 small-string optimization 或
  `reserve` 策略写成标准保证，也不要无条件承诺 amortized constant。

### 10.3 选择、非使用、JS 类比与关系

用于在已有 owning string 后追加。只追加一个字符可用 `push_back`，生成全新组合值可用
`operator+`，大量结构化格式化应考虑专用格式化设施。JavaScript 字符串不可变，`+=`/`concat`
产生新值；C++ `append` 原地修改并返回同一对象引用，因此别名和失效行为完全不同。

推荐关系：`std-string`、`header-string`、`std-string-substr`、`header-string-view`。

### 10.4 确定性示例

1. `append-greeting.cpp`：从 `"Hello"` 开始依次 append `", "` 与 `"C++!"`。
   精确 stdout：`Hello, C++!\n`。
2. `append-self-range.cpp`：`std::string text = "api"`，调用
   `text.append(text.data(), text.size())`，验证规范要求的 source-range 复制语义。
   精确 stdout：`apiapi\n`。

## 11. `std::from_chars`

### 11.1 C++20 声明与结果

```cpp
struct from_chars_result {
  const char* ptr;
  errc ec;
};

from_chars_result from_chars(const char* first, const char* last,
                             /* integer type */& value,
                             int base = 10);

from_chars_result from_chars(const char* first, const char* last,
                             float& value,
                             chars_format fmt = chars_format::general);
// corresponding double and long double overloads
```

C++17 引入；N4861 的结果没有 `operator bool`，整数 overload 也不是 `constexpr`。完整类型集合、
声明和合同由 N4861 `[charconv.syn]` / `[charconv.from.chars]` 固定，当前稳定锚点为
[`[charconv.from.chars]`](https://eel.is/c++draft/charconv.from.chars)。

### 11.2 输入语法、返回、错误、复杂度与生命周期

- `[first,last)` 必须是有效字符范围；函数不要求 null terminator，也不会读过 `last`。
- 成功时 `value` 被赋解析值，`ec == errc{}`，`ptr` 指向第一个未匹配字符或 `last`。
- 无任何字符匹配时：`ec == invalid_argument`、`ptr == first`、`value` 不变。
- 值超出目标类型可表示范围时：`ec == result_out_of_range`、`value` 不变，`ptr` 仍越过已匹配模式。
- 整数 `base` 前置条件为 2..36；不跳过空白，不接受前导 `+`，只有 signed target 可接受 `-`；
  base 16 不接受 `0x` 前缀，C++20 的 base 2 grammar 也不接受 `0b` 前缀。
- 浮点 `scientific` only 要求指数，`fixed` only 禁止指数；hex 模式假定前缀但输入本身不写
  `0x`，所以 `0x123` 会先解析出 `0` 并把 `x123` 留作 remainder。
- 所有 overload `Throws: Nothing`。条款没有渐进 Complexity 段；不要把某个实现 benchmark
  写成标准上界。
- 返回 `ptr` 借用输入范围；源字符存储失效后不能解引用或用于构造 remainder。

### 11.3 选择、非使用、JS 类比与关系

用于无异常、locale-independent、允许前缀解析的协议字段。需要拒绝尾随垃圾时必须检查
`ptr == last`；想自动跳过空白或接受 `0x` 的 `strtol` 规则时不要假设它们相同。
JavaScript `Number()` 返回 `NaN` 表示大量错误，`parseInt` 还允许部分解析；`from_chars`
通过 `ec` 和 `ptr` 分离“完全没匹配”“越界”“成功消费多少”，且失败保持输出值不变。

推荐关系：`header-charconv`、`std-to-chars`、`header-string-view`、`header-string`。

### 11.4 确定性示例

1. `parse-with-remainder.cpp`：解析 `"200ms"` 到 int，成功后用 `ptr` 输出 remainder。
   精确 stdout：`value=200\nremainder=ms\n`。
2. `classify-parse-errors.cpp`：分别解析 `"oops"` 和远超 int 范围的十进制数字串，检查
   `invalid_argument` 与 `result_out_of_range`。精确 stdout：
   `invalid=true\nout-of-range=true\n`。

## 12. `std::to_chars`

### 12.1 C++20 声明与结果

```cpp
struct to_chars_result {
  char* ptr;
  errc ec;
};

to_chars_result to_chars(char* first, char* last,
                         /* integer type */ value,
                         int base = 10);

to_chars_result to_chars(char* first, char* last, float value);
to_chars_result to_chars(char* first, char* last,
                         float value, chars_format fmt);
to_chars_result to_chars(char* first, char* last,
                         float value, chars_format fmt, int precision);
// corresponding double and long double overloads
```

实现为 `char` 及所有 signed/unsigned integer types 提供整数 overload；`bool` 不在整数集合中。
C++17 引入，C++20 非 `constexpr`。当前稳定锚点为
[`[charconv.to.chars]`](https://eel.is/c++draft/charconv.to.chars)，精确 C++20 声明取 N4861。

### 12.2 输出语法、返回、错误、复杂度与生命周期

- `[first,last)` 必须是有效可写范围；函数不追加 null terminator。
- 成功时 `ec == errc{}`，`ptr` 指向最后一个写入字符之后；只应读取 `[first,ptr)`。
- 缓冲不足时 `ec == value_too_large`、`ptr == last`，并且整个 `[first,last)` 内容未指定；错误后
  不能把部分 buffer 当截断字符串。
- 整数 `base` 前置条件为 2..36；没有冗余前导 0，10..35 使用小写 `a..z`，负数有 `-`。
- 无 precision 的浮点 overload 产生能由同实现对应 `from_chars` 精确恢复原值的最短表示；
  `chars_format::hex` 输出没有 `0x` 前缀。跨实现 golden output 应避免依赖浮点表示选择。
- 所有 overload `Throws: Nothing`。条款没有渐进 Complexity 段；P0067R5 的性能目标不是
  可替代规范复杂度的承诺。
- 结果不拥有 buffer；`ptr` 仅在 caller-owned buffer 仍有效时可用。
- 接口没有“先问 required size”的查询。整数任意 base 的通用保守缓冲可取
  `numeric_limits<T>::digits + 3` 个 char（覆盖 base 2 最长 digits、负号与余量），或在
  `value_too_large` 后扩大并重试。浮点尤其带 precision 时应由协议给上限或采用扩大重试；任何
  方案都要记住成功字符数不包含额外的 NUL terminator。

### 12.3 选择、非使用、JS 类比与关系

用于写入预分配 buffer、避免格式字符串和异常。需要字段宽度、填充、locale 或复合格式时选择格式化
设施；需要 owning string 时用 `[first,ptr)` 明确构造。JavaScript `number.toString(base)` 直接返回
拥有字符串；`to_chars` 写 caller buffer，并把容量错误放在 `ec` 中。

推荐关系：`header-charconv`、`std-from-chars`、`header-string`、`header-string-view`。

### 12.4 确定性示例

1. `format-hex.cpp`：将整数 255 以 base 16 写入 8 字节 array，再从 `[first,ptr)` 构造 string。
   精确 stdout：`hex=ff\n`。
2. `handle-small-buffer.cpp`：用不足以保存十进制 `255` 的 2 字节 buffer 转换，且不读取失败后的
   buffer，只检查 `value_too_large` 与 `ptr == last`。精确 stdout：
   `too-small=true\nptr-at-end=true\n`。

## 13. `std::shared_ptr`

### 13.1 C++20 代表接口

```cpp
template<class T> class shared_ptr {
public:
  using element_type = remove_extent_t<T>;
  using weak_type = weak_ptr<T>;

  constexpr shared_ptr() noexcept;
  constexpr shared_ptr(nullptr_t) noexcept;
  template<class Y> explicit shared_ptr(Y* p);
  shared_ptr(const shared_ptr& r) noexcept;
  shared_ptr(shared_ptr&& r) noexcept;
  template<class Y> explicit shared_ptr(const weak_ptr<Y>& r);
  ~shared_ptr();

  void reset() noexcept;
  element_type* get() const noexcept;
  T& operator*() const noexcept;
  T* operator->() const noexcept;
  long use_count() const noexcept;
  explicit operator bool() const noexcept;
};
```

该声明只展示 ownership、构造、销毁和观察主线，明确省略 custom deleter、allocator、aliasing、
converting、`unique_ptr` 转换、比较、cast 与非成员 overload。完整 C++20 集合取 N4861
`[util.smartptr.shared]`；当前锚点为
[`[util.smartptr.shared]`](https://eel.is/c++draft/util.smartptr.shared)。共享指针 C++11 引入；
array specialization 支持由 C++17 的
[P0414R2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0414r2.html) 完善。

### 13.2 所有权、返回、错误、复杂度与线程边界

- `shared_ptr` 表达共享所有权；最后一个 owner 负责调用保存的 deleter 或 `delete`，从而释放被管理
  资源。复制增加同一 ownership group，移动后源为空。
- stored pointer 与 owned pointer 可能不同（aliasing constructor）；`get()==nullptr` 也不能单独
  推断 ownership group 为空。`operator bool` 只检查 stored pointer。
- 所有权组的 control metadata 与 stored pointer 是两条轴：aliasing shared_ptr 可存成员地址却共享
  外层对象的 ownership group。最后一个 strong owner 离开时被管理对象销毁；若 weak_ptr 仍存在，
  实现仍需保留足够的 control metadata 让 `expired`/`lock` 工作，直到最后一个 weak observer 也
  离开后这部分元数据才可回收。页面不得把 control-block 具体布局或地址写成 ABI 保证。
- `operator*`/`operator->` 前置条件是 `get()!=nullptr`；空指针解引用违反前置条件。
- raw-pointer constructor 要求 deleter 表达式行为良好且对象 complete；建立控制信息失败可抛
  `bad_alloc` 或实现定义资源异常，并负责清理传入 pointer。由 expired weak_ptr 构造则抛
  `bad_weak_ptr`。
- 析构本身没有独立异常通道；用户提供的 deleter 必须满足相应要求，不能以抛异常作为恢复协议。
- 当前 shared_ptr 各子条款没有统一 Complexity 段；页面不得把引用计数实现、控制块布局或
  lock-free 性质写成标准复杂度保证。`use_count()` 是观察值，不是同步原语；多线程影响它时结果近似。
- 不同 smart-pointer 对象即使共享同一 ownership group，也可以由多线程并发调用各自的
  shared/weak pointer 成员；引用计数变化本身不构成所指对象的数据竞争。这不让被管理
  对象的字段访问自动安全；对同一个 `shared_ptr` 对象做并发非 const 修改也仍应使用锁或
  C++20 `atomic<shared_ptr<T>>`。

所有权和 data-race 锚点：
[`[util.smartptr.shared.general]`](https://eel.is/c++draft/util.smartptr.shared.general)；析构：
[`[util.smartptr.shared.dest]`](https://eel.is/c++draft/util.smartptr.shared.dest)；观察器：
[`[util.smartptr.shared.obs]`](https://eel.is/c++draft/util.smartptr.shared.obs)；构造器：
[`[util.smartptr.shared.const]`](https://eel.is/c++draft/util.smartptr.shared.const)。

### 13.3 选择、非使用、JS 类比与关系

只有当多个组件确实共同决定对象生命期时使用。单一 owner 用 `unique_ptr`，仅观察 ownership group
用 `weak_ptr`；栈对象和值语义更简单时不要引入引用计数。绝不能用同一 raw pointer 分别构造两个
independent `shared_ptr`，否则会形成两个控制关系并重复释放。JavaScript 对象引用由 GC 追踪，
C++ `shared_ptr` 是确定性引用计数所有权；强引用环不会自动收集，必须以 `weak_ptr` 打断。

推荐关系：`std-weak-ptr`、`std-make-shared`、`std-unique-ptr`、`std-make-unique`、
`header-memory`。

### 13.4 确定性示例

1. `share-service.cpp`：`make_shared<int>(42)` 后复制一个 owner，在单线程固定点输出。
   精确 stdout：`value=42\nowners=2\n`。
2. `alias-member.cpp`：创建 `shared_ptr<Service>`，再以 aliasing constructor 创建指向 `id` 成员
   的 `shared_ptr<int>`；stored pointer 不同但共享 ownership。精确 stdout：
   `id=7\nowners=2\n`。

## 14. `std::weak_ptr`

### 14.1 C++20 代表接口

```cpp
template<class T> class weak_ptr {
public:
  using element_type = remove_extent_t<T>;

  constexpr weak_ptr() noexcept;
  template<class Y> weak_ptr(const shared_ptr<Y>& r) noexcept;
  weak_ptr(const weak_ptr& r) noexcept;
  weak_ptr(weak_ptr&& r) noexcept;
  ~weak_ptr();

  void reset() noexcept;
  long use_count() const noexcept;
  bool expired() const noexcept;
  shared_ptr<T> lock() const noexcept;
};
```

省略 converting overload、assignment、swap 与 ownership ordering，但实现页需要用 related/notes
指出它们存在。C++11 引入，C++20 精确接口取 N4861 `[util.smartptr.weak]`；当前锚点为
[`[util.smartptr.weak]`](https://eel.is/c++draft/util.smartptr.weak)。

### 14.2 所有权、返回、错误、复杂度与并发

- weak_ptr 保存对已由 shared_ptr 管理对象的弱引用，不增加 shared ownership；最后一个 strong
  owner 消失时对象可以销毁，即使 weak_ptr 仍存在。
- weak observer 可以让 ownership group 的 control metadata 继续存在，但不保住被管理对象本身；
  因而“还有 weak_ptr”与“对象仍活着”是完全不同的状态。
- 它没有 `operator*`/`operator->`。访问前调用 `lock()`：未过期时原子地取得一个 shared owner，
  已过期时返回空 shared_ptr。
- `expired()` 等价于 `use_count()==0`，但“先 expired 再另外构造 owner”会有竞态；直接 lock 并
  检查结果才是访问协议。
- `lock()` 是 `noexcept`；相比之下，用 expired weak_ptr 构造 shared_ptr 会抛 `bad_weak_ptr`。
- `use_count()`、`expired()`、`lock()` 条款没有渐进 Complexity 段；不要承诺 lock-free。
- weak_ptr 只保护 lifetime 协议，不同步被管理对象字段。C++20 的 `atomic<weak_ptr<T>>` 用于同一
  weak_ptr 值的原子发布，不替代对象内部同步。

观察合同：[`[util.smartptr.weak.obs]`](https://eel.is/c++draft/util.smartptr.weak.obs)；
构造合同：[`[util.smartptr.weak.const]`](https://eel.is/c++draft/util.smartptr.weak.const)。

### 14.3 选择、非使用、JS 类比与关系

用于打断 shared_ptr 环、观察缓存项或注册表对象而不延长生命期。若调用者必须保证对象活到操作完成，
应持有 shared_ptr 而不是反复查询 raw pointer。JavaScript `WeakRef.deref()` 也可能拿不到对象，
但 JS 的回收时机由 GC 决定；C++ weak_ptr 的失效由最后一个 shared owner 的确定性释放触发。

推荐关系：`std-shared-ptr`、`std-make-shared`、`header-memory`。

### 14.4 确定性示例

1. `lock-live-object.cpp`：weak_ptr 指向值 42；一次 `lock()` 成功后固定输出 bool、值和 strong
   owner 数。精确 stdout：`locked=true\nvalue=42\nowners=2\n`。
2. `observe-expiration.cpp`：先输出未过期，reset 唯一 strong owner 后输出过期和 lock 失败。
   精确 stdout：`expired=false\nexpired=true\nlocked=false\n`。

## 15. `std::make_shared`

### 15.1 C++20 代表 overload

```cpp
template<class T, class... Args>
shared_ptr<T> make_shared(Args&&... args);       // T is not array

template<class T>
shared_ptr<T> make_shared(size_t N);             // T is U[]
template<class T>
shared_ptr<T> make_shared();                     // T is U[N]
template<class T>
shared_ptr<T> make_shared(size_t N,
                          const remove_extent_t<T>& u); // T is U[]
template<class T>
shared_ptr<T> make_shared(const remove_extent_t<T>& u); // T is U[N]
```

非数组版本始于 C++11；四组 array 形态由 P0674R1 加入 C++20。这里展示学习者可见家族，完整
多维数组初始化措辞取 N4861 `[util.smartptr.shared.create]`。当前锚点为
[`[util.smartptr.shared.create]`](https://eel.is/c++draft/util.smartptr.shared.create)，不得复制
当前草案的 `constexpr`。

### 15.2 构造、返回、错误、分配与生命周期

- 非数组版本以 `T(std::forward<Args>(args)...)` 初始化对象，返回既存储又拥有新对象地址的
  shared_ptr；返回时 `get()!=nullptr` 且 `use_count()==1`。
- array overload 按 bounded/unbounded 形态确定元素个数并做 value/default 或指定值初始化；
  C++20 页面必须让 `make_shared<int[]>(N)` 可发现。
- 抛 `bad_alloc` 或对象/元素初始化抛出的异常；若抛出则函数无效果，已构造子对象按规范清理。
- 标准说实现**应当**不超过一次内存分配，不是硬性“必须一次”。页面不能保证 control block 与对象
  的布局、大小或 allocator 细节。
- 没有独立渐进 Complexity 段；只可陈述上述 allocation recommendation 与对象构造本身成本。
- 返回 shared_ptr 延长新对象生命期；最后一个 owner 销毁时对象销毁。实现采用合并分配时，残留
  weak_ptr 可能使整块存储释放晚于对象析构，这是合并布局的常见后果而不是可依赖 ABI。
- `make_shared` 不接受 custom deleter，也不接受 allocator；需要 allocator 用 `allocate_shared`，
  需要 custom deleter 用合适的 shared_ptr constructor。

### 15.3 选择、非使用、JS 类比与关系

普通共享创建优先 `make_shared`：它把对象构造与 ownership establishment 放在一个表达式，避免
裸指针交接窗口。不要为“也许以后共享”而默认选它；单 owner 仍选 `make_unique`。构造器访问控制在
`make_shared` 的实现上下文检查，private constructor 不因调用发生在类成员中就自动可访问。
JavaScript `new` 只构造由 GC 管理的对象；`make_shared<T>` 同时构造 T 并建立显式共享所有权组。

推荐关系：`std-shared-ptr`、`std-weak-ptr`、`std-make-unique`、`header-memory`。

### 15.4 确定性示例

1. `construct-widget.cpp`：`make_shared<Widget>(42)`，输出字段与固定点 owner 数，不输出地址。
   精确 stdout：`value=42\nowners=1\n`。
2. `make-shared-array.cpp`：C++20 `make_shared<int[]>(3)` 后赋值 `2,4,6` 并按固定索引输出。
   精确 stdout：`2 4 6\n`。

## 16. 确定性 C++20 stdout 实现矩阵

| Entry | 示例文件 | 核心路径 | 精确 stdout | 风险防线 |
|---|---|---|---|---|
| `<string>` | `string-family.cpp` | owning text | `text=cpp-learn\nsize=9\n` | 固定 ASCII code units |
| `<string_view>` | `view-family.cpp` | two borrowed slices | `prefix=api\nsuffix=v1/users\n` | literal storage 不悬空 |
| `<charconv>` | `integer-round-trip.cpp` | integer to/from | `value=255\nhex=ff\n` | 仅读 `[first,ptr)` |
| `<memory>` | `ownership-family.cpp` | unique/shared | `unique=7\nshared-count=2\n` | 不输出地址/布局 |
| `substr` | `copy-suffix.cpp` | owning suffix | `result=learner\n` | pos 在界内 |
| `substr` | `extract-route-segment.cpp` | bounded owning slice | `resource=users\n` | count 确定 |
| `find` | `find-delimiter.cpp` | character find | `delimiter=3\n` | 结果固定 |
| `find` | `handle-missing-route.cpp` | missing substring | `admin=missing\n` | 显式比较 npos |
| `append` | `append-greeting.cpp` | chained append | `Hello, C++!\n` | 不保留旧 iterator |
| `append` | `append-self-range.cpp` | aliased source range | `apiapi\n` | 规范要求 copy 语义 |
| `from_chars` | `parse-with-remainder.cpp` | partial integer parse | `value=200\nremainder=ms\n` | ec 成功后使用 ptr |
| `from_chars` | `classify-parse-errors.cpp` | invalid + out of range | `invalid=true\nout-of-range=true\n` | 不输出失败值 |
| `to_chars` | `format-hex.cpp` | base 16 integer | `hex=ff\n` | 不要求 null terminator |
| `to_chars` | `handle-small-buffer.cpp` | capacity error | `too-small=true\nptr-at-end=true\n` | 不读取失败 buffer |
| `shared_ptr` | `share-service.cpp` | deterministic copy | `value=42\nowners=2\n` | 单线程固定点计数 |
| `shared_ptr` | `alias-member.cpp` | aliasing constructor | `id=7\nowners=2\n` | stored/owned pointer 分离 |
| `weak_ptr` | `lock-live-object.cpp` | successful lock | `locked=true\nvalue=42\nowners=2\n` | 单次 lock 后访问 |
| `weak_ptr` | `observe-expiration.cpp` | deterministic expiry | `expired=false\nexpired=true\nlocked=false\n` | reset 唯一 strong owner |
| `make_shared` | `construct-widget.cpp` | forwarded constructor | `value=42\nowners=1\n` | 不输出 allocation 数 |
| `make_shared` | `make-shared-array.cpp` | C++20 array overload | `2 4 6\n` | 固定索引、已赋值 |

所有 manifest 必须声明 `standard: "c++20"` 和完整 `expectedStdout`；源代码必须直接包含所需
头文件、不使用 `using namespace std;`，并在读取 charconv 结果前检查 `ec`。普通实体恰好两个
示例；头文件 reduced-form 各一个示例，避免与普通实体页重复扩写。

## 17. zh.cppreference 学习结构基线

本节只借鉴 zh.cppreference 的 learner-facing 信息架构与覆盖检查，不以其支持规范结论，也不复制
其正文、示例或表格措辞。实现者应把 WG21 原文转述为本站自己的教学语言，并用第 18 节 primary
source 回查每条事实。对应页面映射：

| Entry | Secondary baseline | 借鉴的覆盖检查 |
|---|---|---|
| `<string>` | [字符串库 / `<string>`](https://zh.cppreference.com/w/cpp/header/string) | facility 分组、版本徽标、相关头文件 |
| `<string_view>` | [`<string_view>`](https://zh.cppreference.com/w/cpp/header/string_view) | aliases、literals、hash、ranges 集成 |
| `<charconv>` | [`<charconv>`](https://zh.cppreference.com/w/cpp/header/charconv) | result types、format enum、两个方向 |
| `substr` | [`basic_string::substr`](https://zh.cppreference.com/w/cpp/string/basic_string/substr) | 按版本声明、参数、返回、异常、notes、示例、see-also |
| `find` | [`basic_string::find`](https://zh.cppreference.com/w/cpp/string/basic_string/find) | overload 分组、npos、空模式、示例 |
| `append` | [`basic_string::append`](https://zh.cppreference.com/w/cpp/string/basic_string/append) | overload 分组、异常、失效、相关函数 |
| `from_chars` | [`from_chars`](https://zh.cppreference.com/w/cpp/utility/from_chars) | 语法差异、错误结果、参数/返回、notes |
| `to_chars` | [`to_chars`](https://zh.cppreference.com/w/cpp/utility/to_chars) | 格式重载、buffer 错误、示例、see-also |
| `<memory>` | [`<memory>`](https://zh.cppreference.com/w/cpp/header/memory) | facility family map 与版本分组 |
| `shared_ptr` | [`shared_ptr`](https://zh.cppreference.com/w/cpp/memory/shared_ptr) | ownership、member/non-member 导航、notes |
| `weak_ptr` | [`weak_ptr`](https://zh.cppreference.com/w/cpp/memory/weak_ptr) | observers、lock、循环关系、see-also |
| `make_shared` | [`make_shared`](https://zh.cppreference.com/w/cpp/memory/shared_ptr/make_shared) | overload 版本组、exceptions、allocation notes |

每个 ordinary page 的内容槽位固定为：用途与非用途；按版本分组声明；参数/约束/前置条件；返回；
错误/异常；复杂度（若标准没有独立规定则明确写无独立上界）；lifetime/失效/thread 边界；notes；
两个原创确定性示例；有用的 JS/TS 类比；related entries。secondary 页面若与 N4861 或 current draft
冲突，以 WG21 primary source 为准。

## 18. 每条目 primary source manifest 建议

以下是内容 source 字段的最小集合；同一条目可按事实拆成多条 source record，但不得把 secondary
baseline 伪装成规范来源。

| Entry | C++20/version source | current contract anchors | evolution guard |
|---|---|---|---|
| `<string>` | N2356、N4861、P0980R1 | `[string.syn]`、`[basic.string.general]`、`[string.require]` | P1206R7、P1679R3、P3044R2 |
| `<string_view>` | P0220R1、N4659、N4861 | `[string.view.synop]`、`[string.view.template]` | P1679R3、P3044R2 |
| `<charconv>` | P0067R5、P0682R1、N4659、N4861 | `[charconv.syn]` | P2291R3、P2497R0 |
| `substr` | N2356、N4861、P0980R1 | `[string.substr]`、`[string.cons]` | P2438R2、P3044R2 |
| `find` | N2356、N4861、P0980R1 | `[string.find]`、`[string.view.find]` | current draft only for anchor |
| `append` | N2356、N4861、P0980R1 | `[string.append]`、`[string.require]` | P1206R7 |
| `from_chars` | P0067R5、P0682R1、N4659、N4861 | `[charconv.from.chars]` | P2291R3、P2497R0 |
| `to_chars` | P0067R5、P0682R1、N4659、N4861 | `[charconv.to.chars]` | P2291R3、P2497R0 |
| `<memory>` | N2356、N3337、N4861 | `[memory.syn]` | P1132R8、P2590R2、P3037R5 |
| `shared_ptr` | N3337、N4861、P0414R2 | shared general/const/dest/obs | P1901R2、P3037R5 |
| `weak_ptr` | N3337、N4861、P0718R2 | weak general/const/obs | P1901R2、P3037R5 |
| `make_shared` | N3337、N4861、P0674R1 | `[util.smartptr.shared.create]` | P1973R1、P3037R5 |

## 19. 实现审查清单

- [ ] catalog 恰好新增本文 12 个 ID，总数从 49 变为 61，版本从 5 变为 6。
- [ ] 4 个 header 页采用 reduced facility map，有直接 include、版本、选择与 outgoing links。
- [ ] 8 个 ordinary entry 均有两个 C++20 确定性示例和精确 stdout。
- [ ] C++20 `substr` 只有未 ref-qualified 的 const overload；没有 `&&` 或 `subview`。
- [ ] `substr` 说明返回 owning copy、`pos > size()`、截断长度与默认构造 allocator。
- [ ] `find` 说明最小位置、`npos`、空模式、pointer range 前置条件，不发明精确比较次数。
- [ ] `append` 说明 `*this`、强异常保证、`length_error` 与引用/view 失效，不出现 `append_range`。
- [ ] C++20 charconv result 只有 `ptr/ec`；没有 `operator bool`/comparison；整数 conversion 非 constexpr。
- [ ] `from_chars` 说明不跳空白/不接收 leading `+`/不接收整数前缀，并区分两种 errc。
- [ ] `to_chars` 不写 null terminator；buffer 失败后不读取 unspecified contents。
- [ ] charconv 页面不承诺实现内部绝不分配，只陈述 caller buffer、Throws Nothing 与设计目标。
- [ ] `shared_ptr` 区分 stored pointer 与 ownership，警告重复 raw-pointer control group 和强环。
- [ ] `weak_ptr` 通过一次 `lock()` 取得访问 owner，不写 `expired()` 先检查再解引用的竞态模式。
- [ ] `make_shared` 包含 C++20 array overload，且把“不超过一次分配”写成 should 而非 shall。
- [ ] shared_ptr/weak_ptr/make_shared 没有当前草案的 C++26 `constexpr`/owner hash/equal 泄漏。
- [ ] Complexity 段对未规定独立上界的条目明确诚实，不用经验复杂度冒充标准保证。
- [ ] JS/TS 类比只解释心智模型差异，不暗示 Unicode、GC 或错误语义完全相同。
- [ ] zh.cppreference 只作为结构/覆盖 baseline；所有 substantive standard facts 仍指向 WG21 primary。

## 20. 一级来源索引

### 20.1 标准版本

- [N2356：1997 public review draft](https://www.open-std.org/jtc1/sc22/open/n2356/)
- [N3337：C++11 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)
- [N4659：C++17 final working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
- [N4861：C++20 final working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)

### 20.2 字符串与转换演进

- [P0220R1：Adopt Library Fundamentals V1 TS Components for C++17](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0220r1.html)
- [P0067R5：Elementary string conversions](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0067r5.html)
- [P0682R1：Repairing elementary string conversions](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0682r1.html)
- [P0482R6：char8_t](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0482r6.html)
- [P0980R1：Making std::string constexpr](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0980r1.pdf)
- [P1206R7：Conversions from ranges](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p1206r7.pdf)
- [P1679R3：string contains](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1679r3.html)
- [P2291R3：constexpr integral charconv](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2291r3.pdf)
- [P2438R2：std::string::substr() &&](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2438r2.html)
- [P2497R0：Testing charconv success or failure](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p2497r0.html)
- [P3044R2：sub-string_view from string](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3044r2.pdf)

### 20.3 Memory 演进

- [P0414R2：shared_ptr array support](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0414r2.html)
- [P0674R1：Extending make_shared to support arrays](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0674r1.html)
- [P0718R2：Atomic smart pointers](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0718r2.html)
- [P1973R1：Renaming default-initialization smart-pointer functions](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/p1973r1.pdf)
- [P1132R8：out_ptr](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p1132r8.html)
- [P2590R2：Explicit lifetime management](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2590r2.pdf)
- [P1901R2：Ownership-based hash/equality](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p1901r2.html)
- [P3037R5：constexpr std::shared_ptr and friends](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p3037r5.pdf)

### 20.4 当前 Working Draft 条款

- [`[string.syn]`](https://eel.is/c++draft/string.syn)
- [`[string.view.synop]`](https://eel.is/c++draft/string.view.synop)
- [`[string.view.template]`](https://eel.is/c++draft/string.view.template)
- [`[basic.string.general]`](https://eel.is/c++draft/basic.string.general)
- [`[string.require]`](https://eel.is/c++draft/string.require)
- [`[string.cons]`](https://eel.is/c++draft/string.cons)
- [`[string.substr]`](https://eel.is/c++draft/string.substr)
- [`[string.find]`](https://eel.is/c++draft/string.find)
- [`[string.view.find]`](https://eel.is/c++draft/string.view.find)
- [`[string.append]`](https://eel.is/c++draft/string.append)
- [`[charconv.syn]`](https://eel.is/c++draft/charconv.syn)
- [`[charconv.from.chars]`](https://eel.is/c++draft/charconv.from.chars)
- [`[charconv.to.chars]`](https://eel.is/c++draft/charconv.to.chars)
- [`[memory.syn]`](https://eel.is/c++draft/memory.syn)
- [`[util.smartptr.shared.general]`](https://eel.is/c++draft/util.smartptr.shared.general)
- [`[util.smartptr.shared.const]`](https://eel.is/c++draft/util.smartptr.shared.const)
- [`[util.smartptr.shared.dest]`](https://eel.is/c++draft/util.smartptr.shared.dest)
- [`[util.smartptr.shared.obs]`](https://eel.is/c++draft/util.smartptr.shared.obs)
- [`[util.smartptr.shared.create]`](https://eel.is/c++draft/util.smartptr.shared.create)
- [`[util.smartptr.weak]`](https://eel.is/c++draft/util.smartptr.weak)
- [`[util.smartptr.weak.const]`](https://eel.is/c++draft/util.smartptr.weak.const)
- [`[util.smartptr.weak.obs]`](https://eel.is/c++draft/util.smartptr.weak.obs)
- [`[using.headers]`](https://eel.is/c++draft/using.headers)

## 21. 研究结论

本批形成两个清晰闭环：`<string>` / `<string_view>` / `<charconv>` 把拥有文本、借用文本与底层数值
转换分开；`<memory>` / `shared_ptr` / `weak_ptr` / `make_shared` 把共同拥有、非拥有观察与安全创建
连成一组。三个 string member 页面进一步覆盖切片、定位和增长三种高频意图。

实现中的最高风险不是少列 overload，而是版本与语义串线：把当前 charconv result、rvalue substr、
range append 或 constexpr shared_ptr 回写到 C++20；把 `substr` 误写成 view；把 `find` 的 npos 当
异常；读取失败后的 to_chars buffer；用 `expired()` 代替一次原子 lock；或把 make_shared 的
allocation recommendation 写成硬保证。本文已把这些风险落成可验证的声明、合同、stdout 与
source manifest，内容实现应逐项执行。
