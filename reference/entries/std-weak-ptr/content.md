# `std::weak_ptr`

`std::weak_ptr<T>` 非拥有地观察一个 shared_ptr 控制块。它不会延长被管理对象寿命；调用
`lock()` 可以原子地尝试取得临时 shared_ptr。

## 快速信息

- 头文件：`<memory>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权：弱观察，不增加强引用计数
- 安全访问入口：`lock()`

## 代表性声明

```cpp
template<class T>
class weak_ptr {
public:
    constexpr weak_ptr() noexcept;

    template<class Y>
    weak_ptr(const shared_ptr<Y>& owner) noexcept;

    long use_count() const noexcept;
    bool expired() const noexcept;
    shared_ptr<T> lock() const noexcept;
    void reset() noexcept;
};
```

weak_ptr 没有 `operator*` 或 `operator->`，因为仅观察控制块不能证明对象在下一条指令仍然存活。

## 建立与所有权

从 shared_ptr 建立 weak_ptr 会加入同一所有权组，但不增加强计数。只要仍有 weak_ptr，控制块可能
保留；被管理对象仍在最后一个 shared_ptr 消失时立即析构。

weak_ptr 常用于缓存、观察者关系、父指针和图结构中的非拥有边。它不是通用裸指针替代品：只有
原对象由兼容 shared_ptr 控制块管理时才能建立这种观察关系。

## `lock()` 返回值

`lock()` 原子检查对象是否仍被强所有。如果存活，返回一个新的 shared_ptr 并增加强计数；如果
已经过期，返回空 shared_ptr。函数不抛异常。

```cpp
if (auto owner = observer.lock()) {
    use(*owner);
}
```

把返回的 shared_ptr 保存在局部变量中，能保证整个使用区间内对象仍然存活。

## `expired()` 与竞争窗口

`expired()` 等价于观察 `use_count() == 0`，适合状态展示，但“先 expired，再 lock”在并发环境中
存在检查与使用之间的竞争窗口。真正访问对象时直接调用 lock，并根据返回值分支。

`shared_ptr<T>(weak)` 构造在已过期时会抛 `std::bad_weak_ptr`；`weak.lock()` 则以空 shared_ptr
报告同一情况，适合普通条件流程。

## 复杂度与异常

这些操作围绕共享控制信息工作，但 C++20 的相关条款没有为 `use_count`、`expired`、`lock` 等
观察器单独给出可在本页承诺的渐进复杂度上界，也不保证 lock-free。列出的 weak_ptr 观察操作
不抛异常；对象访问发生在成功得到 shared_ptr 之后，其异常取决于 T 的操作。

## 生命周期与线程

weak_ptr 自身销毁不会销毁被管理对象。不同 weak_ptr/shared_ptr 对象可以按智能指针共享控制块
的线程规则使用；同一个 weak_ptr 对象的并发非 const 修改仍需同步。成功 lock 只保护对象寿命，
不保护对象内部可变状态。

## 示例

第一个示例在 owner 存活时 lock，得到值 42 和两个强所有者。第二个示例跨越 owner 作用域观察
`expired` 从 false 变为 true，并验证之后 lock 返回空。

## Notes

打破环时要选择真正不拥有对方的一边，而不是机械地把任意字段改为 weak_ptr。对象关系应先有
清楚的生命周期方向，智能指针再编码该设计。

## 常见错误

- 期待直接解引用 weak_ptr。
- 先检查 expired，稍后假设对象仍存活。
- 认为 weak_ptr 会让对象延迟销毁。
- 成功 lock 后只保存裸指针，却立即丢弃返回的 shared_ptr。

## 与 JavaScript 的区别

> JavaScript `WeakRef.deref()` 也可能取得对象或 `undefined`，但对象存活由垃圾回收时机决定。
> weak_ptr 观察显式 shared_ptr 控制块；最后一个强所有者消失时对象按 C++ 生命周期立即析构，
> 随后的 lock 确定返回空。

## 相关内容

`std::shared_ptr` 解释控制块和共享所有权；`std::make_shared` 建立普通共享对象。weak_ptr 的主要
价值是非拥有观察与打破 shared_ptr 环。

## 来源

观察、过期与 lock 合同依据 `[util.smartptr.weak]`、N3337、N4861 和 N2351；cppreference 是
二级学习参考。
