# Review：恢复 CMake 目标图

不要先翻旧答案。读 `CMakeLists.txt`、`tests.cpp` 和失败的 CTest 输出，先预测哪个命令行参数破坏了测试契约。

## 任务

保留独立的 `review-app` 与 `review-tests` 目标。修复测试注册，使 CTest 只运行测试目标本身；随后确认应用目标仍可单独执行。

## 解释要求

分别说明 clean configure、命名目标构建、CTest 与最终应用运行能发现哪一类错误。它们不是四种写法，而是四层不同的证据。
