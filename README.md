# C++ Learn

面向现代 C++ 软件与 Web 工程方向的本地优先学习平台。当前已完成 **Stage 1：首个学习闭环**，可以在 Web 中阅读课程、编辑并保存 C++、Run、Grade，并把结果持久化为本地学习记录。

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
