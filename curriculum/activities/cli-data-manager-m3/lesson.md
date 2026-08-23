# Project：CLI 数据管理器 Milestone 3

继续沿用 Milestone 1/2 的 Workspace。本次不重写数据模型，而是增加可复现工程入口：CMake 配置 `record_model` 库、CLI 目标和独立测试目标，CTest 必须先通过，Judge 才会运行最终 CLI 集成测试。

## 任务

检查 `CMakeLists.txt` 中测试注册参数。修复后，clean configure、指定目标构建、CTest 和 CLI Grade 四个阶段都应通过。

## 检索练习

为什么“直接用 clang++ 编译所有 `.cpp`”不能替代目标依赖图？库、应用和测试三个 target 各自拥有什么责任？
