# Milestone 2：跨语言兼容发布

最终里程碑把 API envelope 变成一条真实的本地全栈切片：React 调用 `/api/v1/records/:id`，TypeScript 在运行时解码响应；C++ 服务在 `127.0.0.1:0` 接收 HTTP 请求，用 prepared statement 查询 SQLite，再返回版本化成功或错误 envelope。

CMake 同时链接 Threads 与 SQLite，CTest 真正执行 TypeScript decoder 契约测试；它还会从同一干净 Workspace 读取固定版本 `package.json` 与 `tsconfig.json`，完成 Vite TSX 生产构建，再通过 `component.test.tsx` 挂载 `App.tsx` 并验证初始状态。Judge 则通过回环 socket 验证存在记录和缺失记录，并记录请求指标。Portfolio 必须说明 clean build/install、HTTP/SQLite/React 集成证据、C++ producer 相对基线，以及 schema drift 如何被监控、回滚并转化为 producer-consumer 回归测试。

这也是你连接前端经历与 C++ 后端岗位的核心项目：你能站在生产者和消费者两侧解释版本演进，而不是只会其中一端的框架。
