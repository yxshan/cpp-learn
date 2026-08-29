# `std::sort`

`std::sort` 重排一个随机访问范围，使元素满足默认升序或给定比较器定义的顺序。

## 快速信息

- 头文件：`<algorithm>`
- 命名空间：`std`
- 标准：C++98 起
- 要求：随机访问迭代器

## 什么时候使用

需要原地重排随机访问范围，并且不要求等价元素保持原相对次序时使用。若必须保持等价元素
的先后关系，应选择 [`std::stable_sort`](https://eel.is/c++draft/stable.sort)；链表容器
应使用自己的排序成员。若只需要最小值、前若干项或按分界查找，不一定需要把整个范围
完全排序。

## 代表性声明

C++98 起的两个经典非执行策略重载：

```cpp
template<class RandomIt>
void sort(RandomIt first, RandomIt last);

template<class RandomIt, class Compare>
void sort(RandomIt first, RandomIt last, Compare comp);
```

C++20 起，这些重载成为 `constexpr`：

```cpp
template<class RandomIt>
constexpr void sort(RandomIt first, RandomIt last);

template<class RandomIt, class Compare>
constexpr void sort(RandomIt first, RandomIt last, Compare comp);
```

C++17 起还提供执行策略重载；它们具有额外的调用要求与异常处理规则，本页示例聚焦上面的
经典重载。C++20 起经典重载可用于常量求值。

## 参数

`[first, last)` 是待排序的半开区间。`comp` 必须为元素建立严格弱序，不能在比较过程中破坏参与排序的值。

## 返回值

无返回值；输入范围被原地重排。

## 复杂度

比较次数为 `O(N log N)`，其中 `N` 是范围长度。

## 常见错误

`std::list` 的迭代器不是随机访问迭代器，应使用它自己的 `sort` 成员。比较器若不满足严格弱序，会违反算法前提。

## 异常与前提

范围必须有效，迭代器和值类型必须满足对应标准版本的可交换、可移动及比较要求。比较器必须建立严格弱序。非执行策略重载会传播元素交换、移动或比较过程中抛出的异常。

## 示例

第一个示例对整数向量升序排序。第二个示例为候选人定义“分数降序、同分姓名升序”的比较
规则；显式同分规则既符合严格弱序，也让示例输出不依赖算法如何排列等价元素。

## 相关内容

查看 `std::vector` 了解示例中的连续容器。

## 来源

签名、要求与复杂度依据由 Entry manifest 提供。
