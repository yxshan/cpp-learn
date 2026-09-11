# 文档与代码冲突审计

| Field | Value |
|---|---|
| Document ID | DOC-CODE-AUDIT-001 |
| Version | 1.1 |
| Status | In Review |
| Owner | Project Maintainer |
| Audit date | 2026-09-10 |
| Fixed point | `96f31c3` |
| Decisions recorded | 2026-09-12（§7） |
| Scope | `docs/` 下 110 份 Markdown、根目录 5 份说明文档、7 份 ADR，对照实际代码 |

> Path note: every code path cited below is the path **at the `96f31c3` fixed
> point**. The [refactoring plan](73-REFACTORING-PLAN.md) has since moved
> `apps/server/src/{server,composition,config}.ts` into
> `packages/composition/src/`, extracted `packages/reference-presentation`, and
> deleted `packages/ui`. Findings and severities are unaffected.
>
> Decisions note (2026-09-12): §7 now records the owner decisions on all seven open
> items and what was executed. Later refactors moved the legacy prototype paths into
> `docs/archive/legacy-prototype/` and added `ADR-0008`; the citations above still
> point at the `96f31c3` fixed point.

## 1. 目的与判据

本审计回答一个问题：**当前文档里哪些说法与实际代码不符，以及这些不符应该改文档还是改代码。**

判定依据沿用 [文档导航](README.md) §1 的优先级，并采纳项目所有者确认的方向：
文档描述的项目结构是**目标**，后续改进方向是「根据文档翻新项目代码架构」。

因此每条冲突必须落入以下三类之一，不允许静默择一：

| 类别 | 含义 | 处置 |
|---|---|---|
| `DOC-ERROR` | 文档对**当前代码**作了错误陈述，且没有任何证据表明它是目标设计 | 修文档 |
| `ARCH-GAP` | 文档描述的是目标结构/接口/控制，代码尚未实现 | **不改文档**；登记为代码翻新方向 |
| `STALE-META` | 状态、版本、日期、计数、标题、链接、文档间引用过期或互相矛盾 | 修文档（不改语义） |
| `UNVERIFIED` | 无法复现或无法判定 | 重测后再定性 |

本文件不对 `docs/13`–`21`、`25`–`52`、`54`–`65` 的历史 Implementation Report 追责：
它们合法地描述过去某个时间点的状态，文档导航 §6 已明确其证据地位。

## 2. 审计方法

1. 先建立代码事实基线（包结构、HTTP 路由、CLI 命令、配置键、模块接口、
   Schema、内容计数、门禁结果），全部由命令实测，不转抄文档。
2. 再把「描述当前状态」的文档逐份与基线比对，每条冲突必须同时给出
   文档位置与代码证据。
3. 对每个子任务结论做抽样复核；本文件只收录**已复核确认**的条目，
   被推翻的结论记录在 §5。

## 3. 冲突登记册

### 3.1 路径与目录命名

| ID | 类别 | 文档位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| A-01 | `DOC-ERROR` | `docs/06-DATA_DESIGN.md:19,193-196,207` | 内容根为 `reference-content/` | 实际目录是 `reference/`；`docs/04-DETAILED_DESIGN.md:37` 已明确写过"生产内容目录是 `reference/`，不是旧文档中曾出现的 `reference-content/`" | 改为 `reference/` |
| A-02 | `DOC-ERROR` | `docs/22-API-REFERENCE-MODULE-DESIGN.md:132` | 目录树写 `reference-content/` | 同上 | 改为 `reference/` |

### 3.2 接口与契约事实（`docs/05-INTERFACE_CONTRACTS.md`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| B-01 | `DOC-ERROR` | `:371` | "The non-HTTP `ReferenceAuthoring` Interface owns **fourteen** operations"，随后列出 14 个 | 接口实际有 **16** 个操作；文档缺少 `advanceRepair` 与 `buildRepairPlan` | 补两个操作并改为 sixteen |
| B-02 | `DOC-ERROR` | `:272-275` | SSE 事件示例 `event: judge.stage.finished`，data 内含 `stage`/`outcome` | `PlatformEvent` 只有 `schemaVersion`/`jobId`/`sequence`/`type`（`packages/contracts/src/index.ts:929-934`） | 换成真实事件负载 |
| B-03 | `DOC-ERROR` | `:278-287` | 事件类型含 `judge.preparing`、`judge.stage.started`、`judge.diagnostic`、`judge.stage.finished` | 代码实际只发出 `judge.queued`、`judge.cancelled`、`judge.system-error`、`judge.report.ready` 四种（全仓 grep 无其余四种） | 改为真实四种，或移入 Planned |
| B-04 | `DOC-ERROR` | `:293-300` | `JudgeReport` 含必填 `buildFlags`，无 `mode` | 真实 DTO 有必填 `mode: ExecutionMode`，`buildFlags` 为可选（`packages/contracts/src/index.ts:476-503`） | 对齐真实 DTO |
| B-05 | `DOC-ERROR` | `:321` | "Stage kinds additionally include `property_test`, `performance`, `configure`, `build`, `ctest`" | 两个类型被混为一谈：Module 层最小 stage kind 只有 `prepare\|compile\|test\|analyze`；传输层 `JudgeReportStage` 才是完整列表 | 分别描述两个类型 |
| B-06 | `DOC-ERROR` | `:213` | "Run request may include **stdin** and runtime arguments" | `ExecuteActivityBody` 只允许 `schemaVersion`/`commandId`/`attemptId`（`apps/server/src/server.ts:58-62,87-95`），stdin 只存在于服务端 Judge spec 内 | 改为"stdin 由服务端 Judge spec 提供" |
| B-07 | `DOC-ERROR` | `:217-225` | Grade 响应示例为 `{schemaVersion, jobId, snapshotId, status, report:{verdict, stages}}` | 真实 DTO 还含 `commandId` 与可选 `learningOutcome`（`packages/contracts/src/index.ts:776-784`），`JudgeReport` 并非只有 `verdict`/`stages` | 用真实 DTO 替换示例 |
| B-08 | `DOC-ERROR` | `:323-336` | 409 错误体为 `{error:{code,message,retryable,correlationId,details}}` | 服务器直接回传平台结果：`{schemaVersion, commandId, result:{ok:false, code:"revision_conflict"}}`（`apps/server/src/server.ts:515-517`） | 对齐实现的信封 |
| B-09 | `DOC-ERROR` | `:16` | "Unknown fields are rejected for **commands**" | 只有 `workspace.save` 与两个 Playground body 做精确键校验；hints/reflections/teacher-packs/teacher-observations/run/grade 接受任意额外键 | 要么实现严格拒绝，要么放宽措辞 |
| B-10 | `DOC-ERROR` | `:367` | "`--json` writes exactly one **versioned** result" | `doctor --json` 直接打印 `bootstrap.get` 结果，而 `LearningBootstrapResult` 没有 `schemaVersion`（`packages/contracts/src/index.ts:32-39`） | 修正措辞或补 `schemaVersion` |
| B-11 | `DOC-ERROR` | `:349-357` | 命令清单只有 7 条 | CLI 实际有 11 条，缺 `hint`（`apps/cli/src/cli.ts:110`）与 `reflect`（`:136`） | 补两条命令及其参数 |
| B-12 | `DOC-ERROR` | `:514-517` | "Every HTTP route is tested against the shared contract schema." | `packages/contracts` 只有 1 个 Schema（`bootstrap-result.schema.json`），`apps/server/src/server.test.ts` 只 import 类型，无任何路由做 Schema 校验 | 收窄措辞到实际覆盖范围 |
| B-13 | `ARCH-GAP` | `:40-43` | `GET /api/v1/tracks/:trackId`、`POST /api/v1/sessions`、`POST /api/v1/activities/:activityId/start` | 三条路由在代码中零命中；Curriculum 只有 `GET /api/v1/activities` 与 `GET /api/v1/activities/:activityId`；contracts 中不存在 Track/Session 领域类型 | 实现，或移入显式 Planned 段 |
| B-14 | `ARCH-GAP` | `:165` | `GET /api/v1/snapshots/:snapshotId/diff/:otherSnapshotId` | 未注册；Workspace 只有 `GET`/`PATCH /api/v1/workspaces/:activityId` | 实现或标注为 Planned |
| B-15 | `ARCH-GAP` | `:343` | "`422`: valid request whose learning preconditions are not met." | 全仓无 `422`；提示顺序违规以抛错形式出现，Server 未定义对应错误处理 | 实现映射或标注未实现 |
| B-16 | `ARCH-GAP` | `:350,353` | `cpplearn serve [--host] [--port]`、`status [--due]` | `serve` 不解析任何 flag，`apps/cli/src/index.ts:31-35` 硬编码 `127.0.0.1:4173`；`status` 不读 `--due` | 实现 flag 或从契约移除 |

### 3.3 课程与判题规范（`docs/07-CURRICULUM_AND_JUDGE_SPECIFICATION.md`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| C-01 | `DOC-ERROR` | `:44-78` | "Activity manifest" 示例用 `content.lesson`、`workspace.starter/editable`、`judge.profile/standard/stages`、`evidencePolicy.publicPass/demonstratedRequires`，并缺 `objectives`/`victoryConditions`/`sources`/`learning`/`quality` | 该示例会被当前 Schema **直接拒绝**：`content` 要求 `{format,path}`、`workspace` 要求 `{editablePaths,starterFiles}`、`judge` 要求 `{version,expectedStdout,timeoutMs}`、`evidencePolicy` 要求 `{automatedPass,demonstratedRequiresReflection,demonstratedRequiresIndependent,reviewAfterDays}`，且四者均 `additionalProperties:false`；70 份真实 manifest 全部符合 Schema | 已修复：示例替换为真实 manifest 并经 `validateActivity` 校验通过；按「早期残留」处理，不扩 Schema |
| C-02 | `ARCH-GAP` | `:68-71` | 同样示例中的 `judge.profile` / `judge.stages` | 全仓零命中；真实选择机制是 `buildProfile` + `sanitizers` | 已决定为早期残留：示例已重写，不新增 `judge.profile` / `judge.stages` |
| C-03 | `ARCH-GAP` | `:104-136` | CLI I/O 的 token/正则/浮点容差比较、Function harness(cpp-function) | 不存在 judge profile 概念；输出比较目前只有严格相等（`modules/judge/src/index.ts:1054,1091,1150`） | 保留为目标语义 |
| C-04 | `DOC-ERROR` | `:84` | "Catalog activation rejects **private values** inside `curriculum/`" | 代码拒绝的是公开 manifest 中出现 `judge.privateTests` **键**（`modules/curriculum/src/index.ts:574-585`），不是扫描其他字段里的私有值 | 修正措辞 |
| C-05 | `UNVERIFIED` | `:128` | "initial system Module is POSIX-compatible on the reference macOS environment and Linux" | 代码中无 OS 条件分支，进程组终止有非 POSIX 回退，默认编译器硬编码 `/usr/bin/clang++`，无 Linux 测试 | 需 Linux CI 证据或收窄措辞 |

### 3.4 状态、版本与计数器

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| D-01 | `DOC-ERROR` | `docs/67:264` | "the Authoring plan still illustrates a three-operation interface while the implementation has sixteen" | `docs/53:77` 已写明"the implementation now has a 16-operation compatibility facade"，该漂移描述本身已过期 | 删除该例子或改述 |
| D-02 | `DOC-ERROR` | `docs/68:141` | `quality-baseline.json` "当前记录 116 个受审计 Entry" | 该文件只有 `acceptedEntryVersions: {}`、`knownGaps: []`、`notApplicable: []`；116 由 `report:reference` 计算 | 改为"由质量脚本计算" |
| D-03 | `DOC-ERROR` | `docs/71:166` | npm 自动修复候选是 `monaco-editor@0.53.0` | 2026-09-10 实测 `npm audit --omit=dev` 为 **"No fix available"**，3 vulnerabilities 仍在 | 更新为当前结论 |
| D-04 | `DOC-ERROR` | `docs/10:63` | §4 "Planned keys" 把已实现与未实现键并列 | `server.host`/`server.port` 已由 `CPP_LEARN_HOST`/`CPP_LEARN_PORT` 实现；`judge.maxConcurrentJobs`、`retention.runSnapshotDays`、`logging.level`、`paths.*` 全仓零命中 | 拆成"已实现/未实现"两组 |
| D-05 | `STALE-META` | `docs/67:57` | Documentation files = 109 | 实测 `docs/` 下 `.md` 已 110 份 | 已修复：`docs/67` §3.1 给出带过滤口径的复测（`docs/**/*.md` 现为 116 份） |
| D-06 | `STALE-META` | `docs/12:179` | 小节标题 "Planned Stage 6.2 evidence" | Stage 6.2 已 Accepted，表内 10 项状态全为 Passed | 改标题 |
| D-07 | `STALE-META` | `docs/24` 头部 | `Status: Baseline`（v1.20） | `docs/README.md` §4 把它列为"历史计划，主体已完成" | 统一状态标签 |
| D-08 | `STALE-META` | `docs/29,57,58,59,60,61,62,63,64,65` 头部 | 使用了 `Accepted (independent review limitation recorded)`、`Implemented; empirical acceptance pending`、`Tracer bullet implemented; phase in progress`、`Accepted; Phase A4 complete` 等 | `docs/README.md` §8 规定状态词汇只有 `Draft`/`In Review`/`Baseline`/`Accepted`/`Superseded`/`Archived` | 已决定：`docs/README` §8 明确该词汇只约束文档头部 `Status` 字段，表格内阶段标签不在范围内，历史报告不改写 |
| D-09 | `UNVERIFIED` | `docs/67:54` | "Tracked domain module source files = 66" | `modules/` 下 `.ts` 42、`.ts`+`.schema.json` 64、全部 tracked 81，无任何口径等于 66 | 已修复：`docs/67` §3.1 逐项写明过滤口径；原「66」在任何单一规则下都无法复现，已替换 |

### 3.5 文档间矛盾

| ID | 类别 | 双方 | 内容 | 实测/结论 |
|---|---|---|---|---|
| E-01 | `STALE-META` | `docs/11:59-63` §4 R1 ↔ 根 `README.md:109`、`docs/69` §4、`docs/70:105` | 路线图把"统一 Reference 内容策略"列为近期第一项，且全文未出现安全债务线路；其余三处（含 `docs/08` §1）已把安全债务收敛列为 P1 | 路线图落后，需补安全线路并重排 |
| E-02 | `STALE-META` | `docs/53:454` §12 ↔ 同上 | "First unify the Reference content policy…" | 同上，需改为安全债务优先 |

### 3.6 Reference 阅读模块与作者指南（`docs/22`、`docs/23`、`docs/24`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| F-01 | `DOC-ERROR` | `docs/22:132` | 仓库布局写 `reference-content/` | 实际是 `reference/`（同 A-02） | 改为 `reference/` |
| F-02 | `DOC-ERROR` | `docs/22:134-140` | 布局为 `<category>/<entry>/entry.json`、`content.md`、`examples/basic.cpp` | 实际为 `reference/entries/<id>/entry.json`、`…/content.md`、`…/examples/*.cpp`，`catalog.json` 记录 `entries/standard-library/entry.json` | 改写布局块 |
| F-03 | `DOC-ERROR` | `docs/22:143` | `web/src/reference/` 为懒加载 Reference 适配器 | 该目录不存在；实际是 `apps/web/src/ReferenceBrowser.tsx` + `ReferenceArticle.tsx`，在 `App.tsx:116-118` 懒加载 | 更正路径 |
| F-04 | `STALE-META` | `docs/22:319` | "Planned query routes:" | 四条路由均已注册并生效（`server.ts:231,250,315,338`），文档自身在 `:328` 又称其为 active contracts | 删除 "Planned"，并补 Playground run/cancel 两条路由 |
| F-05 | `STALE-META` | `docs/22:44` | 延迟范围含 "Example execution until the read-only catalog is accepted" | Playground 已实现并验收（`server.ts:357,439`；`docs/24:278`） | 从延迟范围移除 |
| F-06 | `ARCH-GAP` | `docs/22:546-548` | 激活时原子替换内存目录，失败保留旧的有效目录 | `modules/reference/src/index.ts:485-517` 只做一次性 memoized 激活，无 reload API，也不保留旧目录 | 保留为目标，登记为代码翻新方向 |
| F-07 | `STALE-META` | `docs/23:22-25` | 自动化/增量检查/事实台账/编译缓存/Web Author Console "Until those phases are accepted…" | A0–A2、A4–A7 已 Accepted（`docs/11:39-46`、`docs/53` 各阶段 `Status: Accepted.`） | 改为"已交付并验收，仅 A3 实测与可选 A8 未完成" |
| F-08 | `STALE-META` | `docs/23:382-383` | "The next expansion targets 80–120 Entries" | catalog version 19 已 120 条，正是该区间上界；backlog 与 `docs/24:120` 均记 120 条目标已完成 | 标记为已完成 |
| F-09 | `STALE-META` | `docs/24:7` | `Status: Baseline` | `docs/README.md:64` 称其为"历史计划，主体已完成"；文档自身 `:117-120`、`:278` 也称 Phase 3 完成、Phase 4 accepted | 统一状态标签 |

### 3.7 作者工具计划（`docs/53-CONTENT-AUTHORING-TOOLS-DESIGN-AND-IMPLEMENTATION-PLAN.md`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| G-01 | `DOC-ERROR` | `:217` | `check --draft std-vector-insert --changed` | 全仓无 `--changed`；`check` 只解析 `--draft`（`apps/cli/src/reference-author-cli.ts:544-557`），增量范围已在 `check` 内部硬编码（`modules/reference-authoring/src/index.ts:4915-4926`） | 删除示例中的 `--changed` |
| G-02 | `DOC-ERROR` | `:214` | `prepare --id std-vector-insert --kind member` | `--slug` 与 `--title` 为必填，该调用实际以 exit 2 打印用法（`reference-author-cli.ts:497-520`） | 补全示例参数 |
| G-03 | `STALE-META` | `:213-220` | Adapter 示例只列 6 个子命令 | CLI 实际有 13 个，另有 `repair-plan`、`repair`、`research`、`batch`、`run`、`template`、`measure`；`docs/04:162` 已列全 | 补全或改为引用 `docs/04` |
| G-04 | `DOC-ERROR` | `:131` | "Select five to ten related Entries" | 同文档 `:342` 与 `authoring-batch-run.schema.json:12` 的 `maxItems: 5` 都是上限 5 | 统一为 ≤5 |
| G-05 | `DOC-ERROR` | `:105-116` | 工件表列 draft/facts/sources/entry/content/examples/report/repair | 代码还生成 `catalog-proposal.json`（`index.ts:1311`，`filesystem.ts:177` 强制解析）与 `generation/revision-<n>.json` 收据（`index.ts:2589`） | 补入工件表 |
| G-06 | `DOC-ERROR` | `:146-147` | Entry kind 只列 `member/function/type/object/header/guide` | `REFERENCE_ENTRY_KINDS` 有 8 种，另有 `landing`、`concept`（`packages/contracts/src/index.ts:47-56`） | 补两种 kind |
| G-07 | `STALE-META` | `:280`、`:394` | Phase A2 与 A8 小节没有 `**Status:**` 行，其余阶段都有 | `docs/11:41` 记 A2 Accepted、`:47` 记 A8 可选未实现 | 补状态标签 |
| G-08 | `ARCH-GAP` | `:152-153` | context pack 含项目词汇表与邻近已发布页面 | `AuthoringContextPack` 只有 target/profile/requiredHeadings/factGroups/sources/policy；`vocabulary`/`nearby` 在生产代码零命中 | 保留为目标，登记为代码翻新方向 |

### 3.8 需求条目与追踪矩阵（`docs/02`、`docs/12`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| H-01 | `ARCH-GAP` | `docs/02:49` FR-033 | Judge 支持 function-harness、expected compile-failure 等 | Activity Judge 只有 `direct`/`cmake` 两种 build profile；`JudgeSpec` 必填 `expectedStdout`，无编译失败模式；`expected-compile-failure` 只存在于 Reference 示例 | 保留需求，代码补齐 |
| H-02 | `ARCH-GAP` | `docs/02:75` FR-063 | 原始编译/运行/Sanitizer 日志置于渐进披露控件后 | `apps/web/src/LessonWorkspace.tsx:716-745` 直接把各 stage 与原始 `stdout`/`stderr` 内联渲染，无披露控件 | 保留需求，代码补齐 |
| H-03 | `UNVERIFIED` | `docs/02:32` FR-010 | 从声明式内容加载 versioned Tracks/Modules/Concepts | `curriculum/catalog.json` 只有 `schemaVersion` + `activityManifests`；Activity kind 只有 4 种；Concept 只是 `conceptIds` 字符串数组 | 已决定为概念分组：FR-010 已收窄，Tracks/Modules 明确为 Activity 顺序之上的呈现分组 |
| H-04 | `STALE-META` | `docs/12:179,181` | 标题 "Planned Stage 6.2 evidence"，列头 "Planned executable evidence" | 表内 10 行状态全为 `Passed`，被引用的测试套件确实存在并通过 | 改标题与列头 |

### 3.9 安全、测试与运维（`docs/08`、`docs/09`、`docs/10`）

`docs/08-SECURITY_AND_PRIVACY.md` 是本次审计中**唯一没有文档级错误**的被审文档：
它在 `96f31c3` 中被更新后，已正确区分"已实现"与"未实现"的控制
（`:75` Activity 无共享准入、`:149` 未实现 session token、`:174` CI 未做依赖/密钥扫描）。

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| I-01 | `ARCH-GAP` | `docs/08:148` | "Validate `Origin` for state-changing requests." | `isAllowedMutationOrigin` 在缺失 Origin 时返回 `true`，且只比较 protocol+hostname 不比端口（`apps/server/src/server.ts:116-124`） | 保留需求；代码补齐 fail-closed 校验 |
| I-02 | `ARCH-GAP` | `docs/08:70` | "A bounded queue and shared concurrency limit across every Judge entry point." | 只有 Reference Playground 有界（`server.ts:162-168`，过载 429）；Activity Run/Grade 无准入 | 保留需求；代码补齐 |
| I-03 | `DOC-ERROR` | `docs/09:252` | "CI preserves test reports, coverage summaries, judge fixture reports…" | `ci.yml` 只有 `npm ci` 与 `npm run check`；`"test": "vitest run"` 无 `--coverage`，无覆盖率脚本，无 `upload-artifact` | 改为计划要求，或补 CI 覆盖率步骤 |
| I-04 | `ARCH-GAP` | `docs/09:39,42` | 契约测试跑在 "Filesystem and in-memory Curriculum Adapters" 与 "JSONL/SQLite and in-memory Learning Record Adapters" | Curriculum 只导出 `createFilesystemCurriculum`，Learning Record 只导出 `createJsonlLearningRecord`；in-memory 适配器只存在于 Reference/Workspace/Authoring | 保留目标；补两个 in-memory 适配器 |
| I-05 | `ARCH-GAP` | `docs/09:31` | Learning Record 覆盖 "upcasting" | `modules/learning-record` 中 `upcast` 零命中 | 实现或标注为计划 |
| I-06 | `STALE-META` | `docs/09:9,187` | 更新日期 2026-09-08；§4 作者测试阶段止于 A6 | A7 已 Accepted（`docs/65`），`modules/reference-authoring/src/repair.test.ts:128` 有 `T-AUTH-014` 修复循环测试，但 §4 无 A7 条目 | 补 A7 并更新日期/版本 |
| I-07 | `DOC-ERROR` | `docs/10:63-67` | §4 "Planned keys" 列 `server.host`/`server.port` | 已由 `CPP_LEARN_HOST`/`CPP_LEARN_PORT` 实现（`apps/server/src/config.ts:16,21`），但这两个环境变量在 doc 10 中从未记录 | 记录已实现的环境变量，只保留真正未实现的键为 planned |
| I-08 | `DOC-ERROR` | `docs/10:83-84` | "The server accepts `CPP_LEARN_DATA_ROOT` and `CPP_LEARN_WORKSPACE_ROOT`…" | 文档推荐的 `./cpplearn serve` 走 `apps/cli/src/index.ts:17,46`，硬编码地址且不读这些变量；只有 `apps/server/src/index.ts:12-13`（`npm run dev`）生效 | 把变量接入 CLI serve，或把该声明限定到 server 入口 |
| I-09 | `INTERNAL-CONTRADICTION` | `docs/10:138` ↔ `:141` | 可运行示例含 `cpplearn doctor --rebuild-projections`，而 `:141` 又称该命令"remains planned" | `doctor` 只处理 `--json`（`apps/cli/src/cli.ts:45-53`），该 flag 不存在 | 从可运行示例中移除 |
| I-10 | `ARCH-GAP` | `docs/10:99` | "Structured JSON logs in production mode; readable logs in development." | 无模式切换，两处都是 `logger: true`，无 pino-pretty | 实现或标注为计划 |
| I-11 | `STALE-META` | `docs/10:26` | "The implementation will use npm workspaces. Expected commands after scaffolding:" | workspaces 早已存在（`package.json:6-10`），同文档 `:42` 又称命令可执行 | 改为现状描述 |

### 3.10 权威与元文档（根 `README`、`docs/README`、`66`–`71`、ADR、`CONTEXT`）

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| J-01 | `STALE-META` | `docs/68:157` | "`66`–`70`：架构对照、审计、文件地图、未来计划与 AI 接手。" | `docs/71-CURRENT-SECURITY-AUDIT.md` 已存在且被 `docs/README:94` 收录，doc 68 漏列 | 改为 `66`–`71` 并点名安全审计 |
| J-02 | `STALE-META` | `docs/71:144` | "报告 1 个 Moderate、1 个 Low 依赖项" | 2026-09-10 实测为 "3 vulnerabilities (2 low, 1 moderate)"，同一条依赖链 | 更新计数并注明需重跑 |
| J-03 | `INTERNAL-CONTRADICTION` | `docs/70:215` | §13 问题 4 "当前最高优先级债务为何是 content policy？" | 同文件 `:105` 已改为安全债务为 P1，`:107` 把 content policy 列为 P2；`96f31c3` 只改了 §7 未改 §13 | 更新 §13 问题 4 |
| J-04 | `INTERNAL-CONTRADICTION` | `docs/67:319,323,360` | "A-01 central Reference content policy" 为 top recommendation / first candidate | `docs/69:23-24` 已把安全债务列为 P1、content policy 列为 P2；doc 67 全文无任何安全候选 | 在 doc 67 补安全阶段，或声明 R0 从属于 `docs/69` P1 |
| J-05 | `INTERNAL-CONTRADICTION` | `docs/67:338-342` | Phase R3 含 A-06 文档信息架构与 A-07 contracts 拆分 | `docs/69` §2 的 P0–P7 完全没有这两项（grep `A-0` 零命中） | 补入 `docs/69` 或在 doc 67 明确搁置 |
| J-06 | `DOC-ERROR` | `docs/69:197,201,217` | P7 小节内的编号是 `### 9.1`/`9.2`/`9.3` | 它们位于 `## 10. P7：内容扩展方法` 之下，编号应为 10.x | 重新编号 |
| J-07 | `STALE-META` | `docs/README.md:39` | "不需要从 01 顺序读到 67。" | 现有最高编号是 71 | 改为 71 |
| J-08 | `STALE-META` | `docs/adr/0007:9-10` | "atomic publication behind `prepare`, `check`, and `publish`" | 实际接口有 16 个操作 | 加一条 ADR 更新注记（不重写决策） |
| J-09 | `STALE-META` | `docs/CONTEXT.md:1` | 文件无 Version/Status/Owner 元数据表 | 其余文档均有该表 | 补标准表头 |
| J-10 | `UNVERIFIED` | `docs/24:272` | 退出条件 "All required course Activities expose relevant Reference links" | "required course Activities" 无定义；70 份 manifest 中只有 2 份声明 `referenceIds` | 需先定义判定口径 |

### 3.11 已确认一致的文档

- `docs/01-PROJECT_CHARTER.md`：无任何关于当前实现的错误陈述，头部元数据与实测一致。
- `docs/08-SECURITY_AND_PRIVACY.md`：无文档级错误（见 §3.9 说明）。
- 全部 ADR 的链接与状态字段自洽；`scripts/check-docs.mjs` 对 110 份文档通过，
  未发现失效链接或锚点。

### 3.12 架构与数据设计（`docs/03`、`docs/04`、`docs/06`）

`docs/03-SYSTEM_ARCHITECTURE.md` 经核对无冲突：路径、计数、接口、存储位置、
债务陈述与两条反向依赖声明全部准确。

| ID | 类别 | 位置 | 文档说法 | 实测 | 处置 |
|---|---|---|---|---|---|
| K-01 | `DOC-ERROR` | `docs/04:96` | "分别限制 stdout、stderr、执行时间与并发。" | 输出是单一共享计数器同时约束两个流（`modules/judge/src/index.ts:133,153-168`）；`docs/05` 已写 "combined" | 把"分别"改为"合并" |
| K-02 | `DOC-ERROR` | `docs/06:50-90` | 事件目录列了 16 种事件，但**没有** `attempt.completed` | `LearningRecordEvent` 联合类型含 `AttemptCompletedEvent`（`packages/contracts/src/index.ts:508,629`），且它是实际数据中的主要事件 | 补入 `attempt.completed` |
| K-03 | `DOC-ERROR` | `docs/06:155` | "Paths are sorted and encoded with explicit lengths before hashing." | `createSnapshot` 用 `JSON.stringify` + sha256，只排序不做长度前缀（`modules/workspace/src/index.ts:123-141`）；改成长度编码会使既有 `snap_*` ID 全部失效 | 已修复；并决定不改为长度前缀——那会使既有 `snap_*` ID 全部失效且无收益 |
| K-04 | `STALE-META` | `docs/06:9` | `Last updated 2026-09-07`（Version 1.6） | 1.6 实际提交于 2026-09-08 并新增 §13；工作树日期未同步 | 更新日期与版本 |
| K-05 | `ARCH-GAP` | `docs/04:86` | 作业生命周期 `queued → preparing → compiling → testing → analyzing → completed` | 不存在该生命周期对象；实际事件只有 `judge.queued`、`judge.report.ready`、`judge.cancelled`、`judge.system-error` | 保留为目标；在 §5.1 标注 |
| K-06 | `ARCH-GAP` | `docs/04:113` | 投影覆盖 Dashboard/Workspace revision/Projects/幂等回执等 | `LearningProjection` 只有 `attempts`、`conceptStates`、`concepts`、`evidence?`、`reviews?`；SQLite 只有 5 张表；幂等回执是进程内 `Map` | 保留为目标 |
| K-07 | `ARCH-GAP` | `docs/04:236` | 错误必须含安全 code、correlation ID、可公开 details 与重试分类 | 实际错误体只有 `{schemaVersion,error:{code,message}}`；`correlationId`/`retryable`/`details` 在 contracts 中零命中 | 保留为目标 |
| K-08 | `ARCH-GAP` | `docs/06:35-39` | 事件信封含 `eventType`、`correlationId`、`payload` | 实际信封是 `{schemaVersion,event:{...},checksum}`，事件对象用 `type` 且字段扁平，无 `correlationId`/`payload` | 已决定保持：目标事件模型与现有 DTO 的差异保留标注，不做内容级对齐 |
| K-09 | `ARCH-GAP` | `docs/06:51-90` | 16 种事件名 | 每一个在 `modules/`/`apps/`/`packages/` 中零命中 | 已决定保持：同上 |
| K-10 | `ARCH-GAP` | `docs/06:98-121` | 负载结构（顶层 `activity`/`snapshot`/`reportId`/`verdict`，Evidence `source: "hidden-test"`、`difficulty`、`contentVersion`） | 实际把上述字段嵌在 `report` 内，用 `activityId` + `conceptIds`；Evidence `source` 取值是 `automated_grade\|review\|teacher_observation` | 已决定保持为目标模型，保留标注 |
| K-11 | `ARCH-GAP` | `docs/06:126-140` | "Suggested tables" 列 11 张表 | 实际 SQLite 只有 5 张：`projection_meta`、`attempts`、`concept_states`、`concept_evidence`、`review_queue`；文档写的是单数 `concept_state` | 保留为目标；命名与真实表对齐 |
| K-12 | `ARCH-GAP` | `docs/06:142,150` | 投影行含 `last_event_id`；`concept_states` 存下次复习日期、最近独立证据、误区标签 | 只有 `concept_states` 有 `last_event_id`；真实列是 `concept_id,state,last_event_id,explanation,evidence_ids_json` | 保留为目标 |
| K-13 | `ARCH-GAP` | `docs/06:159` | Run 快照可在期限内压缩 | 无任何 retention/compaction 代码，`retention`/`runSnapshotDays` 零命中 | 保留为目标 |
| K-14 | `ARCH-GAP` | `docs/06:171,187` | 事件迁移由 upcaster 实现，并有 upcasting 完整性测试 | `upcast` 在 `modules/learning-record` 及全仓零命中 | 保留为目标（同 I-05） |

## 4. 属于「代码追赶文档」的架构翻新方向

以下条目**不是**文档错误，而是文档已明确、代码尚未实现的目标。它们来自
`docs/03` §8/§10、`docs/04` §8.5/§9/§10、`docs/11` R1–R7、`docs/53`、
`docs/67` A-01～A-07、`docs/69` P1–P7，均已用代码证据核实：

| ID | 目标 | 代码现状（实测） |
|---|---|---|
| R-01 | Web 与 CLI 共享 Reference presentation 模块 | `apps/cli/src/reference-author-preview.ts:9` 直接 import `@cpp-learn/web/reference-preview`；`apps/cli/package.json` 依赖 `@cpp-learn/web`；`packages/ui/src/index.ts` 仅 `export {};` |
| R-02 | CLI 不依赖 Server 组合根 | `apps/cli/src/index.ts:10` import `@cpp-learn/server/composition` |
| R-03 | Fastify 按 Learning / Reference / Local Data 三路由组拆分 | 全部路由集中在 `apps/server/src/server.ts`（903 行） |
| R-04 | Web 按学习者工作流拆分 | `apps/web/src/App.tsx` 1097 行、`LessonWorkspace.tsx` 749 行 |
| R-05 | contracts 内部按域拆分、保持单一公共 seam | `packages/contracts/src/index.ts` 956 行 |
| R-06 | 类型化 Reference content policy 深模块 | 规则分散在 `scripts/reference-content-quality.ts`、`modules/reference-authoring/src/index.ts`、`repair.ts` |
| R-07 | Authoring 按生命周期模块化、保留 16 操作门面 | `modules/reference-authoring/src/index.ts` 5271 行，22 个 schema 平铺 |
| R-08 | `docs/` 按 product/architecture/operations/decisions/reports/research/archive 重组 | 111 份 `.md` 平铺在 `docs/` 根 |
| R-09 | 所有 Judge 入口共享并发准入与资源预算 | Activity Run/Grade 无并发上限；`judge.maxConcurrentJobs` 零实现 |
| R-10 | 结构化配置键（`paths.*`、`judge.*`、`retention.*`、`logging.*`） | `apps/server/src/config.ts` 只实现 host/port/dataRoot/workspaceRoot |
| R-11 | Reference 示例执行与课程 Judge 统一执行环境政策 | 已修复：`createBoundedProcessEnvironment` 由 Judge、Reference 验证与 Authoring 校验器共用，三处都设 `HOME`/`TMPDIR` |
| R-12 | 原型目录归档 | 已修复：全部移入 `docs/archive/legacy-prototype/`，arm64 可执行文件已从 Git 删除，`reference/` 根只剩生产内容 |
| R-13 | 事件模型与 upcasting / 投影覆盖 / 保留策略 | 无 upcaster；SQLite 只有 5 张表；`retention.runSnapshotDays` 零实现 |
| R-14 | Fastify 错误信封含 correlation ID 与重试分类 | 实际错误体只有 `{schemaVersion,error:{code,message}}` |
| R-15 | Activity Judge 支持 expected compile-failure 与 function harness | 只有 `direct`/`cmake` build profile，输出比较只有严格相等 |
| R-16 | 原始编译/Sanitizer 日志置于渐进披露控件后 | `LessonWorkspace.tsx:716-745` 内联渲染全部原始输出 |
| R-17 | 运行时 Reference 目录可 reload 并原子替换 | `modules/reference/src/index.ts:485-517` 只有一次性 memoized 激活 |
| R-18 | context pack 含项目词汇表与邻近已发布页面 | `AuthoringContextPack` 无 vocabulary/nearby 字段 |
| R-19 | Track / Session 领域与 HTTP 路由 | contracts 无 Track/Session 类型，Server 未注册相关路由 |

## 5. 审计中被推翻的结论

记录在此以免后续复用错误信息：

| 来源 | 原结论 | 复核结果 |
|---|---|---|
| 簇 05/07 | "64 KiB 是每流上限，编译+运行可达 128 KiB" | **错误**。`modules/judge/src/index.ts:153-168` 用单个共享 `outputBytes` 计数器同时约束 stdout 与 stderr，文档的 "combined" 措辞正确 |
| 簇 05/07 | "`GET /api/v1/reference/entries/:entryId` 的 404 不含 `error.code`" | **错误**。`apps/server/src/server.ts:343-348` 明确返回 `error: { code: "reference_not_found" }` |
| 簇 05/07 | "doc 05 的操作清单缺少 3 个操作（含 `applyGeneratedExample`）" | **部分错误**。`applyGeneratedExample` 已在清单中；实际只缺 `advanceRepair` 与 `buildRepairPlan` 两个 |

## 6. 已执行的文档修复

审计覆盖 8 个文档簇（`01/02/11/12`、`03/04/06`、`05/07`、`08/09/10`、`22/23/24`、
`53`、`66`–`71` 与 ADR、跨文档一致性）。下表记录本轮对 `DOC-ERROR` 与
`STALE-META` 的实际改动；`ARCH-GAP` 与 `UNVERIFIED` 条目一律未改文档。

| 文档 | 已修改内容 |
|---|---|
| `docs/05` | SSE 事件示例与事件类型改为实际发出的四种，并标注细粒度进度事件为目标；`JudgeReport` 补 `mode`、`seeds`，`buildFlags` 改为可选，`stages` 类型改为 `JudgeReportStage`；重写 stage kind 段落；错误信封与 `422`、Track/Session/start、snapshot diff、`serve`/`status` flag 标注为目标；CLI 命令表补 `hint`/`reflect`；`--json` 措辞修正；操作数 14→16 并补 `advanceRepair`/`buildRepairPlan`；契约 Schema 测试声明收窄到实际覆盖 |
| `docs/06` | 存储布局改为 `.cpp-learn/data`、`.cpp-learn/workspaces`、`.cpp-learn/workspaces/.snapshots`、`reference/`，并说明导出路径由命令参数决定；事件目录补 `attempt.completed` 并标注哪些事件已实现、哪些仍是目标；快照哈希措辞改为 "sorted and JSON-encoded"；版本 1.6→1.7、日期更新 |
| `docs/07` | "private values inside `curriculum/`" 改为实际实现（拒绝声明 `judge.privateTests` 键的公开 manifest） |
| `docs/04` | "分别限制 stdout、stderr" 改为合并限制两路输出总量 |
| `docs/09` | CI 覆盖率工件声明改为计划要求；补 Authoring Phase A7 测试条目；版本 2.4→2.5、日期更新 |
| `docs/10` | §4 拆分为"已实现的环境变量"与"计划中的点分键"；补 `CPP_LEARN_HOST`/`CPP_LEARN_PORT` 并说明 `./cpplearn serve` 尚未读取；移除 `doctor --rebuild-projections` 可运行示例；日志模式与 workspace 措辞改为现状 |
| `docs/11` | 新增 R1 安全债务收敛并把内容策略及后续重排为 R2–R5、R6–R8，与 `docs/69` 的 P1→P2 对齐 |
| `docs/12` | §15 标题与列头去掉 "Planned" |
| `docs/22` | 仓库布局改为 `reference/entries/<id>/…` 与真实 Web 文件；删除 "Planned query routes"，补两条 Playground 路由；延迟范围移除已交付的示例执行 |
| `docs/23` | 作者工具段落改为"已交付并验收，仅 A3/A8 未完成"；内容扩展目标标记为已完成 |
| `docs/24` | 头部补 `Current state`；`docs/README` 索引描述同步 |
| `docs/53` | §12 改为安全债务优先；CLI 示例补 `--slug`/`--title`、删除不存在的 `--changed`、补全 13 个子命令说明；批量上限统一为 5；工件表补 `catalog-proposal.json` 与 generation 收据；Entry kind 补 `landing`/`concept`；Phase A2/A8 补状态标签；context pack 标注为目标 |
| `docs/67` | 文档计数 109→110；删除已过期的 "3-operation interface" 漂移描述，替换为当前真实漂移；R0 与 §8 明确安全债务优先于 A-01 |
| `docs/68` | `quality-baseline.json` 的 116 描述改为"由脚本计算"；文档分组补 `71`/`72`；内容策略债务优先级限定为"内容侧最高" |
| `docs/69` | P7 小节编号 `9.x`→`10.x` |
| `docs/70` | §13 问题 4 改为安全债务优先；阅读路径补 `docs/72` |
| `docs/71` | npm 自动修复候选更新为当前实测 "No fix available"；依赖公告计数更新为 3 项 |
| `docs/README`、根 `README` | 收录 `docs/72`；"读到 67" 改为 "读到 71" | 
| `docs/CONTEXT.md` | 补标准 Document ID / Version / Status / Owner / Last updated 表头 |
| `docs/adr/0007` | 追加更新注记：决策不变，门面已扩展为 16 个操作 |

验证命令与结果：

```text
npm run check:docs   → Documentation checks passed (111 Markdown files)
npx prettier --check → All matched files use Prettier code style
npm run format:check → All matched files use Prettier code style
git diff --check     → clean
```

## 7. 所有者决策与处置记录（2026-09-12）

以下七项取决于意图，已于 2026-09-12 由所有者一次性决定并执行。判定原则是：**只让文档
描述当前真实存在的结构**，除非有明确证据表明某个字段是目标设计。

| # | 事项 | 决定 | 执行结果 |
|---:|---|---|---|
| 1 | `docs/07` §4 的 Activity manifest 示例 | **早期残留**，不是目标语法 | 示例替换为真实 manifest（`cli-data-manager-m1`，内联 C++ 缩短），并经 `packages/content-schema` 的 `validateActivity` 校验通过；正文改为说明「规范形状是 Schema，规范示例是该文件」 |
| 2 | `docs/02` FR-010 的 Tracks/Modules/Concepts | **概念分组**，不是声明式实体 | FR-010 收窄为「加载 Activities 及其声明的 Projects/Milestones 与被 `conceptIds` 引用的 Concepts」；Tracks/Modules 明确为呈现分组。实测 `curriculum/catalog.json` 只有 `schemaVersion` + `activityManifests`，全仓代码中 `Track` 零命中 |
| 3 | `docs/06` §2–§4 事件模型 | **保持为目标模型并保留标注** | 不做内容级对齐；K-08/K-09/K-10 的处置保持 |
| 4 | `docs/06` §7 快照哈希 | **保持 JSON 编码** | 文档已是 "sorted and JSON-encoded"；不改为长度前缀——那会使既有 `snap_*` ID 全部失效且无收益 |
| 5 | `docs/67` §3 的模块源文件计数 | 重测并写明口径 | 新增 §3.1「Refreshed measurements」，逐项写明过滤口径；原「66」在任何单一规则下都无法复现，已替换 |
| 6 | `docs/README` §8 状态词汇的作用域 | **只约束文档头部 `Status` 字段** | §8 已写明表格内的阶段标签（`Active`、`Legacy`、`Implemented, acceptance pending` 等）不属于该词汇，历史报告不改写 |
| 7 | `reference/entries/std-vector-size/` | 空目录，删除 | 已删除（只有空的 `examples/` 子目录，Git 本就看不到） |

同一次收尾还处理了两项由此带出的工作：`docs/07` 的 `judge.profile`/`judge.stages` 随之
判定为残留（C-02），`docs/06` 的快照哈希保持现状（K-03 只改文档措辞，不改代码）。

本审计由 **DeepSeek Harness Agent** 依据 2026-09-10 实测代码状态编写。
