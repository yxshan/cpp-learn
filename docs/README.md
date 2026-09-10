# C++ Learning Platform 文档导航

| Field | Value |
|---|---|
| Document ID | DOC-INDEX |
| Version | 6.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 文档的作用

`docs/` 同时保存当前规范、架构决策、实现计划、研究证据和历史交付报告。它们的有效性不同，不能把编号靠后的文件自动视为更权威。

发生冲突时，按以下顺序判断：

1. 当前代码、自动化测试和可复现命令说明“实际上是什么”。
2. 已接受的 ADR 说明“不可随意改变的方向”。
3. 当前 Baseline 规范说明“应当是什么”。
4. In Review 文档是建议或审计结论，尚未自动改变架构。
5. Implementation Report 只证明某个历史节点交付过什么。
6. `archive/` 与根目录早期原型材料不构成当前规范。

如果代码与 Baseline 不一致，应记录偏差并决定修代码、修文档或新增 ADR，不能静默选择其中一边。

## 2. 接手模型的最短阅读路径

新的维护者或 AI 模型先阅读：

1. [根 README](../README.md)
2. [AI 模型接手指南](70-AI-MODEL-HANDOFF-GUIDE.md)
3. [系统架构](03-SYSTEM_ARCHITECTURE.md)
4. [项目文件地图与状态](68-PROJECT-FILE-MAP-AND-STATUS.md)
5. [后续开发计划](69-FUTURE-DEVELOPMENT-PLAN.md)
6. [领域上下文](CONTEXT.md)
7. 与当前任务直接相关的 ADR、规范和历史报告

不需要从 01 顺序读到 67。历史报告用于追溯决策和验收，不是日常开发的必读上下文。

## 3. 当前产品与工程基线

| 文档 | 作用 | 当前使用方式 |
|---|---|---|
| [项目章程](01-PROJECT_CHARTER.md) | 产品目标、范围和约束 | 稳定产品边界 |
| [软件需求规格](02-SOFTWARE_REQUIREMENTS_SPECIFICATION.md) | 功能与非功能需求 | 需求变更的主入口 |
| [系统架构](03-SYSTEM_ARCHITECTURE.md) | 当前模块、数据流和部署形态 | 架构事实基线 |
| [详细设计](04-DETAILED_DESIGN.md) | 关键接口、状态和实现约束 | 开发设计基线 |
| [接口契约](05-INTERFACE_CONTRACTS.md) | HTTP、命令、查询与事件 | 修改边界时核对 |
| [数据设计](06-DATA_DESIGN.md) | 内容、工作区和学习记录 | 修改持久化时核对 |
| [课程与判题规范](07-CURRICULUM_AND_JUDGE_SPECIFICATION.md) | Activity、Evidence 与 Judge | 课程和判题主规范 |
| [安全与隐私](08-SECURITY_AND_PRIVACY.md) | 本地运行、路径与执行边界 | 安全变更必读 |
| [测试与质量计划](09-TEST_AND_QUALITY_PLAN.md) | 分层验证和发布门禁 | 测试策略基线 |
| [开发与运维指南](10-DEVELOPMENT_AND_OPERATIONS_GUIDE.md) | 本地命令和故障处理 | 日常操作入口 |
| [路线图与验收](11-ROADMAP_AND_ACCEPTANCE_PLAN.md) | 已交付阶段和未来能力门禁 | 里程碑基线 |
| [需求追踪矩阵](12-REQUIREMENTS_TRACEABILITY_MATRIX.md) | 需求到实现/测试的映射 | 需求变更同步更新 |

## 4. Reference 与作者工具

| 文档 | 作用 | 状态 |
|---|---|---|
| [Reference 模块设计](22-API-REFERENCE-MODULE-DESIGN.md) | 阅读、搜索、导航、Playground | 当前设计基线 |
| [内容编写指南](23-API-REFERENCE-CONTENT-AUTHORING-GUIDE.md) | 单条目内容结构与事实要求 | 编辑规范 |
| [Reference 实施计划](24-API-REFERENCE-IMPLEMENTATION-PLAN.md) | Stage 6.2 的分期与验收 | 历史计划，主体已完成 |
| [作者工具设计与实施计划](53-CONTENT-AUTHORING-TOOLS-DESIGN-AND-IMPLEMENTATION-PLAN.md) | CLI-first 作者流水线 | A0–A2、A4–A7 已验收；A3 实测待完成 |

Reference 的研究记录位于 `docs/reference/API_REFERENCE_*_RESEARCH.md`。这些文件保存当时使用的来源与批次证据，不是可以直接复制的上游正文。

学习者导向的补充材料也位于 `docs/reference/`：

- [现代 C++ 心智模型](reference/MODERN_CPP_MENTAL_MODEL.md)
- [所有权与生命周期](reference/OWNERSHIP_AND_LIFETIME.md)
- [构建、测试与调试](reference/BUILD_TEST_DEBUG.md)
- [确定性算法测试](reference/DETERMINISTIC_ALGORITHM_TESTING.md)
- [本地系统实验](reference/LOCAL_SYSTEM_LABS.md)
- [生产级 C++ 服务证据](reference/PRODUCTION_CPP_SERVICE.md)

## 5. 架构决策与当前审计

已接受的决策：

- [ADR-0001：Web-first 本地单用户产品](adr/0001-web-first-local-single-user.md)
- [ADR-0002：共享 Learning Platform 核心](adr/0002-shared-learning-core.md)
- [ADR-0003：事件日志与可重建投影](adr/0003-event-log-and-sqlite-projections.md)
- [ADR-0004：Native Judge 优先](adr/0004-native-judge-first.md)
- [ADR-0005：声明式课程内容](adr/0005-declarative-curriculum-content.md)
- [ADR-0006：独立声明式 API Reference](adr/0006-separate-declarative-api-reference.md)
- [ADR-0007：本地 CLI-first Reference 作者流水线](adr/0007-local-reference-authoring-pipeline.md)

当前审计与建议：

- [外部架构对照](66-EXTERNAL-ARCHITECTURE-BENCHMARKS.md)
- [当前架构审计](67-CURRENT-ARCHITECTURE-AUDIT.md)
- [当前安全审计](71-CURRENT-SECURITY-AUDIT.md)
- [项目文件地图与状态](68-PROJECT-FILE-MAP-AND-STATUS.md)
- [后续开发计划](69-FUTURE-DEVELOPMENT-PLAN.md)

`66`、`67` 与 `71` 为 In Review。它们提供证据和改进方向，但在实现完成或 ADR 接受前，不自动替代现有模块接口。

## 6. 历史交付证据

以下编号段属于历史 Implementation Report：

- `13`–`21`：Stage 0 到 Stage 6.1。
- `25`–`52`：Stage 6.2 Reference 分期、内容批次与 Playground。
- `54`–`65`：Stage 6.3 作者工具 A0–A7。

这些文件保留稳定名称，便于已有链接和验收追溯。当前不物理搬迁到子目录，因为批量移动会制造大量链接改动；新增报告应优先按生命周期归类，并在本索引中标明用途。

需要调查某个行为为何存在时，先从相应 ADR 和当前设计开始，再按功能名称用 `rg` 搜索报告。不要把旧报告中的未来时态当成当前待办。

## 7. Archive

`archive/` 记录早期探索，不是规范：

- [备选项目方案](archive/PROJECT_DESIGN_OPTIONS.md)
- [早期 Web 架构方案](archive/WEB_PLATFORM_ARCHITECTURE.md)

若归档内容与当前 Baseline 或已接受 ADR 冲突，以当前 Baseline 和 ADR 为准。

## 8. 文档维护规则

- 状态使用 `Draft`、`In Review`、`Baseline`、`Accepted`、`Superseded`、`Archived`。
- 影响范围或验收的改动同步更新 SRS 与追踪矩阵。
- 难以撤销的架构变化先新增或更新 ADR。
- 接口变化同步更新契约、详细设计和契约测试。
- 实现报告只记录已发生且可复现的交付，不用于隐藏未完成工作。
- 文件地图、路线图和 AI 接手指南在模块、脚本、状态或优先级变化后同步更新。
- 日期使用 `YYYY-MM-DD`；发布后保持 Document ID 稳定。

本轮文档信息架构与导航由 **GPT-5.6 Sol** 整理。
