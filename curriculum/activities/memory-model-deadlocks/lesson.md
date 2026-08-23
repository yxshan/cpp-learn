# 死锁、原子顺序与内存模型

数据竞争是未定义行为；死锁则是多个执行流形成循环等待。给共享字段加很多 mutex 并不自动安全，多把锁必须有全局顺序，或使用 scoped_lock 的死锁规避算法一次获取。

原子类型还需要回答顺序问题。release store 与 acquire load 可建立跨线程 happens-before，把启动前写入安全发布给 worker；relaxed 适合只需要原子计数、不承载其他数据可见性的场景。

本实验让两个线程反向转账。账户锁一次获取，金额总和必须守恒；完成计数使用 relaxed，因为 join 和锁已经承担其他状态的同步。

## 练习要求

用 scoped_lock 一次获取多把锁，并用 release/acquire 发布启动状态。

完成后回答反思题，并说明失败 mutation 破坏了哪个边界。
