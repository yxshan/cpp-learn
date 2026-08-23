# C++ Learn

面向现代 C++ 软件与 Web 工程方向的本地优先学习平台。当前已验收至 **Stage 5.1：Web 学习体验稳定版**：42 个学习活动覆盖现代 C++、算法与本地系统实践，并提供 Web 课程导航、Monaco 编辑器、Run/Grade 判题、学习证据、延迟复习和本地持久化记录。

训练页在桌面端采用课程与编辑器独立滚动的双栏布局，并提供上一节/下一节导航；窄屏设备自动切换为单栏。CLI 入口与 Web 使用同一套学习、工作区和判题核心。

尚未完成的 Stage 6 将继续扩展网络、数据库、并发、性能、部署方向，以及 4–5 个完整工程项目。当前完成度和验收边界见 [路线图](docs/11-ROADMAP_AND_ACCEPTANCE_PLAN.md)。

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
