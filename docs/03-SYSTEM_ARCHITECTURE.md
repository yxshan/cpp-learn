# 系统架构

| Field | Value |
|---|---|
| Document ID | ARCH-001 |
| Version | 2.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. 架构结论

当前项目是本地、单用户、Web-first 的模块化单体。Web、CLI 和 HTTP Server 是适配器；课程、学习编排、工作区、判题、学习记录、Reference 与 Reference Authoring 是独立责任模块。

该形态仍适合当前规模，不需要拆成微服务。近期架构工作的目标是增加模块深度和代码局部性，而不是增加部署单元。

## 2. 架构驱动因素

- 学习者以 Web 为主要入口，同时保留可自动化的 CLI。
- 课程、判题与学习状态只有一个权威实现。
- 课程和 Reference 必须离线可读、可验证、可版本控制。
- 学习者程序失败或超时不能使 Web Server 崩溃。
- Run 与 Grade 的学习语义不同，Reference Playground 不得产生学习证据。
- 内容作者工具必须让 AI 提速，但不能把 AI 输出当成事实来源。
- 本地数据归学习者所有，可导出、恢复和重建。

## 3. 逻辑架构

```text
┌────────────────┐    HTTP     ┌────────────────────┐
│ React Web      │────────────▶│ Fastify HTTP       │
│ Adapter        │             │ Adapter + Compose  │
└────────────────┘             └─────────┬──────────┘
                                        │
┌────────────────┐ direct/API           │
│ Learning CLI   │───────────────────────┤
└────────────────┘                       ▼
                              ┌──────────────────────┐
                              │ Learning Platform    │
                              │ deep module          │
                              └───┬────┬────┬────────┘
                                  │    │    │
                     ┌────────────┘    │    └────────────┐
                     ▼                 ▼                 ▼
              ┌────────────┐    ┌────────────┐    ┌──────────────┐
              │ Curriculum │    │ Workspace  │    │Learning Record│
              └─────┬──────┘    └────────────┘    └──────────────┘
                    ▼
              ┌────────────┐      short-lived native processes
              │ Judge      │────────────────────────────────────▶
              └────────────┘        clang++ / CMake / CTest

┌────────────────┐      ┌──────────────────┐
│ Reference Web  │─────▶│ Reference        │──▶ declarative entries
│ + HTTP Adapter │      │ read-only module │
└────────────────┘      └──────────────────┘

┌────────────────┐      ┌──────────────────┐
│ Authoring CLI  │─────▶│ Reference        │──▶ drafts / checks /
│ Adapter        │      │ Authoring module │    atomic publication
└────────────────┘      └──────────────────┘
```

Reference 阅读能力可以独立降级。Reference 内容缺失或失效时，课程、工作区、Run 和 Grade 仍应启动。

Reference Authoring 当前只有 CLI 适配器，不通过公开学习 Web 提供。未来 Web 审阅界面应是同一模块的薄适配器，而不是第二套 CMS 或规则实现。

## 4. 部署形态

开发模式包含两个长期进程：Vite 开发服务器和 Fastify 本地服务器。浏览器访问 Vite，API 请求进入 Fastify。

生产式本地模式先构建静态 Web 资源，再由一个 Fastify 进程同时提供页面和 API。服务绑定回环地址，默认入口是 `127.0.0.1:4173`。

Judge 在每次需要时启动短生命周期的 `clang++`、构建工具、测试程序或学习者程序。它们不是常驻微服务，也没有独立数据库写权限。

Reference Authoring 由维护者在命令行启动，草稿和缓存位于 `.cpp-learn/`。只有显式、校验通过、版本匹配的 publish 才会修改 `reference/`。

## 5. 模块责任

| 模块 | 拥有的复杂度 | 主要接口或输出 |
|---|---|---|
| Learning Platform | Activity 生命周期、Evidence、Concept、复习、幂等与跨模块编排 | `dispatch`、`query`、`events` |
| Curriculum | 70 个声明式 Activity、Concept 图、内容激活与私有判题合成 | Activity 查询与已验证目录 |
| Workspace | 学习者文件、starter 基线、乐观并发、不可变快照 | open、save、snapshot、diff |
| Judge | 编译、测试、限制、取消、诊断和确定性报告 | Runner 与 Judge Report |
| Learning Record | 事件日志、投影、Evidence、复习、导出与恢复 | append、query、rebuild |
| Reference | 120 个声明式 Entry、搜索、导航、slug、关系与本地示例状态 | `ReferenceCatalog` |
| Reference Authoring | 草稿、事实来源、生成收据、检查、修复、批次、预览与发布 | `ReferenceAuthoring` 兼容门面 |
| Contracts | 跨进程 DTO、命令、查询、事件和解析器 | `@cpp-learn/contracts` |
| Content Schema | Curriculum 内容验证 | JSON Schema 与验证器 |
| Reference Schema | Reference Entry 内容验证 | JSON Schema 与验证器 |

`packages/ui` 当前仅导出空对象，是计划中的接缝，不是已经使用的视觉系统。未来可用于共享 Reference 呈现；若无法形成有深度的公共接口，应删除而不是保留空抽象。

## 6. 核心数据流

### 6.1 学习与判题

```text
浏览器编辑缓冲区
→ Workspace 乐观并发保存
→ 不可变 Source Snapshot
→ Learning Platform dispatch
→ Judge 子进程
→ 不可变 Judge Report
→ Learning Record 事件与投影
→ Web/CLI 查询刷新
```

Run 只返回诊断，不改变 Concept。Grade 才能按 Activity 的 Evidence Policy 产生学习证据。私有测试只在 Server 与 Curriculum 内部合成，不进入浏览器、导出或 Teacher Pack。

### 6.2 Reference 阅读与 Playground

```text
reference/catalog.json + Entry 文件
→ 全量激活与索引
→ ReferenceCatalog
→ HTTP 查询
→ React 安全 Markdown/GFM 渲染
```

Playground 为非 Activity 执行。它使用独立 run identity、并发限制、取消和临时快照，但不产生 Attempt、Evidence、Concept、Review 或 Project 状态。

### 6.3 Reference 内容生产

```text
显式目标与来源摘录
→ Draft + Fact Sheet + Source Ledger
→ 受控生成/人工编辑
→ 结构、事实、质量和编译检查
→ 风险审阅 + 预览 + 精确发布计划
→ 原子写入 reference/
→ 全仓质量门禁
```

生成内容必须受已验证事实和来源约束。外部网站可用于事实调查、覆盖范围和展示参考，但不能整页复制为本项目内容。

## 7. 权威数据与存储

| 数据 | 权威位置 | 版本控制 |
|---|---|---|
| 课程 | `curriculum/` | 是 |
| 私有判题定义 | `judge-private/` | 是，但不得下发到客户端 |
| Reference | `reference/` | 是 |
| 学习者工作区与事件 | `.cpp-learn/workspaces`、`.cpp-learn/data` | 否 |
| 作者草稿与缓存 | `.cpp-learn/authoring*` | 否 |
| 构建与测试产物 | `apps/web/dist`、`test-results/` 等 | 否 |

学习记录采用追加事件与可重建投影。投影损坏时应从事件恢复；内容目录激活采用全有或全无，不允许部分有效目录成为当前版本。

## 8. 接缝与依赖规则

- 适配器依赖模块接口；领域模块不能依赖 React、Fastify 或 CLI 输出格式。
- Web 与 CLI 可共享契约和呈现模块，但不应直接依赖另一个应用包。
- 文件系统、时钟、编译器、发布器等外部行为通过适配器注入。
- 内容规则属于 Schema、质量策略或领域模块，不属于 React 组件与路由处理器。
- 跨边界数据使用版本化契约；模块内部对象不直接泄漏到 HTTP。

当前存在两个已知反向依赖：CLI 通过 `@cpp-learn/server/composition` 复用组合根，并通过 `@cpp-learn/web/reference-preview` 复用 Reference 预览。前者需要澄清公共组合接口，后者应优先迁移到共享呈现模块。

## 9. 可靠性与安全边界

- 路径必须规范化并限制在配置根目录内；拒绝绝对路径、`..` 与不允许的符号链接。
- 子进程使用参数数组而不是 shell 字符串，并限制时间、输出和工作目录。
- Judge 与 Playground 的临时目录在终态后清理。
- Workspace 保存使用 revision 防止静默覆盖。
- Authoring check 与 publish 绑定 draft revision、文件摘要和检查报告。
- Reference 激活失败保留旧的有效目录或进入安全降级。
- 本地 Native Judge 不是强沙箱；不要把服务暴露到公网。

## 10. 已知架构债务

1. Reference profile、质量 area、标题识别和 repair target 仍分散在多个字符串映射中。
2. `ReferenceAuthoring` 已增长为 16 个操作，主要实现文件超过 5,000 行，工作流局部性不足。
3. CLI 预览依赖 Web 应用包，共享呈现边界尚未形成。
4. Fastify 注册、`App.tsx`、`LessonWorkspace.tsx` 与 contracts 单文件偏大。
5. `packages/ui` 尚为空壳；文档历史报告仍在同一目录平铺。
6. A3 作者效率只有确定性夹具证据，尚缺真实五条目批次测量。

债务的推荐顺序和验收切片见 [后续开发计划](69-FUTURE-DEVELOPMENT-PLAN.md)，测量证据见 [当前架构审计](67-CURRENT-ARCHITECTURE-AUDIT.md)。

## 11. 不应提前引入的复杂度

当前不建议拆分微服务、远程数据库、多用户账号、通用 Web CMS、分布式 Judge 或多仓库内容系统。只有在本地单用户约束被真实需求打破时，才应通过新 ADR 重新评估。

本轮架构基线由 **GPT-5.6 Sol** 依据 2026-09-09 的代码与测试状态重写。
