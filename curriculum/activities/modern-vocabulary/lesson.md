# Lambda、optional、variant 与 ranges

现代 C++ 的目标不是堆叠语法，而是让非法状态更难表示。lambda 把局部行为放在使用点；ranges view 描述惰性数据管道；optional 表示值可能缺失；variant 表示结果只能处于若干已知分支之一。

本练习筛选正数并计算最大值与总和。没有正数时，不返回 0 或 -1 这样的魔法哨兵，而是保留缺失状态，再通过 variant 与 visit 统一输出。请比较这套表达与 JS 中 undefined、联合类型和数组链式调用的差异。

重点观察 view 的生命周期：它引用原容器而不拥有元素，因此 values 必须活到遍历结束。

## 练习要求

用 ranges 管道筛选数据，并用 optional 与 variant 显式表达缺失结果和分支。

完成后回答反思题，并说明失败 mutation 破坏了哪个边界。
