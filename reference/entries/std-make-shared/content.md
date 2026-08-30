# `std::make_shared`

`std::make_shared<T>(args...)` 构造对象并立即返回 shared_ptr。普通对象场景中，实现通常能把
对象与控制块放进一次分配，减少分配次数和控制块建立错误。

## 快速信息

- 头文件：`<memory>`
- 命名空间：`std`
- 非数组重载：C++11 起
- 数组重载：C++20 起
- 返回值：`std::shared_ptr<T>` 或相应数组 shared_ptr

## C++20 重载分组

```cpp
// T 不是数组：C++11
template<class T, class... Args>
shared_ptr<T> make_shared(Args&&... args);

// T 是未知边界数组：C++20
template<class T>
shared_ptr<T> make_shared(size_t count);

// C++20 还有有界数组和以初值填充数组的重载组。
```

C++20 同一设施家族还加入了 `make_shared_for_overwrite`；它不是上面普通 `make_shared` 重载的
别名。当前草案中更晚的 constexpr 演进也需要单独标版本，不能回写成 C++11 或 C++20 行为。

## 构造参数与访问控制

非数组重载把 `args...` 转发给 `T` 的构造过程。`T` 必须在 make_shared 内部的构造表达式中
可构造；即使调用 make_shared 的代码位于 T 的 friend 中，私有构造函数访问检查仍可能发生在
标准库实现上下文，常见解决方案是公开受控工厂可访问的构造路径，而不是假定 friend 权限传递。

make_shared 不接受自定义删除器。需要专用删除协议时，使用匹配删除器建立 shared_ptr，并审查
分配失败时的资源安全。

## 分配与控制块

相比 `shared_ptr<T>(new T(args...))` 的对象分配加控制块分配，make_shared 通常将对象和控制块
合并。标准建议实现不超过一次分配，但这是 recommendation，不是可观察的硬保证；具体次数、
内存布局和 ABI 都不可依赖。

合并分配带来一个取舍：最后一个 shared_ptr 消失时 T 已析构，但若仍有 weak_ptr，包含控制块的
整块存储可能要等弱观察者全部消失才释放。对非常大的 T，这可能影响峰值内存。

## 返回值与所有权

成功返回的 shared_ptr 是新所有权组的第一个强所有者，普通情况下 `use_count() == 1`。复制返回
值增加强计数；传给 weak_ptr 不增加强计数。

## 数组重载

C++20 `make_shared<int[]>(count)` 创建未知边界数组并值初始化元素，因此标量初始为零。shared_ptr
不记录可供通用迭代 API 查询的数组长度；调用者仍需在领域对象中保存长度，或优先选择 vector。

本页示例显式写入三个元素再输出，避免依赖未解释的默认零值。

## 复杂度与异常

成本包含存储分配和 T/数组元素构造；数组形式随元素数量增长。分配失败抛 `std::bad_alloc`，
构造函数异常向调用者传播，并由创建过程清理已取得的存储和已完成的数组元素，不返回半成品
shared_ptr。

## 生命周期与失效

从结果取得的裸指针、引用或 string_view 只在所拥有对象/成员仍存活时有效。shared_ptr 移动不会
移动堆上对象本身，但最后一个强所有者 reset 或销毁会结束对象生命周期。

## 示例

第一个示例构造值为 42 的 Widget，初始所有者数为 1。第二个示例使用 C++20 数组重载创建三个
int，写入并输出 `2 4 6`。

## Notes

make_shared 是普通共享对象的首选构造方式，但它不是“所有动态对象”的默认选择。若生命周期有
自然单一所有者，make_unique 更能表达设计；若对象可直接作为值或成员保存，就不需要智能指针。

## 常见错误

- 把数组重载误标成 C++11；它在 C++20 才加入。
- 试图把自定义删除器传给 make_shared。
- 认为一次分配是可观察的对象布局保证。
- 忽略长寿命 weak_ptr 对合并分配存储释放时机的影响。
- 为了获得“现代写法”给本可按值保存的对象增加共享所有权。

## 与 JavaScript 的区别

> JavaScript 对象创建不要求调用者选择 unique/shared 所有权工厂；可达性由 GC 追踪。
> make_shared 建立显式引用计数控制块，并让最后一个强所有者决定确定性析构时机。

## 相关内容

`std::shared_ptr` 解释控制块、别名和线程规则；`std::weak_ptr` 解释非拥有观察。若所有权应当唯一，
使用 `std::make_unique` 与 `std::unique_ptr`。

## 来源

对象与数组重载、异常清理和版本边界依据 `[util.smartptr.shared.create]`、N3337、N4861、N2351、
P0674R1；cppreference 作为二级覆盖和呈现参考。
