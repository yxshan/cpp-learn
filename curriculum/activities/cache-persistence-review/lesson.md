# 延迟复习：缓存缺失结果与失效策略

不要回看原实现，先从不变量恢复接口选择，再用新的 Judge 输入验证迁移能力。

# SQLite、PostgreSQL 边界与缓存一致性

缓存是数据所有权协议，不只是一个 unordered_map。read-through 流程先查缓存，miss 时访问持久层，再把存在或缺失结果写回。若不缓存缺失结果，热点不存在键会持续穿透数据库。

本实验用 SQLite 内存库保持可复现，用 prepared statement 绑定参数，并以 optional 区分缺失。迁移到 PostgreSQL 时，连接池、网络失败、事务隔离和服务端查询计划会改变故障面，但谁是事实来源、何时失效、允许多旧仍必须显式定义。

生产设计还要选择 TTL、写穿或旁路、主动失效或版本键，并为命中率、陈旧读取和回源延迟建立指标。

## 练习要求

用 SQLite prepared statement 实现 read-through cache，并缓存存在与缺失结果。

完成后回答反思题，并说明失败 mutation 破坏了哪个边界。
