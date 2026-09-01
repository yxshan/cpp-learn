# C++ Reference 第九批：行输入、文件流与字符串流扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-01
>
> 精确范围：`std::cerr`、`std::getline`、`<fstream>`、`std::ifstream`、
> `std::ofstream`、`<sstream>`、`std::stringstream`
>
> 事实基线：C++98 末期工作草案 N1146、C++03-era N1577、post-C++03 工作草案
> N1905、N3337、N4659、N4861、当前 C++ Working Draft 和 WG21 原始提案。
> zh.cppreference 只作二级结构与覆盖参考。

## 1. 批次目标与版本边界

本批恰好增加七个 Entry，形成“诊断输出 → 整行输入 → 文件持久化 → 内存文本转换”的学习路径。
默认示例为 C++20；以下后续能力只能出现在版本说明中：

- `ios_base::noreplace` 是 C++23；
- file stream 的 `native_handle()` 是 C++26；
- string stream 的 `view()`、`str() &&` 是 C++20；
- string-view-like 构造与 `str(t)` 是 C++26，不得与 C++20 `view()` 混淆；
- `osyncstream` 是 C++20 独立 `<syncstream>` 设施，不是 `cerr` 成员。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|
| `std-cerr` | `object` | `std::cerr` | `<iostream>` | `c++98` | `c++20` | [`[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects) |
| `std-getline` | `function` | `std::getline` | `<string>` | `c++98` | `c++20` | [`[string.io]`](https://eel.is/c++draft/string.io) |
| `header-fstream` | `header` | `<fstream>` | `<fstream>` | `c++98` | `c++20` | [`[fstream.syn]`](https://eel.is/c++draft/fstream.syn) |
| `std-ifstream` | `type` | `std::ifstream` | `<fstream>` | `c++98` | `c++20` | [`[ifstream]`](https://eel.is/c++draft/ifstream) |
| `std-ofstream` | `type` | `std::ofstream` | `<fstream>` | `c++98` | `c++20` | [`[ofstream]`](https://eel.is/c++draft/ofstream) |
| `header-sstream` | `header` | `<sstream>` | `<sstream>` | `c++98` | `c++20` | [`[sstream.syn]`](https://eel.is/c++draft/sstream.syn) |
| `std-stringstream` | `type` | `std::stringstream` | `<sstream>` | `c++98` | `c++20` | [`[stringstream]`](https://eel.is/c++draft/stringstream) |

建议全部归类 `io`。Header Entry 使用缩减质量模板；本批每页仍恰好两个示例，共 14 个。

## 2. 共享 stream 状态模型

| 状态/接口 | 合同 | 学习者判断 |
|---|---|---|
| `goodbit` | 值为零，无错误位 | 只有此时 `good()` 为真 |
| `eofbit` | 已遇到输入末尾 | 单独出现时 `operator bool()` 仍可为真 |
| `failbit` | 格式、打开、关闭或规定条件失败 | `fail()` 为真，stream Boolean 为 false |
| `badbit` | 底层缓冲级错误 | `fail()` 同样为真 |
| `rdstate()` | 当前状态集合 | 状态持续到成功 `open()` 或 `clear()` |
| `exceptions()` | 哪些状态位触发异常 | 初始为 `goodbit`，默认记状态而不抛 |
| `clear()` | 替换状态，默认 `goodbit` | 不清空缓冲、不移动位置、不关闭文件 |

[`basic_ios::init`](https://eel.is/c++draft/basic.ios.cons) 规定初始 exception mask；
[`[iostate.flags]`](https://eel.is/c++draft/iostate.flags) 规定 `setstate`、`clear` 和
`exceptions`。设置 exception mask 会立即对当前 `rdstate()` 调用 `clear(rdstate())`，所以已有
失败位与新 mask 相交时可立刻抛 `ios_base::failure`，不能写成“只影响未来操作”。

[`[iostreams.threadsafety]`](https://eel.is/c++draft/iostreams.threadsafety) 的默认边界是：同一
普通 stream 或 streambuf 的并发访问可能 data race，必须同步。不同 stream 对象可独立操作，
但多个对象写同一外部文件不因此获得记录原子性或可移植顺序。`cerr` 有第 3 节的标准流特例。

I/O 条款通常没有整项大 O 保证。页面应解释字符数、locale/codecvt、分配和文件系统成本，拒绝
“`is_open()` 保证 O(1)”“一次 flush 等于一次系统调用”等实现推断。

## 3. `std::cerr`

### 3.1 身份与合同

```cpp
// <iostream>
namespace std { extern ostream cerr; }
```

- 控制与 C `stderr` 关联的窄字符输出序列；宽字符对应物是 `wcerr`。
- 初始化后 `cerr.flags() & ios_base::unitbuf` 非零，且 `cerr.tie() == &cout`：
  [`[narrow.stream.objects]`](https://eel.is/c++draft/narrow.stream.objects)。
- 标准 iostream 对象在 `main` 前建立关联，程序执行期间不销毁：
  [`[iostream.objects.overview]`](https://eel.is/c++draft/iostream.objects.overview)。
- C++98 公共审阅文本只明确 `unitbuf`；tie-to-`cout` 由 LWG 455 追溯修正，至少 N1905 和
  N3337 已含现行合同。面向用户仍标 C++98，版本注释说明 DR 即可。

`basic_ostream::sentry` 构造时刷新 tied stream；析构时若 `unitbuf`、无传播中异常且 stream
仍 good，则调用 `pubsync()`。见 [`[ostream.sentry]`](https://eel.is/c++draft/ostream.sentry)。
所以 `cerr` 在输出操作边界自动同步并在输出前刷新 `cout`，但不保证“每字符系统调用”、持久落盘
或一整条链式日志的原子性。默认 `cerr` 上 `endl` 往往形成重复 flush。

写入/同步失败可设置 `badbit`；默认不抛，mask 包含 `badbit` 时可能抛。sentry 析构同步失败会
设置 `badbit` 而不从析构路径传播。

### 3.2 并发、误区与 JS 对照

对 synchronized standard iostream 的并发 formatted/unformatted I/O 不 data race，但字符仍可
交错。`sync_with_stdio(false)` 允许标准流脱离 C stream；在已经 I/O 后调用的效果实现定义。
来源：[`[iostream.objects.overview]`](https://eel.is/c++draft/iostream.objects.overview)、
[`[ios.members.static]`](https://eel.is/c++draft/ios.members.static)。记录级输出需外部同步、先组装
后单次写入，或评估 C++20 `osyncstream`。

常见误区：称其“完全无缓冲”；认为 `cerr`/`clog` 指向不同设备；认为并发链式输出不交错；每行
滥用 `endl`；修改 flags/tie/rdbuf 后仍假设初始合同。JS `console.error()` 只能类比诊断通道，
其宿主行为没有 C++ unitbuf、tie、状态位和 exception mask 合同。

### 3.3 两个示例

1. `inspect-diagnostic-stream.cpp`：查询标准初始化属性，只打印 stdout。

   ```text
   unitbuf=true
   tied_to_cout=true
   ```

2. `capture-one-diagnostic.cpp`：用 RAII guard 在单线程范围临时把 `cerr.rdbuf()` 指向
   `ostringstream`，写入后恢复，再打印捕获值。

   ```text
   captured=error=7
   ```

第二例只教可测试的 streambuf 替换，不推广为并发全局重定向。

## 4. `std::getline`

### 4.1 C++20 代表声明

```cpp
// <string>
template<class CharT, class Traits, class Allocator>
basic_istream<CharT, Traits>& getline(
    basic_istream<CharT, Traits>& input,
    basic_string<CharT, Traits, Allocator>& text,
    CharT delimiter);

template<class CharT, class Traits, class Allocator>
basic_istream<CharT, Traits>& getline(
    basic_istream<CharT, Traits>& input,
    basic_string<CharT, Traits, Allocator>& text);
// 另有 basic_istream&& overload；返回类型仍为 basic_istream&。
```

直接头文件是 `<string>`；使用 `cin`/`istringstream` 仍分别直接包含 `<iostream>`/`<sstream>`。
无 delimiter overload 使用 `input.widen('\n')`。返回 input 引用，所以经典写法是
`while (std::getline(input, line))`，而不是把返回值当 string 或字符数。

### 4.2 参数、状态、复杂度与生命周期

sentry 成功后先 `text.erase()`，再逐字符提取，按顺序遇到 EOF、delimiter 或
`text.max_size()` 停止；delimiter 被消费但不追加；max_size 路径设置 `failbit`；没有提取任何
字符也设置 `failbit`。只消费 delimiter 的空行仍提取了字符，因此读取成功。EOF 在已读到字符后
只需设置 `eofbit`，最后一个无换行行仍可被 while 循环处理。规范：
[`[string.io]`](https://eel.is/c++draft/string.io)、
[`[istream.unformatted]`](https://eel.is/c++draft/istream.unformatted)。

若调用前 stream 已失败，sentry 可阻止 `erase()`，不能保证目标 string 总被清空。非成员 string
版 `getline` 明确不改变 `gcount()`；这不同于 member `istream::getline(char*, n)`。没有专门
大 O 条款；工作随检查/追加字符及 string 分配增长。下一次成功读取会修改目标 string，按 string
规则处理此前元素指针/引用失效。同一 stream 或 string 并发使用要同步。

格式化提取 `input >> number` 通常把换行留在输入序列；紧接 `getline` 会消费该 delimiter 并
得到空 string。若意图丢弃本行剩余内容，使用
`ignore(numeric_limits<streamsize>::max(), '\n')`；单次 `ignore()` 可能不足，`std::ws` 又会吞掉
有意义的空行，不能一概替换。

常见误区：认为 delimiter 被保存；读后用 `gcount()` 当行长；返回 string；无条件承诺目标先清空；
用 `while (!eof())`。Node `readline`/字符串 split 只能类比记录边界；`getline` 是同步拉取、消费
stream、持久更新状态并写入现有 string，不返回 Promise。

### 4.3 两个示例

1. `read-complete-lines.cpp`：读取 `"alpha\nbeta\n"`。

   ```text
   1:alpha
   2:beta
   ```

2. `after-formatted-extraction.cpp`：读整数后用上限形式 ignore，再 getline；展示 getline 不更新
   前一次 ignore 设置的 gcount。

   ```text
   age=42 ignored=1
   name=Ada Lovelace gcount=1
   ```

## 5. `<fstream>`

### 5.1 Facility map 与 open mode

| 目的 | 设施 | 首版/演进 | 选择边界 |
|---|---|---|---|
| 文件缓冲 | `basic_filebuf`、char/wchar aliases | C++98 | 普通代码多用上层 stream |
| 只读 | `basic_ifstream`、`ifstream`/`wifstream` | C++98 | 总加入 `ios::in` |
| 只写 | `basic_ofstream`、`ofstream`/`wofstream` | C++98 | 总加入 `ios::out` |
| 双向 | `basic_fstream`、`fstream`/`wfstream` | C++98 | 共享一个文件位置 |
| move/swap、string path | 上述类型 | C++11 | 不可复制，可移动 |
| `filesystem::path` | open/construct overload | C++17 | 不改变状态模型 |
| `noreplace` | open mode | C++23 | 排他创建 |
| `native_handle()` | 四类 file stream/buffer | C++26 | 非拥有，close/析构后失效 |

源码直接包含 `<fstream>`；`string`、`cout`、`remove` 分别直接包含 `<string>`、`<iostream>`、
`<cstdio>`，不依赖传递包含。

| mode | 精确效果 | 高影响边界 |
|---|---|---|
| `in` | 输入 | 不自动读取整份文件 |
| `out` | 输出 | 单独使用对应创建/截断 |
| `app` | 每次写前定位末尾 | 不同于只定位一次 |
| `ate` | 打开成功后立即定位末尾 | 后续可 seek，不是 append 保护 |
| `trunc` | 打开时截断已有文件 | 需要输出模式 |
| `binary` | 二进制而非文本模式 | 不序列化对象、不规定 endian/ABI |
| `noreplace` | 排他打开 | C++23 起 |

[`[filebuf.members]`](https://eel.is/c++draft/filebuf.members) 给出有效组合与 `fopen` 对应；表外组合
打开失败。`out` 对应 `"w"`，所以默认 ofstream 截断；`app` 对应追加；`ate` 在去掉该 bit 后先
按其余 mode 打开，随后只 seek 一次。binary 不选择读写，也不覆盖默认截断。

filebuf 析构调用 `close()` 并吞掉析构期间异常；close 会先 flush put area、写 codecvt 终止序列，
再关闭文件，即使前面失败也结束关联。RAII 保证尝试关闭，不保证最终错误已被调用者观察；重要数据
显式 close 并检查。`is_open()` 问关联，stream Boolean 问逻辑状态，两者不等价。

常见误区：只查 `bad()`；默认 ofstream 保留内容；`ate == app`；binary 等于序列化；flush 等于
耐久落盘；多个 stream 写同一文件自动原子。Node `fs` flags 可类比 mode，但 fstream 是同步、
RAII、有 locale/状态位的 iostream，不是 Promise、Buffer 或 backpressure API。

### 5.2 两个示例

所有文件示例只用 verifier 临时 cwd 中相对路径，开头清理旧文件，RAII cleanup，逐次检查 open/
close，提前返回也清理。

1. `read-write-round-trip.cpp`：`fstream(path, in | out | trunc)` 写入、flush、seekg(0)、读回。

   ```text
   status=ready
   ```

2. `binary-byte-round-trip.cpp`：binary ofstream 写固定三字节，再 binary ifstream 读回；不写原生
   对象布局。

   ```text
   bytes=0,127,255
   ```

## 6. `std::ifstream`

### 6.1 代表接口与合同

```cpp
// <fstream>
template<class CharT, class Traits = char_traits<CharT>>
class basic_ifstream : public basic_istream<CharT, Traits> {
public:
  basic_ifstream();
  explicit basic_ifstream(const char*, openmode = ios_base::in);
  explicit basic_ifstream(const string&, openmode = ios_base::in); // C++11
  template<class T> explicit basic_ifstream(const T&, openmode = ios_base::in);
  bool is_open() const;
  void open(/* char*, string, filesystem::path */, openmode = ios_base::in);
  void close();
};
using ifstream = basic_ifstream<char>;
```

`const char*`/类型从 C++98；move 与 string filename 为 C++11；filesystem path 为 C++17。构造/
open 总把 `in` OR 进 mode。路径构造失败设置 `failbit`；成员 open 成功调用 `clear()`，失败设置
`failbit`；mask 相交可抛 `ios_base::failure`。`is_open()` 直接报告内部 filebuf 关联。

close 失败设置 `failbit`；filebuf close 后 `is_open() == false`。读到 EOF 后文件通常仍 open，
但 stream 可为 false，所以不能 `while (is_open())`。实际提取应作循环条件。读 EOF 后若要 seek
重读，先 `clear()` 再 `seekg()`。

没有统一复杂度保证。ifstream 拥有 filebuf，析构尝试关闭；move 转移文件关联且移后源不再指向
原文件。同一 ifstream 并发提取/定位/状态访问要同步；多个 ifstream 虽位置独立，但外部文件同时
变化不构成快照保证。

常见误区：`while (!eof())`；只查 `bad()`；用 `is_open()` 判断每次读取；EOF 后 seek 不 clear；
认为 binary 自动解决对象布局。Node `readFileSync` 一次返回 Buffer/string；ifstream 保持位置、
格式状态和错误位，默认不抛异常。

### 6.2 两个示例

1. `read-records.cpp`：先建立两行相对文件，再用 formatted extraction 读取。

   ```text
   1:Ada
   2:Linus
   ```

2. `detect-open-failure.cpp`：先删除确定不存在的路径，再构造 ifstream。

   ```text
   open=false
   fail=true
   ```

## 7. `std::ofstream`

### 7.1 代表接口与合同

```cpp
// <fstream>
template<class CharT, class Traits = char_traits<CharT>>
class basic_ofstream : public basic_ostream<CharT, Traits> {
public:
  basic_ofstream();
  explicit basic_ofstream(const char*, openmode = ios_base::out);
  explicit basic_ofstream(const string&, openmode = ios_base::out); // C++11
  template<class T> explicit basic_ofstream(const T&, openmode = ios_base::out);
  bool is_open() const;
  void open(/* char*, string, filesystem::path */, openmode = ios_base::out);
  void close();
};
using ofstream = basic_ofstream<char>;
```

版本演进同 ifstream；构造/open 总加入 `out`。默认 `out` 映射 `"w"`，会创建或截断。保留并追加
使用 `app`；`ate` 只初始定位，且 `out | ate` 仍会先按 out 截断。

打开失败设置 `failbit`；成员 open 成功清状态。`flush()` 请求同步到底层 buffer，不保证磁盘断电
持久性。close 失败设置 `failbit`；filebuf 析构虽会 close，却捕获且不重抛，所以重要输出应在对象
仍可检查时显式 `close(); if (!output) ...`，或设置 mask 并捕获异常。

没有统一复杂度保证；成本随字符、locale、buffer 和文件系统。move 转移关联。同一 ofstream 并发
写/flush/close 需同步；两个 app stream 也不保证多次 `<<` 组成原子记录。

常见误区：忘记默认截断；把 ate 当 app；只检查打开不检查写/close；把 flush 当事务；binary
直接写对象并称可移植格式。Node `writeFileSync`/append flag 可类比覆盖/追加；C++ 仍有 locale、
状态位和 RAII close 边界。

### 7.2 两个示例

1. `write-then-read.cpp`：默认 ofstream 写两项，显式 close/check，再 ifstream 读回。

   ```text
   file=ready count=2
   ```

2. `append-with-openmode.cpp`：先默认写 `first`，再 `app` 写 `second`，读回计数。

   ```text
   lines=2
   first|second
   ```

## 8. `<sstream>`

### 8.1 Facility map 与边界

| 目的 | 设施 | 首版/关键演进 | 选择边界 |
|---|---|---|---|
| owning 字符缓冲 | `basic_stringbuf` 与 aliases | C++98 | 通常由上层 stream 拥有 |
| 只解析 | `basic_istringstream`/aliases | C++98 | 比双向类型更清楚 |
| 只格式化 | `basic_ostringstream`/aliases | C++98 | 比双向类型更清楚 |
| 同时读写 | `basic_stringstream`/aliases | C++98 | 独立 get/put 位置，共享字符序列 |
| allocator 参数、move/swap | 上述类 | C++11 | 不可复制，可移动 |
| allocator-aware、`str() &&`、`view()` | 上述类 | C++20 | view 非拥有，右值 str 取缓冲 |
| string-view-like 构造/`str(t)` | 上述类 | C++26 | P2495R3，不是 C++20 |

直接包含 `<sstream>`；`string`、`cout`、`string_view` 仍包含各自头。只解析选 istringstream，只生成
文本选 ostringstream，确需双向才选 stringstream。formatted 转换受 locale/flags 和 failbit
控制，不是无分配 parser；性能敏感数值转换可比较 charconv。

`str() const&` 返回 owning string；C++20 `view()` 返回内部非拥有 view；buffer 修改、str 替换、
右值取走、move 或析构可使 view 失效。无类级统一复杂度保证。

常见误区：单向任务总用 stringstream；`str("")` 被误认为也清状态；长期保存 view；把 stream
转换当 JS `Number`/`String`。JS 模板字符串可类比内存格式化，但无双 cursor、locale、failbit 和
view 生命周期。

### 8.2 两个示例

1. `parse-fields.cpp`：`istringstream("Ada 98")`。

   ```text
   name=Ada score=98
   ```

2. `build-message.cpp`：ostringstream 组装文本，再由 `str()` 取得 owning string。

   ```text
   request=GET /docs?page=2
   ```

## 9. `std::stringstream`

### 9.1 C++20 接口、位置和所有权

```cpp
// <sstream>
template<class CharT, class Traits = char_traits<CharT>,
         class Allocator = allocator<CharT>>
class basic_stringstream : public basic_iostream<CharT, Traits> {
public:
  basic_stringstream();
  explicit basic_stringstream(openmode);
  explicit basic_stringstream(const basic_string<CharT, Traits, Allocator>&,
                              openmode = ios_base::in | ios_base::out);
  basic_string<CharT, Traits, Allocator> str() const &;
  basic_string<CharT, Traits, Allocator> str() &&;       // C++20
  basic_string_view<CharT, Traits> view() const noexcept; // C++20
  void str(const basic_string<CharT, Traits, Allocator>&);
};
using stringstream = basic_stringstream<char>;
```

类型从 C++98；第三个 Allocator 参数、move/swap 从 C++11。默认 mode 为 `in | out`。对象拥有
stringbuf 和字符序列，不长期引用构造参数。

| 操作 | 结果 | 生命周期 |
|---|---|---|
| lvalue `str()` | 新 owning string 副本 | 不随 stream 失效 |
| `std::move(s).str()` | 从内部序列 move，内部序列置空 | 返回 string 拥有结果 |
| `view()` | 内部序列的 string_view | 序列失效后使用为 UB（空 view 例外） |
| `str(new_text)` | 替换序列并重设 get/put 指针 | 旧字符/view 失效，不清 error state |

来源：N4861/P0408R7 与当前
[`[stringbuf.members]`](https://eel.is/c++draft/stringbuf.members)。lvalue str 会物化 owning string；
view 不物化；右值 str 允许转移，但不要虚构绝对分配/O(1) 保证。

input/output sequence 有独立位置。现有 string + `out` 且无 `ate` 时 put 从开头开始，写入会覆盖；
`ate` 才把初始 put 放末尾；get 在 `in` 下从开头开始。

复用时三件事不同：`clear()` 只清 rdstate；`str(new)` 换 buffer 并按原 mode 重设位置但不清状态；
`seekg/seekp` 保留内容并移动对应位置。解析失败后用新文本通常同时执行 `clear(); str("42");`。

formatted 操作沿用 stream 状态/mask；无统一复杂度。同一 stringstream 任何读写、状态、str/view 与
修改并发都要同步。常见误区：认为构造参数被引用；put 总在末尾；只 str 不 clear；只 clear 就
认为内容/位置重置；保存 view 后写入；在 C++20 展示 C++26 string-view-like overload。

TS 可用 string + read index/builder 模拟结果，但没有 C++ 双 cursor、openmode、locale、failbit 和
非拥有 view 生命周期；JS string 不可变不能推出 stringstream view 安全。

### 9.2 两个示例

1. `independent-read-write-positions.cpp`：以 `"abc"` 构造默认双向 stream，写 `X` 后读取首字符。

   ```text
   buffer=Xbc
   first=X
   ```

2. `reset-after-failure.cpp`：解析失败后 `clear()` + `str("42")` 再解析。

   ```text
   first_failed=true
   value=42
   ```

## 10. 版本与来源矩阵

| 事实组 | 一级来源 |
|---|---|
| C++98 首版身份 | [N1146](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/1998/n1146.pdf)；可浏览的 1997 [`[lib-iostreams]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-iostreams.html) 与 [`[lib-strings]`](https://www.open-std.org/jtc1/sc22/open/n2356/lib-strings.html) |
| C++03-era / tie DR 后边界 | [N1577](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2004/n1577.pdf)、post-C++03 [N1905](https://www.open-std.org/JTC1/SC22/WG21/docs/papers/2005/n1905.pdf)；N1905 已含 `cerr.tie() == &cout` |
| C++11 stream move/string path/rvalue getline | [N3337](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3337.pdf)、[N1857](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2005/n1857.html) |
| C++17 filesystem path | [N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)、[P0610R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0610r0.html) |
| C++20 stringbuf 高效访问 | [N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf)、[P0408R7](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0408r7.pdf) |
| C++23 noreplace | [P2467R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/p2467r1.html) |
| C++26 string-view-like stringstreams | [P2495R3](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p2495r3.pdf) |
| C++26 file native handle | [P1759R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2023/p1759r6.html) |
| 当前 stream 对象/线程/state | [`[iostream.objects]`](https://eel.is/c++draft/iostream.objects)、[`[iostreams.threadsafety]`](https://eel.is/c++draft/iostreams.threadsafety)、[`[iostate.flags]`](https://eel.is/c++draft/iostate.flags) |
| getline gcount 历史澄清 | [LWG 91 / N1350](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2002/n1350.html) |

二级页面仅核对搜索别名与栏目：
[cerr](https://zh.cppreference.com/w/cpp/io/cerr)、
[getline](https://zh.cppreference.com/w/cpp/string/basic_string/getline)、
[`<fstream>`](https://zh.cppreference.com/w/cpp/header/fstream)、
[ifstream](https://zh.cppreference.com/w/cpp/io/basic_ifstream)、
[ofstream](https://zh.cppreference.com/w/cpp/io/basic_ofstream)、
[`<sstream>`](https://zh.cppreference.com/w/cpp/header/sstream)、
[stringstream](https://zh.cppreference.com/w/cpp/io/basic_stringstream)。正文和示例必须原创。

## 11. 实施与终审清单

- 只新增七个建议 ID；每页两个 deterministic C++20 run 示例，共 14 个。
- 文件示例只用相对路径、RAII cleanup、逐次 open/close 检查，适配 verifier 临时 cwd。
- cerr 示例不依赖 stdout/stderr 合并顺序；重定向示例先恢复 rdbuf 再打印。
- expected stdout 全 ASCII，不依赖 locale、路径、时钟、平台换行或随机数。
- 每页覆盖适用的 header/since、声明或 facility map、参数/返回、状态与 mask、复杂度精度、
  buffer/file 生命周期、flush/close、并发、误区、JS/TS 对照、版本和一级来源。
- 终审拒绝：cerr “完全无缓冲/日志原子”；getline “返回 string/更新 gcount/保留 delimiter”；
  `while (!eof())`/`while (is_open())`；is_open 等于 Boolean；默认 ofstream 保留；ate 等于 app；
  binary 等于序列化；flush 等于耐久提交；RAII 保证错误可见；clear 清 buffer；str 清 failbit；
  C++20 中出现 noreplace/native_handle/string-view-like 构造；无规范依据的 O(1) 或 syscall 次数。
