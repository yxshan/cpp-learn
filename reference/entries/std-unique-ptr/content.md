# `std::unique_ptr`

`std::unique_ptr` 是不可复制、可移动的智能指针，用类型系统表达一个资源只有一个所有者。

## 快速信息

- 头文件：`<memory>`
- 命名空间：`std`
- 标准：C++11 起
- 所有权：独占

## 什么时候使用

动态对象或资源需要明确的单一释放责任，并可能在函数、容器或对象之间转移时使用。无需动态生命周期时，直接按值保存对象通常更简单。

## 声明

```cpp
template<class T, class Deleter = std::default_delete<T>>
class unique_ptr;
```

## 所有权转移

复制构造和复制赋值被删除。移动把被管理指针与删除责任转给目标，源指针随后为空；销毁目标时调用其删除器。

## 返回值与观察

`get()` 返回不拥有资源的裸指针，`operator*` 和 `operator->` 提供访问。观察结果不能超过 `unique_ptr` 的生命周期，也不能自行释放资源。

## 复杂度

标准没有为整个类模板给出一条统一复杂度承诺。观察器与 `release()` 只读取或更新所存指针；
移动还可能移动删除器。`reset()`、移动赋值与析构会在存在旧指针时调用删除器，因而总成本
包含删除器和被管理对象析构所做的工作，不能把“销毁整棵对象图”笼统写成 O(1)。这些效果
分别见 [`[unique.ptr.single.observers]`](https://eel.is/c++draft/unique.ptr.single.observers) 与
[`[unique.ptr.single.modifiers]`](https://eel.is/c++draft/unique.ptr.single.modifiers)。数组特化的
`operator[]` 不执行边界检查。

## 异常与约束

删除器必须能正确释放对应资源，并且在 `unique_ptr` 析构调用它时不得抛出异常。使用默认
删除器通过基类指针拥有派生对象时，基类通常需要可访问的虚析构函数。解引用空指针会导致
未定义行为；访问前可使用布尔转换检查。对应边界见
[`[unique.ptr.single.dtor]`](https://eel.is/c++draft/unique.ptr.single.dtor) 与
[`[expr.delete]`](https://eel.is/c++draft/expr.delete)。

## 示例

第一个示例通过 `std::move` 转移所有权，并输出源为空以及目标值。第二个示例让工厂函数
返回 `std::unique_ptr<Service>`，把派生对象的独占所有权交给调用者；基类使用虚析构函数，
确保通过基类所有者销毁派生对象时执行正确的析构路径。

## 常见错误

不要对 `get()` 的结果调用 `delete`。需要把资源交给旧式 API 时，先区分该 API 是观察、暂借还是接管所有权。

## 与 JavaScript 的区别

JavaScript 对象由垃圾回收追踪；`unique_ptr` 的销毁时刻由 C++ 作用域和所有权移动确定。

## 相关内容

`<memory>` 展示其他所有权工具，`std::move` 允许移动重载参与选择。

## 来源

所有权、移动与删除语义依据由 Entry manifest 提供。
