# 详细设计

| Field | Value |
|---|---|
| Document ID | DD-001 |
| Version | 3.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 代码布局

```text
apps/
  web/                 React/Vite 学习与 Reference 适配器
  server/              Fastify HTTP 适配器和生产组合根
  cli/                 学习 CLI 与 Reference Authoring CLI
modules/
  learning-platform/   学习规则和跨模块编排
  curriculum/          课程加载、验证和私有判题合成
  workspace/           学习者文件、revision 和快照
  judge/               C++ 编译、运行、测试与报告
  learning-record/     事件与可重建投影
  reference/           Reference 激活、搜索、导航与查询
  reference-authoring/ 草稿、事实、生成、检查、修复和发布
packages/
  contracts/           版本化命令、查询、DTO 与事件
  content-schema/      Curriculum JSON Schema
  reference-schema/    Reference JSON Schema
  ui/                  当前为空的预留包
curriculum/            生产课程内容
reference/             生产 Reference 内容和质量基线
judge-private/         Server-only 私有判题注册表
```

生产内容目录是 `reference/`，不是旧文档中曾出现的 `reference-content/`。运行时学习数据默认位于 `.cpp-learn/`，不是根目录的早期 `student-workspaces/` 设计名称。

## 2. Learning Platform

### 2.1 公共接口

```ts
interface LearningPlatform {
  dispatch<C extends LearningCommand>(
    command: C,
  ): Promise<CommandResultFor<C>>;
  query<Q extends LearningQuery>(query: Q): Promise<QueryResultFor<Q>>;
  events(jobId: JobId): AsyncIterable<PlatformEvent>;
}
```

`dispatch` 是改变学习状态的唯一主入口，`query` 不得产生副作用，`events` 为单个 Job 提供有序事件流。相同幂等标识的成功命令不得重复追加事件。

### 2.2 关键不变量

- Run 只产生执行结果，不改变 Concept 状态。
- Grade 依据 Activity 版本和 Evidence Policy 生成 Evidence。
- 提示、完整答案暴露和延迟复习会影响 Evidence 独立性。
- Judge Report 是不可变输入；HTTP 回调不能直接写学习证据。
- Session 选择、复习到期和 Concept 转换必须可解释、可重放。

## 3. Curriculum

每个 Activity 位于 `curriculum/activities/<activity-id>/`，包含 manifest、教学 Markdown、starter 和公开资源。`curriculum/catalog.json` 决定激活顺序，70 个 Activity 在启动前整体验证。

Activity 类型包括 lesson、exercise、review 与 project-milestone。它声明前置关系、Concept、预计时长、Workspace、公开 Judge 契约和 Evidence Policy。

私有测试从 `judge-private/tests.json` 单独加载，只在 Curriculum 模块内部与公开 Activity 合成。公开响应、日志、学习者导出和 Teacher Pack 都不能包含私有 oracle 或测试输入。

版本规则：文案修正可保持 Activity 版本；starter、公开测试、Project identity、Milestone 顺序或 Evidence 语义变化必须提升相应内容版本。

## 4. Workspace

Workspace 负责打开、保存、快照和差异。学习者可编辑文件与不可变 starter 基线同时返回，后者只用于浏览器中的重置，不会在 open 时覆盖现有代码。

保存请求必须携带 `baseRevision`。revision 不匹配时返回 conflict，并保持磁盘内容不变。路径必须是 manifest 允许的相对路径，拒绝绝对路径、父目录穿越、设备路径和越界符号链接。

Run 与 Grade 都基于保存后的不可变 Source Snapshot。课程升级可以增加只读支持文件，但不能静默替换学习者已经编辑的文件。

## 5. Judge

### 5.1 状态

```text
queued → preparing → compiling → testing → analyzing → completed
   └──────────────────────────────────────→ cancelled / system_error
```

终态不可逆。阶段返回结构化数据，不直接追加学习事件。

### 5.2 执行规则

- 使用参数数组启动工具，不拼接 shell 命令。
- 每个 Job 使用独立临时目录和最小环境。
- 分别限制 stdout、stderr、执行时间与并发。
- 超时或取消时终止进程组并清理临时目录。
- 记录工具链指纹、source digest、flags、exit code、signal 和截断状态。
- 编译器或运行环境缺失属于 system/toolchain 问题，不判为学习者错误。

固定 profile 包括直接 C++20 编译和 CMake/CTest 工程。受控能力可以注入 Node、Git 与 Web 前端测试 harness，但 Activity 不能传入任意可执行路径、安装命令或环境变量名。

确定性属性测试记录 seed、case index 与可重放输入。性能测试比较同机相对规模和中位数，不使用跨机器固定毫秒阈值。

### 5.3 安全界限

Native Judge 通过目录、参数、时间和输出限制降低风险，但不是容器或操作系统级强隔离。只运行本机学习者代码，不接受公网多租户执行。

## 6. Learning Record

学习记录以带 schemaVersion、事件 ID 和因果 ID 的追加事件为权威数据。启动时扫描到最后一个有效事件；不完整尾部需隔离，再从事件重建投影。

投影覆盖 Dashboard、当前 Activity、Workspace revision、Concept/Evidence、Review Queue、Attempts、Hints、Projects 与幂等回执。投影是可丢弃缓存，迁移失败时应重建而不是修改历史事件。

导出包含学习者拥有的工作区、事件与反思，不包含 Curriculum 私有判题定义。恢复必须先验证归档结构和版本，再以可回滚方式安装。

## 7. Reference

### 7.1 公共接口

```ts
interface ReferenceCatalog {
  readiness(): Promise<ReferenceReadiness>;
  getEntry(entryId: string): Promise<ReferenceEntryDetail | undefined>;
  resolveSlug(slug: string): Promise<ReferenceSlugResolution | undefined>;
  search(query: ReferenceSearchQuery): Promise<ReferenceSearchResult>;
  getNavigation(): Promise<ReferenceNavigation>;
}
```

`reference/catalog.json` 与 120 个 `entry.json`、`content.md`、示例文件组成声明式目录。激活时验证 ID、slug、类别、关系、来源、Markdown 路径、示例和 Activity 反向链接，再原子发布内存索引。

搜索索引覆盖 ID、symbol、header、title、alias、category、heading 和正文 token。精确 symbol、header、ID、alias 与 title 的权重高于前缀、标题、类别和正文；相同分数使用确定性排序。

历史 slug 先解析到稳定 Entry ID，再返回 canonical slug。重定向不能形成链或环。标准版本用可用区间表达，deprecated 与 removed 分开表示。

Markdown 通过 React Markdown 与 GFM 安全呈现。内容不支持任意 HTML、MDX 或脚本。表格、代码块、锚点与内部链接必须同时经过内容检查和浏览器测试。

### 7.2 Playground

可运行示例接受编辑后的 source，但标准、stdin 和示例身份来自已发布 manifest。浏览器先创建唯一 run ID，Server 再登记取消控制器和并发名额。

Playground 默认只允许一个本地执行。重复活跃 ID 返回 conflict，繁忙返回 429，取消请求中止对应 Runner。无论成功、编译失败、超时还是取消，都不得写入学习记录。

## 8. Reference Authoring

### 8.1 当前接口事实

最初的 prepare/check/publish 深模块已经扩展为 16 个兼容操作，覆盖 repair、batch、run、research、context、generation、review、measure 和发布生命周期。

当前 `ReferenceAuthoring` 门面包含：

```text
advanceRepair          advanceBatch          advanceRun
proposeSourceFacts     buildContext          buildRepairPlan
buildGenerationTemplate                    measureBatch
reviewGeneratedClaims  applyGenerationBundle
applyGeneratedSection  applyGeneratedSummary
applyGeneratedExample  prepare  check  publish
```

CLI 面向用户的命令包括 prepare、context、template、research、repair-plan、repair、batch、run、apply-generation、measure、check、preview 和 publish。CLI 只负责参数、文件输入和呈现，不拥有正确性规则。

### 8.2 草稿模型

每个 draft 位于 `.cpp-learn/authoring/<draft-id>/`，主要工件包括：

| 工件 | 责任 |
|---|---|
| `draft.json` | 身份、kind、revision、目标与状态 |
| `facts.json` | signature、参数、返回、错误、复杂度、生命周期等事实组 |
| `sources.json` | 来源类别、URL、验证日期与事实映射 |
| `entry.json` | 候选 Reference manifest |
| `content.md` | 项目原创教学正文 |
| `examples/*.cpp` | 最小与真实场景示例 |
| `report.json` | hard failure、warning、review queue 和 digest |
| `repair/*.json` | 固定预算、版本绑定的修复尝试证据 |

filesystem draft repository 使用 revision 与完整文件快照做 compare-and-swap。相同 Entry ID 的并发 prepare 只能恢复同一目标或返回 conflict，不能覆盖已有保留。

### 8.3 生成与事实边界

AI Adapter 接受 provider-neutral JSON，不保存模型密钥，也不把供应商协议放入领域模块。上下文由当前 draft、profile、Fact Sheet、Source Ledger 和邻近已发布页面重建。

每个生成 claim 必须映射到允许的事实组。超出 context allowlist 的事实进入 unverified queue，不能满足 publish gate。示例还必须经过真实编译与预期结果检查。

`sources.json` 保存引用、分类和作者笔记，不保存整页镜像。cppreference、标准草案和官方库文档用于事实核验与覆盖参考，最终解释性文字必须由本项目原创。

### 8.4 检查、修复与发布

check 组合 Schema、路径、来源、事实覆盖、profile、关系、slug、Markdown、质量和示例验证。hard failure 阻止发布；warning 进入按风险排序的人审队列。

示例缓存 key 包含编译器指纹、标准 flag、规则版本、source、stdin 与 expected outcome。任何相关输入变化都使缓存失效。

repair plan 只把受支持的确定性 finding 转成有限目标，固定最多三次尝试。重命名 repair ID 不能重置预算，应用修复仍需经过事实、claim、编译、revision 和 receipt 检查。

publish 绑定 draft revision、作者输入摘要、检查报告与 canonical target 摘要。它先在 sibling tree 中验证完整 Reference，再原子交换并支持回滚；Git commit 与发布验收仍由维护者显式完成。

### 8.5 当前设计债务

16 操作兼容门面和超过 5,000 行的主要实现文件降低了局部性。后续应按 Draft、Evidence、Generation、Repair/Batch、Validation/Publication 生命周期在内部拆分，同时保持外部 CLI 行为和 artifact schema 兼容。

## 9. HTTP Adapter

当前 Fastify v1 路由按能力分为：

| 路由族 | 主要能力 |
|---|---|
| `/api/v1/health`、`bootstrap` | 健康、能力与版本 |
| `/api/v1/dashboard`、`activities` | 课程导航与活动详情 |
| `/api/v1/workspaces` | 打开与 revision-aware 保存 |
| Activity `runs`、`grades` | 执行与判题 |
| `hints`、`reflections` | 学习互动 |
| `reviews`、`progress`、`concepts`、`attempts` | 学习记录查询 |
| `teacher-packs`、`teacher-observations` | 教师协作工件 |
| `jobs`、SSE events | 状态、取消与事件流 |
| `exports`、`restores` | 本地数据备份 |
| `/api/v1/reference/*` | 目录、搜索、slug、Entry 与 Playground |

HTTP 适配器负责 transport 校验、状态码、origin/loopback 策略与错误映射，不拥有学习、Reference 或判题规则。当前全部注册集中在 `apps/server/src/server.ts`，未来应按领域路由组拆分。

## 10. Web Adapter

Web 包含学习 Dashboard、Activity 工作台、Reference 浏览器与 Playground。URL 和 history 是导航状态的一部分；直接链接、前后切换、刷新和浏览器回退必须保持一致。

桌面训练页让课程内容与编辑器独立滚动；窄屏退化为无横向溢出的单栏。编辑器中的 Format 与 Reset 只改变浏览器缓冲区，Save、Run 或 Grade 才持久化。

Reference 应保持独立可加载。其不可用状态不能覆盖学习 Dashboard。Reference 文章的表格使用 GFM renderer，并在桌面与 390px 视口验证。

`App.tsx` 和 `LessonWorkspace.tsx` 当前承担多个工作流。后续应以学习者工作流为边界抽取 view model 和状态，而不是创建大量一文件一组件的浅层包装。

## 11. 配置与错误

配置优先级为 CLI flag、项目本地配置、允许列表中的环境变量、安全默认值。路径在组合根中解析一次，再作为显式依赖传给模块。

错误必须包含安全 code、correlation ID、可公开 details 与重试分类。原始进程输出不能塞入通用 internal error；学习者错误、内容错误与基础设施错误要分开。

## 12. 验证层级

- JSON Schema 和内容脚本验证声明式输入。
- Vitest 覆盖模块、适配器、契约、恢复与失败路径。
- Reference 质量基线实施 ratchet，防止已审计条目回退。
- Playwright 通过真实浏览器覆盖学习、Reference 和 Playground 主路径。
- `npm run build` 验证 TypeScript 与生产 Web 构建。
- `npm run check` 是合并前全仓门禁。

本轮详细设计由 **GPT-5.6 Sol** 依据当前代码接口和目录结构重写。
