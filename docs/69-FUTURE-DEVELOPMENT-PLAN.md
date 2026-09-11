# 后续开发计划

| Field | Value |
|---|---|
| Document ID | NEXT-PLAN-001 |
| Version | 1.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 目标

本计划把架构与安全审计转成可由后续 AI 模型逐项执行的开发切片。顺序强调风险和依赖：先收敛已确认的安全债务，再统一内容政策、重构作者生命周期，然后修正共享呈现和应用局部性，最后加速内容扩展。

每个切片都应保持外部行为可用，并能单独测试和回滚。不要在一个改动中同时移动目录、重写接口、改变内容规则和新增 UI。

## 2. 优先级总览

| 顺序 | 工作流 | 主要结果 | 依赖 |
|---:|---|---|---|
| 0 | 交接基线复验 | 新模型确认当前事实和门禁 | 无 |
| 1 | 安全债务收敛 | 处理依赖公告、Judge 准入和 CI 安全门禁 | 0（已完成，见 §4） |
| 2 | Reference content policy | 检查、模板和修复共享一个类型化政策 | 0，可与 1 分提交推进 |
| 3 | Authoring 生命周期深化 | 16 操作兼容门面背后形成清晰内部模块 | 2 |
| 4 | Reference presentation | CLI 不再依赖 Web app | 0（已完成） |
| 5 | A3 真实批次测量 | 证明速度或定位真实瓶颈 | 2，建议 3 后 |
| 6 | Server/Web 局部性 | 降低大文件的无关认知负担 | 1、4（均已完成） |
| 7 | 内容持续扩展 | 用稳定快速流水线补齐高价值 API | 1、2、5 |

## 3. P0：交接基线复验

### P0-1 读取与工作树审计

操作：阅读根 README、文档索引、系统架构、文件地图、本计划和 AI 接手指南。运行 `git status --short`，区分用户改动、已完成文档和生成物。

完成条件：能说明 Web、CLI、Server、七个领域模块、三个有效共享包、两个生产内容根和一个空 UI 包的责任。

### P0-2 全仓门禁

操作：依次运行 `npm run check`、`npm run test:e2e` 和 `npm run test:e2e:production`。若失败，先诊断环境问题与代码回归，不立即扩大重构范围。

完成条件：记录命令、环境和结果。若旧基线本身失败，建立独立修复切片并更新接手文档。

## 4. P1：安全债务收敛（已完成）

以 [当前安全审计](71-CURRENT-SECURITY-AUDIT.md) 为证据，按独立提交依次处理：

1. 验证并升级 Monaco/DOMPurify 依赖链，不使用未经 E2E 验证的强制回退。
2. 为 Activity 与 Reference 建立共享 Judge 并发准入、有限队列和过载响应。
3. 新增依赖、密钥扫描和安全回归 Job，并将 GitHub Actions 固定到完整 commit SHA。
4. 更新安全基线，明确 Native Judge 是风险接受项，不是已经解决的隔离能力。

完成条件：生产依赖 Audit 无未接受公告；并发压力不会突破配置预算；安全 Job 能拦截
受控 fixture；`npm run check` 与 production E2E 通过。Native Judge 的强隔离仍是非回环、
多人或不可信代码场景的发布阻断项。

**执行结果（2026-09-11，证据见 `docs/71` §10）**：

- 第 1 项：`overrides` 将 DOMPurify 提升到 3.4.15，并在构建时把 Monaco **内联**的同一份
  副本重定向到该包。审计原文“DOMPurify 会被依赖链打入生产包”已按构建取证更正：进入
  bundle 的一直是 Monaco 内联的副本，仅升级 npm 包不会改变出货代码。
- 第 2 项：`packages/composition/src/admission.ts` 提供进程内共享预算，Activity
  Run/Grade 排队、Playground 非阻塞拒绝，过载返回 `429` + `Retry-After`。
- 第 3 项：独立 `security` CI Job、固定到 commit SHA 的两个 Action、
  `scripts/check-security.ts`（工作树 + 全部修订的凭据扫描）与
  `security/audit-exemptions.json`（带理由/责任人/到期日）。
- 第 4 项：`SECURITY.md` 与 `docs/08` 更新；Native Judge 仍是风险接受项。
- 仍未完成：单个被准入进程的 CPU/内存/进程数上限（需要容器或 OS 级适配器），
  以及 `docs/71` 的 P2 项（SEC-F01、SEC-F08 与 Authoring 示例执行环境、路径竞态）。

**P1 本地产品加固随后完成（2026-09-12，证据见 `docs/71` §10.5–§10.8）**：

- SEC-F05：每次启动的会话令牌、精确同源校验、回环 `Host` 校验与 Fetch Metadata。
- SEC-F06：导出与恢复共用的归档预算，判定先于解码，拒绝时不动任何根目录。
- SEC-F07：命令回执 LRU 与 Job 事件流的有界保留，运行中的 Job 受保护。
- 响应加固：`nosniff`、Referrer Policy、`X-Frame-Options`，CSP 先以 Report-Only 验证。

## 5. P2：统一 Reference content policy

这是安全债务收敛之后内容侧的最高优先级，因为相同语义目前分散在 Authoring profile、质量脚本和 repair target map 中，已经发生过 Header finding 无法进入修复计划的问题。

### P2-1 特征测试与词汇清单

涉及：

- `scripts/reference-content-quality.ts`
- `modules/reference-authoring/src/index.ts`
- `modules/reference-authoring/src/repair.ts`
- `packages/reference-schema/`

先为 Entry kind、semantic area、heading alias、必需 fact group、risk 和 repairability 建立当前行为矩阵。测试必须覆盖 type、member、function、object、header、guide。

完成条件：在不改变行为的前提下，测试能暴露任何 checker 与 repair 对同一 area 的不一致。

### P2-2 建立深政策模块

优先放在可被脚本和 Authoring 同时消费的领域包中。公共接口只暴露稳定概念，例如 `EntryKindPolicy`、`SemanticAreaId`、heading matcher 和 requirement evaluator。

模块应隐藏字符串别名、风险计算和适用性细节。不要暴露几十个独立常量，也不要让调用方再次解释标题。

完成条件：删除该模块会迫使至少 checker、scaffolder、validator 和 repair planner 重新实现同一规则，说明它具有真实深度和杠杆。

### P2-3 迁移质量检查

让 `scripts/reference-content-quality.ts` 通过政策模块识别 area 和 profile，不改变现有 120 Entry 的结果。

完成条件：`npm run check:reference-quality` 输出等价；quality baseline 无意外变化；旧字符串表不再作为并行权威来源。

### P2-4 迁移 prepare/check/repair

Authoring scaffold、事实要求、warning risk 和 repair target 全部消费同一政策。Header、guide 和 aggregation Entry 的适用性必须有专门 fixture。

完成条件：所有 Authoring 测试通过；已知 area 可修则一定能生成目标，不可修则返回明确 manual/infrastructure 原因。

### P2-5 删除重复政策

只有所有调用方迁移并通过等价测试后，才删除旧映射。同步更新详细设计、作者指南和 Implementation Report。

完整门禁：

```bash
npm run check:reference
npm run check:reference-quality
npm test
npm run check
```

## 6. P3：深化 Reference Authoring 生命周期

目标不是把 5,000 行机械分成很多文件，而是让一个工作流的知识位于一个深模块内，并限制 16 操作门面继续增长。

### P3-1 冻结兼容门面

为当前 `ReferenceAuthoring` 16 个操作和 CLI 命令建立 contract snapshot。记录 request/result、artifact schema、错误和幂等行为。

完成条件：后续内部移动不能无意改变 JSON、exit code、revision、receipt 或恢复语义。

### P3-2 按生命周期归属 Schema

把 22 个 Schema 建立清晰分组和 owner 映射：Draft、Evidence/Research、Generation、Run/Batch、Repair、Validation/Publication。

先只建立导出结构与测试，不改 schema `$id`、版本或生成工件路径。若要物理移动 Schema，必须证明引用和 snapshot 保持兼容。

### P3-3 抽取内部能力模块

推荐顺序：

1. Draft identity 与 CAS repository 协调。
2. Context、Fact 与 Source evidence。
3. Generation application 与 receipts。
4. Run、Batch 与 Repair progression。
5. Check、Preview 与 Publication gate。

每个内部模块应返回领域结果，不读 CLI 参数、不打印终端、不直接加载 React。

### P3-4 缩小调用权限

学习 CLI 不应看到 authoring；未来 Web review 只依赖 read/review/publish-plan 所需的窄权限。保留一个兼容 facade 给当前 CLI，内部消费者使用更小 capability interface。

完成条件：新增工作流优先组合已有 capability，不默认向 16 操作 facade 再加方法。

### P3-5 验证失败与恢复

重点覆盖 stale revision、digest mismatch、重复 run ID、重启恢复、三次 repair 预算、partial generation、publication rollback 和 interrupted swap。

完整门禁：`npm run check`。涉及预览时再跑 Reference E2E 和 production E2E。

## 7. P4：共享 Reference presentation（已完成）

`packages/reference-presentation` 已承担该接缝：Web 与 CLI 共用同一套块模型、
heading id 与 HTML 序列化；`apps/cli` 依赖的是 `@cpp-learn/reference-presentation`，
不再依赖 `@cpp-learn/web`；空的 `packages/ui` 已删除。在线文章与 preview 的等价性由
`apps/web/src/reference-article.parity.test.tsx` 守护。以下为原始验收描述，保留备查。


### P4-1 定义呈现接缝

将 Markdown/GFM 组件、Reference block mapping 和静态 render entry 组织为一个可被 Web 与 CLI 使用的 presentation 模块。

浏览器 location/history/link navigation 留在 `apps/web`；filesystem preview output 留在 `apps/cli`。共享模块不能读取 app config 或本地草稿路径。

### P4-2 迁移在线文章

让 `ReferenceArticle.tsx` 使用共享呈现接口，保持 table、code、anchor、callout 和链接行为。先跑组件测试，再跑真实浏览器 Reference 测试。

### P4-3 迁移 CLI preview

让 `apps/cli/src/reference-author-preview.ts` 直接消费共享 presentation，删除 `@cpp-learn/web` 依赖。

完成条件：在线页面与 preview snapshot 等价；CLI package 不再依赖 Web package；`packages/ui` 要么承担这个深接口，要么被删除并用更准确的包名替代。

## 8. P5：A3 真实五条目批次

选择一个事实可复用但操作语义不同的相关批次，例如一个容器、三个高频成员和对应 header。避免只挑五个极短、无错误/失效语义的条目美化数据。

记录：

- research、Fact Sheet、写作、人审和修复的 active author time；
- check、compile、preview、publish 和 full gate 的 machine time；
- cache hit 与 invalidation；
- high/medium/low review findings；
- 发布前缺陷和发布后 escaped defects；
- 每个 Entry 的适用/不适用内容区域。

完成条件：真实批次满足既定 60–90 分钟目标且无质量回退，或产生一份可复现的瓶颈报告。后者也是有效结果，但 A3 保持未验收，直到门槛真正满足或经 ADR/计划修订。

## 9. P6：Server 与 Web 局部性（已完成）

- P6-1：`packages/composition/src/server.ts` 只负责安装四个 route group
  （learning / reference / local-data / jobs），parsing、status mapping 与
  cancellation/streaming 全部下沉；共享策略在 `transport.ts`。
- P6-2：`App.tsx` 为 26 行；`dashboard/` 抽出 `useDashboardNavigation`、
  `useDashboardView`、`useDashboardQueries`、`useBackupRestore` 与各 section 组件，
  `lesson/` 抽出 `useEditorSession`、`useActivityExecution`。

以下为原始验收描述，保留备查。


### P6-1 Server route groups

把 `packages/composition/src/server.ts` 深化为 Learning、Reference/Playground、Local Data 三个路由注册模块和一个共享 transport policy。

避免一文件一路由。每个 route group 应隐藏该领域的 parsing、status mapping 和 cancellation/streaming 细节，Fastify composition 只负责安装。

### P6-2 Web workflow modules

从 `App.tsx` 优先抽取 Dashboard view model、backup/restore workflow 和 route/location state。从 `LessonWorkspace.tsx` 抽取 editor session state 或 execution workflow，但不拆纯传参 wrapper。

完成条件：修改一个工作流的主要状态无需跨越无关页面；direct URL、browser history、dirty confirmation 和窄屏行为保持不变。

## 10. P7：内容扩展方法

### 10.1 选题

从课程引用缺口、搜索无结果、高频标准库使用和职业项目需求中选条目。每批五至十个主题相关 Entry，共享来源调查，但不共享未经证明的操作语义。

### 10.2 最低内容质量

实质性 type/function/member Entry 尽量覆盖：

- 声明、可用标准和头文件；
- 参数与约束；
- 返回和值类别；
- 错误、异常和未定义行为边界；
- 复杂度；
- 生命周期、引用/迭代器失效与线程注意事项；
- 常见误区和 API 选择建议；
- 至少一个最小示例和一个现实示例；
- 对 JS 学习者有帮助且明确边界的类比。

Header、guide、category 等 Entry 不强塞函数字段。由类型化 policy 决定 required、recommended 和 notApplicable，避免模板完整但内容空洞。

### 10.3 来源与原创

优先使用 C++ 标准草案、标准提案、实现官方文档和权威规范。cppreference 用于导航、覆盖和交叉核对，不能直接抄写或把其存储格式当项目数据模型。

每个规范性 fact group 映射到来源。JS 对照属于教学解释，也必须忠于 C++ 语义，不能把相似语法误写成相同生命周期、异常或性能保证。

## 11. 可选 Web 审阅面

只有 P5 证明人审界面是瓶颈时才开发。第一版范围限定为：风险队列、draft/published diff、claim/source 证据、编译结果、渲染预览和 publish plan 确认。

它不是 AI 开发记录页面。模型运行历史由结构化 receipt 和 batch report 提供；Web 只帮助人做风险决策。

## 12. 原型归档任务（已完成）

已用全仓搜索、完整门禁与浏览器 E2E 证明根目录 `assets/`、`lessons/`、`exercises/`、
`learning-records/` 以及 `reference/compile-run-debug.html` 没有当前运行时引用，随后全部移入
`docs/archive/legacy-prototype/`，并删除已提交的 arm64 可执行文件
`exercises/0001-first-program/first_program`（同目录 `.gitignore` 防止再次提交）。
归档说明见 `docs/archive/legacy-prototype/README.md`，`docs/68` §9 记录了逐项处置。

## 13. 每次交付的记录模板

```text
目标：解决哪一个可观察问题
固定点：开始 commit 与原有门禁结果
不变量：不能改变的行为和数据
变更：文件与接口
验证：命令、测试数量、E2E 与人工检查
偏差：仍未完成的验收
回滚：如何恢复且不丢学习者/作者数据
文档：更新 Baseline、ADR、追踪矩阵或报告
```

本计划由 **GPT-5.6 Sol** 编写，供后续模型按小切片继续执行。
