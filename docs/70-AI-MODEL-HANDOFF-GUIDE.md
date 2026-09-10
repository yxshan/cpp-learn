# AI 模型接手指南

| Field | Value |
|---|---|
| Document ID | AI-HANDOFF-001 |
| Version | 1.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 你接手的是什么

这是一个可运行的本地 C++ 学习平台，不是空脚手架。学习主线、判题、学习记录、120 条 API Reference、Playground 和 CLI-first Reference 作者工具都已实现。

代码基线检查时的固定点是 commit `76d9e20`。本轮之后可能出现仅文档的新 commit，因此应以 `git log -5 --oneline` 和 `git status --short` 确认你实际拿到的状态。

用户预计到 2027 年暑假才开始集中学习。当前开发期可以改进平台，但不代表可以无限扩大产品范围。产品仍是本地、单用户、Web-first，并保留 CLI。

## 2. 用户目标与偏好

- 用户已有 HTML、CSS、JavaScript、Vue 3 和 React 经验。
- JavaScript 最熟，TypeScript 高级特性使用较少。
- C++ 从零开始，但不需要重复教授通用编程常识。
- 目标是研究生阶段获得互联网软件/Web 相关实习能力。
- 倾向 C++ 后端、基础设施和网络服务，暂不做硬件开发。
- 不喜欢 Java；若未来拓宽通用后端岗位，优先评估 Go。
- 页面风格应克制、清晰、接近 MDN，不要花哨。
- Reference 需要详细、可运行、来源可追溯，并适当加入 JS 对照。

稳定背景见根目录 `MISSION.md`、`LEARNING_PLAN.md` 和 `NOTES.md`。除非用户目标变化，不要反复询问这些已知信息。

## 3. 第一轮必须做的事

```bash
git status --short
git log -5 --oneline
node --version
clang++ --version
npm run check
```

随后按任务风险选择：

```bash
npm run test:e2e
npm run test:e2e:production
```

不要直接清理 dirty worktree。先读取 diff，区分用户改动、前任模型改动和生成产物。仓库可能包含尚未提交但已经验证的文档或内容。

## 4. 最短上下文

按顺序阅读：

1. [根 README](../README.md)
2. [文档导航](README.md)
3. [系统架构](03-SYSTEM_ARCHITECTURE.md)
4. [项目文件地图](68-PROJECT-FILE-MAP-AND-STATUS.md)
5. [后续开发计划](69-FUTURE-DEVELOPMENT-PLAN.md)
6. [当前架构审计](67-CURRENT-ARCHITECTURE-AUDIT.md)
7. [当前安全审计](71-CURRENT-SECURITY-AUDIT.md)
8. 与任务直接相关的 ADR 和规范

不要把 40 多份 Implementation Report 全部放进上下文。只有当你需要追溯某个行为、验收或失败模式时，才读取对应报告。

## 5. 当前事实快照

| 项目 | 2026-09-09 快照 |
|---|---:|
| Activity | 70 |
| Reference Entry | 120 |
| 本地验证 C++ 示例 | 226 |
| 纳入 Reference 质量审计 | 116/120 |
| 已知质量豁免 | 0 |
| Vitest 测试文件 | 36 |
| Vitest 测试 | 351 |
| Reference Authoring 公共操作 | 16 |
| Authoring JSON Schema | 22 |

这些数字仅帮助发现异常。每次内容或测试变化后，应由脚本重新计算，不要手工维持“漂亮数字”。

## 6. 已完成与未完成

已完成：

- Stage 0–6.2 全部产品阶段。
- Authoring A0、A1、A2、A4、A5、A6、A7。
- Web 训练页双栏独立滚动、上下节、格式化和重置。
- Reference MDN 风格页面、GFM 表格和完整 Playground。
- Reference 120 条目质量补充与无豁免基线。

未完成或待验证：

- A3 只有工具和 fixture，缺真实五条目批次的效率验收。
- A8 Web 审阅面未实现，且仍是可选项。
- Reference content policy 仍分散在 checker、profile 和 repair 映射。
- Authoring 主实现过大，生命周期局部性不足。
- CLI preview 仍依赖 Web app package。
- Server 和 Web 有大文件，但不能靠机械拆文件解决。
- 早期原型目录尚未归档。

## 7. 推荐的下一项工作

首选 [后续开发计划 P1](69-FUTURE-DEVELOPMENT-PLAN.md#4-p1安全债务收敛)：先收敛已确认的依赖、Judge 准入与 CI 安全债务。

安全工作按独立小提交完成后，继续 [P2](69-FUTURE-DEVELOPMENT-PLAN.md#5-p2统一-reference-content-policy)：统一类型化 Reference content policy。后者解决已经造成真实漏接的重复规则问题，并为 Authoring 重构、真实批次和后续内容扩展提供共同语义。

若用户明确要求页面问题，则先完成该 UI 任务，不强行插入 P1。修复后仍应回到路线图，而不是把一次 UI 需求扩成全站重写。

## 8. 开发约束

### 8.1 模块边界

- Learning Platform 拥有学习语义。
- Curriculum 拥有 Activity 内容与激活。
- Judge 拥有执行规则和报告，不写 Evidence。
- Reference 是只读知识系统，不产生学习状态。
- Reference Authoring 拥有作者正确性规则；CLI/Web 只做适配。
- React、Fastify 和终端输出不能进入领域模块。

### 8.2 内容边界

- 课程与 Reference 都是声明式、可版本控制的内容。
- 权威来源提供事实，不提供可直接复制的项目正文。
- cppreference 可作为覆盖、导航和展示参考，不是本项目内容数据库。
- JS 对照要解释迁移心智模型，同时写清不等价之处。
- 示例必须最小、确定、可编译，并与声明的标准版本一致。

### 8.3 数据与安全

- `.cpp-learn/` 是用户本地状态，不要无故删除或提交。
- `judge-private/` 不得进入客户端响应或学习者导出。
- Native Judge 不是强沙箱，不得对公网开放。
- 当前安全审计仍有 1 项 High、3 项 Medium 和 4 项 Low finding；不要把“本地可用”描述成“安全加固完成”。
- 文件写入保持路径约束、revision/CAS 和原子发布。
- 不要使用破坏性 Git 命令清理不理解的改动。

## 9. 任务工作流

### 9.1 修改前

1. 找到当前接口、调用方、测试和相关 ADR。
2. 写出可观察问题与必须保持的不变量。
3. 选择最小但端到端可验证的切片。
4. 若诊断问题，只报告原因；只有用户要求修复时才修改。

### 9.2 修改中

1. 优先写或补失败测试，尤其是回归和边界问题。
2. 保持适配器薄、模块深、共享策略单一。
3. 不修改与任务无关的用户文件。
4. 及时更新用户，说明已确认的事实和剩余风险。

### 9.3 修改后

1. 跑局部测试和静态检查。
2. 跑 `npm run check`。
3. UI、路由、Judge 或生产资源变更再跑相应 E2E。
4. 检查 `git diff --check` 与 `git status --short`。
5. 更新架构/计划/报告，但只把有证据的阶段标为 Accepted。

## 10. 常用命令

```bash
npm run dev
npm run dev:web
npm run build
npm run check
npm run check:docs
npm run check:content
npm run check:reference
npm run check:reference-quality
npm run report:reference
npm run test:e2e
npm run test:e2e:production
npm run reference:author -- --help
./cpplearn doctor --json
```

如果只改 Markdown，至少运行 `npm run check:docs`、对相关文件运行 Prettier check，并执行 `git diff --check`。

## 11. 可使用的技能

若接手环境提供相应技能，可按任务选用：

- `diagnosing-bugs`：页面、判题、构建或恢复问题的证据化诊断。
- `codebase-design`：设计深模块、判断 seam 和提高局部性。
- `tdd`：回归修复与接口迁移的红绿重构。
- `research`：对 C++ API 事实使用一手来源做仓库内研究记录。
- `redesign-existing-projects`：用户明确要求重做现有页面时使用。
- `web-design-guidelines`：UI 完成后的可访问性与交互复审。
- `handoff`：再次切换模型前生成临时对话交接，不替代本文件。

技能不能替代仓库规范。使用前应完整读取对应说明，并保持用户请求优先。

## 12. 不要重复的错误

- 不要声称项目“完全完成”；课程主体已完成，但架构、内容和真实学习反馈会继续演进。
- 不要把 A3 的 fixture 当成真实作者效率数据。
- 不要把 Web 审阅界面描述为给用户看 AI 开发日志。
- 不要从 cppreference 直接抄整页内容。
- 不要为每个 API 强塞相同标题；按 Entry kind 和适用性决定。
- 不要用微服务、数据库 CMS 或多账号系统解决本地单用户问题。
- 不要只因文件大就创建大量浅 wrapper。
- 不要把旧 `lessons/`、`exercises/` 当成生产课程。

## 13. 交接完成标准

接手模型能独立回答以下问题后，才算完成上下文恢复：

1. 哪些目录是生产内容，哪些是运行时或 Legacy？
2. Run、Grade 与 Reference Playground 的状态语义有何不同？
3. Reference 阅读模块与 Authoring 模块为何分开？
4. 当前最高优先级债务为何是 content policy？
5. 哪些门禁与当前任务风险相匹配？
6. 哪些工作已实现但尚未验收？

本指南由 **GPT-5.6 Sol** 编写，作为后续 AI 模型的稳定接手入口。
