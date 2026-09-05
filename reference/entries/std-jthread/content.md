# `std::jthread`

`std::jthread` 是 move-only 的线程所有者。它在 `std::thread` 的显式 join 模型上加入共享停止状态和 RAII 回收：线程函数可以观察一次性的停止请求，而仍为 joinable 的对象在析构时会先请求停止，再等待线程结束。

## 快速信息

- 头文件：`<thread>`；显式使用 `std::stop_token` 时也直接包含 `<stop_token>`
- 命名空间：`std`
- 标准：C++20 起
- 功能检测：`__cpp_lib_jthread >= 201911L`
- 核心边界：停止请求是协作信号，不是强制终止

## 什么时候使用

工具链完整支持 C++20，线程生命周期应由作用域管理，并且工作函数能主动响应停止请求时，优先评估 `jthread`。它适合少量、边界清楚的长期 worker；大量短任务仍通常交给线程池或任务系统。

不要把它当作“自动杀线程”的 `thread`。工作函数忽略 token、永久阻塞或等待调用线程持有的锁时，析构仍可能长期阻塞或死锁。需要返回值、异常组合或异步 continuation 时还要使用 future、消息通道或更高层抽象。

## C++20 代表接口

```cpp
class jthread {
public:
  using id = thread::id;
  using native_handle_type = thread::native_handle_type;

  jthread() noexcept;

  template<class F, class... Args>
  explicit jthread(F&& f, Args&&... args);

  ~jthread();
  jthread(const jthread&) = delete;
  jthread(jthread&&) noexcept;
  jthread& operator=(const jthread&) = delete;
  jthread& operator=(jthread&&) noexcept;

  bool joinable() const noexcept;
  void join();
  void detach();
  id get_id() const noexcept;
  void swap(jthread&) noexcept;

  stop_source get_stop_source() noexcept;
  stop_token get_stop_token() const noexcept;
  bool request_stop() noexcept;

  static unsigned int hardware_concurrency() noexcept;
};
```

这里省略 native handle 和非成员比较、交换等细节。当前工作草案中的晚期线程属性不属于本页的 C++20 基线。

## 参数、调用与返回

启动构造函数会在创建线程中 materialize callable 与各参数的衰减副本。新线程优先尝试调用 `invoke(f, get_stop_token(), args...)`；只有该形式不良构时，才尝试不注入 token 的 `invoke(f, args...)`。因此自动注入的 `std::stop_token` 必须是 callable 的第一个参数；两种形式都可调用时，带 token 的形式优先。

callable 不接收 token 也是合法的，但它没有观察内部停止请求的入口。线程函数返回值会被忽略；需要结果时必须另设通道。构造完成与新线程开始调用 callable 副本之间有同步关系。

| 操作 | 返回或后置状态 |
|---|---|
| 默认构造 | 空句柄，`joinable() == false`，内部 source 不可停止 |
| `joinable()` | 当前 ID 是否不是默认 ID；线程函数自然返回后、join 前仍为 `true` |
| `get_stop_token()` | 关联内部 stop state 的观察者；空对象得到 disengaged token |
| `get_stop_source()` | 内部请求端的副本；它与已发出的 token 共享状态 |
| `request_stop()` | 首次真正把状态改为“已请求”时为 `true`，之后为 `false` |
| `join()` / `detach()` | 返回 `void`；成功后当前句柄不再表示线程 |
| `hardware_concurrency()` | 硬件线程上下文数量的提示；无法确定时允许为 0 |

## 协作停止

停止状态是单调且不可重置的。`request_stop()` 只发布请求，并可能在调用线程同步执行已注册的 stop callbacks；它不等待 worker 结束，也不会中断任意阻塞调用。worker 必须检查 `stop_requested()`，或使用理解 stop token 的等待设施。

关联 source/token 上的请求和查询不会彼此造成 data race。一次返回 `true` 的停止请求与观察到已请求状态的调用建立同步关系，但这不会自动保护与 stop state 无关的业务数据。

## 所有权与生命周期

若对象析构时仍 `joinable()`，析构按顺序调用 `request_stop()` 和 `join()`。这避免了 `std::thread` 在同一状态下析构会 terminate 的问题，却也意味着作用域退出可能阻塞。

移动构造同时转移线程句柄和 stop state；源对象变为空，已交给 worker 的 token 仍与目标 owner 管理的同一状态关联。移动赋值若目标原来 joinable，会先对旧线程请求停止并 join，再接管来源，因此即使签名为 `noexcept` 也可能阻塞。

成功 `join()` 后，被管理线程的完成同步于调用返回。`detach()` 则切断 RAII 停止与等待责任，不延长引用、指针、`this`、`string_view` 或 `span` 的生命周期。先前复制出的 token/source 可以在句柄 join、detach 或移动后继续拥有 stop state；所以 `stop_possible()` 与 `joinable()` 不是同一个问题。

对同一个 `jthread` wrapper 并发 join、detach、move 或查询不会自动安全。stop state 的线程安全保证不能扩展成对整个句柄和任意共享对象的保护。

## 复杂度与阻塞

标准没有为这些操作规定统一的可移植大 O、线程创建成本、调度公平性或完成时限。`join()` 和析构可能等待任意长时间；`request_stop()` 的耗时可能包含同步 stop callback 工作。不要把它们概括成 O(1)，也不要用 sleep 为正确性建立时序。

## 异常与错误

callable 或参数副本的构造错误发生在创建线程；无法创建系统线程时，启动构造函数抛 `std::system_error`，典型 code 为 `resource_unavailable_try_again`。线程入口若让异常逃逸会调用 `std::terminate`，不会自动传播给 owner。

`join()` 可用 `system_error` 报告自 join、底层线程无效或对象不可 join；`detach()` 也会拒绝无效或不可 detach 的句柄。对空对象调用它们不是无操作。`request_stop()` 是 `noexcept`，但同步执行的 stop callback 若抛出异常会 terminate。

## 示例

第一个示例用 atomic handshake 确保 worker 已启动，再展示第一次与重复停止请求的布尔结果和显式 join 后的状态。第二个示例让作用域退出自动请求停止并等待，主线程只在析构返回后读取结果。两者都不 sleep、不从 worker 输出，也不依赖调度顺序。

## 常见错误

- 以为 `request_stop()` 会强杀线程，或等价于 `join()`。
- worker 忽略 token，却期待析构停止无限循环。
- 把 token 放在 callable 的非首参位置，误以为仍会自动注入。
- 在线程退出需要某把锁时，持有该锁销毁或移动赋值 `jthread`。
- detach 后仍期待析构 stop + join，或留下悬空引用捕获。
- 认为线程函数自然结束后 `joinable()` 会自动变为 `false`。
- 把 `stop_possible()` 当作 `joinable()`，混淆 stop state 与线程句柄。
- 认为返回值或异常会保存在 `jthread` 中。
- 并发操作同一个 wrapper，或只检查语言模式却不检查标准库功能。

## 与 `std::thread` 的选择

两者都不可复制、可以移动，并都直接表示执行线程。`std::thread` 在仍 joinable 时析构会 terminate，没有内建停止状态；`jthread` 在相同位置请求停止后 join，并可把 token 注入 callable。新 C++20 代码通常更适合结构化的 `jthread`，但自动等待带来的时延和死锁面、协作停止要求以及旧工具链兼容性必须明确评估。

## 与 JavaScript 的区别

> `stop_source` / `stop_token` 最接近 `AbortController` / `AbortSignal`：请求都是一次性的，也都可能被工作方忽略。但 C++ token 参与跨线程同步且不携带 abort reason；`jthread` 析构还会确定地阻塞 join，JavaScript 对象离开作用域或被 GC 不会这样做。

`jthread` 句柄可帮助理解 Web Worker 的生命周期，但 C++ 线程默认共享地址空间；Worker 更偏向消息传递。`Worker.terminate()` 是强制停止，不等同于协作式 `request_stop()`。同样，`join()` 会阻塞当前 OS 线程，而 `await` 通常暂停 async 函数并把执行权还给事件循环。

## 相关内容

头文件设施地图见 `<thread>`；与必须显式处理 join/detach 的 `std::thread` 对照阅读。示例用 `std::atomic` 建立确定性握手；返回值与异常通道可继续阅读 `std::future`。

## 来源

接口、token-first 调用选择、析构与移动、join/detach、停止状态、错误和同步关系由 manifest 中的 N4861、当前 Working Draft 与 P0660R10 验证；cppreference 中文页只用于二级覆盖和信息架构核对。页面正文、表格、示例及 JavaScript 类比均为项目原创。
