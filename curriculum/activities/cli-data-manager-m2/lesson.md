# Project：CLI 数据管理器 Milestone 2

沿用 Milestone 1 的 Workspace，不替换已有 `Record` 与格式化代码。新增 `RecordStore`，把记录加入 `vector` 并输出数量。这个增量验证 Project 文件确实跨 Milestone 保留，同时引入组合与容器所有权。

## 检索练习

在动手前说明：为什么 `RecordStore` 应拥有 `vector<Record>`，而格式化函数仍只借用 `const Record&`？
