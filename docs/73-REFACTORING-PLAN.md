# 重构方案与执行计划

| Field | Value |
|---|---|
| Document ID | REFACTOR-PLAN-001 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Prepared by | DeepSeek Harness Agent |
| Fixed point | `96f31c3` + `docs/72` 修复后的工作树 |
| Goal | 方便后续开发、提高效率、保证模块化、降低耦合 |

本文不是 `docs/67`/`docs/69` 的复述。它重新评估了实际代码，给出**可选做法与推荐决策**，
请所有者审计后再执行。唯一优化目标是后续开发效率与模块化程度，不要求与既有文档一致。

## 1. 现状诊断（实测）

### 1.1 依赖图本身是健康的

```
contracts, workspace, content-schema, ui     ← 叶子，无内部依赖
reference-schema, judge, learning-platform,
learning-record, curriculum                   ← 只依赖 contracts（+ content-schema）
reference                                     ← contracts, judge, reference-schema
reference-authoring                           ← contracts, judge, reference, reference-schema
server                                        ← 全部领域模块
web                                           ← contracts
cli                                           ← contracts, 5 个模块, server, web
```

没有循环依赖。领域模块分层正确：判题、学习记录、工作区都只面向 `contracts`。
**这一点不需要重构，应保持。**

### 1.2 真正的架构违规只有 3 个 import

| 位置 | 引用 | 代价 |
|---|---|---|
| `apps/cli/src/index.ts:10` | `@cpp-learn/server/composition` | CLI 复用 Server 组装逻辑，`serve` 命令被绑死在 Server 的装配方式上 |
| `apps/cli/src/reference-author-preview.ts:9` | `@cpp-learn/web/reference-preview` | CLI 为生成静态预览**运行时加载 React + react-dom/server**，并跨包读取 web 目录下的 `styles.css`、`mdn-theme.css` |

第二项的实际成本最高：一个命令行作者工具为了输出 HTML，引入了整个 Web 技术栈。

### 1.3 局部性债务集中在 5 个文件（占非测试源码 40%）

| 文件 | 行数 | 问题 |
|---|---:|---|
| `modules/reference-authoring/src/index.ts` | 5271 | 校验、模板、草稿、证据、生成、批处理、修复、发布的编排全在一个文件 |
| `apps/web/src/App.tsx` | 1097 | 导航、5 个并行查询、备份恢复、Dashboard 派生视图、渲染混在一起 |
| `packages/contracts/src/index.ts` | 956 | 一个文件承载 Reference/学习/判题/事件/传输五类契约 |
| `apps/server/src/server.ts` | 903 | 27 条路由 + origin 策略 + 错误映射 + 输入校验交织 |
| `apps/web/src/LessonWorkspace.tsx` | 749 | 编辑会话状态与执行工作流混合 |

### 1.4 语义债务：同一套规则有三份定义

Reference 内容策略在三个地方独立维护：

- `scripts/reference-content-quality.ts`：`headingPatterns`（TextArea→RegExp）、`areaOrder`、`commonSemanticAreas`、`auditHeader`
- `modules/reference-authoring/src/index.ts`：`PROFILE_BY_KIND`、profile/heading 校验
- `modules/reference-authoring/src/repair.ts`：`AREA_HEADINGS`、`SECTION_FACT_KINDS`

后果不是理论风险：A7 阶段真实发生过 header 类 finding 无法进入修复计划。
这也是**唯一一个已经造成缺陷的架构问题**。

### 1.5 重构安全网充足

36 个测试文件 / 351 个测试（6.7s）、18 条开发 E2E（57s）、1 条生产 E2E。
模块测试全部通过接口断言，不是实现细节断言。大文件拆分在测试保护下是可行的。

## 2. 总体策略：三个可选主干

### 策略 A：「边界优先」——先消除跨应用依赖

只做 §3 的 D1、D2，加上 D5（server 分域）。
- 成本：小。D1 半天，D2 一天，D5 一天。
- 收益：CLI 与 Web 解耦，`serve` 不再绑定 Server 装配；CLI 启动不再拉 React。
- 局限：不解决 5271 行与策略重复这两个真正的效率瓶颈。

### 策略 B：「策略优先」——先统一内容策略，再拆 Authoring

做 D3、D4，加 D6。
- 成本：中偏大。D3 两天，D4 三到四天。
- 收益：解决已造成缺陷的重复规则；把 5271 行拆到可独立理解的生命周期模块，
  这是后续内容扩展与真实批次验收的直接前置。
- 局限：CLI 仍然拉 React，server 仍然单文件。

### 策略 C：「整体分层」——按目标架构一次性重排

D1–D7 全做，含把 `docs/` 按生命周期重组（`docs/67` A-06）。
- 成本：大，且 `docs/` 重组会产生大量链接改动而**不提高任何开发效率**。
- 风险：变动面覆盖全部应用层，回归定位困难。
- 结论：**不推荐**。文档重组只在确认文档已成为协作瓶颈时才做。

### 推荐：A → B 的两阶段主干，且顺序不可颠倒

先 A 后 B，理由：

1. A 的三个改动彼此独立、风险极低，且立刻让 CLI 成为真正的独立适配器；
2. B 的 D3（策略下沉）需要一个新的共享包，A 阶段建立的"共享包不依赖应用"惯例是它的前置；
3. D4（拆 5271 行）必须在 D3 之后，否则会把三份策略定义原样搬进新的模块划分里，白拆一次。

C 明确不做。`docs/` 重组、contracts 拆成多包、Authoring 拆成多包，都属于"增加包数量但不增加模块深度"的伪改进。

## 3. 决策点与备选做法

### D1 消除 CLI → Server 的组合根依赖

| 选项 | 做法 | 评价 |
|---|---|---|
| **D1-a（推荐）** | 新建 `packages/composition`，承载 `createProductionApplication` / `createProductionHttpServer` / `createProductionDataArchive`；`apps/server` 与 `apps/cli` 都依赖它 | 组合根是独立职责，两个适配器共用一份装配。包本身不依赖任何 app |
| D1-b | 把组合根放进 `modules/learning-platform` | 不推荐：领域模块不应知道 HTTP、文件系统路径与静态资源 |
| D1-c | CLI 自己写最小装配 | 不推荐：两份装配逻辑必然漂移，且 `serve` 与 `dev` 行为会分叉 |

`packages/composition` 是本次唯一新增的"装配"包，它允许依赖全部领域模块与 node 内建，
但**不允许**被任何领域模块反向依赖。

### D2 消除 CLI → Web 的呈现依赖

| 选项 | 做法 | 评价 |
|---|---|---|
| **D2-a（推荐）** | 新建 `packages/reference-presentation`，承载框架无关的 Reference 正文渲染：Markdown/GFM → HTML 块映射、内联代码、表格、锚点、callout、相关链接。Web 的 React 组件改为消费它的块模型；CLI 直接调用它产出 HTML。样式表由调用方传入，包内不读 web 目录 | 真正形成"一份 renderer、两个消费者"的深接口；CLI 不再加载 React。同时可删除空壳 `packages/ui` |
| D2-b | 保留 `packages/ui` 名号，让它承担呈现 | 可行，但 `ui` 这个名字会继续吸引"放点共享 CSS 和薄组件"的浅改动；改名更能表达职责 |
| D2-c | 把静态渲染下沉到 `modules/reference` | 不推荐：Reference 是只读知识模块，拥有"内容"而不是"长什么样"；且会让运行时模块被 CLI 与构建脚本依赖 |

无论选哪个，**`packages/ui` 都应当消失**：`src/index.ts` 只有 `export {};`，零消费者，
留着只会被当作垃圾桶。

### D3 Reference content policy 深模块

| 选项 | 做法 | 评价 |
|---|---|---|
| **D3-a（推荐）** | 新建 `packages/reference-policy`，对外只暴露稳定概念：`EntryKindPolicy`、`SemanticAreaId`、`headingMatcher`、`requirementEvaluator`、`repairabilityOf`。隐藏标题别名、风险计算与适用性细节 | 删除它会迫使 checker、scaffolder、validator、repair planner 各自重写同一规则——满足深模块判据 |
| D3-b | 并入 `packages/reference-schema` | 该包会同时有两个变更原因（Schema 版本 / 教学策略），不推荐 |
| D3-c | 放进 `modules/reference` | policy 是作者侧概念，放进运行时只读模块会让构建脚本依赖运行时模块 |

**执行顺序必须是**：先写覆盖全部 8 种 Entry kind 的特征测试固定当前行为 → 建包 →
checker 迁移并证明 `check:reference-quality` 输出等价 → authoring 的 scaffold 与 repair 迁移
→ 删除旧字符串表。中途任一步不等价就停下，不改 120 条 Entry 的既有结果。

### D4 拆分 5271 行的 Authoring 编排

| 选项 | 做法 | 评价 |
|---|---|---|
| **D4-a（推荐）** | 保留 `modules/reference-authoring` 单一包与 16 操作门面，内部按生命周期目录化：`draft/`、`evidence/`、`generation/`、`run-batch/`、`repair/`、`validation/`、`publication/`。`index.ts` 只保留门面装配与导出 | 包边界不变 = CLI、schema、测试导入路径全部不变；改动集中在文件内部移动 |
| D4-b | 拆成多个 workspace 包 | 不推荐：会制造包版本、导出面和循环依赖风险，而收益与 D4-a 相同 |
| D4-c | 只抽策略，不动编排 | 不推荐：5271 行的问题原样保留 |

前置护栏：先冻结 16 个操作的 contract snapshot（request/result、artifact schema、
错误、幂等、exit code）。任何 JSON 形态变化都视为破坏性变更。

### D5 Server 按域注册路由

无实质性分歧，直接做：`routes/learning.ts`、`routes/reference.ts`、`routes/local-data.ts`，
外加 `transport.ts` 承载 origin/loopback 策略、错误映射与统一输入校验。
`server.ts` 只负责安装。**明确不做一文件一路由**——那只是把导航成本换个地方。

顺带修掉 `docs/72` 记录的 B-09/B-08：输入校验与错误信封在 `transport.ts` 里统一，
不再每条路由各写一遍。

### D6 contracts 内部拆分

保持单包单出口，内部按 `reference.ts` / `learning.ts` / `judge.ts` / `events.ts` / `transport.ts` 分组，
`index.ts` 重导出。**零调用方改动**，这是纯局部性收益。放在 D4 之后做，避免与 Authoring 拆分互相干扰。

### D7 Web 工作流拆分

从 `App.tsx` 抽 `useNavigation`、`useDashboard`、`useReferenceCatalog`、`useBackupRestore`，
从 `LessonWorkspace.tsx` 抽编辑会话状态。App 只保留路由选择。
不做纯传参 wrapper。这项收益中等，放在最后。

## 4. 推荐执行顺序与验收

每个切片独立提交、独立可回滚，各自跑 `npm run check`，涉及 UI/路由时加跑对应 E2E。

| # | 切片 | 门禁 | 完成标准 |
|---|---|---|---|
| 1 | 新建 `packages/composition`，Server 与 CLI 改用 | `npm run check` + `./cpplearn serve` 与 `npm run dev` 手工验证 | CLI 不再依赖 `@cpp-learn/server` 包 |
| 2 | 新建 `packages/reference-presentation`，Web 与 CLI 共用，删除 `packages/ui` | `npm run check` + Reference E2E + 生产 E2E | CLI 不再依赖 `@cpp-learn/web`；在线文章与静态预览一致 |
| 3 | 新建 `packages/reference-policy`，先加特征测试再迁移 checker | `check:reference-quality` 输出等价、`npm test` | 质量基线无变化；旧字符串表不再是并行权威 |
| 4 | 迁移 authoring 的 scaffold 与 repair 到 policy | `npm test`、`npm run check` | 已知可修 finding 一定能生成修复目标 |
| 5 | 删除重复策略映射 | `npm run check` | 全仓只剩一处策略定义 |
| 6 | 冻结 16 操作 contract snapshot | `npm test` | 快照测试能拦住 request/result/exit code 变化 |
| 7 | 按生命周期拆 Authoring 内部 | `npm run check` | `index.ts` 降到门面规模；快照测试不变 |
| 8 | Server 路由分域 + 统一 transport 校验 | `npm run check` + E2E | 路由行为不变；错误信封统一 |
| 9 | contracts 内部拆分 | `npm run check` | 公共导入路径不变 |
| 10 | Web 工作流拆分 | `npm run check` + E2E | direct URL、history、dirty 状态、390px 行为不变 |

第 1、2 切片合起来约一天，可先做并立即收获解耦效果。
第 6、7 切片是最大的一块，建议单独安排。

## 5. 明确不做的重构

- **不引微服务、不拆多仓库、不引远程数据库**：当前是本地单用户产品，拆部署单元只增加成本。
- **不按 `docs/67` A-06 重组 `docs/` 目录**：会产生大量链接改动，对开发效率无任何提升。
  文档真正的问题已在 `docs/72` 逐条修正。
- **不把 contracts 或 authoring 拆成多个 workspace 包**：包数量不等于模块深度。
- **不为"文件大"而机械拆文件**：每个切片的目标是"一个变更原因落在一个模块内"，
  而不是行数下降。拆完如果理解成本没降，就是拆错了。
- **不在重构中改变教学内容、判题语义或学习者数据结构**。

## 6. 需要所有者审计的决策

1. 主干选 A → B（推荐）、只做 A、还是直接做 C。
2. D2 是新建 `packages/reference-presentation`（推荐）还是复用 `packages/ui` 名号。
3. `packages/ui` 是否删除（推荐删除）。
4. 是否接受新增 `packages/composition` 与 `packages/reference-policy` 两个包。
5. 第 1、2 切片是否可以先开工——它们不触碰 5271 行的 Authoring，风险最低。

## 7. 执行记录

### 切片 1：`packages/composition`（已完成）

执行时发现范围比原估计大：`./cpplearn serve` 必须自己构建 HTTP 服务器，因此仅下沉
"组合根"不足以切断 CLI → Server app 的依赖，**HTTP 适配器与服务端配置必须一起下沉**。
最终 `packages/composition` 承载三件事，内部按文件分开：

| 文件 | 职责 | 原位置 |
|---|---|---|
| `src/config.ts` | 环境变量 → 监听地址与存储路径 | `apps/server/src/config.ts` |
| `src/application.ts` | 领域模块装配（platform / reference / playground / archive） | `apps/server/src/composition.ts` |
| `src/server.ts` | Fastify 路由、SSE、错误映射、Playground 准入 | `apps/server/src/server.ts` |
| `src/index.ts` | 公共导出面 | 新增 |

三份测试随实现一起移动（`config.test.ts`、`application.test.ts`、`server.test.ts`），
`apps/server` 只剩 `index.ts` 与 `e2e-index.ts` 两个进程入口，且不再导出任何模块接口。

顺带修掉 `docs/72` I-08：`./cpplearn serve` 现在读取 `CPP_LEARN_HOST`/`CPP_LEARN_PORT`/
`CPP_LEARN_DATA_ROOT`/`CPP_LEARN_WORKSPACE_ROOT`，不再硬编码 `127.0.0.1:4173`。

依赖变化：

```text
修改前：cli → server（app 间依赖）、server → 7 个领域模块
修改后：cli → composition、server → composition、composition → 7 个领域模块
```

验证：`npm run typecheck` 通过、`npm test` 36 文件 / 351 测试全过、
`npm run check` exit 0、`./cpplearn doctor --json` 正常、两条 E2E 套件通过。

**遗留**：`packages/composition` 同时承载"领域装配"与"HTTP transport"，目前只靠文件分界。
第 8 切片（按领域拆路由组 + 统一 transport 校验）会把它进一步内部深化；若届时分界
仍不清晰，再考虑把 HTTP 适配器拆成独立包。

### 切片 2：`packages/reference-presentation`（已完成）

新增 `packages/reference-presentation`，并把 Reference 的**语义**集中到该包：

| 文件 | 职责 |
|---|---|
| `src/types.ts` | 框架无关的文章块模型（`ArticleBlock` / `ArticleInline` / 表格对齐） |
| `src/markdown.ts` | `mdast` + GFM 解析为块模型；`headingId` 与 `articleHeadings` |
| `src/links.ts` | Entry / 搜索链接构造（原在 `apps/web/src/reference-location.ts`） |
| `src/html.ts` | 块模型 → 独立 HTML 文档（供 CLI 预览） |

关键设计：**Web 与 CLI 共用同一份块模型与同一套 heading id**，只有叶子序列化不同
（React 元素 vs HTML 字符串）。这消除了"两份 renderer 各自解释 Markdown"的漂移风险，
而 `docs/67` A-03 原本只要求把 Web 的 renderer 搬给 CLI 用。

改动：

- `apps/web/src/ReferenceArticle.tsx` 不再使用 `react-markdown`，改为渲染共享块模型；
  `articleHeadings` 改从包导入。
- 删除 `apps/web/src/reference-preview.tsx` 与 `reference-preview.test.ts`，
  `@cpp-learn/web` 不再导出任何子路径。
- `apps/cli/src/reference-author-preview.ts` 改用 `renderArticleDocument`；
  **不再加载 React / react-dom**。
- 删除空壳 `packages/ui`。
- `vitest.config.ts` 的 include 扩展为 `*.test.{ts,tsx}`，以容纳 React 组件测试。

新增护栏：

1. `markdown.test.ts` 用全部 120 份真实 `content.md` 解析，断言 **unsupported 节点为 0**
   ——模型不可能静默丢内容。
2. `apps/web/src/reference-article.parity.test.tsx` 用同一份富 fixture 分别走 React 与
   HTML 两条路径，断言 **heading id、表格单元格、代码块、可见文本完全一致**。
   这条测试在本次实现中立刻抓到了一个真实缺陷（`h2` 被错误映射为三级标题）。

依赖变化：

```text
修改前：cli → web（app 间依赖，运行时加载 React + react-dom/server）
修改后：cli → reference-presentation、web → reference-presentation
```

**至此应用之间不再存在任何依赖**，`apps/*` 只依赖包与领域模块。

验证：`npm test` 38 文件 / 363 测试全过、`npm run check` exit 0、两条 E2E 套件通过。

**遗留**：CLI 预览仍需按路径读取 Web Adapter 的 `styles.css` 与 `mdn-theme.css`
（`apps/cli/src/reference-author-preview.ts` 顶部有说明）。这是**构建资产引用，不是代码依赖**
——不加载任何 Web 模块。彻底去除需要把 Reference 相关样式从 2985 行的应用样式表中拆出，
单独作为切片的收益不足，暂不处理。

### 切片 3–5：统一 Reference content policy（已完成）

新增 `packages/reference-policy`，Reference 内容策略从此只有一处定义：

| 文件 | 职责 |
|---|---|
| `src/areas.ts` | 语义区域清单、展示顺序、标题匹配器（含反向查询）、每种 Entry kind 的要求 |
| `src/evaluate.ts` | 纯函数评测：给定 Entry 内容与元数据，返回缺失区域 |
| `src/repair-targets.ts` | 各区域可用于修复的规范标题 |

迁移：

- `scripts/reference-content-quality.ts` 只保留目录级审计与基线读写，规则全部委托给包；
  原 `headingPatterns` / `areaOrder` / `commonSemanticAreas` / `auditHeader` 已删除。
- `modules/reference-authoring/src/repair.ts` 的 `AREA_HEADINGS` 已删除，改用包的
  `REPAIR_HEADINGS_BY_AREA`。
- `apps/cli/src/reference-author.ts` 不再从 `../../../scripts/` 导入 —— **应用不再引用脚本目录**。

**等价性证据**（切片 3 的要求）：迁移前后 `npm run check:reference-quality` 输出逐字相同
（`116/120 entries audited, 0 reviewed gaps, no regressions`），且 415 行的既有质量测试套件
与 619 行的 repair 套件均未修改即通过。

**契约测试抓到的两个真实缺陷**。切片 4 先写契约测试（`policy-contract.test.ts`）再迁移，
它当场暴露了文档 `docs/67` A-01 只以"A7 阶段曾漏接 Header finding"描述的那类问题：

1. `direct-include` 与 `facility-map` 是必需区域、也有修复标题，但匹配器根本没有这两个区域的
   模式（`HEADING_PATTERNS[area]` 为 `undefined`）。区域的"查找标题"正则此前只存在于 checker
   的专用分支里，从未被暴露成策略。已把这两个正则提升为正式区域模式。
2. `interface` 的修复候选里含 `快速信息` 与 `类型与所有权`，但匹配器都不接受这两个标题。
   后果是：对 `type` 条目修复 `interface` finding 时会写 `快速信息`（实体 profile 里
   `声明与重载` 不在 requiredHeadings 中，于是回退到第二个候选），而 checker 把
   `快速信息` 读作 quick-info —— **修复写完，finding 依旧存在，三轮预算白烧**。
   已把 `类型与所有权` 正式登记为 entity profile 的 interface 标题，并从候选里移除
   `快速信息`。真实 120 条结果不受影响（添加别名只会减少 finding，而当前本就是 0）。

新增护栏：

1. `policy-contract.test.ts`：修复标题必须被匹配器接受；每个必需区域必须有修复标题。
2. `repair.test.ts` 的 `[T-REF-014]`：端到端跑 repair planner，断言它计划写出的每个
   heading 都满足共享策略 —— 上面第 2 个缺陷正是这条测试所防的形态。

验证：`npm test` 39 文件 / 366 测试全过、`npm run check` exit 0、`check:reference-quality`
输出与基线逐字一致。

**遗留**：`modules/reference-authoring` 仍保留 `PROFILE_DEFINITIONS.headings`（脚手架生成的
小节顺序与展示名）与 `SECTION_FACT_KINDS`（小节 → 事实种类）。它们不是 checker 策略的副本，
而是脚手架模板词汇；在本次别名修正后，profile 的每个标题都已被策略匹配器接受。把二者进一步
合并会改变 scaffold 的生成产物，收益不足，暂不处理。

### 切片 6：冻结 16 操作契约快照（已完成）

在拆分 5271 行实现之前，先把"对外不能变的东西"钉死，共两个快照测试：

| 测试 | 钉住的内容 |
|---|---|
| `modules/reference-authoring/src/contract-snapshot.test.ts` | 16 个操作名集合与可调用性；22 个工件 Schema 的 `$id` 全量列表（递归扫描 `src/`，因此 Schema 即使换目录也不会漏检） |
| `apps/cli/src/reference-author-cli.contract.test.ts` | 13 个 CLI 子命令；未知子命令必须返回 exit 2 而不是猜测 |

Schema `$id` 是磁盘契约的一部分：早期版本已经写出的草稿、缓存与收据都引用它，所以它必须被显式
钉住，而不是靠"没人会改"的假设。

验证：`npm test` 41 文件 / 373 测试全过、`npm run check` exit 0、两条 E2E 套件通过（18 + 1）。

### 切片 7：按生命周期拆分 Authoring 实现（已完成，门面仍保留）

`modules/reference-authoring` 原本已经有 `batch.ts`、`generation.ts`、`run.ts`、`research.ts`、
`repair.ts`、`publisher.ts`、`cache.ts` 等兄弟模块；缺的是 **Draft、Validation 与 Entry review**
三段，以及一个把 5271 行都装进去的 `index.ts`。

本次在契约快照护栏下再抽 5 个模块：

| 新文件 | 行数 | 生命周期职责 |
|---|---:|---|
| `validation.ts` | 236 | 工件 Schema 校验：Ajv 实例、22 个 Schema 的编译与 `validateAuthoring*` |
| `profiles.ts` | 152 | Entry kind profile：脚手架小节顺序、事实种类、示例数量与内容模板 |
| `digest.ts` | 52 | 草稿输入摘要：只让作者输入参与，排除生成物 |
| `draft.ts` | 250 | 草稿生命周期：目标路径、manifest、starter、目录提案、内存仓储 |
| `gates.ts` | 861 | Entry 评审：生成物校验、事实覆盖、来源对齐、内容 profile、Entry 身份、图谱影响、示例编译、事实复用、新鲜度物化 |

`index.ts`：**5271 → 3924 行（−26%）**。抽取全部是机械移动：新模块以 `import type` 反向引用
`index.ts`（类型导入在运行时被擦除，因此不产生运行时环），每个模块都是参数驱动的，不闭包
facade 状态。

抽取过程中被契约快照与既有测试拦下并修正的问题（都属于"移动时顺手带走/漏带"的机械失误，
不是行为变更）：`jsonFile` 与 `AuthoringCatalogProposal` 被误移、若干导出未重新导出、
`AuthoringFinding` 的类型归属。这些都说明**先有快照再拆**是必要的——没有它，`authoringInputDigest`
从 `./index.js` 消失这类问题会一路漏到 CLI。

**仍然保留在 `index.ts` 的部分**：`createReferenceAuthoring` 的 16 个方法目前是一个约 2200 行的
对象字面量，只共享 `clock` 与 `applyGeneratedContent` 两个闭包变量。把它们移出去需要引入一个
显式 context 对象并确定方法之间是否互相调用——这是**设计变更而不是机械移动**，风险与前 5 个模块
不同量级。建议作为独立切片，先测出方法间调用关系再决定拆分边界。

验证：`npm test` 41 文件 / 373 测试全过、`npm run check` exit 0、两条 E2E 套件通过（18 + 1）、
契约快照（16 操作 / 22 Schema `$id` / 13 CLI 子命令）全部通过。

### 切片 8：HTTP Adapter 按领域分域（已完成）

`packages/composition/src/server.ts` **903 → 97 行**。拆成 1 个策略模块 + 4 个路由组：

| 新文件 | 行数 | 职责 |
|---|---:|---|
| `transport.ts` | 130 | 共享 transport 策略：origin/loopback 校验、请求体守卫、字节预算常量、Playground 快照 |
| `routes/learning.ts` | 266 | 目录查询、Activity、Workspace、Run/Grade、提示、反思、学习记录读模型 |
| `routes/reference.ts` | 293 | Reference 浏览与 Playground（准入计数与活动运行表是模块内私有状态） |
| `routes/local-data.ts` | 197 | Teacher Pack、Teacher Observation、导出与恢复 |
| `routes/jobs.ts` | 82 | 作业状态、取消、事件流 |

`server.ts` 现在只做：构建 Fastify、挂静态资源、定义 `referenceReadiness`/`readyReference`、
按序安装四个路由组。

**关键设计**：Playground 的并发计数与活动运行表移入 `routes/reference.ts` 作为模块私有状态——
第二个路由组不可能再启动不受限的本地编译。origin 校验与请求体守卫全部来自 `transport.ts`，
不再每条路由各写一份。

验证：`packages/composition` 27 测试全过（含 21 条真实 Fastify 注入的 server 测试）、
`npm run check` exit 0、两条 E2E 套件通过。

### 切片 9：contracts 内部按域拆分（已完成）

`packages/contracts/src/index.ts` **956 → 483 行**，内部拆为三个域文件，包入口不变：

| 新文件 | 行数 | 域 |
|---|---:|---|
| `reference.ts` | 211 | Entry 形状、搜索、导航、就绪度、Playground DTO |
| `judge.ts` | 151 | 判定、阶段报告、结构化 Judge Report |
| `events.ts` | 139 | 追加式 Learning Record 事件联合 |

`index.ts` 用 `export *` 重导出三者，其余（bootstrap 信封、Curriculum/Activity、命令与查询）
留在入口。

**等价性证据**：拆分前后把全部 `export` 声明名排序对比，**集合完全一致**
（`diff` 无输出）。包内跨域引用只有 `import type`（类型位置），运行时无环。

验证：`npm test` 41 文件 / 373 测试全过、`npm run check` exit 0、两条 E2E 套件通过。

### 切片 10：Web 工作流拆分（已完成）

采用**方案 1 + 4**（视图组件化 + 编辑器/执行工作流），目录按工作流划分。这两个文件是整个仓库里
E2E 覆盖最密的区域，因此拆分前先确认护栏：窄屏无溢出、history 保护未保存代码、陈旧响应不能
覆盖当前工作区、键盘导航、项目证据页、格式化与重置。

**`App.tsx` 1097 → 26 行**，只剩 `/reference` 分支与两个 lazy 导入；`LearningApp` 迁入
`dashboard/`，展示区块拆为独立组件：

| 新文件 | 行数 | 职责 |
|---|---:|---|
| `dashboard/LearningApp.tsx` | 518 | 状态、4 个查询 effect、URL/history 同步、备份恢复、组合渲染 |
| `dashboard/CatalogSection.tsx` | 134 | 目录列表与筛选 |
| `dashboard/ProjectsSection.tsx` | 132 | 作品集项目与里程碑 |
| `dashboard/RecordsSection.tsx` | 107 | 学习记录与继续学习入口 |
| `dashboard/navigation.ts` | 74 | URL/history 纯函数（filter、activity、section、history state 编码） |
| `dashboard/StageBanner.tsx` | 63 | 当前阶段与下一步动作 |
| `dashboard/ReviewsSection.tsx` | 51 | 延迟复习队列 |
| `dashboard/EnvironmentSection.tsx` | 51 | 工程环境就绪度 |
| `dashboard/KnowledgeMap.tsx` | 34 | 概念图谱 |
| `dashboard/StatusCard.tsx` | 34 | 就绪度卡片 |
| `dashboard/Topbar.tsx` | 23 | 顶部状态条 |
| `dashboard/format.ts`、`types.ts`、`Footer.tsx` | 26 | 共享格式化、视图类型、页脚 |

**`LessonWorkspace.tsx` 749 → 507 行**：

| 新文件 | 行数 | 职责 |
|---|---:|---|
| `lesson/useEditorSession.ts` | 183 | 编辑器会话：活动文件、缓冲区、dirty 判定、beforeunload 保护、格式化与重置 |
| `lesson/useActivityExecution.ts` | 137 | 保存 / Run / Grade / 取消工作流与在途状态 |
| `lesson/InteractiveBlock.tsx` | 104 | 交互式课程块逐步演示 |
| `lesson/command-id.ts` | 10 | 幂等命令 ID |

**拆分中的三个设计判断：**

1. **`persist` 归入执行工作流而非保存工作流**：Run 与 Grade 必须判题判的是已保存内容，
   "脏缓冲区先落盘"属于执行语义。这条写进了 `useActivityExecution` 的文件头。
2. **`load` / `clear` / `markClean` 用 `useCallback` 保持引用稳定**：工作区加载 effect 原本的
   依赖数组是 `[activityId, onDirtyChange]`；若 hook 每次渲染返回新函数，该 effect 会在每次渲染
   重新拉取数据，直接冲击 `T-UI-003`（陈旧响应不能覆盖当前工作区）。回调经 ref 承接，
   依赖数组只增加了两个恒定函数。
3. **格式化与重置只改浏览器缓冲区**，从不直接触网 —— 与 `docs/03` "Save、Run 或 Grade
   才持久化" 一致。

**保真性证据**（比"测试通过"更强的检查）：把拆分前 `App.tsx` 与拆分后 `dashboard/` 全部文件的
`className` 与 `id` 取集合对比 —— **68 个 className 与全部 id，零丢失**。说明区块是被搬运
而不是被重写。

验证：`npm test` 41 文件 / 373 测试全过、`npm run check` exit 0、两条 E2E 套件通过。

**遗留**：`LearningApp.tsx` 仍有 518 行，其中 4 个并发查询与备份/恢复工作流仍与视图组合放在
一起。若要继续降到约 150 行的壳，需要抽出 `useDashboardQueries` 与 `useBackupRestore`
（即方案 2）—— 那会重排 effect 顺序，属于设计方案变更，建议单独一轮。

### 切片 11：Dashboard 工作流 Hook 化（已完成）

方案 2。`dashboard/LearningApp.tsx` **518 → 234 行**（相对最初的 1097 行降 79%），四个新 hook：

| 新文件 | 行数 | 职责 |
|---|---:|---|
| `dashboard/useDashboardNavigation.ts` | 197 | 工作区活动、目录筛选、当前区块；4 个 history ref；打开/关闭/脏确认回调；popstate 与 hashchange 两个 effect |
| `dashboard/useDashboardView.ts` | 109 | 视图模型：当前活动序号、上一/下一节、已练概念数、目录计数、筛选后的活动、项目分组 |
| `dashboard/useDashboardQueries.ts` | 92 | 5 个读模型、错误状态、`refresh`，以及只重读学习记录的 `refreshLearningRecord` |
| `dashboard/useBackupRestore.ts` | 55 | 备份导出（纯浏览器 Blob 下载）与恢复（先确认再覆盖） |

**关于"约 150 行的壳"这个目标**：实际停在 234 行。剩下的 234 行里约 140 行是组合 12 个子组件的
JSX（sidebar 与 main 的布局），约 85 行是 hook 装配与 `BrandMark`。再往下拆只能把 JSX 搬到
另一个文件，总复杂度不变 —— 所以**没有继续**，这是一个诚实的下限而不是未完成。

**三个保行为的判断：**

1. **5 个查询保持一起取**：它们同屏渲染，混用新目录与旧学习记录比"整屏等到齐"更糟。这条写进
   `useDashboardQueries` 的文件头。
2. **`refreshLearningRecord` 是新增的窄接口，不是复用 `refresh`**：Grade 记录证据后原本只重读
   dashboard/progress/reviews 三项；若直接调 `refresh` 会连 bootstrap 与 catalog 一起重取，
   属于行为变化。这里刻意只暴露它实际需要的那一项。
3. **history 是唯一事实来源**：`useDashboardNavigation` 保留了 4 个 ref，用来区分"学习者导航了"
   与"我们替学习者导航了" —— 这正是 `T-UI-002`（history 保护未保存代码）的语义。ref 与 effect
   原样搬运，未重排顺序。

验证：`npm test` 41 文件 / 373 测试全过、`npm run check` exit 0、两条 E2E 套件通过（18 + 1）。

### 切片 12：Authoring 门面拆分（已测出调用图，待实施）

`modules/reference-authoring/src/index.ts` 中 `createReferenceAuthoring` 的 16 个方法是一个
**2506 行**的对象字面量（文件中 1321–3827 行）。它只共享两个闭包变量（`clock` 与
`applyGeneratedContent`）。

**已完成的前置测量**：静态扫出方法之间的调用图，结果是**它们确实互调，但只有 7 条边**：

| 调用方 | 被调方 |
|---|---|
| `advanceRepair` | `buildGenerationTemplate` |
| `advanceBatch` | `advanceRun` |
| `advanceRun` | `buildGenerationTemplate` |
| `applyGenerationBundle` | `applyGeneratedSection`、`applyGeneratedSummary`、`applyGeneratedExample` |
| `buildGenerationTemplate` | `buildContext` |
| `reviewGeneratedClaims` | `buildContext` |

结论：**16 个方法里有 10 个没有任何出口调用**，依赖是一张浅 DAG，汇聚到三个能力根 ——
`buildContext`、`buildGenerationTemplate`，以及三个 `applyGenerated*`。

因此拆法应当是：定义一个窄的 `AuthoringCapabilities`（只含上述 6 个被依赖的操作），
每个方法移出为 `createXOperation(context)`，只声明它真正需要的 capability；
`createReferenceAuthoring` 退化为装配点与 16 操作门面。

**这是设计变更而非机械移动**，但因为有契约快照（切片 6）与 373 条测试兜底，风险可控。

#### 已完成的第一个簇：生成应用

按上面的调用图，先抽出了**最自包含的一簇**：`applyGenerationBundle` 及其依赖的三个
`applyGenerated*`，共 4 个操作，连同它们共享的 `applyGeneratedContent` 管线。

新文件 `modules/reference-authoring/src/operations/generation-apply.ts`（923 行），
`index.ts` 从 3924 行降到 **3109 行（−21%）**。

装配方式是本切片的核心决定：

```ts
const generationApply = createGenerationApplyOperations({
  drafts: dependencies.drafts,
  examples: dependencies.examples,
  cache: dependencies.cache,
  clock,
  // 惰性解析：reviewGeneratedClaims 是门面上的兄弟操作
  reviewGeneratedClaims: (request) => authoring.reviewGeneratedClaims(request),
});

const authoring: ReferenceAuthoring = { ...generationApply, /* 其余 12 个操作 */ };
```

`reviewGeneratedClaims` 通过**闭包惰性解析** —— 该箭头在装配时不会被调用，因此 `authoring`
的 TDZ 不构成问题。这比把 capability 对象改成可变 holder 更简洁，也不需要重排装配顺序。

**搬迁过程中被 typecheck 抓到的三件事**（都属于"对象方法变成独立函数后失去上下文类型"）：

1. `request` 参数失去上下文类型 → 需要显式标注（`unknown` / `ApplyGenerated*Request`）。
2. 返回类型不再被 `ReferenceAuthoring` 约束，`ok: false` 被拓宽成 `boolean` → 需要显式
   `Promise<ApplyGenerated*Result>`。
3. `applyGeneratedContent` 实际还依赖 `examples` 与 `cache` 两个能力，以及 `PROFILE_DEFINITIONS`、
   `jsonFile`、`exampleTemplate`、`sameFactGroupAllowlist` 等模块 —— 前者是测量时的漏项，
   后者说明这一簇比调用图显示的更宽。

另外把两个只被该簇使用的声明（`GeneratedContentMutation`、`generatedRequestFailure`）
随代码一起搬走，并把 `ApplyGeneratedContentSuccess` / `ApplyGeneratedContentFailureCode`
改为导出。

验证：`npm test` 41 文件 / 373 测试全过（含 117 条 authoring 测试与契约快照）、
`npm run check` exit 0、两条 E2E 套件通过。

**剩余**：另外 12 个操作仍在 `index.ts` 中，可继续按同样的 capability 模式逐簇搬迁
（建议顺序：`buildContext` 簇 → `run/batch` 簇 → `repair` 簇 → `prepare`/`check`/`publish`）。

#### 全部 16 个操作已完成搬迁

按上面的顺序把剩下 12 个操作全部迁出。`index.ts` **5271 → 994 行**，其中门面退化为纯装配：

```ts
const authoring: ReferenceAuthoring = {
  ...draftLifecycleOps,
  ...researchMeasureOps,
  ...repairOps,
  ...runBatchOps,
  ...contextOps,
  ...generationApply,
};
```

`operations/` 下 6 个模块：

| 文件 | 行数 | 操作 | capability |
|---|---:|---|---|
| `operations/draft-lifecycle.ts` | 891 | `prepare`、`check`、`publish` | 无（只依赖 drafts/catalog/cache/examples/quality/publisher/clock） |
| `operations/generation-apply.ts` | 913 | `applyGenerationBundle`、三个 `applyGenerated*` | `reviewGeneratedClaims` |
| `operations/context.ts` | 564 | `buildContext`、`buildGenerationTemplate`、`reviewGeneratedClaims` | 无（三者互相调用，模块内解析） |
| `operations/repair.ts` | 422 | `buildRepairPlan`、`advanceRepair` | `buildGenerationTemplate` |
| `operations/research-measure.ts` | 401 | `proposeSourceFacts`、`measureBatch` | 无 |
| `operations/run-batch.ts` | 146 | `advanceRun`、`advanceBatch` | `buildGenerationTemplate` |

装配顺序即依赖顺序：`contextOps` 先建，随后 `runBatchOps` / `repairOps` 直接取用它的
`buildGenerationTemplate`，无需惰性回调；只有 `generationApply` 因为要调 `reviewGeneratedClaims`
（与它同在 `contextOps`，但装配顺序在后）而使用惰性闭包。

**搬迁中反复出现的三类问题**（都是"对象方法变成独立函数"的固有代价，全部由 typecheck 拦下）：

1. **参数与返回类型必须显式写**。对象方法从 `ReferenceAuthoring` 接口获得上下文类型；独立函数
   没有，`ok: false` 会被拓宽成 `boolean`，`request` 会退化成隐式 `any`。
2. **依赖面比调用图显示的大得多**。静态调用图只给出**下界**：`buildContext` 的调用图显示只依赖
   `drafts`，实际还需要 `PROFILE_DEFINITIONS`、`jsonFile`、`exampleTemplate`、
   `sameFactGroupAllowlist`、`validateFact*` 等十来个符号。每次都要靠编译器补全。
3. **私有声明要跟着走或补导出**。`GeneratedContentMutation`、`generatedRequestFailure`、
   `applyPreparedFactReuse`、`AuthoringGenerationDraft` 都只被搬迁代码使用；其中
   `AuthoringFinding` 反过来必须继续从 `index.ts` 导出，因为 `repair.ts` 与测试从那里导入它。

另有一个真实缺陷被搬迁过程暴露：`applyGeneratedContent` 依赖 `dependencies.examples` 与
`dependencies.cache`，而最初的调用图测量遗漏了这两个能力。

验证：`npm test` 41 文件 / 373 测试全过、**16 操作契约快照通过**、22 个 Schema `$id` 逐字未变、
`npm run check` exit 0、两条 E2E 套件通过（18 + 1）。



