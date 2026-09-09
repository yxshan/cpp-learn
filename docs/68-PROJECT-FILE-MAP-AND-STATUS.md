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
| `package.json` | Active | npm workspace、工具版本与仓库级命令 |
| `package-lock.json` | Active | 锁定依赖；安装依赖后只提交有意变化 |
| `cpplearn` | Active | 学习 CLI 的可执行启动脚本 |
| `tsconfig.json` | Active | 全仓 TypeScript 项目与 path 配置 |
| `eslint.config.js` | Active | ESLint 规则 |
| `vitest.config.ts` | Active | 单元与契约测试配置 |
| `playwright*.config.ts` | Active | 开发式与生产式浏览器测试配置 |
| `.github/` | Active | CI 工作流与仓库自动化 |
| `.gitignore`、`.prettierignore` | Active | 源码边界与格式排除项 |
| `.cpp-learn/` | Generated | 本地学习、Workspace、作者草稿与缓存；被 Git 忽略 |
| `node_modules/` | Generated | npm 安装依赖；不得手工修改或提交 |
| `test-results/` | Generated | Playwright 运行产物；失败诊断后可删除重建 |
| `.DS_Store` | Generated | macOS 元数据；无项目语义 |

## 3. 应用适配器

### 3.1 `apps/web`

状态：Active，局部 Transitional。

| 文件 | 责任 | 注意事项 |
|---|---|---|
| `src/main.tsx` | React 挂载入口 | 保持轻量 |
| `src/App.tsx` | 应用壳、路由状态、Dashboard 和备份流程 | 约 1,100 行，后续按工作流深化 |
| `src/LessonWorkspace.tsx` | 训练页、Monaco、Run/Grade、格式化与重置 | 约 750 行，课程与编辑器独立滚动 |
| `src/ReferenceBrowser.tsx` | Reference 布局、导航与搜索 | Reference 降级不能影响课程 |
| `src/ReferenceArticle.tsx` | GFM 文章、表格、代码与锚点呈现 | 与静态预览保持一致 |
| `src/api.ts` | 类型化 HTTP 调用 | 不放教学规则 |
| `src/cpp-format.ts` | 浏览器缓冲区中的确定性 C++ 格式化 | 不是完整 clang-format 替代品 |
| `src/reference-preview.tsx` | Reference 静态预览呈现 | 当前被 CLI 直接依赖，需迁移 |
| `src/mdn-theme.css` | Reference 的 MDN 风格主题 | 保持克制、可读和响应式 |
| `src/styles.css` | 学习平台全局样式 | 修改后跑完整 E2E |

### 3.2 `apps/server`

状态：Active，路由注册 Transitional。

| 文件 | 责任 | 注意事项 |
|---|---|---|
| `src/index.ts` | 开发/生产进程入口 | 读取配置并启动 Server |
| `src/e2e-index.ts` | E2E 专用入口 | 只为测试环境组合 |
| `src/config.ts` | 环境、路径、端口和安全默认值 | 路径只解析一次 |
| `src/composition.ts` | 生产适配器和领域模块组合 | CLI 当前也从这里复用组合 |
| `src/server.ts` | Fastify 路由、SSE、错误与 Reference Playground | 约 900 行，建议按领域路由组拆分 |

### 3.3 `apps/cli`

状态：Active，依赖方向 Transitional。

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

`reference-authoring/src/index.ts` 超过 5,000 行。已有 `generation.ts`、`run.ts`、`batch.ts`、`repair.ts`、`research.ts` 等辅助实现，但生命周期责任仍过度集中在入口文件。

模块下的 in-memory adapter 与测试 fixture 不是重复生产实现，它们用于证明接口可替换、失败行为可测试。重构时应保留这些测试接缝。

## 5. 共享包

| 路径 | 状态 | 当前情况 |
|---|---|---|
| `packages/contracts/` | Active/Transitional | 跨模块 DTO、命令、查询、事件和解析器集中在约 950 行入口中 |
| `packages/content-schema/` | Active | Curriculum Schema 与验证器 |
| `packages/reference-schema/` | Active | Reference Entry Schema 与验证器 |
| `packages/ui/` | Planned | `src/index.ts` 目前只有 `export {}`，没有生产消费者 |

不要仅为了缩短文件而拆 contracts。应按稳定领域词汇在内部拆分，再从包入口重导出，保持公共 seam 不变。

`packages/ui` 的下一步选择只有两种：承载真正共享的 Reference presentation，或删除空包。不要把纯 CSS 碎片和薄组件堆进去制造浅模块。

## 6. 声明式内容

### 6.1 `curriculum/`

状态：Active。

- `catalog.json`：70 个 Activity 的激活顺序与目录版本。
- `activities/<id>/activity.json`：Activity manifest。
- 同目录 Markdown、starter 和公开资源：教学内容与可见输入。
- 私有测试不在这里声明；它们来自 `judge-private/tests.json`。

Activity 内容是生产事实来源。根目录 `lessons/` 和 `exercises/` 不会被当前 Curriculum adapter 激活。

### 6.2 `reference/`

状态：Active，夹有一个早期静态页面。

- `catalog.json`：120 个 Entry 的激活目录，当前 catalog version 19。
- `entries/<id>/entry.json`：Entry identity、kind、slug、关系、来源和示例 manifest。
- `entries/<id>/content.md`：原创中文教学正文。
- Entry 目录中的 `.cpp`：226 个本地验证示例。
- `quality-baseline.json`：质量 ratchet 与已知 gap 基线。
- `compile-run-debug.html`：早期静态速查页，Legacy，不属于当前 Entry renderer。

`quality-baseline.json` 当前记录 116 个受审计 Entry，`knownGaps` 为空。剩余 4 个通常是聚合或导航类 Entry；接手者应以质量脚本输出为准，不凭数量猜测遗漏。

### 6.3 `judge-private/`

状态：Active/Sensitive。

`tests.json` 保存课程私有 pedagogical tests。它虽然在本地仓库中可被机器所有者读取，但必须从浏览器响应、日志、Teacher Pack 和学习者备份中排除。

## 7. 文档与测试

### 7.1 `docs/`

状态：Active + Historical。

- `01`–`12`：当前产品和工程基线。
- `22`–`24`、`53`：Reference 与作者工具的设计/计划。
- `66`–`70`：架构对照、审计、文件地图、未来计划与 AI 接手。
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

当前有 36 个测试文件与 350 个 Vitest 测试。该数字只表示 2026-09-09 快照，不能替代运行 `npm test`。

## 8. 维护脚本

| 文件/命令 | 作用 |
|---|---|
| `scripts/check-docs.mjs` / `npm run check:docs` | Markdown 链接、代码围栏与需求追踪 |
| `scripts/check-content.ts` / `npm run check:content` | Curriculum 内容和参考解校验 |
| `scripts/check-reference.ts` / `npm run check:reference` | Reference Schema、关系、来源与示例验证 |
| `scripts/check-reference-quality.ts` / `npm run check:reference-quality` | 质量 profile 与 ratchet |
| `scripts/report-reference.ts` / `npm run report:reference` | Reference 覆盖与质量报告 |
| `scripts/verify-react-project.mjs` | Judge 使用的受控 React 项目验证 harness |

`scripts/reference-content-quality.ts` 与 Authoring 模块当前都掌握部分内容质量词汇，这是最高优先级的重复策略债务。

## 9. 早期原型目录

| 路径 | 状态 | 处理建议 |
|---|---|---|
| `assets/course.css` | Legacy | 仅供早期静态 HTML；迁移或确认无引用后再归档 |
| `lessons/0001-source-to-program.html` | Legacy | 第一课静态原型，不是当前课程内容 |
| `exercises/0001-first-program/` | Legacy | 含旧可执行文件、源码和 shell 检查脚本，不是当前 Judge 输入 |
| `learning-records/*.md` | Legacy | 早期人工学习记录，不是事件存储 |

本轮不删除这些文件，因为删除是否影响用户保存的历史材料尚未单独确认。后续可创建一次“原型归档”任务，先证明无运行时引用，再移动到 `docs/archive/legacy-prototype/` 或删除生成二进制。

## 10. 修改影响速查

| 修改类型 | 至少检查 |
|---|---|
| Activity 或 starter | Curriculum Schema、私有测试映射、Judge、学习 E2E |
| Evidence 或 Concept | contracts、Learning Platform、Learning Record、追踪矩阵 |
| Workspace 保存 | revision、路径安全、Run/Grade 快照与恢复 |
| Reference Entry | authoring check、Reference/quality scripts、浏览器渲染 |
| Reference Schema | schema 包、loader、作者工件、现有 120 Entry |
| Judge profile | compiler fingerprint、timeout、cleanup、错误分类和 golden fixtures |
| HTTP route | contracts、origin/loopback 策略、server test、E2E |
| Web 布局 | keyboard、history、dirty state、桌面/390px、浏览器 console |
| 文档基线 | 本索引、相关 ADR/规范、`npm run check:docs` |

本文件由 **GPT-5.6 Sol** 根据 2026-09-09 的仓库树、接口和质量快照编写。
