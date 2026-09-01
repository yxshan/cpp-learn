# C++ Reference 第十批：路径与文件系统基础扩展研究

> 状态：研究完成，供内容实现与审查使用
>
> 研究日期：2026-09-01
>
> 精确范围：`<filesystem>`、`std::filesystem::path`、
> `std::filesystem::directory_entry`、`std::filesystem::directory_iterator`、
> `std::filesystem::exists`、`std::filesystem::create_directories`、
> `std::filesystem::remove`
>
> 事实基线：C++17 最终工作草案 N4659、C++20 工作草案 N4861、当前 C++
> Working Draft、Filesystem TS 与 WG21 原始提案/LWG 缺陷报告。cppreference 与
> zh.cppreference 只作二级结构和覆盖参考，正文与示例不得复制。

## 1. 批次目标与版本边界

本批恰好增加七个 Entry，形成“表示路径 → 观察目录项 → 遍历目录 → 查询存在性 →
创建目录 → 删除单个对象”的最小文件系统闭环。所有可运行示例以 C++20 编译；页面的
主体合同也使用 C++20 代表签名，同时明确 C++17 初版与当前工作草案的差异。

- `<filesystem>` 及本批全部设施从 C++17 起可用，且只要求 hosted implementation 提供。
- 可用性宏是 `__cpp_lib_filesystem`，C++17 初始值为 `201703L`；示例仍直接包含
  `<filesystem>`，不靠宏代替 include。
- C++20 为 `path` 纳入 `char8_t`：`u8string()`/`generic_u8string()` 返回
  `std::u8string`，不要沿用 C++17 的 `std::string` 结论。
- C++20 `path` 与 `directory_entry` 使用三路比较；示例不依赖操作系统相关的根名排序。
- `directory_iterator` 在 C++20 对 ranges opt-in 为 view 和 borrowed range；LWG 3480 的
  `end` 修正及 LWG 3719 的 `default_sentinel_t` 比较是 C++23 边界，不应写入 C++20 示例。
- C++26 增加 `std::formatter<std::filesystem::path, CharT>`；C++20 页面不能演示它。
- 当前工作草案在 C++26 之后继续演进路径展示/系统编码接口，含 `display_string()`、
  `native_encoded_string()` 等；这些不是 C++20/C++23/C++26 可直接假设的接口，应放在
  “未来版本”提示中并链接原始提案。

### 1.1 Manifest 身份矩阵

| 建议 ID | kind | symbol | direct header | `since` | 示例标准 | 当前规范锚点 |
|---|---|---|---|---|---|---|
| `header-filesystem` | `header` | `<filesystem>` | `<filesystem>` | `c++17` | `c++20` | [`[fs.filesystem.syn]`](https://eel.is/c++draft/fs.filesystem.syn) |
| `std-filesystem-path` | `type` | `std::filesystem::path` | `<filesystem>` | `c++17` | `c++20` | [`[fs.class.path]`](https://eel.is/c++draft/fs.class.path) |
| `std-filesystem-directory-entry` | `type` | `std::filesystem::directory_entry` | `<filesystem>` | `c++17` | `c++20` | [`[fs.class.directory.entry]`](https://eel.is/c++draft/fs.class.directory.entry) |
| `std-filesystem-directory-iterator` | `type` | `std::filesystem::directory_iterator` | `<filesystem>` | `c++17` | `c++20` | [`[fs.class.directory.iterator]`](https://eel.is/c++draft/fs.class.directory.iterator) |
| `std-filesystem-exists` | `function` | `std::filesystem::exists` | `<filesystem>` | `c++17` | `c++20` | [`[fs.op.exists]`](https://eel.is/c++draft/fs.op.exists) |
| `std-filesystem-create-directories` | `function` | `std::filesystem::create_directories` | `<filesystem>` | `c++17` | `c++20` | [`[fs.op.create.directories]`](https://eel.is/c++draft/fs.op.create.directories) |
| `std-filesystem-remove` | `function` | `std::filesystem::remove` | `<filesystem>` | `c++17` | `c++20` | [`[fs.op.remove]`](https://eel.is/c++draft/fs.op.remove) |

建议全部归类 `filesystem`。Header Entry 使用缩减质量模板；本批每页仍恰好两个示例，
共 14 个。

## 2. 共享文件系统合同

### 2.1 路径对象不等于磁盘对象

`path` 只表示 pathname 的词法和语法；路径不必存在，也不必对当前操作系统或某个文件系统
有效。`/` 负责按路径语义追加元素，`+=` 只是拼接 native representation，二者不能互换。
`lexically_normal()`、`lexically_relative()` 只处理词法元素，不查询磁盘、不解析符号链接。
来源：[`[fs.class.path]`](https://eel.is/c++draft/fs.class.path)、
[`[fs.path.append]`](https://eel.is/c++draft/fs.path.append)、
[`[fs.path.gen]`](https://eel.is/c++draft/fs.path.gen)。

native format、separator、root-name、绝对路径判定和字符编码均可随操作系统而不同。页面及测试
只对相对 ASCII 路径调用 `generic_string()`，以 `/` 获得平台无关展示；不得把 Windows drive、
POSIX 权限、inode、大小写规则或 Unicode normalization 当作跨平台合同。

### 2.2 抛异常与 `error_code` 两条通道

[`[fs.err.report]`](https://eel.is/c++draft/fs.err.report) 规定共同模型：

| 调用形式 | OS/底层文件系统错误 | 无错误时 | 分配失败 |
|---|---|---|---|
| 无 `error_code&` | 抛 `filesystem_error`，并携带适用的路径 | 正常返回 | 仍可抛分配异常 |
| 带 `error_code& ec` | 把相应错误写入 `ec` | 除非单项另有规定，调用 `ec.clear()` | 即使是 `ec` 形式，也不能一概承诺不抛 |

函数签名上的 `noexcept` 才能排除其他异常。尤其：

- `exists(path, ec)` 和 `remove(path, ec)` 是 `noexcept`；
- `directory_entry::refresh(ec)` 是 `noexcept`；
- C++20 代表签名中的 `create_directories(path, ec)` **不是** `noexcept`，因为中间路径和
  实现缓冲可能分配；这是 LWG 3014 修正的重点；
- C++20 的 `directory_iterator(path, ec)` 与 `increment(ec)` 也不是 `noexcept`，对应
  LWG 3013 的分配边界。

因此 `error_code` 形式的教学定义应是“把预期的 OS 错误转为值通道”，不是“绝不抛异常”。
示例选它是为了避免平台相关异常消息进入 stdout，并在每一步显式检查 `ec`。

### 2.3 文件系统竞态、线程与可移植性

[`[fs.race.behavior]`](https://eel.is/c++draft/fs.race.behavior) 把多个线程、进程或计算机对同一
文件系统对象交错访问/修改定义为 file system race；由本子库调用引入这种竞态时行为未定义。
所以 `if (!exists(p)) create_directories(p)` 不是原子协议，也不能用查询结果做安全检查后再操作。
优先调用本身具备幂等/失败合同的操作，再解释返回值或 `error_code`。

标准库对象还受普通 data-race 规则约束：独立 `path` 值可独立使用；对同一个对象并发修改或
一读一写需要同步。即使 C++ 对象不同，若它们操作同一外部路径，仍可能形成文件系统竞态。

所有示例必须：

- 在 verifier 为单个示例创建的隔离临时 cwd 中运行；
- 只使用固定 ASCII 相对路径，不查询或修改进程 current path；
- 开头用 `remove_all(relative_root, ec)` 建立已知状态，并检查 `ec`；
- 用局部 RAII cleanup 在所有退出路径删除该 root；析构清理用 `error_code` 且不输出；
- 对 create/open/write/close/status/iterate/remove 的每个有意义步骤检查结果；
- 不创建符号链接，不改变权限，不依赖时钟、目录原生顺序或异常消息；
- stdout 只输出已规范化的布尔值、ASCII 文件名和固定数字。

## 3. `<filesystem>`

### 3.1 Facility map 与选择边界

```cpp
// <filesystem>, C++20 代表性轮廓
namespace std::filesystem {
class path;
class filesystem_error;
class directory_entry;
class directory_iterator;
class recursive_directory_iterator;
class file_status;

enum class file_type;
enum class perms;
enum class perm_options;
enum class copy_options;
enum class directory_options;

bool exists(file_status) noexcept;
bool exists(const path&);
bool exists(const path&, std::error_code&) noexcept;

bool create_directories(const path&);
bool create_directories(const path&, std::error_code&);

bool remove(const path&);
bool remove(const path&, std::error_code&) noexcept;
}
```

Header 页应按任务而非按字母列设施：path 表示与转换、状态/类型查询、目录迭代、创建/复制/
重命名/删除、容量与时间。`fstream(path)` 仍由 `<fstream>` 声明；输出需 `<iostream>`，
`std::error_code` 的直接使用需 `<system_error>`，排序需 `<algorithm>`，不要依赖 `<filesystem>`
的传递包含。

该头没有统一复杂度保证。每个操作的文件系统访问、路径转换、分配与系统调用数可能不同；只有
具体条款写出的界限才能转述，例如 `create_directories` 的 O(path elements)。

常见误区：把 filesystem 当异步 I/O；认为所有功能在 freestanding 环境存在；把 path 当已打开
handle；先 exists 再 create/remove 并声称原子；忽略 `error_code` 旧值需要被成功调用清除；
依赖实现传递包含。

Node `node:fs`/`node:path` 是最接近的 JS 对照，但边界不同：C++ `<filesystem>` 的操作是同步调用、
路径是强类型值、错误可走异常或 `error_code`；Node 常用 callback/Promise 或抛异常，`path`
模块本身只处理字符串。

### 3.2 两个示例

1. `compose-portable-path.cpp`：纯词法组合 `assets/icons/logo.svg`，用 `generic_string()` 输出；
   不访问文件系统，因此不需要 cleanup。

   ```text
   path=assets/icons/logo.svg
   ```

2. `directory-lifecycle.cpp`：先清理 `batch10-header-demo`，RAII cleanup；用 `error_code`
   创建 `cache/items`，检查为目录，再删除空的 `items`。

   ```text
   created=true
   is_directory=true
   removed_leaf=true
   ```

第二例优先 `error_code`，避免 `filesystem_error::what()` 的实现/平台文字污染固定输出。

## 4. `std::filesystem::path`

### 4.1 C++20 代表接口

```cpp
// <filesystem>
namespace std::filesystem {
class path {
public:
  using value_type = /* operating-system-dependent encoded character type */;
  using string_type = std::basic_string<value_type>;
  static constexpr value_type preferred_separator = /* OS-dependent */;

  enum format { native_format, generic_format, auto_format };

  path() noexcept;
  path(const path&);
  path(path&&) noexcept;
  path(string_type&& source, format fmt = auto_format);
  template<class Source>
  path(const Source& source, format fmt = auto_format);

  path& operator/=(const path&);
  path& operator+=(const path&);
  path& replace_filename(const path&);
  path& replace_extension(const path& replacement = path());

  const string_type& native() const noexcept;
  std::string string() const;
  std::string generic_string() const;
  std::u8string u8string() const;          // C++20 return type

  path parent_path() const;
  path filename() const;
  path stem() const;
  path extension() const;
  bool is_absolute() const;
  bool is_relative() const;
  path lexically_normal() const;
  path lexically_relative(const path& base) const;

  class iterator;
  iterator begin() const;
  iterator end() const;
};
}
```

上面是学习用代表集，不是完整 synopsis。构造/赋值的 Source 只能是规定的 encoded character
序列；空指针不满足要求。`value_type` 与 native encoding 由操作系统决定，转换到无法表示的字符
时结果可能未指定，不能宣称 `string()` 永远是 UTF-8。

### 4.2 语义、复杂度与生命周期

- `p / child` 按路径元素合并；若右侧是绝对路径或不兼容 root-name，可能替换左侧。
- `p += suffix` 直接拼 native representation，不自动插入 separator，且不天然跨平台。
- `lexically_normal()` 只消除可按语法处理的重复分隔符、`.`、`..`，不访问磁盘、不解析 symlink；
  不能用它代替 `canonical()` 做安全边界判断。
- `filename()`、`stem()`、`extension()` 返回新的 owning `path` 值；`native()` 返回对象内部
  `string_type` 的 const 引用，`c_str()` 指针也依赖对象当前内容。
- 任意非 const member 会使该 path 的所有 element iterator 失效。move 后源仍有效但状态未指定。
- 当前标准只给个别操作明确复杂度；例如 `swap` constant time。构造、分解、组合、字符串转换和
  `lexically_normal` 没有可统一转述的大 O，不得自行承诺 O(1) 或零分配。

path 本身不产生文件系统副作用。不同 path 值之间不存在“磁盘缓存一致性”；把它传给操作函数时
才发生 pathname resolution。相同文本也可能因 current path、挂载、大小写与外部修改指向不同对象。

常见误区：`/` 等于字符串 `/` 拼接；`+=` 自动补 separator；path 构造会检查存在性；
`lexically_normal` 解析 symlink；`string()` 恒为 UTF-8；保存 `native()` 引用后修改 path；
在跨平台测试中打印 native separator/root-name。

Node `path.join`/`normalize` 可类比词法处理，但 JS 返回 string；C++ path 同时持有操作系统相关
native representation，并有 iterator/内部引用失效规则。两边的 normalize 都不等同于访问磁盘的
realpath/canonical。

### 4.3 两个示例

1. `decompose-relative-path.cpp`：只处理固定相对 ASCII 路径。

   ```text
   parent=docs/reference
   filename=vector.md
   stem=vector
   extension=.md
   ```

2. `normalize-joined-path.cpp`：组合 `cache/items/../result.txt` 后词法正规化；不访问磁盘。

   ```text
   raw=cache/items/../result.txt
   normalized=cache/result.txt
   ```

两个示例都只调用 `generic_string()`；无文件系统副作用，故无需清理。

## 5. `std::filesystem::directory_entry`

### 5.1 C++20 代表接口与缓存模型

```cpp
// <filesystem>
namespace std::filesystem {
class directory_entry {
public:
  directory_entry() noexcept = default;
  explicit directory_entry(const filesystem::path& p);
  directory_entry(const filesystem::path& p, std::error_code& ec);

  void assign(const filesystem::path& p);
  void assign(const filesystem::path& p, std::error_code& ec);
  void replace_filename(const filesystem::path& p);
  void replace_filename(const filesystem::path& p, std::error_code& ec);
  void refresh();
  void refresh(std::error_code& ec) noexcept;

  const filesystem::path& path() const noexcept;
  bool exists() const;
  bool exists(std::error_code& ec) const noexcept;
  bool is_regular_file() const;
  bool is_regular_file(std::error_code& ec) const noexcept;
  std::uintmax_t file_size() const;
  std::uintmax_t file_size(std::error_code& ec) const noexcept;
  file_status status() const;
  file_status status(std::error_code& ec) const noexcept;
  file_status symlink_status() const;
  file_status symlink_status(std::error_code& ec) const noexcept;
};
}
```

对象拥有一个 path，并**可能**保存 status、symlink status、size、hard-link count、last-write-time
等属性缓存。实现应在目录遍历已经取得属性且缓存能减少访问时保存它们，但是否缓存以及缓存哪些属性
不对用户暴露。observer 在有缓存时返回缓存，否则调用对应 namespace operation。

构造 `directory_entry(p, ec)` 会调用 `refresh(ec)`；成功时 `path()==p`，错误时 path 为空。
`assign`/`replace_filename` 先换 path 再 refresh；发生错误时缓存值未指定。`refresh` 更新当前文件
属性；外部文件变化不会自动刷新，iterator 也被禁止间接调用 entry 的 refresh。

### 5.2 错误、复杂度、生命周期与并发

- 无 `ec` observer 遵循 filesystem_error 通道；`ec` observer 通过对应 status/operation 返回。
- `path()` 返回内部 path const 引用；entry 被修改、move 或销毁后，不得继续使用该引用。
- `directory_entry` 的相等/排序只比较存储的 path，不比较文件身份或缓存属性；等价文件应使用
  `filesystem::equivalent`，但仍需考虑竞态。
- 标准没有给出 entry 构造、refresh 或 observer 的统一复杂度/系统调用数。缓存可能省访问，但
  不能写成保证 O(1) 或保证不访问磁盘。
- 对同一个 entry 并发 refresh/assign 与读取需要同步；即使只读缓存，外部文件变化也不会形成快照。

常见误区：entry 是打开的文件 handle；observer 永远实时；所有实现缓存相同属性；refresh 修改
磁盘；`path()` 返回副本；比较 entry 判断两个路径是否指向同一文件；忽略构造错误后 path 为空。

Node `fs.Dirent` 是合适类比：它把目录枚举得到的名称/类型信息包装起来，但 C++ `directory_entry`
还能按需查询更多属性并显式 `refresh()`；两者都不是稳定文件 handle，也不能阻止 TOCTOU。

### 5.3 两个示例

1. `inspect-regular-entry.cpp`：在 `batch10-entry-demo` 中写入三字节 `note.txt`，显式 close/check，
   再用 `directory_entry(path, ec)` 查询 filename、regular 与 size。

   ```text
   name=note.txt
   regular=true
   bytes=3
   ```

2. `refresh-after-change.cpp`：先写一字节，读取 size；追加一字节并 close/check；显式
   `entry.refresh(ec)` 后再次读取。

   ```text
   before=1
   after=2
   ```

两例都使用 RAII root cleanup。第二例必须 refresh，不能假设实现是否缓存；两例优先 `error_code`
observer，使错误路径稳定且不打印实现相关异常。

## 6. `std::filesystem::directory_iterator`

### 6.1 C++20 代表接口

```cpp
// <filesystem>
namespace std::filesystem {
class directory_iterator {
public:
  using iterator_category = std::input_iterator_tag;
  using value_type = directory_entry;
  using pointer = const directory_entry*;
  using reference = const directory_entry&;

  directory_iterator() noexcept; // end iterator
  explicit directory_iterator(const path& p);
  directory_iterator(const path& p, directory_options options);
  directory_iterator(const path& p, std::error_code& ec);
  directory_iterator(const path& p, directory_options options,
                     std::error_code& ec);

  const directory_entry& operator*() const;
  const directory_entry* operator->() const;
  directory_iterator& operator++();
  directory_iterator& increment(std::error_code& ec);
};

directory_iterator begin(directory_iterator iter) noexcept;
directory_iterator end(const directory_iterator&) noexcept;
}
```

它只列出目标目录直接包含的 entry；不会递归，且不产生 `.`/`..`。默认构造值是唯一 end
condition，end 不可解引用。构造空目录得到 end；权限被拒且 options 含
`skip_permission_denied` 时也得到 end 而不报告该权限错误。

### 6.2 单遍、顺序、失效与并发

- 它满足 Cpp17InputIterator，而不是 forward iterator；复制值可共享底层遍历状态，不能多遍扫描，
  不能假设递增一个副本不影响另一个副本。
- 枚举顺序未指定。需要稳定 UI/测试时，先复制 filename/path 到容器后排序；不得排序迭代器本身。
- 解引用所得 `directory_entry` 及其 `path()` 引用依赖当前 iterator element；iterator increment、
  move、赋值或销毁后应视为不可继续依赖，若要保留就复制 path/entry 值。
- iterator 构造与非 const member 可把枚举时已有属性缓存进当前 entry，但不会调用 refresh。
- 构造后目录增加/删除对象时，后续是否观察到这些变化未指定；遍历不提供快照。
- 构造/递增报告错误或越过最后元素后，iterator 变为 end。
- 专属条款未给遍历总成本或每次系统调用数；不要把 input iterator 类别误写为文件系统 O(1)。

同一 iterator 或共享遍历状态的副本不能无同步并发递增/解引用。不同 iterator 同时观察/修改同一
目录仍可能触发文件系统竞态。遍历中直接删除/重命名对象尤其不应作为初学示例。

常见误区：顺序按文件名；自动递归；可多遍；range-for 保存的是独立 entry 永久引用；复制 iterator
得到独立 cursor；构造后目录视图冻结；空 path 表示当前目录（标准建议显式 `"."`）。

Node `fs.opendir`/`fs.Dir` 可类比逐项枚举；C++ iterator 是同步 single-pass range。Node 的
`readdir({withFileTypes:true})` 也不应被理解成目录快照或排序保证。

### 6.3 两个示例

1. `collect-and-sort.cpp`：建立 `alpha.txt` 与 `beta.txt`；用 `error_code` 构造 iterator，循环中
   使用 `increment(ec)`，复制 filename 后 `std::sort` 再输出。

   ```text
   alpha.txt
   beta.txt
   ```

2. `iterate-one-level.cpp`：建立 `direct.txt` 与 `nested/inner.txt`；只遍历 root，复制并排序直接
   entry 名称，证明普通 iterator 不进入 nested。

   ```text
   direct.txt
   nested
   direct_entries=2
   ```

两例均用 RAII cleanup，写文件时显式 open/write/close 检查。必须排序；优先 error_code iterator，
但仍要允许 `bad_alloc`，因为 C++20 `ec` 构造/递增不是 `noexcept`。

## 7. `std::filesystem::exists`

### 7.1 C++20 声明与返回合同

```cpp
// <filesystem>
bool std::filesystem::exists(file_status status) noexcept;
bool std::filesystem::exists(const path& p);
bool std::filesystem::exists(const path& p, std::error_code& ec) noexcept;
```

`exists(file_status s)` 返回
`status_known(s) && s.type() != file_type::not_found`。因此：

- `file_type::regular`、`directory`、`symlink` 等已知类型返回 true；
- `not_found` 返回 false；
- `none`（未确定或取得类型时出错）也返回 false，但原因不同。

path overload 先按 `status(p)`/`status(p, ec)` 获得 file_status，再调用纯值 overload；它跟随
symlink。`exists(p, ec)` 只要 status 已知就清除 ec，所以“对象不存在”返回 false 且 ec 为空；
若无法确定 status，false 与非空 ec 才表示查询错误。这是 LWG 2725 澄清的行为。

不存在不是异常，但访问被拒、无效路径、底层 I/O 错误可能通过 filesystem_error/ec 报告。标准
没有规定专属复杂度或 status 系统调用次数；若已有 `directory_entry`/`file_status`，传 status
可避免为了同一判断再按路径查询，但缓存也可能陈旧。

### 7.2 生命周期、竞态、误区与 JS 对照

exists 不取得资源所有权，也不使结果保持为真。返回后外部对象即可被删除/替换；“先 exists，后
open/remove/create”存在 TOCTOU。应直接执行目标操作并处理其结果。

常见误区：false 等于“确定不存在”；`ec` 形式出错时仍只看 bool；missing 会留下错误；查询不
跟随 symlink；exists 结果是锁/快照；用它预防后续操作失败。

Node `fs.existsSync()` 只返回 bool 并折叠错误信息；C++ `exists(path, ec)` 能区分“已知不存在”和
“状态未知”，但仍不提供原子保证。Node 文档同样不推荐在操作前用 exists 做竞态式预检查。

### 7.3 两个示例

1. `reuse-file-status.cpp`：建立 `batch10-exists-demo/item.txt`，用 `status(path, ec)` 取得值后调用
   `exists(status)`，不做第二次路径查询。

   ```text
   known=true
   exists=true
   ```

2. `missing-clears-error.cpp`：先确保 `batch10-exists-missing/item.txt` 不存在，把 ec 预置为任意
   非零错误，再调用 `exists(path, ec)`。

   ```text
   exists=false
   ec_cleared=true
   ```

两例都用 RAII cleanup。第二例必须用 `error_code`，专门验证“not_found 是已知状态，不是查询
错误”；不得打印平台错误消息或数值。

## 8. `std::filesystem::create_directories`

### 8.1 C++20 声明、参数与副作用

```cpp
// <filesystem>
bool std::filesystem::create_directories(const path& p);
bool std::filesystem::create_directories(const path& p,
                                         std::error_code& ec);
// C++20 代表签名：ec overload 不是 noexcept。
```

函数对 p 中每个尚不存在的元素调用 `create_directory`，所以可建立多层父目录。返回 true 当且仅当
为 p 所解析到的最终目录新建了目录；目标目录已存在时返回 false，不是错误。任何实际失败按共同
错误模型报告，ec overload 出错返回 false；但 false 本身也可能只是“最终目录早已存在”，必须
结合 ec 判断。

标准明确复杂度为 O(n)，n 是 p 的 path element 数量；这是 path element 次数，不是时间、系统
调用或磁盘复杂度保证。函数可能已经创建若干父目录后才在后续元素失败，条款不承诺事务回滚。

LWG 2935 移除了不切实际的最终 `is_directory(p)` postcondition；P1164R1 随后恢复了
`create_directory` 对“同名非目录”的直观错误处理。当前 `create_directories` 条款本身仍表述为
“对每个不存在的元素调用 create_directory”，没有重新写出最终 `is_directory(p)` postcondition；
因此页面不得仅由 `false` 推导最终对象一定是目录，稳健代码在依赖该性质时应检查 ec，并按协议
决定是否另行验证类型。中间元素若不是可遍历目录，继续创建子元素会报告错误。LWG 3014 又去掉
ec overload 的 `noexcept`，允许临时 path/缓冲分配失败抛异常。

### 8.2 生命周期、竞态、误区与 JS 对照

函数不返回 handle，也不延长目录寿命。多进程并发创建同一路径仍必须按实际返回/ec 处理；不要
先 exists 再 create。成功只表示调用完成时合同满足，不保证之后目录仍存在，也不保证耐久提交。

常见误区：只创建最后一级；目标已存在会报错；false 必然失败；ec overload `noexcept`；失败自动
删除已创建父目录；O(n) 等于 n 次系统调用；先 exists 能避免竞态。

Node `fs.mkdirSync(path, {recursive:true})` 可类比递归创建，但返回值与错误细节不同；C++ 返回 bool
表示最终目录是否新建，并把 OS 错误分为 exception/ec 两条通道。

### 8.3 两个示例

1. `create-nested-tree.cpp`：清空 `batch10-create-demo`，用 ec overload 创建 `a/b`，再用
   `is_directory(path, ec)` 验证。

   ```text
   created=true
   is_directory=true
   ```

2. `repeat-idempotently.cpp`：在已知空状态连续两次创建同一 `a/b`，第二次前把 ec 预置为非零值，
   验证成功无变化时清除旧错误。

   ```text
   first=true
   second=false
   ec_cleared=true
   ```

两例均用 RAII cleanup，优先 error_code 避免异常文本。调用方仍要允许分配异常，因为该 overload
在 C++20 不是 `noexcept`。

## 9. `std::filesystem::remove`

### 9.1 C++20 声明、返回与副作用

```cpp
// <filesystem>
bool std::filesystem::remove(const path& p);
bool std::filesystem::remove(const path& p, std::error_code& ec) noexcept;
```

若 `exists(symlink_status(p, ec))`，删除 p 本身，如 POSIX `remove`。这意味着 symlink 参数删除链接
而不是其目标。对目录只删除空目录；非空树应使用 `remove_all`，但本页不要让初学者把两者混淆。

成功删除一个 file system object 返回 true；路径不存在返回 false，而且“不存在”不是错误。
实际失败通过 filesystem_error 或 ec 报告。成功后 postcondition 以
`exists(symlink_status(p)) == false` 表述，避免 dangling symlink 被错误视为已经满足。

标准未给 remove 专属复杂度或原子/事务/耐久保证。它删除目录项/链接；对已打开文件、hard link、
Windows sharing、网络文件系统的后续行为受 OS/文件系统约束，不应在跨平台教学页下额外承诺。

### 9.2 生命周期、竞态、误区与 JS 对照

remove 不拥有 path，也不使此前的 `directory_entry` 缓存或 iterator 自动更新。成功后相关缓存可
陈旧；遍历中的 path 也可能不再存在。exists 后 remove 仍可能竞态，直接调用 remove 并检查返回/ec。

常见误区：递归删除；能删除非空目录；删除 symlink target；false 总是错误；删除后所有缓存自动
失效通知；删除已打开文件跨平台行为一致；用 `std::remove` 算法或 `<cstdio>` 的 remove 与它混用。

Node `fs.rmSync(path)` 是近似对照；`recursive:true` 更接近 C++ `remove_all`，不是本函数。C++ bool
把“确实删除”和“原本不存在”分开，ec 再区分实际错误。

### 9.3 两个示例

1. `remove-one-file.cpp`：建立 `batch10-remove-demo/item.txt`，close/check 后用 ec overload 删除，
   再用 exists ec overload 验证。

   ```text
   removed=true
   exists=false
   ```

2. `remove-empty-directory-twice.cpp`：建立空目录 `batch10-remove-empty/leaf`，第一次删除返回 true；
   第二次前预置非零 ec，再删除同一路径，验证 missing 返回 false 且清除 ec。

   ```text
   first=true
   second=false
   ec_cleared=true
   ```

两例都有 RAII root cleanup；优先 error_code，避免异常信息并显式展示“false + clear ec”不是失败。

## 10. 十四个示例的确定性清单

| # | Entry / 文件名 | 是否有副作用 | 稳定策略 | 精确 stdout |
|---:|---|---|---|---|
| 1 | `<filesystem>` / `compose-portable-path.cpp` | 否 | 相对 ASCII + generic format | `path=assets/icons/logo.svg\n` |
| 2 | `<filesystem>` / `directory-lifecycle.cpp` | 是 | ec + root cleanup | `created=true\nis_directory=true\nremoved_leaf=true\n` |
| 3 | `path` / `decompose-relative-path.cpp` | 否 | 只做词法分解 | `parent=docs/reference\nfilename=vector.md\nstem=vector\nextension=.md\n` |
| 4 | `path` / `normalize-joined-path.cpp` | 否 | 只做词法正规化 | `raw=cache/items/../result.txt\nnormalized=cache/result.txt\n` |
| 5 | `directory_entry` / `inspect-regular-entry.cpp` | 是 | 固定三字节 + refresh-on-construct | `name=note.txt\nregular=true\nbytes=3\n` |
| 6 | `directory_entry` / `refresh-after-change.cpp` | 是 | 显式 close + refresh | `before=1\nafter=2\n` |
| 7 | `directory_iterator` / `collect-and-sort.cpp` | 是 | 复制 filename 后排序 | `alpha.txt\nbeta.txt\n` |
| 8 | `directory_iterator` / `iterate-one-level.cpp` | 是 | 非递归 + 排序 | `direct.txt\nnested\ndirect_entries=2\n` |
| 9 | `exists` / `reuse-file-status.cpp` | 是 | 复用已检查 status | `known=true\nexists=true\n` |
| 10 | `exists` / `missing-clears-error.cpp` | 是 | 确保 missing + 预置 ec | `exists=false\nec_cleared=true\n` |
| 11 | `create_directories` / `create-nested-tree.cpp` | 是 | ec + is_directory 验证 | `created=true\nis_directory=true\n` |
| 12 | `create_directories` / `repeat-idempotently.cpp` | 是 | 同路径两次 + 预置 ec | `first=true\nsecond=false\nec_cleared=true\n` |
| 13 | `remove` / `remove-one-file.cpp` | 是 | close/check + ec | `removed=true\nexists=false\n` |
| 14 | `remove` / `remove-empty-directory-twice.cpp` | 是 | 空目录两次 + 预置 ec | `first=true\nsecond=false\nec_cleared=true\n` |

实现模板应定义每个示例私有的：

```cpp
struct Cleanup {
  std::filesystem::path root;
  ~Cleanup() noexcept {
    try {
      std::error_code ignored;
      std::filesystem::remove_all(root, ignored);
    } catch (...) {
    }
  }
};
```

随后在 main 开头先执行一次 checked `remove_all(root, ec)`，再构造 guard。析构忽略清理错误是因为
不能从 destructor 抛异常；`remove_all(root, ec)` 自身仍可能因分配失败抛异常，所以 guard 还必须
捕获所有异常。主流程中的每项操作仍必须检查。纯 path 示例没有外部状态，无需伪造 cleanup。任何
出错分支只写 `std::cerr` 并返回非零，不能把平台相关错误文本混入 expected stdout。

## 11. 版本、缺陷报告与一级来源矩阵

| 事实组 | 一级来源 |
|---|---|
| Filesystem TS 与 C++17 纳入 | [N4100 Filesystem TS](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4100.pdf)、[P0218R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0218r1.html)、[C++17 final draft N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) |
| 当前总览、OS 与 race 边界 | [`[filesystems]`](https://eel.is/c++draft/filesystems)、[`[fs.conformance]`](https://eel.is/c++draft/fs.conformance)、[`[fs.race.behavior]`](https://eel.is/c++draft/fs.race.behavior)、[`[fs.err.report]`](https://eel.is/c++draft/fs.err.report) |
| path 语法、转换、成员与 iterator 失效 | [`[fs.class.path]`](https://eel.is/c++draft/fs.class.path)、[`[fs.path.cvt]`](https://eel.is/c++draft/fs.path.cvt)、[`[fs.path.append]`](https://eel.is/c++draft/fs.path.append)、[`[fs.path.gen]`](https://eel.is/c++draft/fs.path.gen)、[`[fs.path.itr]`](https://eel.is/c++draft/fs.path.itr) |
| directory_entry 缓存设计 | [`[fs.class.directory.entry]`](https://eel.is/c++draft/fs.class.directory.entry)、[`[fs.dir.entry.mods]`](https://eel.is/c++draft/fs.dir.entry.mods)、[`[fs.dir.entry.obs]`](https://eel.is/c++draft/fs.dir.entry.obs)、[P0317R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0317r1.html) |
| directory_iterator 顺序、single-pass 与改变中的目录 | [`[fs.class.directory.iterator]`](https://eel.is/c++draft/fs.class.directory.iterator)、[`[fs.dir.itr.members]`](https://eel.is/c++draft/fs.dir.itr.members)、[LWG 3013](https://cplusplus.github.io/LWG/issue3013)、[LWG 3480](https://cplusplus.github.io/LWG/issue3480)、[LWG 3719](https://cplusplus.github.io/LWG/issue3719) |
| exists 的 status/ec 语义 | [`[fs.op.exists]`](https://eel.is/c++draft/fs.op.exists)、[LWG 2725](https://cplusplus.github.io/LWG/issue2725) |
| create_directories 的副作用、O(n)、DR | [`[fs.op.create.directories]`](https://eel.is/c++draft/fs.op.create.directories)、[LWG 2935](https://cplusplus.github.io/LWG/issue2935)、[P1164R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1164r1.pdf)、[LWG 3014](https://cplusplus.github.io/LWG/issue3014) |
| remove 的 symlink/missing 合同 | [`[fs.op.remove]`](https://eel.is/c++draft/fs.op.remove)、[N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) |
| C++20 char8_t path 变化 | [P0482R6](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0482r6.html)、[N4861](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2020/n4861.pdf) |
| C++26 path formatting | [P2845R8](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p2845r8.html)、[`[fs.path.fmtr]`](https://eel.is/c++draft/fs.path.fmtr) |
| 当前草案后续 path 展示/编码演进 | [P2319R5](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p2319r5.html)、[`[fs.path.native.obs]`](https://eel.is/c++draft/fs.path.native.obs)、[`[fs.path.generic.obs]`](https://eel.is/c++draft/fs.path.generic.obs) |

二级页面只核对搜索别名与栏目：
[`<filesystem>`](https://zh.cppreference.com/w/cpp/header/filesystem)、
[`path`](https://zh.cppreference.com/w/cpp/filesystem/path)、
[`directory_entry`](https://zh.cppreference.com/w/cpp/filesystem/directory_entry)、
[`directory_iterator`](https://zh.cppreference.com/w/cpp/filesystem/directory_iterator)、
[`exists`](https://zh.cppreference.com/w/cpp/filesystem/exists)、
[`create_directories`](https://zh.cppreference.com/w/cpp/filesystem/create_directory)、
[`remove`](https://zh.cppreference.com/w/cpp/filesystem/remove)。正文、表格与示例必须原创。

## 12. 实施与终审清单

- 只新增七个建议 ID；每页两个 deterministic C++20 run 示例，共 14 个。
- 除两个纯词法 path 示例外，全部使用独立相对 root、checked 初始清理与 RAII 最终清理。
- 所有 create/open/write/close/status/iterator increment/remove 均检查；错误只写 stderr 并返回非零。
- 目录遍历结果复制 filename 后排序；禁止依赖 native order、`.`/`..`、mtime、权限或 symlink。
- expected stdout 全 ASCII；路径展示用 `generic_string()`，不得输出 current/temp absolute path。
- 每个普通 Entry 覆盖 direct header/since、C++20 声明族、参数与要求、返回、异常/ec、规范复杂度、
  文件系统副作用、生命周期/缓存/失效、线程与 race、可移植性、误区、Node/JS 对照、版本与一级来源。
- Header Entry 覆盖 facility map、选择边界、共同错误模型、直接包含要求、版本和两个示例。
- 终审拒绝：path 构造“检查存在”；`/ == +=`；`string()` 恒为 UTF-8；lexical normalization
  解析 symlink；entry observer 恒实时/恒 O(1)；iterator 有序/递归/多遍/快照；exists false 恒为
  missing；先 exists 后操作具原子性；create_directories false 恒为错误或自动回滚；
  `create_directories(ec)` C++20 `noexcept`；remove 递归或删除 symlink target；任意无标准依据的
  syscall 次数、耐久性或事务保证。
