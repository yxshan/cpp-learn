# 路线图与验收计划

| Field | Value |
|---|---|
| Document ID | ROADMAP-001 |
| Version | 4.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 交付原则

项目按能力和证据验收，不按日历或代码量验收。一个阶段只有在参考环境中可重复通过约定的内容、单元、契约、浏览器和构建门禁后，才能标为 Accepted。

Implementation Report 证明历史交付；当前代码和测试证明现状。历史报告里的“下一步”如果已被后续阶段完成，不再构成待办。

## 2. 已交付基线

| 阶段 | 状态 | 已交付能力 | 主要证据 |
|---|---|---|---|
| Stage 0 | Accepted | npm workspace、契约、模块壳、CI 与文档门禁 | [报告 13](13-STAGE-0-IMPLEMENTATION-REPORT.md) |
| Stage 1 | Accepted | Dashboard 到 Monaco、Run、Grade 和持久化的 Web 纵切 | [报告 14](14-STAGE-1-IMPLEMENTATION-REPORT.md) |
| Stage 2 | Accepted | 多文件 Workspace、可靠 Judge、事件与恢复 | [报告 15](15-STAGE-2-IMPLEMENTATION-REPORT.md) |
| Stage 3 | Accepted | Hint、Reflection、Evidence、Concept 与延迟复习 | [报告 16](16-STAGE-3-IMPLEMENTATION-REPORT.md) |
| Stage 4 | Accepted | 现代 C++ 课程主线与工程实践 | [报告 17](17-STAGE-4-IMPLEMENTATION-REPORT.md) |
| Stage 5 | Accepted | 算法、系统、网络、SQLite、CMake 与确定性测试 | [报告 18](18-STAGE-5-IMPLEMENTATION-REPORT.md) |
| Stage 5.1 | Accepted | 响应式学习导航、独立滚动、前后切换与无障碍 | [报告 19](19-STAGE-5.1-IMPLEMENTATION-REPORT.md) |
| Stage 6 | Accepted | 70 个 Activity、5 个作品集项目与职业方向内容 | [报告 20](20-STAGE-6-IMPLEMENTATION-REPORT.md) |
| Stage 6.1 | Accepted | C++ 初始格式、显式 Format 与确认 Reset | [报告 21](21-STAGE-6.1-IMPLEMENTATION-REPORT.md) |
| Stage 6.2 | Accepted | 120 条 Reference、226 个示例、搜索、导航与 Playground | [报告 52](52-STAGE-6.2-PHASE-4-COMPLETION-IMPLEMENTATION-REPORT.md) |

Stage 6.2 的内容扩展和质量修复证据分布在报告 25–52。它们保留用于追溯，不要求接手模型逐篇阅读。

## 3. Reference Authoring 当前验收

| 阶段 | 状态 | 说明 |
|---|---|---|
| A0 Contracts/fixtures | Accepted | 工件 Schema、profile fixture 与 non-publishing prepare |
| A1 CLI prepare/check | Accepted | 文件系统草稿、结构/事实/来源/示例检查 |
| A2 Cache/preview/publish | Accepted | 内容寻址缓存、生产 renderer 预览、原子发布 |
| A3 Fact reuse/context/metrics | Implemented, acceptance pending | 逻辑与 fixture 已完成，缺真实五条目批次测量 |
| A4 AI authoring adapter | Accepted | Provider-neutral 生成、claim gate、summary 与 example |
| A5 Batch runner | Accepted | 有依赖图、可恢复的一至五条目批次 |
| A6 Research assistant | Accepted | 显式来源摘录、Fact Sheet proposal 与人工验证边界 |
| A7 Bounded repair | Accepted | 固定三次预算、digest/revision 绑定的定向修复 |
| A8 Web review | Optional, not implemented | 只在人工审阅需求证明价值后开发 |

完整工件和验收规则见 [作者工具设计与实施计划](53-CONTENT-AUTHORING-TOOLS-DESIGN-AND-IMPLEMENTATION-PLAN.md)。A3 不能因后续阶段已实现而自动视为 Accepted。

## 4. 近期路线

### R0：恢复稳定交接基线

目标：保证新模型可以理解仓库、复现现状并安全开始工作。

验收：README、架构、文件地图、未来计划与接手指南一致；`npm run check` 和生产式 E2E 通过；工作树中没有来源不明的改动。

### R1：安全债务收敛

目标：按[当前安全审计](71-CURRENT-SECURITY-AUDIT.md)的证据处理已确认的安全债务，顺序与[后续开发计划 P1](69-FUTURE-DEVELOPMENT-PLAN.md#4-p1安全债务收敛)一致——先处理依赖公告（SEC-F03）、Judge 并发准入（SEC-F02）与 CI 安全门禁（SEC-F04），再更新安全基线。

验收：生产依赖 Audit 不再有未接受的公告；并发压力不突破配置预算；安全 Job 能拦截受控 fixture；`npm run check` 与生产式 E2E 通过。Native Judge 的强隔离（SEC-F01）在非回环、多人或不可信代码场景下仍是发布阻断项。

### R2：统一 Reference 内容策略

目标：建立一个类型化的 Reference content policy，统一 Entry kind profile、semantic area、标题识别、必需事实、风险和 repairability。

验收：质量检查、prepare scaffold 与 repair plan 使用同一策略；Header 等 area 不再通过独立字符串映射漏接；现有 120 个 Entry 的质量结果不回退。

### R3：收敛 Reference Authoring 内部结构

目标：按 Draft、Evidence、Generation、Repair/Batch、Validation/Publication 生命周期深化模块，保留现有 16 操作兼容门面。

验收：CLI、artifact schema 与已有 fixture 兼容；主要实现不再包含多个独立变更原因；失败、恢复、CAS 和原子发布测试仍通过。

### R4：修正共享呈现与应用依赖

目标：让 Web 与 CLI 共同依赖一个 Reference presentation 模块，移除 CLI 对 `@cpp-learn/web` 的直接依赖。

验收：静态预览与在线 Reference 使用同一 renderer；浏览器路由仍只在 Web；文件输出仍只在 CLI；相关单元和 E2E 通过。

### R5：完成真实作者效率验收

目标：使用作者流水线完成一个相关的五条目批次，记录 active author time、machine time、cache hit、review findings 与 escaped defects。

验收：测量过程使用真实内容和正常门禁，不用确定性 fixture 代替人时；满足既定时间目标或形成有证据的新瓶颈计划。

## 5. 中期路线

### R6：按领域深化 HTTP Adapter

把 Fastify 注册分为 Learning、Reference/Playground 和 Local Data 路由组。保留一个小 composition implementation，集中共享 transport policy。

验收不是“文件变多”，而是一个路由组的变更不要求理解无关领域；不能把领域规则移动到 Fastify。

### R7：按学习者工作流深化 Web Adapter

把 Dashboard、Lesson Workspace、Reference 和备份恢复的状态局部化。App shell 只负责顶层导航与路由选择。

验收包括 direct URL、history、dirty state、键盘操作、桌面独立滚动、390px 无横向溢出和无浏览器错误。

### R8：持续扩展高质量内容

先依据学习路径和搜索缺口选择条目，再按相关批次扩展。每个实质性 API 条目尽量覆盖参数、返回、错误、复杂度、生命周期/失效、常见误区、可运行示例和适当的 JS 对照。

不是每个字段都适用于每种 Entry。任何省略都需要由 profile 的 `notApplicable` 或结构化理由表达，不能用空泛段落凑齐模板。

## 6. A8 Web 审阅界面的决策门

Web 审阅界面不是开发日志。只有出现下列证据时才进入实现：

- CLI 风险队列难以完成逐项人审；
- 预览、事实来源和编译证据需要并排比较；
- 用户确实希望在浏览器中批准或拒绝 finding；
- 该界面可以复用 Authoring 模块而不复制规则。

若实现，第一版只做只读/审批型 Adapter：风险队列、published-vs-draft diff、claim-to-source、编译证据、render preview 与 publication plan。不要建设账号、协作、聊天记录或通用 CMS。

## 7. 延后事项

以下能力当前不在路线主干：

- 微服务、多仓库或远程数据库迁移；
- 公网多用户账号与权限系统；
- 分布式或公开代码执行服务；
- 自动抓取、镜像或翻译 cppreference；
- 无人工事实核验的自动发布；
- 为“架构整洁”而拆出大量浅层文件。

如果实际需求突破本地单用户边界，应先更新需求并新增 ADR，再改变部署架构。

## 8. 每个后续切片的最低完成定义

1. 在实现前写清目标、不变量、影响文件和回滚方式。
2. 保持 Web、CLI、模块与内容的责任边界。
3. 为成功、失败、恢复和兼容路径补测试。
4. 跑与风险相称的最小门禁，合并前跑全仓门禁。
5. 更新 Baseline、文件地图、路线图和相关追踪信息。
6. 只在真实证据可复现后写 Implementation Report 和 Accepted。

更细的执行切片见 [后续开发计划](69-FUTURE-DEVELOPMENT-PLAN.md)。

本轮路线图由 **GPT-5.6 Sol** 根据当前交付状态和架构审计重写。
