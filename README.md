# C++ Learn

面向现代 C++ 软件与 Web 工程方向的本地优先学习平台。当前处于 **Stage 0：工程基线**，已具备共享核心、Web 控制台、CLI、课程契约校验、工具链探测和本地学习记录初始化。

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
```

## 质量门禁

```bash
npm run check
```

该命令依次检查文档链接与需求追踪、Lint、TypeScript、单元/契约测试和 Web 生产构建。

产品与工程设计基线见 [`docs/README.md`](docs/README.md)。
