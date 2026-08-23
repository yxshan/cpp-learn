# Portfolio Project 4：并发任务队列

第一个里程碑直接实现真实线程池的核心：四个固定 worker 从受 `mutex` 保护的队列取任务，`condition_variable` 只负责唤醒，不替代状态谓词。

`close()` 先把状态切为停止接收，再唤醒所有 worker。worker 只有在“队列为空且不再接收”时退出，因此已接受任务会排空；随后 `join` 建立完成边界，关闭后的 `submit` 必须被拒绝。公开与私有输入共同验证 exact-once、负数任务和关闭状态。
