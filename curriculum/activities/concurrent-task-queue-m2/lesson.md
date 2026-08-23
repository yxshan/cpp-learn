# Milestone 2：并发工程的可复现证据

并发 bug 经常表现为“本机偶尔失败”。本里程碑把固定 worker 队列打包成可安装工件，并要求把编译线程支持、exact-once drain 回归、worker 数基准和关闭竞态复盘写入同一个 Portfolio。

CTest 会真正调用队列，验证负数任务只执行一次、worker 数固定为四、`close` 排空以及晚到任务被拒绝；Judge 还会执行批量增长基准。完成后，你应能用状态机解释 admission、drain、join 与 reject，而不是只展示一段 `std::thread` 代码。
