# `std::shared_ptr`

`std::shared_ptr<T>` 让多个句柄共同拥有一个对象。最后一个强所有者消失时销毁被管理对象；
控制块可能继续存在，直到相关 weak_ptr 也全部消失。

## 快速信息

- 头文件：`<memory>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权：共享强所有权
- 主要成本：控制块、引用计数更新和间接访问

## 代表性声明

```cpp
template<class T>
class shared_ptr {
public:
    constexpr shared_ptr() noexcept;

    template<class Y>
    explicit shared_ptr(Y* pointer);

    shared_ptr(const shared_ptr& other) noexcept;
    shared_ptr(shared_ptr&& other) noexcept;

    template<class Y>
    shared_ptr(const shared_ptr<Y>& owner, element_type* stored) noexcept;

    element_type* get() const noexcept;
    long use_count() const noexcept;
    explicit operator bool() const noexcept;
};
```

这里只展示所有权建立、复制、移动、别名和观察器。删除器、allocator、数组及转换构造还有更多
重载，应按具体任务进入标准条款或成员页。

## 两个指针概念

shared_ptr 可以同时拥有两个不同概念：

- **被管理指针**：强计数归零时交给删除器的对象；
- **存储指针**：`get()`、`operator*`、`operator->` 暴露的地址。

普通 shared_ptr 中二者通常相同。别名构造函数共享 `owner` 的控制块，却把 `stored` 保存为访问
指针，因此可以拥有整个对象而暴露其中一个成员。存储指针甚至可以为空，而 shared_ptr 仍参与
某个控制块的所有权。

## 控制块与所有权组

控制块通常保存强/弱引用计数、删除器、allocator，以及在 make_shared 场景下可能与对象相邻的
存储。复制 shared_ptr 增加强计数；移动转移句柄，不增加所有者数量。

绝不能从同一个裸指针分别构造两个独立 shared_ptr：它们会创建两个控制块，最终可能重复删除。
应复制已有 shared_ptr，或从一开始使用 make_shared。

## 返回值与观察器

`get()` 返回非拥有裸指针。`use_count()` 返回共享同一控制块的强所有者数量，适合诊断与教学，
不应在并发代码中用它决定“我是最后一个所有者”。布尔转换检查存储指针是否非空，不等同于
检查某个特定控制块是否存在。

## 复杂度

`shared_ptr` 的各子条款没有一条可覆盖所有操作的统一渐进复杂度保证。实现通常通过控制信息维护
引用计数，但页面不把控制块布局、计数算法或 lock-free 性质写成标准承诺。销毁最后一个所有者
还会执行被管理对象析构、删除器和可能的存储释放，不能只按一次计数更新估算。

## 异常与错误

- 复制、移动和别名构造不抛异常。
- 从裸指针建立新控制块可能分配并抛 `std::bad_alloc`；规定重载会在控制块建立失败时正确释放
  已交入的指针。
- 解引用空存储指针是未定义行为，应先检查。
- 自定义删除器在释放路径上必须满足对应调用要求，不能把异常传播出析构清理路径。

## 生命周期、循环与 weak_ptr

强计数归零时被管理对象析构。若对象 A 与 B 互相保存 shared_ptr，计数都无法归零，形成所有权
环。把不表达所有权方向的一条边改为 weak_ptr，或重新设计拥有关系。

别名 shared_ptr 能让整个 owner 对象保持存活，因此成员指针在别名所有者存在期间有效；这不是
把任意裸指针自动变安全。

## 线程安全

共享同一控制块的**不同 shared_ptr 对象**可以由多个线程各自执行成员修改，控制块计数协调不会
因此产生数据竞争。多个线程同时非 const 修改**同一个 shared_ptr 对象**仍需同步，或在 C++20
使用 `std::atomic<std::shared_ptr<T>>`。这些保证不保护 `T` 本身；被管理对象的共享可变状态仍需
自己的并发协议。

## 示例

第一个示例复制一个共享整数，稳定输出值与两个所有者。第二个示例让 shared_ptr 拥有完整
Session，却通过别名构造暴露 `id` 成员，两个句柄共享同一控制块。

## Notes

shared_ptr 表达的是“共同决定对象寿命”，不是“这个对象在多线程中自动安全”，也不是默认容器
元素类型。能明确指定单一所有者时，unique_ptr 或直接值通常更简单。

## 常见错误

- 从 `owner.get()` 再构造一个 shared_ptr。
- 互相保存 shared_ptr 形成环。
- 用 `use_count() == 1` 实现并发独占判断。
- 认为复制 shared_ptr 会复制被管理对象。
- 把 shared_ptr 的控制块线程安全误认为对象数据线程安全。

## 与 JavaScript 的区别

> JavaScript GC 通过可达性追踪对象，通常能回收不可达环；shared_ptr 使用显式强引用计数，
> 因而所有权环不会自动消失。C++ 的最后一个强所有者离开时会确定性调用对象析构。

## 相关内容

优先用 `std::make_shared` 建立普通共享对象。用 `std::weak_ptr` 表达非拥有观察和打破环；只有一个
所有者时转到 `std::unique_ptr`。

## 来源

控制块、别名、销毁和线程规则依据 `[util.smartptr.shared]`、N3337、N4861、N2351 与 N2638；
cppreference 是二级页面结构与覆盖参考。
