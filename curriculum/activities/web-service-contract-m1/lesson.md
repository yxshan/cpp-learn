# Portfolio Project 5：Web 与 C++ 服务契约

你已经熟悉 React 和 TypeScript。这个项目把既有优势变成 C++ 后端竞争力：不从 UI 重学，而是学习如何让不同语言通过稳定、可校验的契约协作。

第一个里程碑使用紧凑文本代替 JSON 库，专注三个问题：版本如何表达、成功与失败如何判别、未知操作如何保持同一 envelope。真实项目中应把相同原则应用到 JSON Schema、OpenAPI 或 protobuf。

Workspace 同时包含 C++ producer、`client.ts` 运行时 decoder 和 `App.tsx` React consumer。不要用 TypeScript 类型断言跳过不可信响应；先验证版本与判别字段，再让 React state 接收收窄后的联合类型。
