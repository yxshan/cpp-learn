# C++ 学习平台确定架构

状态：已选定，待实施  
决策：本地 Web 平台优先，保留 CLI；两者共享同一个教学核心与判题内核

## 1. 产品定义

这是一个单用户、本地优先、AI 可协作的 C++ 学习平台。它包含：

- 可视化课程与知识地图
- 浏览器内多文件代码编辑
- 本地编译、运行与结构化诊断
- 公开测试、教学性隐藏测试、超时和 Sanitizer 判题
- 分级提示、闭卷解释、变式复习和阶段项目
- 事件化学习记录、掌握度证据和间隔复习
- 面向学习者的 Web 入口与面向终端/AI 的 CLI 入口

### 明确不做

- 不做 SSR、SEO 或公网部署；本地单页应用已经满足需求。
- 第一版不做账号、多用户、付费、排行榜和远程同步。
- 第一版不做任意 C++ 执行轨迹可视化或强安全沙箱。
- 第一版不让 AI 自动改分或静默改写学习者代码。
- 不一次性批量生成全部课程；先验证内容与反馈闭环。

## 2. 总体结构

```text
┌──────────────────────┐       ┌──────────────────────┐
│ React Web Adapter    │       │ CLI Adapter          │
│ 课程/编辑/进度/复习  │       │ serve/next/check/... │
└──────────┬───────────┘       └──────────┬───────────┘
           │ HTTP + SSE                    │ direct call
           └──────────────┬────────────────┘
                          ▼
              ┌──────────────────────┐
              │ Learning Platform    │
              │ 深 Module            │
              │ 调度/证据/复习/规则  │
              └───────┬──────┬───────┘
                      │      │
             ┌────────┘      └──────────┐
             ▼                          ▼
┌────────────────────────┐  ┌────────────────────────┐
│ Curriculum Module      │  │ Learning Record Module │
│ 课程/概念图/内容版本    │  │ events + projections   │
└───────────┬────────────┘  └────────────────────────┘
            │
            ▼
┌────────────────────────┐
│ Judge Module           │
│ queue + worker + report│
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ Native Process Adapter │
│ Clang/CMake/CTest      │
└────────────────────────┘
```

Web、CLI 和未来 MCP 都只是 Adapter。所有选课、判题证据、提示独立度、掌握状态和复习规则只存在于 `Learning Platform` 的实现中。

## 3. 核心 Interface

为避免 Web 路由和 CLI 命令逐渐拥有各自逻辑，教学核心只暴露三个操作：

```ts
interface LearningPlatform {
  dispatch(command: LearningCommand): Promise<CommandResult>;
  query(query: LearningQuery): Promise<QueryResult>;
  events(jobId: JobId): AsyncIterable<PlatformEvent>;
}
```

命令是有类型的封闭联合：

```ts
type LearningCommand =
  | { type: "session.start"; availableMinutes: number }
  | { type: "activity.start"; activityId: ActivityId }
  | { type: "workspace.save"; activityId: ActivityId; revision: number; changes: FilePatch[] }
  | { type: "submission.run"; activityId: ActivityId; input?: string }
  | { type: "submission.grade"; activityId: ActivityId }
  | { type: "hint.request"; activityId: ActivityId }
  | { type: "reflection.submit"; activityId: ActivityId; answers: ReflectionAnswer[] }
  | { type: "teacher.observe"; observation: TeacherObservation };
```

查询同样是封闭联合：

```ts
type LearningQuery =
  | { type: "dashboard.get"; now: string }
  | { type: "activity.get"; activityId: ActivityId }
  | { type: "workspace.get"; activityId: ActivityId }
  | { type: "attempt.get"; attemptId: AttemptId }
  | { type: "progress.get" }
  | { type: "reviews.due"; now: string };
```

这一 Interface 是 Web、CLI、集成测试和未来 AI 工具共同的测试面。HTTP 路由只能解析输入、调用它并序列化结果，不包含教学规则。

## 4. 深 Module 与 seam

### Learning Platform Module

负责：

- 根据先修图、逾期复习、活动状态和可用时间选择下一步
- 将判题结果转化为学习证据
- 计算提示对独立性的影响
- 决定概念状态和下一次复习日期
- 处理内容升级后旧证据是否仍有效
- 保证同一判题结果不会重复入账

它不负责 HTTP、终端输出、文件系统细节或启动编译器。

### Curriculum Module

Interface：

```ts
interface Curriculum {
  getActivity(id: ActivityId): Promise<Activity>;
  getConceptGraph(trackId: TrackId): Promise<ConceptGraph>;
  validate(): Promise<ContentValidationReport>;
}
```

生产 Adapter 从版本化内容目录读取；测试 Adapter 使用内存课程。课程内容升级不会影响调用者。

### Judge Module

Interface：

```ts
interface Judge {
  submit(request: JudgeRequest): Promise<JobId>;
  events(jobId: JobId): AsyncIterable<JudgeEvent>;
  cancel(jobId: JobId): Promise<CancelResult>;
}
```

它隐藏编译参数、临时目录、测试 harness、超时、进程组终止、输出截断、Sanitizer 解析和隐藏测试脱敏。

第一版使用 Native Process Adapter；测试使用 Fake Judge Adapter；未来真正需要隔离时增加 Container Adapter。因此 judge seam 有真实的多 Adapter 需求。

### Learning Record Module

Interface：

```ts
interface LearningRecord {
  append(events: LearningEvent[]): Promise<AppendReceipt>;
  project<T extends Projection>(query: ProjectionQuery<T>): Promise<T>;
  rebuild(): Promise<RebuildReport>;
}
```

原始事件写入 JSONL；SQLite 是可删除、可重建的查询投影。测试使用内存 Adapter。Web 不直接写数据库。

### Workspace Module

负责学习者文件、乐观版本号、starter 初始化、源码快照和课程升级时的非破坏迁移。内容文件和学习者文件永不混写。

## 5. 技术栈决定

### Web

- React + TypeScript
- Vite 构建本地 SPA
- Monaco Editor 提供多文件代码与 diff 体验
- 原生 Fetch 访问 HTTP；SSE 接收编译和判题事件
- 不使用 SSR，也不在第一版引入重型全栈框架

选择依据：用户已熟悉 React/TypeScript；平台本地单用户，无 SEO、SSR 或服务器组件需求。Vite 官方提供 React TypeScript 模板；Monaco 是 VS Code 使用的 Web 编辑器。

### 本地服务

- Node.js + TypeScript
- Fastify 作为薄 HTTP Adapter，使用 JSON Schema 校验请求和响应
- 仅监听 `127.0.0.1`
- 判题在独立 Worker 进程执行，不阻塞 HTTP 进程

Fastify 不承载教学规则；它只负责传输、校验、日志和错误映射。

### CLI

- TypeScript 薄 Adapter，与本地服务复用同一 contracts
- 支持：

```bash
./cpplearn serve
./cpplearn next --minutes 40
./cpplearn check
./cpplearn status
./cpplearn doctor
```

`serve` 启动本地平台；其他命令可直接调用教学核心，或在服务运行时走 localhost。两种路径必须通过 contract test 保证结果一致。

### C++ 工具链

- C++20 作为教学基线
- 基础练习直接调用 `clang++`
- 多文件和项目练习使用 CMake/CTest
- 主线检查：编译警告、ASan、UBSan
- TSan、性能和 Linux 专属检查按环境能力启用

### 测试

- TypeScript Module 与 React 交互：Vitest
- 浏览器端到端：Playwright
- 判题器：真实 Clang golden tests + Fake Judge contract tests
- C++ 练习：公开测试、隐藏性质测试、CTest 集成测试

### 数据

- `data/events.jsonl`：追加事件，唯一事实来源
- `data/projections.sqlite`：仪表盘与查询投影，可从事件重建
- `data/snapshots/`：提交时的源码摘要或压缩快照
- `student-workspaces/`：学习者当前代码

SQLite 只做本地应用数据，不承担多人并发服务角色。

## 6. 内容格式

课程采用声明式内容，不执行任意课程脚本：

```text
curriculum/tracks/cpp-web/modules/01-mental-model/
  module.json
  lessons/0101-source-to-program/
    activity.json
    lesson.md
    starter/
    public-tests/
    hints.json
    reflection.json
    references.json
```

`lesson.md` 只负责文字、图片和代码块。交互内容用受控 block：

```json
{
  "type": "memory-visualization",
  "scenario": "stack-lifetime-01"
}
```

Web 只渲染平台认识的 block，不执行任意 MDX。活动与课程清单由 JSON Schema 校验。

私有判题数据与公开课程分离：

```text
judge-private/cpp.references.01/
  judge.json
  tests/
  expected-properties.json
```

浏览器、普通课程导出和 AI teacher pack 都不能读取该目录。

## 7. 判题生命周期

```text
保存源码
  → 创建不可变提交快照
  → 加入本地队列
  → Worker 建立临时目录
  → 文件契约检查
  → 编译
  → 公开测试
  → 隐藏性质测试
  → ASan / UBSan
  → 超时与输出限制
  → 可选性能/并发检查
  → 生成结构化结果
  → Learning Platform 转换为证据
```

### 运行与提交分离

- “运行”允许自定义 stdin，只提供快速反馈，不更新掌握度。
- “提交”才运行完整判题并产生学习证据。
- 使用完整答案后即使提交通过，也不能产生 `demonstrated` 证据。

### 结果分类

```text
compile_error
contract_failure
public_failure
hidden_property_failure
timeout
output_limit
memory_safety_failure
data_race_suspected
performance_failure
automated_pass
pending_teacher_review
judge_system_error
```

### 安全模式

- `native-fast`：默认，适合本人编写的可信代码；临时目录、环境白名单、无 shell 参数、超时和输出限制。
- `container-safe`：后期可选，用于 AI 或第三方代码；需要额外容器环境。

本地平台不会把 native 模式描述成安全沙箱。

## 8. 学习证据与复习

概念状态保持可解释：

```text
unseen → introduced → practiced → demonstrated → retained
```

- 看完讲解：`introduced`
- 公开测试通过：`practiced`
- 隐藏性质测试 + 闭卷解释 + 变式任务：`demonstrated`
- 经过延迟复习仍独立完成：`retained`

默认复习间隔从 1、3、7、21、60 天起步，根据独立程度调整：

- 无提示独立通过：延长
- 使用一级提示后通过：保守延长
- 使用完整答案：不升级，尽快安排新变式
- 复习失败：缩短但保留历史证据

AI 只能提交 `TeacherObservation`。Learning Platform 根据活动版本、源码证据和 rubric 决定是否入账，AI 不能直接写掌握分数。

## 9. Web 信息架构

### Dashboard

- “今天有 20 / 40 / 90 分钟”入口
- 当前阶段、待复习、未完成活动
- 最近错误模式与提示依赖趋势
- 项目里程碑和课程覆盖

### Lesson Workspace

桌面三栏：课程导航、讲解/可视化、编辑器/终端/测试。小屏改为标签切换；Monaco 不作为移动端主要体验。

### Exercise Result

- 编译器诊断映射到具体代码行
- stdout、stderr、退出码、耗时、输出截断
- 公开测试明细
- 隐藏测试只显示性质类别
- Sanitizer 解释与原始日志展开
- 分级提示和使用记录

### Knowledge Map

- 概念依赖
- 当前状态及证据
- 最近错误和下一次复习
- 在阶段项目中的使用位置

### Review Queue

- 闭卷解释
- 从空白重写
- 错误代码诊断
- 旧题加约束
- 项目迁移任务

### Projects

- 需求、里程碑与验收标准
- 架构说明、构建、测试和性能
- AI 代码评审与项目追问
- 故障注入和复盘

## 10. 代码目录

```text
cpp-learn/
├── apps/
│   ├── web/                    # React Web Adapter
│   ├── server/                 # Fastify HTTP Adapter
│   └── cli/                    # CLI Adapter
├── modules/
│   ├── learning-platform/      # 教学规则深 Module
│   ├── curriculum/             # 内容加载与验证
│   ├── judge/                  # 队列、Worker 和报告
│   ├── learning-record/        # events 与投影
│   └── workspace/              # 学习者文件与快照
├── packages/
│   ├── contracts/              # 稳定 DTO 与事件类型
│   ├── content-schema/         # JSON Schema
│   └── ui/                     # 课程交互与视觉系统
├── curriculum/
├── judge-private/
├── student-workspaces/
├── data/
├── reference/
├── learning-records/
├── package.json                # npm workspaces
└── package-lock.json
```

采用 npm workspaces，利用当前已经具备的 Node/npm，不额外要求另一种包管理器。

## 11. 质量策略

### Module 测试

- 通过 Module Interface 测试行为，不测试内部函数。
- Curriculum 使用文件 Adapter 与内存 Adapter 做 contract tests。
- Judge 使用 Fake Adapter 测教学流程，使用真实 Clang 测判题正确性。
- Learning Record 必须验证崩溃恢复、重复事件、重建和 schema migration。

### 端到端关键路径

Playwright 至少覆盖：

1. 打开课程并初始化 starter。
2. 编辑代码并保存。
3. 运行后看到编译诊断。
4. 修正后提交并通过公开/隐藏测试。
5. 完成反思后产生证据。
6. Dashboard 与 Review Queue 更新。

### 内容质量

每个活动必须通过内容 lint：

- ID、版本和先修关系有效
- 概念图无环
- starter 可构建或按设计失败
- 公开/隐藏测试自身通过参考实现
- 提示不泄露完整答案
- 引用链接存在
- 估计时间、胜利条件和复习变式齐全

## 12. 交付阶段

开发按可验收能力推进，不按“搭了多少目录”推进。

### 阶段 1：Web 垂直切片

交付一条完整路径：

```text
Dashboard → 第一课 → Monaco 编辑 → 运行 → 提交 → 判题 → 学习事件 → 状态更新
```

同时交付 `./cpplearn serve/check/status`。现有第一课迁移为声明式内容。

验收：浏览器和 CLI 对同一提交返回一致 verdict；关闭并重启后记录仍存在且可重建。

### 阶段 2：可靠判题与记录

- 多文件 workspace、源码快照和历史 diff
- 公开/隐藏测试、超时、输出限制、ASan/UBSan
- 结构化诊断、取消、崩溃恢复
- JSONL 事件与 SQLite 投影重建

验收：判题 Worker 崩溃不影响 HTTP 进程；同一结果不能重复入账。

### 阶段 3：教学闭环

- 分级提示
- 闭卷反思
- 概念证据和复习队列
- 变式题与错误模式
- AI teacher pack / observation

验收：使用完整答案不能升级掌握度；延迟变式任务能够产生更强证据。

### 阶段 4：现代 C++ 主干

完成首批 10–12 节课程、15–20 道练习和第一个渐进项目；随后扩展类型、引用、指针、生命周期、RAII、STL、类、拷贝/移动、智能指针和模板基础。

验收：课程 graph、测试、提示和参考资料全部通过内容 lint。

### 阶段 5：算法与系统实验

- 性质测试与确定性随机 seed
- 相对性能检查
- 文件、进程、线程、socket、SQLite
- CMake/CTest 工程项目
- 可选 Linux CI/容器验证

### 阶段 6：完整路线与体验

- 知识地图和高级可视化
- 网络、数据库、并发和性能课程
- 4–5 个渐进项目
- 项目 rubric、压测和故障复盘
- 数据导出、备份和平台自更新策略

## 13. 冻结的决定与延期决定

### 已冻结

- Web 优先、本地单用户、SPA、无 SSR
- React/TypeScript/Vite + Fastify
- Monaco 编辑器
- Web 与 CLI 共享 Learning Platform Interface
- Node Worker 调用 Clang/CMake/CTest
- JSONL 事件是真相，SQLite 是派生投影
- 声明式 Markdown/JSON 内容与 JSON Schema
- C++20 教学基线
- Native fast 模式优先，容器隔离后置

### 延期到实际需要时决定

- 是否打包为桌面应用
- 使用哪一种 SQLite Node Adapter
- 是否加入容器运行时和远程 Linux runner
- 是否接入具体 AI Provider 或仅暴露 MCP/teacher pack
- 是否支持多用户和云端同步
- 是否开放内容插件系统

这些延期决定都位于已有 seam 后面，不影响第一阶段的外部 Interface。

## 14. 技术参考

- [React：Using TypeScript](https://react.dev/learn/typescript)
- [React：从零构建应用与 Vite 选项](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite：Getting Started](https://vite.dev/guide/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Fastify：TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [Node.js：Child Process](https://nodejs.org/api/child_process.html)
- [SQLite：Appropriate Uses](https://www.sqlite.org/whentouse.html)
- [Vitest：Getting Started](https://vitest.dev/guide/)
- [Playwright：Installation and Capabilities](https://playwright.dev/docs/intro)
- [CMake 官方教程](https://cmake.org/cmake/help/latest/guide/tutorial/index.html)
- [JSON Schema：创建与验证 Schema](https://json-schema.org/learn/getting-started-step-by-step)
