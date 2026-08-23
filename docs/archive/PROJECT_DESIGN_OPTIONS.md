# C++ 教学项目设计方案

状态：方案比较已完成；用户选择 Web 优先，确定架构见 [WEB_PLATFORM_ARCHITECTURE.md](./WEB_PLATFORM_ARCHITECTURE.md)  
目标用户：具有 JavaScript/TypeScript 与前端基础、C++ 零基础的学习者，以及长期协作的 AI 教师

## 1. 共同需求

无论采用哪种形态，项目都应满足以下要求：

- 覆盖现代 C++、数据结构与算法、工程工具、操作系统、网络、数据库、并发与性能的就业主线。
- 每个知识点包含短课、动手练习、即时反馈、延迟变式题和可复用参考资料。
- 支持编译、公开测试、教学性隐藏测试、超时、输出限制、ASan/UBSan，以及专项性能检查。
- 区分“代码通过测试”与“学习者已经掌握”。
- 记录尝试次数、提示使用、源码摘要、判题结果、解释能力和后续复习日期。
- AI 可以给提示、评审和追问，但不能把自己的答案静默记为学习者的掌握证据。
- 本机离线优先，首先支持当前 macOS、Apple Clang、CMake、Node 和 Python 环境。
- 后期提供 Linux 验证；不能把 macOS 等同于互联网 C++ 生产环境。
- 课程和记录归学习者所有，可版本化、可迁移、可从原始事件重建。

### 不应承诺的事情

- 本地隐藏测试不能对机器所有者真正保密，只能作为防剧透机制。
- 本机直接运行 C++ 代码不是强安全沙箱，只应运行本人或可信来源代码。
- 自动测试不能完全评价设计、可维护性、解释能力和真实掌握。
- “覆盖大部分知识点”不等于把语言标准逐条做成题海；求职主线应为必修，高级模板元编程等应为选修。

## 2. 方案 A：极简本地 CLI 教师

### 核心理念

把选课、判题、提示、学习记录和复习调度隐藏在一个深模块中。学习者每天只需要记住三个命令：

```bash
./cpplearn next --minutes 40
./cpplearn check
./cpplearn status
```

AI 教师使用同一接口的 JSON 模式：

```bash
./cpplearn next --minutes 40 --json
./cpplearn check --json
./cpplearn status --json
```

概念接口可以压缩成：

```cpp
class Tutor {
public:
    SessionPlan next(const NextRequest&);
    JudgeReport check(const CheckRequest&);
    ProgressSnapshot status(const StatusQuery&) const;
};
```

`next` 负责选择逾期复习、恢复未完成任务或推荐新内容；`check` 负责判题、分级提示和 AI 主观评审入账；`status` 负责当前任务、技能图谱、复习队列与环境诊断。

### 典型体验

```text
$ ./cpplearn next --minutes 40

NEXT  cpp.references.01
引用不是 JavaScript 对象引用
预计：35 分钟
课程：curriculum/.../lesson.md
作业：work/cpp.references.01/solution.cpp

$ ./cpplearn check

PASS  编译
FAIL  公开测试：空容器场景
SKIP  隐藏测试
SKIP  ASan / UBSan

需要提示：./cpplearn check --hint
```

### 它隐藏的复杂度

- 课程依赖图与下一活动调度
- 工具链能力探测和编译参数
- 临时构建目录、超时、子进程清理和输出截断
- 公开/隐藏测试、随机种子和失败复现
- Sanitizer 报告归一化
- 内容版本与旧学习证据迁移
- 提示使用对掌握度的影响
- 事件追加、崩溃恢复和派生状态重建

### 优点

接口最简单，离线、快速，不容易因为平台建设拖延学习。AI 也能稳定读取结构化状态。它最适合作为整个系统的长期内核。

### 缺点

可视化较弱；复杂交互、知识图谱和尝试历史不如 Web 直观。如果 CLI 本身直接用 C++ 实现，第一版开发成本较高；若用脚本长期堆积，又容易变脆。

## 3. 方案 B：Git + CMake/CTest 工程训练仓库

### 核心理念

不发明完整教学平台，而把仓库本身当成课程。学习者始终使用真实的 Git、CMake、CTest、编译器和测试报告。

公开接口是标准工程目标：

```bash
cmake --preset dev
cmake --build --preset dev --target check-0103
cmake --build --preset grade --target grade-0103
ctest --preset dev -R '^lab\.0103\.' --output-on-failure
git diff
git commit -m "learn: complete value semantics lab"
```

固定 target 约定：

```text
lab-0103              只编译该题
check-0103            编译并运行公开测试
grade-0103            隐藏测试、超时与安全检查
record-0103           判题成功后追加学习证据
teacher-pack-0103     生成不含答案的 AI 评审上下文
course-next           推荐下一题
course-status         查看课程状态
review-due            查看到期复习
```

### 典型体验

每道 lab 都有自己的 target、公开测试、学习者提交目录和反思题。阶段项目持续演进，后续里程碑重新运行旧行为的回归测试，而不是学完一章就丢掉代码。

例如本地 KV 项目可以逐步加入：

```text
文件读写 → RAII → 索引 → 并发 → 崩溃恢复 → HTTP API → 性能报告
```

### 它隐藏的复杂度

- 根据清单生成 CMake target 和 CTest test
- 为不同 Sanitizer 生成构建 preset
- 测试隔离、临时端口、数据库 fixture 和后台进程清理
- 隐藏测试失败到概念反馈的映射
- 性能测试预热、同机参考实现和统计噪声处理
- Git diff 与学习证据关联
- AI 上下文包生成和答案过滤

### 优点

求职迁移价值最高。学习过程中自然形成构建、测试、Git、回归、调试和性能分析习惯，离开教学项目后也无需重新适应真实 C++ 工程。

### 缺点

CMake/CTest 对第一周偏重，文本反馈不如 Web 直观。若为每个练习暴露大量 target，接口会显得嘈杂；课程基础设施也可能膨胀成复杂的 CMake 程序。

## 4. 方案 C：本地 Web 学习平台

### 核心理念

建立一个离线优先的个人学习产品，把课程、代码编辑、终端、判题、掌握度、复习和项目里程碑放在统一界面中。

```text
React / TypeScript UI
        │ HTTP + SSE
        ▼
本地教学服务
        ├── SQLite 学习档案
        ├── 课程内容库
        └── C++ 判题 Worker
              ├── Clang / CMake / CTest
              └── 超时 / Sanitizer / 隐藏测试
```

推荐利用学习者已有技术栈：React、TypeScript、Vite；编辑器可采用 Monaco，本地服务采用 TypeScript，记录放入 SQLite。C++ 是学习内容，不必一开始用 C++ 编写平台本身。

### 核心界面

- 仪表盘：今天的课程、待复习概念、薄弱点、阶段项目。
- 三栏课程页：概念树、讲解/可视化、编辑器/终端/测试。
- 练习工作台：多文件编辑、编译诊断定位、公开测试、提交、Sanitizer、代码 diff。
- 知识地图：概念依赖、证据、典型错误和下次复习日期。
- 项目页：里程碑、rubric、构建、集成测试、性能和故障复盘。

核心服务接口可以是：

```text
GET  /api/v1/dashboard
GET  /api/v1/lessons/:id
POST /api/v1/exercises/:id/runs
POST /api/v1/exercises/:id/submissions
GET  /api/v1/jobs/:id/events
GET  /api/v1/reviews/today
POST /api/v1/tutor/observations
```

### 它隐藏的复杂度

- 文件自动保存、版本冲突和源码快照
- 编译诊断到编辑器行列映射
- 判题任务队列和实时日志
- 浏览器公开内容与私有判题数据隔离
- SQLite schema migration
- 内容版本化与历史尝试回放
- AI 上下文裁剪和结构化观察
- 概念掌握度、提示独立性和复习调度

### 优点

学习体验和可视化最好。特别适合演示生命周期、`vector` 扩容、迭代器失效、树图算法、线程状态、TCP 请求和 SQL 索引。它也可以成为一个很有辨识度的全栈作品。

### 缺点

它已经接近一个中型产品，最容易出现“为了学 C++，先花半年做学习平台”的倒置。任意 C++ 运行轨迹、并发可视化和强沙箱都不应进入第一版。

## 5. 三种方案的关键比较

接口最简单的是 CLI。三个命令可以隐藏最多复杂度，也最容易形成每天使用的习惯。它的短板主要是可视化，而不是判题或记录能力。

工程真实性最强的是 Git + CMake/CTest。它把教学工具本身变成 C++ 工程训练的一部分，尤其适合以实习和求职为目标的学习者。但低阶课程必须用快捷入口遮住部分 CMake 复杂度，随后再逐步揭示。

交互和扩展性最强的是 Web。它能最好地表达学习数据与抽象概念，也能复用学习者已有的前端能力。不过它具有最高的开发、测试和维护成本，不适合作为最先建设的核心。

三者最重要的分歧是“把复杂度放在哪里”：CLI 放在一个深内核中；工程仓库放在构建系统和标准工作流中；Web 平台放在本地服务、数据模型和 UI 中。

## 6. 推荐方案 D：渐进式混合架构

推荐顺序是：

```text
CLI 深内核
    ↓ 调用
Git + CMake/CTest 真实练习
    ↓ 读取同一事件与内容模型
后期 Web 仪表盘
```

学习者日常仍只需要：

```bash
./cpplearn next
./cpplearn check
./cpplearn status
```

但 `check` 内部调用真实的 CMake/CTest target。到工程化阶段，课程会要求学习者展开并亲自使用这些底层命令。Web 第一版只做只读仪表盘和课程导航，不急着实现在线编辑器、任意可视化和执行沙箱。

这套混合方案保留了：

- CLI 的低认知负担与 AI 稳定接口
- Git/CMake/CTest 的真实工程迁移价值
- Web 的可视化潜力

同时避免一开始建设中型平台。

## 7. 推荐目录

```text
cpp-learn/
├── cpplearn                    # 唯一日常入口
├── curriculum/
│   ├── catalog.json            # 路线与知识依赖图
│   ├── tracks/cpp-web/
│   ├── lessons/
│   ├── exercises/
│   ├── reviews/
│   └── projects/
├── work/                       # 学习者代码，不被内容升级覆盖
├── judge/
│   ├── public/
│   ├── private/                # 教学性隐藏测试
│   └── cmake/
├── platform/
│   ├── cli/
│   ├── judge-core/
│   └── dashboard/              # 后期加入
├── learning/
│   ├── events.jsonl            # 机器事件的唯一事实来源
│   ├── state.json              # 可重建的派生状态
│   ├── reflections/
│   └── teacher-reviews/
├── learning-records/           # 人类可读的关键学习洞见
├── reference/
├── assets/
├── CMakeLists.txt
└── CMakePresets.json
```

内容、学习者代码、私有判题、平台代码和学习记录必须分离，避免课程升级覆盖作业，也避免 AI 教师无意读取答案。

## 8. 课程内容蓝图

### 必修主线

1. **JS/TS → C++ 心智迁移**：编译链接、静态类型、初始化、值语义。
2. **语言基础**：函数、作用域、引用、指针、`const`、字符串、枚举、结构体与类。
3. **现代资源管理**：生命周期、RAII、拷贝/移动、智能指针、错误处理。
4. **标准库**：容器、迭代器、算法、lambda、`optional`、`variant`、ranges 基础。
5. **泛型**：模板、concepts 和可读的泛型接口。
6. **工程能力**：多文件、CMake、测试、Git、调试、Sanitizer、静态分析、性能测量。
7. **数据结构与算法**：复杂度、数组/字符串、哈希、栈队列、树堆图、排序、二分、回溯、动态规划。
8. **系统基础**：进程、线程、虚拟内存、文件、系统调用和 Linux 工具。
9. **网络**：TCP/UDP、socket、HTTP、阻塞/非阻塞、事件循环基础。
10. **数据库**：SQL、索引、事务、SQLite/PostgreSQL 使用与基本原理。
11. **并发与性能**：锁、条件变量、线程池、竞态、死锁、原子与内存模型基础、profiling。
12. **综合项目与面试**：设计、测试、部署、压测、故障复盘和项目追问。

### 选修

- 协程和异步 I/O 深入
- RPC、分布式系统和存储引擎
- AI 推理服务与 Python/C++ 互操作
- 高级模板元编程
- 编译器、运行时与 C++ ABI
- 游戏、音视频或客户端专项

### 建议内容规模

先定义完整知识图谱，不一次性生成全部内容。可将长期目标控制在：

- 80–120 个 20–45 分钟微课程
- 120–180 个练习与变式复习
- 20–30 个系统实验
- 4–5 个渐进项目
- 每个核心概念至少两次不同情境证据和一次延迟回忆

第一版只实现 10–12 节课、15–20 道练习和一个小项目，以验证闭环；否则很容易批量生成低质量内容。

## 9. 判题模型

### 支持的练习类型

- 标准输入/输出题：精确、token、浮点容差比较。
- 函数题：固定 header 接口，由测试 harness 调用。
- 编译诊断题：预期编译失败或要求修复警告。
- 性质测试：确定性随机输入，失败时保存 seed。
- 算法题：正确性、大输入和宽松复杂度门槛。
- 系统实验：文件、子进程、loopback 网络、临时 SQLite。
- 工程题：CMake 构建、服务启动、集成测试和回归。
- 开放设计题：自动检查为基础，AI/人工 rubric 负责解释与取舍。

### 判题流水线

```text
文件契约
  → 编译
  → 公开测试
  → 教学性隐藏测试
  → ASan / UBSan
  → 超时与输出限制
  → 专项性能/并发检查
  → AI 教师 rubric
  → 结构化证据
```

结构化结果不只给总分，而应区分：

```text
compile_error
contract_failure
public_failure
hidden_property_failure
timeout
memory_safety_failure
data_race_suspected
performance_failure
automated_pass
pending_teacher_review
```

普通题的性能和风格检查默认只提示；只有性能专项题才设硬门槛。并发压力测试和 TSan 通过也不能证明不存在竞态，反馈中必须明确这一点。

## 10. 学习记录模型

采用三层记录：

### 原始事件：`learning/events.jsonl`

追加写入，不覆盖历史，是机器状态的唯一事实来源：

```json
{
  "schema": 1,
  "type": "graded_attempt",
  "time": "2027-07-18T10:32:14+08:00",
  "activity": "cpp.references.01",
  "content_version": 2,
  "source_digest": "sha256:...",
  "attempt": 3,
  "hints_used": 1,
  "evidence": {
    "public": "pass",
    "hidden": "pass",
    "asan": "pass",
    "ubsan": "pass",
    "reflection": "pending",
    "transfer": "pending"
  }
}
```

### 派生状态：`learning/state.json`

可随时由事件重建。概念只使用可解释的五级状态：

```text
unseen → introduced → practiced → demonstrated → retained
```

- 阅读课程只到 `introduced`。
- 公开测试通过到 `practiced`。
- 隐藏测试、解释与变式题通过到 `demonstrated`。
- 经过延迟复习仍能独立完成，才到 `retained`。
- 使用完整答案后的同题通过不能贡献 `demonstrated` 证据。

复习间隔先采用简单可解释规则，例如 1、3、7、21、60 天；失败缩短间隔，独立成功延长间隔，提示后成功仍需更早复习。

### 人类记录：`learning-records/*.md`

只记录真正有教学意义的洞见：已有能力、纠正过的误区、方向变化、可迁移的理解。它不是每节课流水账。

## 11. 内容清单示例

每个活动都使用有限字段的 JSON，不允许嵌入任意 shell 命令：

```json
{
  "schema": 1,
  "id": "cpp.references.01",
  "version": 1,
  "kind": "code_lab",
  "title": "引用不是 JavaScript 对象引用",
  "estimated_minutes": 35,
  "concepts": ["cpp.references", "cpp.const"],
  "prerequisites": ["cpp.functions.basic"],
  "workspace": {
    "editable": ["solution.cpp"]
  },
  "judge": {
    "standard": "c++20",
    "stages": ["compile", "public", "hidden", "asan", "ubsan", "timeout"]
  },
  "reviews": ["cpp.references.review.01", "cpp.references.review.02"]
}
```

限制清单能力可以避免课程文件演化成不安全、不可维护的 CI 脚本语言。

## 12. 推荐实施阶段

### 阶段 0：冻结设计

- 选定日常接口和目录。
- 定义 activity、judge result、learning event 三个 schema。
- 定义隐私、安全和内容升级规则。

### 阶段 1：最小闭环

- 实现 `next / check / status`。
- 支持单文件编译、stdin/stdout、公开/隐藏测试、超时、ASan/UBSan。
- 追加尝试事件并重建状态。
- 把现有第一课迁入内容清单。
- 制作 10–12 节课、15–20 道练习和第一个小项目。

### 阶段 2：现代 C++ 主干

- 加入函数题 harness、CMake/CTest、分级提示、变式复习。
- 完成类型、引用、指针、生命周期、RAII、类、STL、拷贝/移动和智能指针主线。
- 加入 AI teacher pack 和主观评审证据。

### 阶段 3：算法与系统实验

- 性质测试、随机 seed、相对性能检查。
- 文件、进程、线程、socket 和 SQLite fixture。
- Linux 可选 CI 或容器验证。

### 阶段 4：渐进项目

- CLI 数据管理器。
- 本地 KV / 日志索引。
- C++ HTTP 服务。
- React/TS + C++ + SQLite 综合项目。

### 阶段 5：Web 仪表盘

- 先做只读课程、状态、复习和尝试历史。
- 再决定是否加入 Monaco、实时编译和交互可视化。
- 不在需求明确前开发任意代码执行可视化或复杂沙箱。

## 13. 推荐结论

如果首要目标是尽快开始并长期坚持，选择方案 A。

如果首要目标是最大化实习和真实工程迁移，选择方案 B。

如果首要目标是做成可展示的产品并愿意承担长期平台开发，选择方案 C。

用户最终选择 Web 优先，同时保留 CLI 入口。确定方案不再采用“最后才做 Web”的顺序，而是从第一阶段就交付 Web 课程、编辑和判题闭环；CLI 与 Web 共享同一个教学核心，不复制业务逻辑。具体决定见 [WEB_PLATFORM_ARCHITECTURE.md](./WEB_PLATFORM_ARCHITECTURE.md)。

选择该方案并不要求一次建完。第一里程碑只需要回答一个问题：学习者能否通过同一个入口完成“选课 → 编码 → 判题 → 记录 → 安排复习”的完整闭环。
