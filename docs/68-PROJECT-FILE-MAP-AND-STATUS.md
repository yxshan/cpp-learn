# 项目文件地图与当前状态

| Field | Value |
|---|---|
| Document ID | REPO-MAP-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 状态词汇

| 状态 | 含义 |
|---|---|
| Active | 当前生产代码、内容或规范，修改前需理解其契约 |
| Transitional | 正在使用，但边界或结构已有明确债务 |
| Planned | 预留接缝，尚未形成可依赖能力 |
| Legacy | 早期原型或历史材料，不是当前运行路径 |
| Generated | 安装、构建、测试或运行时生成，不应作为源码维护 |

## 2. 根目录地图

| 路径 | 状态 | 作用与当前情况 |
|---|---|---|
| `README.md` | Active | 人和 AI 的项目入口、运行命令与当前快照 |
| `MISSION.md` | Active | 学习者背景、职业目标、范围和时间约束 |
| `LEARNING_PLAN.md` | Active | 预计 2027 年暑假正式学习的长期能力路线 |
| `NOTES.md` | Active | 教学偏好与用户上下文；不是产品需求规格 |
| `RESOURCES.md` | Active | 外部学习资源，需定期检查链接和时效 |
| `package.json` | Active | npm workspace、工具版本、仓库级命令与 `overrides`（仅用于把传递依赖保持在已修复版本） |
| `package-lock.json` | Active | 锁定依赖；安装依赖后只提交有意变化 |
| `cpplearn` | Active | 学习 CLI 的可执行启动脚本 |
| `SECURITY.md` | Active | 支持范围、漏洞报告渠道、Native Judge 限制与安全门禁规则 |
| `security/audit-exemptions.json` | Active | 生产公告豁免的唯一来源；每条含理由、责任人与到期日 |
| `tsconfig.json` | Active | 全仓 TypeScript 项目与 path 配置 |
| `eslint.config.js` | Active | ESLint 规则 |
| `vitest.config.ts` | Active | 单元与契约测试配置 |
| `playwright*.config.ts` | Active | 开发式与生产式浏览器测试配置 |
| `.github/` | Active | CI 工作流与仓库自动化 |
| `.gitignore`、`.prettierignore` | Active | 源码边界与格式排除项 |
| `docs/archive/legacy-prototype/` | Legacy | 早期原型归档，零运行时引用；见该目录 `README.md` |
| `.cpp-learn/` | Generated | 本地学习、Workspace、作者草稿与缓存；被 Git 忽略 |
| `node_modules/` | Generated | npm 安装依赖；不得手工修改或提交 |
| `test-results/` | Generated | Playwright 运行产物；失败诊断后可删除重建 |
| `.DS_Store` | Generated | macOS 元数据；无项目语义 |

## 3. 应用适配器

### 3.1 `apps/web`

状态：Active。按工作流分为 `dashboard/`（学习总览）与 `lesson/`（训练页）两个目录，
Reference 呈现保持平铺。

| 文件 | 责任 | 注意事项 |
|---|---|---|
| `src/main.tsx` | React 挂载入口 | 保持轻量 |
| `src/App.tsx` | 路由分支（`/reference` 与学习总览）与懒加载 | 26 行，只做入口 |
| `src/dashboard/LearningApp.tsx` | 总览壳：组合 12 个子组件 | 234 行 |
| `src/dashboard/useDashboardView.ts` | 视图模型派生 | 汇总与目录必须一致 |
| `src/dashboard/useDashboardNavigation.ts` | 工作区活动、目录筛选、history 与脏确认 | history 是唯一事实来源 |
| `src/dashboard/useDashboardQueries.ts` | 5 个读模型、错误与刷新 | 5 个查询同屏，保持一起取 |
| `src/dashboard/useBackupRestore.ts` | 备份导出与恢复 | 导出完全在浏览器内完成 |
| `src/dashboard/navigation.ts` | URL/history 纯函数 | 直接链接、刷新与回退都依赖它 |
| `src/dashboard/*Section.tsx` | 目录、项目、记录、复习、环境、知识地图、顶部与页脚 | 纯展示，无状态无 effect |
| `src/lesson/LessonWorkspace.tsx` | 训练页组合：取数 effect、提示、反思与渲染 | 约 510 行 |
| `src/lesson/useEditorSession.ts` | 编辑器会话：缓冲区、dirty 判定、格式化与重置 | 只改浏览器缓冲区 |
| `src/lesson/useActivityExecution.ts` | 保存 / Run / Grade / 取消工作流 | 判题前先落盘 |
| `src/lesson/InteractiveBlock.tsx` | 交互式课程块逐步演示 | 纯展示 |
| `src/ReferenceBrowser.tsx` | Reference 布局、导航与搜索 | Reference 降级不能影响课程 |
| `src/ReferenceArticle.tsx` | GFM 文章、表格、代码与锚点呈现 | 消费共享块模型，见 `reference-presentation` |
| `src/api.ts` | 类型化 HTTP 调用 | 不放教学规则 |
| `src/cpp-format.ts` | 浏览器缓冲区中的确定性 C++ 格式化 | 不是完整 clang-format 替代品 |
| `src/mdn-theme.css` | Reference 的 MDN 风格主题 | 保持克制、可读和响应式 |
| `src/styles.css` | 学习平台全局样式 | 修改后跑完整 E2E |

### 3.2 `apps/server`

状态：Active。进程入口很薄，服务端实现已下沉到 `packages/composition`。

| 文件 | 责任 | 注意事项 |
|---|---|---|
| `src/index.ts` | 开发/生产进程入口 | 只解析配置、组装并监听 |
| `src/e2e-index.ts` | E2E 专用入口 | 只为测试环境组合 |

### 3.3 `apps/cli`

状态：Active。仅依赖 `packages/composition` 与领域模块，不再依赖任何 app。

| 文件 | 责任 | 注意事项 |
|---|---|---|
| `src/index.ts` | `cpplearn` 进程入口 | 当前依赖 Server composition |
| `src/cli.ts` | 学习命令解析与输出 | `--json` 供自动化使用 |
| `src/reference-author.ts` | `reference:author` 入口 | 作者命令与学习 CLI 分离 |
| `src/reference-author-cli.ts` | 作者工作流参数和输出 | 不复制模块规则 |
| `src/reference-author-preview.ts` | 生成本地预览文件 | 当前依赖 Web preview，优先清债 |

## 4. 领域模块

| 路径 | 状态 | 权威责任 |
|---|---|---|
| `modules/learning-platform/` | Active | 学习命令、查询、Evidence 与编排 |
| `modules/curriculum/` | Active | 课程验证、激活、公开与私有定义合成 |
| `modules/workspace/` | Active | 文件、revision、starter 与快照 |
| `modules/judge/` | Active | 编译、运行、测试、取消和结构化报告 |
| `modules/learning-record/` | Active | 事件、投影、恢复、导入和导出 |
| `modules/reference/` | Active | Reference 目录、搜索、slug、导航与示例状态 |
| `modules/reference-authoring/` | Active/Transitional | 16 操作作者门面、22 个工件 Schema 与主要流水线 |

`reference-authoring/src/index.ts` 现有 994 行（原 5271 行），只做装配。`generation.ts`、`run.ts`、`batch.ts`、
`repair.ts`、`research.ts`、`validation.ts`、`profiles.ts`、`digest.ts`、`draft.ts`、`gates.ts`
与 `operations/generation-apply.ts` 已承载各自的生命周期；16 个操作已全部迁入 `src/operations/` 的 6 个 capability 模块
（draft-lifecycle、generation-apply、context、repair、research-measure、run-batch）。

模块下的 in-memory adapter 与测试 fixture 不是重复生产实现，它们用于证明接口可替换、失败行为可测试。重构时应保留这些测试接缝。

## 5. 共享包

| 路径 | 状态 | 当前情况 |
|---|---|---|
| `packages/composition/` | Active | 服务端组装与服务端实现：`config.ts`（环境→地址、路径与 Judge 预算）、`application.ts`（领域模块装配）、`admission.ts`（进程内共享 Judge 并发预算与有界队列）、`server.ts`（107 行，只做安装）、`transport.ts`（写请求授权：精确 origin、回环 `Host`、会话令牌、Fetch Metadata；响应加固头；请求体守卫与字节预算）与 `routes/`（learning / reference / local-data / jobs 四个路由组） |
| `packages/reference-policy/` | Active | Reference 内容策略的唯一权威：语义区域、标题匹配、每种 Entry kind 的要求、修复目标标题。质量门禁、Authoring 脚手架与修复计划都消费它 |
| `packages/reference-presentation/` | Active | Reference 呈现的共享块模型与 HTML 序列化；Web 与 CLI 共用同一套 heading id 与块语义 |
| `packages/contracts/` | Active | 跨模块 DTO、命令、查询、事件和解析器；内部按域分为 `reference.ts`、`judge.ts`、`events.ts`、`session.ts`（本地会话 cookie 与 header 名），入口用 `export *` 重导出，公共导入路径不变 |
| `packages/content-schema/` | Active | Curriculum Schema 与验证器 |
| `packages/reference-schema/` | Active | Reference Entry Schema 与验证器 |

不要仅为了缩短文件而拆 contracts。应按稳定领域词汇在内部拆分，再从包入口重导出，保持公共 seam 不变。

`packages/ui` 是空壳且零消费者，已按 `docs/73` 删除；共享 Reference 呈现改由 `packages/reference-presentation` 承担。

## 6. 声明式内容

### 6.1 `curriculum/`

状态：Active。

- `catalog.json`：70 个 Activity 的激活顺序与目录版本。
- `activities/<id>/activity.json`：Activity manifest。
- 同目录 Markdown、starter 和公开资源：教学内容与可见输入。
- 私有测试不在这里声明；它们来自 `judge-private/tests.json`。

Activity 内容是生产事实来源。根目录 `lessons/` 和 `exercises/` 不会被当前 Curriculum adapter 激活。

### 6.2 `reference/`

状态：Active。

- `catalog.json`：120 个 Entry 的激活目录，当前 catalog version 19。
- `entries/<id>/entry.json`：Entry identity、kind、slug、关系、来源和示例 manifest。
- `entries/<id>/content.md`：原创中文教学正文。
- Entry 目录中的 `.cpp`：226 个本地验证示例。
- `quality-baseline.json`：质量 ratchet 与已知 gap 基线。

`quality-baseline.json` 只保存 ratchet 基线与豁免记录（`acceptedEntryVersions`、`knownGaps`、`notApplicable`），不保存受审计条目数量；当前 116/120 这个数字由 `npm run check:reference-quality` 与 `npm run report:reference` 计算得出。剩余 4 个通常是聚合或导航类 Entry；接手者应以质量脚本输出为准，不凭数量猜测遗漏。

### 6.3 `judge-private/`

状态：Active/Sensitive。

`tests.json` 保存课程私有 pedagogical tests。它虽然在本地仓库中可被机器所有者读取，但必须从浏览器响应、日志、Teacher Pack 和学习者备份中排除。

## 7. 文档与测试

### 7.1 `docs/`

状态：Active + Historical。

- `01`–`12`：当前产品和工程基线。
- `22`–`24`、`53`：Reference 与作者工具的设计/计划。
- `66`–`73`：架构对照、架构审计、文件地图、未来计划、AI 接手、安全审计、文档-代码冲突审计与重构方案。
- `13`–`21`、`25`–`52`、`54`–`65`：历史交付证据。
- `adr/`：已接受架构决策。
- `reference/`：学习补充材料与 Reference 批次研究。
- `archive/`：不再规范当前实现的早期方案。

### 7.2 `e2e/` 与测试文件

状态：Active。

- `e2e/first-learning-loop.spec.ts`：真实学习闭环和训练页行为。
- `e2e/reference-browser.spec.ts`：Reference 导航、渲染、表格与 Playground。
- `e2e/reference-production.spec.ts`：生产构建下的 Reference 行为。
- 各模块/应用旁的 `*.test.ts(x)`：单元、契约、失败与恢复测试。

当前有 36 个测试文件与 351 个 Vitest 测试。该数字只表示 2026-09-09 快照，不能替代运行 `npm test`。

## 8. 维护脚本

| 文件/命令 | 作用 |
|---|---|
| `scripts/check-docs.mjs` / `npm run check:docs` | Markdown 链接、代码围栏与需求追踪 |
| `scripts/check-content.ts` / `npm run check:content` | Curriculum 内容和参考解校验 |
| `scripts/check-reference.ts` / `npm run check:reference` | Reference Schema、关系、来源与示例验证 |
| `scripts/check-reference-quality.ts` / `npm run check:reference-quality` | 质量 profile 与 ratchet |
| `scripts/report-reference.ts` / `npm run report:reference` | Reference 覆盖与质量报告 |
| `scripts/security-checks.ts` | 安全门禁的纯判定逻辑：凭据模式、生产公告豁免与过期/失效判定 |
| `scripts/check-security.ts` / `npm run check:security` | 生产公告、跟踪树与全部修订的凭据扫描；独立于质量 Job |
| `scripts/security-checks.test.ts` / `npm run test:security` | 用受控公告与受控凭据 fixture 证明门禁会失败 |
| `scripts/verify-react-project.mjs` | Judge 使用的受控 React 项目验证 harness |

`security/audit-exemptions.json` 是唯一的公告豁免来源，每条必须带理由、责任人和到期日。

`scripts/reference-content-quality.ts` 与 Authoring 模块当前都掌握部分内容质量词汇，这是内容侧最高优先级的重复策略债务。安全侧的 P0 债务（`docs/71` 的 SEC-F02 准入、SEC-F03、SEC-F04）已收敛，剩余安全项按该文档的 P1/P2 排序。

## 9. 早期原型目录（已归档）

原型归档任务已完成，全部内容移入 `docs/archive/legacy-prototype/`，仓库根目录不再有
`assets/`、`lessons/`、`exercises/`、`learning-records/`，生产 `reference/` 根也不再夹带
静态页面。归档前已确认零运行时引用（全仓搜索 + 完整门禁 + 浏览器 E2E），归档说明见该目录的
`README.md`。

| 路径 | 原位置 | 处理 |
|---|---|---|
| `assets/course.css` | 根 `assets/` | 归档 |
| `lessons/0001-source-to-program.html` | 根 `lessons/` | 归档 |
| `reference/compile-run-debug.html` | 生产 `reference/` 根 | 归档，reference 根因此只剩生产内容 |
| `learning-records/0001-existing-frontend-foundation.md` | 根 `learning-records/` | 归档 |
| `exercises/0001-first-program/main.cpp`、`check.sh` | 根 `exercises/` | 归档；`check.sh` 已标注为非判题路径 |
| `exercises/0001-first-program/first_program` | 同上 | **删除**（已提交的 arm64 Mach-O，来源不可审查），同目录 `.gitignore` 防止再次提交 |

同目录保留了原有相对结构，因此两个静态页面在归档内仍可打开。

## 10. 修改影响速查

| 修改类型 | 至少检查 |
|---|---|
| Activity 或 starter | Curriculum Schema、私有测试映射、Judge、学习 E2E |
| Evidence 或 Concept | contracts、Learning Platform、Learning Record、追踪矩阵 |
| Workspace 保存 | revision、路径安全、Run/Grade 快照与恢复 |
| Reference Entry | authoring check、Reference/quality scripts、浏览器渲染 |
| Reference Schema | schema 包、loader、作者工件、现有 120 Entry |
| Judge profile | compiler fingerprint、timeout、cleanup、错误分类和 golden fixtures |
| Judge 并发或预算 | `admission.ts`、`CPP_LEARN_JUDGE_MAX_*` 环境变量、composition server test、Playground 与 Activity 必须共用同一预算 |
| 依赖或 Action 版本 | `npm run check:security`、豁免文件、Monaco 内联副本的重定向测试 |
| HTTP route | contracts、写请求授权与响应头策略、server test、E2E |
| 归档格式或预算 | learning-record 的 `ARCHIVE_LIMITS`、导出与恢复两侧、恶意归档测试 |
| 进程内缓存或保留期 | learning-platform 的 `RetentionPolicy`、Learning Record 是否仍能补齐历史 |
| Web 布局 | keyboard、history、dirty state、桌面/390px、浏览器 console |
| 文档基线 | 本索引、相关 ADR/规范、`npm run check:docs` |

本文件由 **GPT-5.6 Sol** 根据 2026-09-09 的仓库树、接口和质量快照编写；安全债务收敛后的差异见 `docs/71` §10。
