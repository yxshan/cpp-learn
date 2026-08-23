# C++ Learn

面向现代 C++ 软件与 Web 工程方向的本地优先学习平台。当前已验收至 **Stage 6：职业方向完整版本**：70 个学习活动覆盖现代 C++、算法、工程工具、系统、网络、数据库、并发与生产工程，并提供 5 个渐进式作品集项目、Web 课程导航、Monaco 编辑器、Run/Grade 判题、学习证据、延迟复习和本地持久化记录。

训练页在桌面端采用课程与编辑器独立滚动的双栏布局，并提供上一节/下一节导航；窄屏设备自动切换为单栏。CLI 入口与 Web 使用同一套学习、工作区和判题核心。

项目视图会把每个 Milestone 的判题证据追溯到对应 Concept；作品集 Workspace、学习事件和反思可通过显式备份导出，Curriculum 私有判题定义不会进入归档。完整验收边界见 [Stage 6 实施报告](docs/20-STAGE-6-IMPLEMENTATION-REPORT.md)。

## 环境要求

- Node.js 22 或更高版本
- npm
- 支持 C++20 的 `clang++`

## 开始开发

```bash
npm install
npm run dev
```

另开一个终端启动 Web：

```bash
npm run dev:web
```

打开 <http://127.0.0.1:5173>。

CLI 环境检查：

```bash
./cpplearn doctor
./cpplearn doctor --json
./cpplearn next --json
./cpplearn status --json
./cpplearn check --activity source-to-program --json
```

一体化运行（先构建，再由同一个本地服务托管 Web 与 API）：

```bash
npm run build
./cpplearn serve
```

打开 <http://127.0.0.1:4173>。

## 质量门禁

```bash
npm run check
npm run test:e2e
```

该命令依次检查文档链接与需求追踪、生产课程树、格式、Lint、TypeScript、单元/契约测试和 Web 生产构建。

产品与工程设计基线见 [`docs/README.md`](docs/README.md)。
