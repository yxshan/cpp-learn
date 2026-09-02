# `std::lock_guard`

`std::lock_guard<Mutex>` 是最小的 RAII 锁所有者：构造时取得 mutex，析构时释放。它不可复制、不可移动，也没有提前 unlock 或转移所有权接口。

## 快速信息

- 头文件：`<mutex>`
- 命名空间：`std`
- 标准：C++11 起
- 适用模型：整个词法作用域持续持锁

## 什么时候使用

进入作用域就加锁、离开作用域必定解锁时优先使用。它让异常、早返回和多分支共享同一个析构释放路径。需要延迟加锁、提前解锁、移动锁所有权或配合 condition_variable 时改用 `unique_lock`。

如果一次需要取得多个 mutex，使用 `scoped_lock` 或 `std::lock` 协调，而不是嵌套多个 lock_guard 并在不同位置改变顺序。

## C++20 代表接口

```cpp
template<class Mutex>
class lock_guard {
public:
  using mutex_type = Mutex;

  explicit lock_guard(mutex_type& mutex);
  lock_guard(mutex_type& mutex, std::adopt_lock_t);
  ~lock_guard();

  lock_guard(const lock_guard&) = delete;
  lock_guard& operator=(const lock_guard&) = delete;
};
```

## 构造、参数与结果

普通构造保存 mutex 引用并调用 `mutex.lock()`。`adopt_lock` 构造不加锁；前置条件是当前线程已经拥有传入 mutex。析构调用 `mutex.unlock()`。构造器不返回值，guard 本身也没有 `owns_lock()`、`unlock()` 或 `release()`。

模板参数只需满足相应 BasicLockable 合同，不局限于 `std::mutex`。底层 mutex 必须覆盖 guard 的完整生命周期。

## 复杂度

标准没有给 lock_guard 单独规定渐进复杂度；构造/析构分别执行一次底层 lock/unlock，其阻塞、进度与成本由 mutex 合同和运行时竞争决定。

## 异常与错误

普通构造可传播底层 `lock()` 的异常。一旦成功构造，析构路径依赖底层 `unlock()` 的不抛合同。未持锁却传 `adopt_lock`，或 guard 析构前 mutex 已销毁，违反前置条件，不能作为正常异常分支处理。

## 生命周期、同步与线程安全

同步效果来自底层 mutex 的 lock/unlock，不是 guard 对象本身。guard 持有引用而非拥有 mutex；mutex 必须更长寿。不要从多个线程操作同一个 guard，也不要把 guard 当作可传递的“锁令牌”。

具名局部变量的生命周期必须覆盖要保护的语句。未命名临时量会在当前完整表达式末尾析构，下一条语句已经不受保护。

## 示例

第一个示例通过异常展开离开 guard 作用域，再次取得同一 mutex 并更新值。第二个示例先手工 lock，再用 `adopt_lock` 把释放责任交给 guard；之后普通 guard 能再次取得同一 mutex。

## 常见错误

- 写成 `std::lock_guard{mutex};`，误以为能保护后续语句。
- 未先持锁却使用 `std::adopt_lock`。
- mutex 在 guard 之前销毁。
- 需要提前解锁却强行扩大/扭曲作用域。
- 试图复制或移动 guard。
- 用多个 lock_guard 以不一致顺序取得多个 mutex。
- 持锁调用可能重入或长时间阻塞的未知代码。

## 与 JavaScript 的区别

> JavaScript 的 `try/finally` 可以类比“无论如何都释放资源”，但普通 JS 没有 C++ 析构时机和共享对象 mutex 合同。lock_guard 的释放由确定的 C++ 作用域析构触发，而不是 Promise 完成、垃圾回收或 event-loop tick。

## 相关内容

底层独占互斥量见 `std::mutex`；完整互斥设施地图见 `<mutex>`；并发执行者见 `std::thread`。

## 来源

构造、adopt 前置条件、析构和 BasicLockable 关系由 manifest 中的 `[thread.lock.guard]`、mutex requirements、N3337 与 N4861 验证；cppreference 仅用于二级覆盖核对。
