# C++ Learn

一个面向现代 C++ 软件、Web 后端与基础设施方向的本地优先学习平台。项目把课程、在线编辑、判题、学习记录、API Reference 和内容作者工具放在同一仓库中，同时保留 Web 与 CLI 两个入口。

项目服务于已有 JavaScript/TypeScript 与前端经验、准备从零学习 C++ 的学习者。当前目标不是替代权威标准资料，而是提供可运行、可判定、可追踪、适合中文学习的工程化学习环境。

## 当前状态

截至 2026-09-09，课程与 Reference 主体功能已经可用，后续重点应从“继续堆功能”转向架构收敛、内容生产效率和真实使用验证。

| 能力 | 当前情况 |
|---|---|
| 课程 | 70 个 Activity，覆盖现代 C++、算法、工程工具、系统、网络、数据库、并发与生产工程 |
| 作品集 | 5 个渐进式项目，Milestone 证据可追溯到 Concept |
| 学习工作台 | Monaco 编辑器、保存、格式化、重置、Run、Grade、提示、反思、上一节/下一节 |
| 学习记录 | 本地持久化、Evidence、Concept 状态、延迟复习、导出与恢复 |
| API Reference | 120 个 Entry、226 个本地验证示例、搜索、导航、历史 slug 与 Playground |
| 内容质量 | 116/120 个 Entry 纳入质量审计，当前质量基线无已知豁免 |
| 作者工具 | CLI-first 草稿、事实/来源、生成、检查、修复、预览、批处理和原子发布流程 |
| 自动化验证 | 36 个测试文件、351 个单元/契约测试，另有真实浏览器 E2E |

这些数字是当前仓库快照，不是永久承诺。接手开发前应运行质量命令重新确认。

## 快速开始

环境要求：Node.js 22 或更高版本、npm，以及支持 C++20 的 `clang++`。

```bash
npm install
npm run dev
```

另开一个终端启动 Vite：

```bash
npm run dev:web
```

打开 <http://127.0.0.1:5173>。开发模式下，Web 与本地 API 分别由 Vite 和 Fastify 提供。

生产式本地运行会先构建 Web，再由同一个 Fastify 进程托管静态页面与 API：

```bash
npm run build
./cpplearn serve
```

打开 <http://127.0.0.1:4173>。Reference 位于 `/reference`，课程工作台位于根页面。

## CLI

学习 CLI 与 Web 复用同一套 Learning Platform、Workspace、Judge 和 Learning Record 模块。

```bash
./cpplearn doctor
./cpplearn next --json
./cpplearn status --json
./cpplearn check --activity source-to-program --json
```

Reference 作者工具面向维护者和 AI 接手模型，不是学习者必须操作的 Web 控制台。

```bash
npm run reference:author -- --help
npm run reference:author -- prepare --help
npm run reference:author -- check --help
```

完整流程见 [内容作者工具设计](docs/53-CONTENT-AUTHORING-TOOLS-DESIGN-AND-IMPLEMENTATION-PLAN.md)。

## 仓库结构

```text
apps/             Web、Server、CLI 三个适配器与组合入口
modules/          课程、判题、学习记录、Reference、作者工具等领域模块
packages/         跨模块契约与 JSON Schema
curriculum/       当前生产课程内容
reference/        当前生产 API Reference 内容与质量基线
judge-private/    不进入浏览器响应的私有判题定义
docs/             规范、架构、计划、ADR、研究与历史交付证据
e2e/              Playwright 真实浏览器测试
scripts/          内容、Reference、文档和质量检查脚本
```

根目录的 `assets/`、`lessons/`、`exercises/`、`learning-records/` 属于最早期原型，不是现行 Web 平台的数据源。完整状态与每个目录的责任见 [项目文件地图](docs/68-PROJECT-FILE-MAP-AND-STATUS.md)。

## 质量门禁

```bash
npm run check
npm run test:e2e
npm run test:e2e:production
npm run check:security
```

`npm run check` 会检查文档链接、课程内容、Reference 结构与质量、格式、Lint、TypeScript、单元/契约测试和生产构建。只修改文档时，至少运行 `npm run check:docs` 与 Prettier 检查。

`npm run check:security` 单独执行：生产依赖公告、跟踪树与全部修订的凭据扫描。它在独立
CI Job 中运行，不占用 `npm run check` 的时间；依赖豁免规则见 [SECURITY.md](SECURITY.md)。

本地 Judge 会执行学习者 C++ 代码，但当前不是强安全沙箱。服务只面向单机、单用户和回环地址，不应直接暴露到公网或运行不可信的第三方代码。

## 接手开发

新的维护者或 AI 模型建议按以下顺序阅读：

1. [文档导航与有效性规则](docs/README.md)
2. [系统架构](docs/03-SYSTEM_ARCHITECTURE.md)
3. [项目文件地图](docs/68-PROJECT-FILE-MAP-AND-STATUS.md)
4. [后续开发计划](docs/69-FUTURE-DEVELOPMENT-PLAN.md)
5. [AI 模型接手指南](docs/70-AI-MODEL-HANDOFF-GUIDE.md)
6. [文档与代码冲突审计](docs/72-DOC-CODE-CONFLICT-AUDIT.md)
7. [安全策略与风险接受项](SECURITY.md)

当前最高优先级的架构工作是统一 Reference 内容策略、收敛作者工具内部结构、移除 CLI 对 Web 包的反向依赖，并完成一次真实五条目作者批次的效率验收。[当前安全审计](docs/71-CURRENT-SECURITY-AUDIT.md)的 P0 三项（依赖公告、Judge 准入、CI 安全门禁）已修复，证据见该文档 §10；剩余安全项按其中的 P1/P2 排序，Native Judge 的强隔离仍是非回环、多人或不可信代码场景的发布阻断项。

## 文档署名

本轮 README、架构基线、文件地图、后续计划和 AI 接手文档由 **GPT-5.6 Sol** 整理与重写。
