# `std::scoped_lock`

`std::scoped_lock<MutexTypes...>` 在构造时取得一个或多个 mutex，并在作用域结束时全部释放。传入多个 mutex 时，它使用与 `std::lock` 等价的死锁规避算法，而不是简单按参数顺序逐个阻塞加锁。

## 快速信息

- 头文件：`<mutex>`
- 命名空间：`std`
- 标准：C++17 起
- 所有权模型：不可复制、不可移动、不能提前解锁

## 什么时候使用

一个操作必须同时保护两个或更多互斥域时优先使用，例如在两个账户间转账或交换两个受锁保护的对象。只有一个 mutex 且整个作用域持锁时，它也可替代 `lock_guard`。

需要延迟、尝试、提前释放或向 condition variable 传递锁时改用 `unique_lock`。`scoped_lock` 故意不提供 `owns_lock()`、`unlock()` 或 `release()`，让所有锁共同服从一个清晰作用域。

## C++20 代表接口

```cpp
template<class... MutexTypes>
class scoped_lock {
public:
  using mutex_type = Mutex; // 仅当 sizeof...(MutexTypes) == 1

  explicit scoped_lock(MutexTypes&... mutexes);
  explicit scoped_lock(std::adopt_lock_t, MutexTypes&... mutexes);
  ~scoped_lock();

  scoped_lock(const scoped_lock&) = delete;
  scoped_lock& operator=(const scoped_lock&) = delete;
};
```

参数包可以为空，此时构造与析构都无效果。一个 mutex 时该类型须满足 BasicLockable；多个 mutex 时每个类型须满足 Lockable，以支持 `lock`、`try_lock` 与回退解锁。

## 参数、取得与释放

普通构造接收 mutex 左值引用。单参数版本调用该 mutex 的 `lock()`；多参数版本通过 `std::lock` 协调全部 mutex。`adopt_lock` 版本不执行加锁，前置条件是当前线程已经拥有传入的每一个 mutex。

构造器没有返回值。成功构造意味着 guard 拥有全部锁；析构对每个所持 mutex 调用 `unlock()`。模板参数经类模板实参推导通常可以省略，例如 `std::scoped_lock lock(a, b);`。

## 复杂度与进度

标准不规定多锁算法的尝试次数、渐进复杂度、公平性或取得顺序。发生竞争时可能多次 lock、try_lock 和回退 unlock。不要让程序正确性依赖哪一个 mutex 先取得。

## 异常与错误

单锁构造传播底层 `lock()` 的异常。多锁构造若某次 `lock` 或 `try_lock` 抛出，`std::lock` 会在重新抛出前解开它在本次调用中已经取得的锁，避免留下部分所有权。

把同一个非递归 mutex 传入两次、把当前线程已经持有的 mutex 交给普通构造，或未持有全部 mutex 却使用 `adopt_lock`，都违反相应锁合同，可能死锁或产生未定义行为，不能作为业务错误处理。

## 生命周期、失效与线程安全

guard 只引用 mutex，不管理其寿命；每个 mutex 必须活过 guard。析构后 guard 对象失效且所有锁已释放。移动和复制均被删除，因此锁集合不会在不明显的位置转移。

多个线程可以各自创建 guard 来竞争同一组 mutex，但不能并发操作同一个 guard 对象。锁只保护遵守同一锁协议的共享访问；任何绕过锁的冲突访问仍会形成 data race。

## 示例

第一个示例让两个线程以相反参数顺序请求同一对 mutex，并在 join 后验证总额不变。第二个示例先用 `std::lock` 取得两把锁，再通过 `adopt_lock` 把共同释放责任交给 scoped_lock。

## 常见错误

- 分别嵌套两个 `lock_guard`，且不同代码路径使用相反顺序。
- 写成未命名临时量，让锁在完整表达式末尾立即释放。
- 在构造参数里重复传入同一个非递归 mutex。
- 未持有全部 mutex 就使用 `adopt_lock`。
- 期待通过 scoped_lock 提前解锁其中一把锁。
- 在持有整组锁时执行慢 I/O 或未知回调。
- 认为死锁规避等于公平或无饥饿保证。

## 与 JavaScript 的区别

> JavaScript 的 `Promise.all` 只是汇合多个异步结果，并不会原子取得多份共享资源；`scoped_lock` 管理的是真实 mutex 所有权。Web Locks API 也没有与一组本地 mutex、RAII 析构和 `adopt_lock` 一一对应的合同。

## 相关内容

单个底层锁见 `std::mutex`；简单单锁 guard 见 `std::lock_guard`；可改变所有权状态的锁包装器见 `std::unique_lock`；完整设施地图见 `<mutex>`。

## 来源

零/单/多 mutex 的要求、普通与 adopt 构造、异常清理及析构合同由 manifest 中的 `[thread.lock.scoped]`、P0156R2 与 N4861 验证；cppreference 中文页用于二级覆盖核对。
