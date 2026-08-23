# Review：验证回滚

从空白恢复事务的失败路径：插入一行后执行回滚，确认查询结果仍为零。解释回滚改变的是事务可见状态，而不是替代 statement finalize 或 connection close。
