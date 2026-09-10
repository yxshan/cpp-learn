# 当前安全审计

| Field | Value |
|---|---|
| Document ID | SEC-AUDIT-001 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Audit date | 2026-09-09 |
| Fixed point | `8f99f7e8f23d5732b88dccb2df07c9fd1a953093` |

## 1. 结论

本轮没有发现能够从公网直接攻击当前应用的路径，也没有发现已提交的明显密钥、动态
SQL 拼接、Shell 字符串执行或 Reference 原始 HTML 注入。服务配置拒绝非回环地址，
因此当前部署边界仍是“本机、单用户、可信内容”。

但项目不能据此被描述为安全沙箱。本轮确认了 1 项高风险架构边界、3 项中风险问题、
4 项低风险或防御纵深问题：

| ID | 严重度 | 结论 | 当前状态 |
|---|---|---|---|
| SEC-F01 | High | Native Judge 可访问宿主机文件、网络和进程资源 | 已知且文档化，尚无强隔离 |
| SEC-F02 | Medium | Activity Run/Grade 没有全局并发准入和 CPU/内存上限 | 未修复 |
| SEC-F03 | Medium | Monaco 的生产依赖链包含受公告影响的 DOMPurify 3.4.8 | 未修复 |
| SEC-F04 | Medium | CI 声明与实际不一致，未执行依赖/密钥扫描，Action 也未固定到提交 | 未修复 |
| SEC-F05 | Low | 本地写接口只验证回环 hostname，接受任意端口和缺失的 `Origin` | 部分控制 |
| SEC-F06 | Low | 归档恢复没有统一的文件数、解码后字节数和 CLI 输入上限 | 部分控制 |
| SEC-F07 | Low | 长期运行进程中的命令回执与 Job 事件没有淘汰策略 | 未修复 |
| SEC-F08 | Low | 仓库含 Legacy 可执行文件和绕过 Judge 边界的检查脚本 | 不在生产路径，但仍可被手动执行 |

此外，生产 HTTP 响应没有显式 CSP、`frame-ancestors`、`nosniff` 和 Referrer Policy。
在本地单用户模型下将其记录为 Hardening observation，而不是单独提高总体严重度。

当前优先级应先处理 SEC-F02、SEC-F03 和 SEC-F04；SEC-F01 不能通过小修补消除，
应在运行第三方代码、导入不可信练习或开放非回环访问之前完成容器/虚拟机隔离。

## 2. 范围与方法

### 2.1 已检查范围

- `apps/server` 的绑定、请求验证、写路由、归档接口和静态资源托管；
- `apps/web` 的 Markdown、链接、Monaco 和 API 调用；
- `modules/judge` 的编译、执行、超时、输出和进程终止；
- `modules/workspace`、`modules/learning-record` 的路径和持久化；
- `modules/reference`、`modules/reference-authoring` 的内容激活、路径和示例验证；
- `packages/reference-schema` 的 Reference Schema；
- npm 生产/开发依赖、当前 Git 跟踪文件和 GitHub Actions；
- 现有安全规范、ADR 与实现声明。

### 2.2 执行的方法

1. 静态追踪浏览器到 Fastify、Learning Platform、Judge 和文件系统的数据流。
2. 搜索 Shell 执行、动态 SQL、原始 HTML、危险 URL、密钥模式和可执行文件。
3. 使用 npm 官方 Audit API 检查完整依赖树和仅生产依赖树。
4. 将现有安全规范中的控制逐项与实现对照。
5. 复用已有路径、Origin、归档、私有判题和进程边界测试作为证据。

本轮没有执行恶意 C++ 样例、Fork bomb、内存耗尽、浏览器渗透、网络抓包、模糊测试、
Git 历史密钥扫描或第三方 SAST。结论只适用于上述固定点和当前支持的本地单用户模型。

## 3. 严重度口径

| 等级 | 本项目含义 |
|---|---|
| Critical | 在当前支持方式下可低门槛远程控制宿主机、泄露大量隐私或破坏全部数据 |
| High | 可造成宿主机级影响，但需要用户运行代码、导入内容或满足本地前提 |
| Medium | 有实质影响且控制不完整，需要本地访问、并发、特定依赖用法或供应链前提 |
| Low | 防御纵深、长期稳定性或需要较强本地能力/显式用户操作的问题 |
| Info | 已验证的正向控制、维护建议或当前不可利用的观察项 |

“当前严重度”不等于“扩展部署后的严重度”。任何非回环、多用户或不可信代码场景都
必须重新建模；SEC-F01 在这些场景下是发布阻断项。

## 4. 详细发现

### SEC-F01：Native Judge 不是主机安全沙箱

**严重度：High；状态：Known / Accepted for trusted local use**

`modules/judge/src/index.ts` 使用参数数组和 `shell: false`，为子进程设置临时工作目录、
最小环境、墙钟超时、输出上限和进程组终止。这些控制能够减少命令注入、失控输出和
普通死循环，但不能阻止被执行程序：

- 读取当前系统用户有权访问的文件，例如 SSH 密钥、浏览器数据或其他项目；
- 建立外部网络连接并传出数据；
- 创建大量进程/线程或快速申请内存；
- 调用操作系统接口影响同一用户的其他进程；
- 在超时发生前消耗主机 CPU、内存、文件描述符和磁盘。

`HOME` 和 `TMPDIR` 指向临时目录只是减少误访问，不是文件系统隔离。当前 README、
`docs/08-SECURITY_AND_PRIVACY.md` 和 ADR-0004 已明确 Native 模式不是强沙箱，因此这
不是文档遗漏，而是尚未消除的架构风险。

**现实攻击/事故路径**：学习者从论坛、AI 回复或外部题目复制一段 C++ 代码后点击
Run/Grade。代码看似普通，但可直接读取并上传宿主机文件；更常见的非恶意事故是内存
无限增长或进程爆炸使本机失去响应。

**建议**：

1. 当前 UI 在首次执行和导入外部代码时继续明确显示“在本机运行、不是沙箱”。
2. 在 Native 模式增加可用的 OS 资源限制，但不要把它描述成完整隔离。
3. 建立 `JudgeExecutionAdapter` 的容器/轻量 VM 实现：只读工具链、最小挂载、非特权用户、
   禁网、PID/CPU/内存/文件描述符/磁盘配额、seccomp 或平台等价控制。
4. 任何远程访问、多人使用、第三方课程包或自动执行 AI 代码的需求，都必须以隔离适配器
   和独立威胁模型为前置门禁。

**验收**：恶意样例不能读取宿主机哨兵文件、访问外网、看到宿主环境变量、创建超额
进程或突破资源预算；隔离失败时 Grade 必须 fail closed。

### SEC-F02：Activity Judge 缺少全局并发准入和强资源预算

**严重度：Medium；状态：Open**

Reference Playground 在 `apps/server/src/server.ts` 中默认限制为一个并发运行，繁忙时
返回 `429`。Activity Run/Grade 则直接进入 `LearningPlatform.dispatch()`；
`activeJobs` 只保存取消控制器，没有并发阈值或队列长度上限。不同 `commandId` 可以同时
启动多个编译/测试任务。

Judge 有每个子进程的墙钟与输出限制，但没有统一的进程数、CPU、内存和磁盘预算。
这与 `docs/08-SECURITY_AND_PRIVACY.md` 中“Queue concurrency limits”的现行表述不完全
一致：该控制只完整落在 Reference Playground，并未覆盖课程 Run/Grade。

**影响**：本地脚本、浏览器扩展或未来误开放的客户端可以并发创建大量编译器和被测
进程，造成资源耗尽。即使请求来自正常 UI，重复点击、多个标签页或异常重试也可能放大
问题。

**建议**：

1. 在 Learning/Server 边界建立共享 Judge admission controller，配置全局并发数和有限
   队列；过载返回 `429` 和 `Retry-After`。
2. 将 Reference Playground 和 Activity Judge 接入同一宿主资源预算，而不是各自计数。
3. 对取消、客户端断开、服务关闭和 Judge 崩溃验证槽位必然释放。
4. 容器适配器完成前，至少使用操作系统可用的 CPU/地址空间/进程数限制降低事故影响。

**验收**：高并发测试证明实际编译/执行进程不超过配置上限，排队数量有界，取消和异常
不会泄漏令牌，服务在过载后仍能继续处理健康检查与普通查询。

### SEC-F03：Monaco 生产依赖链包含受影响的 DOMPurify

**严重度：Medium；状态：Open**

2026-09-09 的 `npm audit --omit=dev --json` 报告 1 个 Moderate、1 个 Low 依赖项。
依赖链为：

```text
@monaco-editor/react 4.7.0
  -> monaco-editor 0.56.0
     -> dompurify 3.4.8
```

DOMPurify 3.4.8 落在四个公告的受影响范围内：

- [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4)
- [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882)
- [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9)
- [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)

未发现应用代码调用 `DOMPurify.setConfig()`、自定义 hooks、`CUSTOM_ELEMENT_HANDLING`、
`dangerouslySetInnerHTML` 或 `rehypeRaw`。Reference 使用 `react-markdown` 默认安全 URL
转换，Source Schema 只接受 HTTPS。因此当前尚未证明这些公告可由本项目内容触发，实际
暴露低于一个接收任意富文本的公网编辑器；但 Monaco 位于生产包且 DOMPurify 确实会被
打包，不能把 Audit 结果当成误报删除。

npm 给出的自动修复候选是 `monaco-editor@0.53.0`，属于 0.x 版本回退且被标记为 breaking
change。不要直接执行 `npm audit fix --force`。

**建议**：

1. 查询 Monaco 官方支持版本中是否已升级到不受影响的 DOMPurify，再做常规升级。
2. 若只能使用 npm `overrides`，先固定一个不在公告范围的 DOMPurify 版本，并完成 Monaco
   编辑、诊断 hover、格式化、Reference Playground 和生产构建 E2E；不能仅看安装成功。
3. 将 `npm audit --omit=dev` 加入 CI 的安全 Job，并制定临时豁免文件、责任人和到期日，
   避免不可修公告永久阻塞普通质量 Job。

**验收**：`npm audit --omit=dev` 不再报告这些公告；Monaco 相关组件测试和真实浏览器
E2E 通过；生产构建中不再包含受影响版本。

### SEC-F04：CI 安全控制与规范不一致

**严重度：Medium；状态：Open**

`docs/08-SECURITY_AND_PRIVACY.md` 声明 CI 应执行 dependency 和 secret scanning，但
`.github/workflows/ci.yml` 目前只有安装、`npm ci` 和 `npm run check`。本轮已存在的
DOMPurify 公告因而不会让 PR 或 main 构建显式失败，也没有历史密钥扫描或代码扫描。

此外，工作流使用 `actions/checkout@v4`、`actions/setup-node@v4` 这类可移动标签，LLVM
通过未固定版本的 Homebrew formula 安装。GitHub 官方说明，完整 commit SHA 是 Action
不可变固定的方式：[Secure use reference](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)。

**建议**：

1. 新增独立 `security` Job：生产依赖 Audit、当前树和历史密钥扫描、必要的 SAST。
2. 固定 GitHub Actions 到经核对的完整 commit SHA，并由 Dependabot/Renovate 提交升级。
3. 对 LLVM 记录版本和编译器 fingerprint；若固定 formula 不现实，至少将实际版本作为
   构建证据输出。
4. 增加根 `SECURITY.md`，说明支持范围、漏洞报告渠道和 Native Judge 限制。
5. 安全 Job 与功能 Job 分离，使失败原因和临时豁免清晰可审计。

**验收**：用一个受控的测试公告/密钥 fixture 证明检查会失败；Action SHA 可追溯到官方
仓库 release；豁免必须包含原因、责任人和过期时间。

### SEC-F05：本地写接口的来源验证不是完整授权

**严重度：Low；状态：Partially mitigated**

服务只能绑定 `127.0.0.1`、`::1` 或 `localhost`，写路由也会拒绝非回环 Origin。这是有效
控制。但 `isAllowedMutationOrigin()` 只比较 protocol 与 hostname：

- `http://127.0.0.1:3000` 会被运行在 `127.0.0.1:4173` 的服务接受；
- 没有 `Origin` 的请求直接被接受；
- 没有每次启动的随机令牌、认证或目标 origin 的精确比较。

浏览器同源策略和当前未启用 CORS 会阻止多数跨源 JSON 请求，因此这不是普通公网 CSRF
等价物；同时，能以同一用户运行任意本地进程的攻击者本就拥有更强权限。不过，恶意本地
Web 服务、扩展、代理错误或未来 CORS 变化会削弱这一假设。OWASP 建议将来源 origin 与
目标 origin（包括端口）完整比较，无法确认来源时优先拒绝，并对状态修改使用不可由跨源
页面附加的自定义请求头：[CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#using-standard-headers-to-verify-origin)。

**建议**：服务启动时生成随机 session token，通过同源 bootstrap 注入 Web，并要求所有
写请求以自定义 Header 回传；同时精确比较 scheme、host 和 port。CLI 可从只允许当前用户
读取的本地文件或父进程传递 token。继续禁止宽松 CORS，并增加 `Sec-Fetch-Site` 防御纵深。

**验收**：其他 localhost 端口、缺失/`null` Origin、错误 Host、错误 token 和跨站 Fetch
均不能修改 Workspace、启动 Judge、写学习记录或恢复归档；Web 与 CLI 正常工作。

### SEC-F06：归档恢复资源边界不完整

**严重度：Low；状态：Partially mitigated**

Web restore 路由有 64 MiB 请求上限，归档会验证 Schema、路径、重复项、逐文件 checksum、
manifest checksum 和 `events.jsonl`，并先写 staging root、重建投影、再原子切换。这些是
很好的完整性和回滚控制。

仍存在以下资源问题：

- CLI `restore --input` 会一次性读取任意大小 JSON，没有输入字节上限；
- `parseArchive()` 会逐项 Base64 解码来校验，写 staging 时再次解码；
- 没有文件数量、单文件解码后大小、总解码后大小和事件数量上限；
- 导出同样将全部文件和 Base64 内容聚合在内存中。

当前恢复需要用户显式选择本地文件，Web 还要求 `confirm: true`，所以严重度为 Low。若未来
支持下载链接、共享备份或自动导入，风险应提升为 Medium。

**建议**：在 Web 与 CLI 共用的 archive domain policy 中定义输入 JSON、文件数、单文件、
总解码字节、事件行和路径长度预算；尽可能流式解析/校验/写入。超限必须在切换根目录前
失败并清理 staging。

### SEC-F07：进程内回执和 Job 事件无淘汰策略

**严重度：Low；状态：Open**

`LearningPlatform` 中的 `commandReceipts` 和 `retainedJobEvents` 会按每个新命令/Job 增长，
当前没有 TTL、最大项数或持久化后淘汰策略。长期学习会缓慢增长；配合大量不同 command
ID 的本地请求可形成内存型拒绝服务。

**建议**：定义幂等窗口和 Job 查询保留期；完成的 Promise 只保留有限 LRU/TTL，持久化
回执由 Learning Record 提供；事件流只保留查询所需的有界尾部。不得在运行中的 Job 被
取消前淘汰其控制器。

### SEC-F08：Legacy 目录包含可执行产物和无边界执行脚本

**严重度：Low；状态：Open / outside production path**

`exercises/0001-first-program/first_program` 是已提交的 arm64 Mach-O 二进制，无法仅通过
代码审查证明其来源；同目录 `check.sh` 直接在宿主机调用 `clang++` 并执行学习者程序，
没有 Judge 的超时、输出、最小环境和进程组控制。

当前 README 和文件地图已将根 `exercises/` 标记为 Legacy，生产 Curriculum 不引用它，
所以它不是 Web Run/Grade 的隐藏执行路径。但仓库使用者仍可能手动运行脚本或二进制。

**建议**：完成现有 Legacy 归档任务时从 Git 删除编译产物，将该名称加入局部 `.gitignore`；
若保留脚本，改成调用正式 CLI/Judge 或明确标注“不受限宿主执行”，不要维护第二套判题
路径。删除前先确认没有教学证据依赖该文件。

## 5. Hardening observations

### 5.1 HTTP 安全响应头

Fastify 当前没有统一设置 CSP、`X-Content-Type-Options: nosniff`、
`Referrer-Policy`、`frame-ancestors` 或等价点击劫持控制。Reference Source 链接使用
`target="_blank"` 和 `rel="noreferrer"`，Schema 只允许 HTTPS，这是正向控制；统一响应头
仍能降低未来引入富内容或第三方资源后的影响。可参考 [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
与 [MDN X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)。

Monaco worker 与 Vite 资源可能影响 CSP 规则。建议先用 `Content-Security-Policy-Report-Only`
验证，再收敛到 production policy；本地 HTTP 不应机械添加只适用于 HTTPS 的 HSTS。

### 5.2 Reference Authoring 示例执行

Reference 示例验证与作者工具复用了 bounded process，但环境只设置 `TMPDIR`，没有像
课程 Judge 一样把 `HOME` 也指向临时根。它同样不是强沙箱。已发布仓库内容是可信输入，
风险较低；AI 生成或外部贡献的草稿在人工审阅前不应自动执行。建议统一执行环境政策，
并在未来接入与 SEC-F01 相同的隔离适配器。

### 5.3 路径竞态

Workspace、Reference 和 Authoring 已进行词法路径限制、`realpath`/`lstat` 和符号链接拒绝，
归档恢复也在 staging root 中完成。检查与使用之间仍可能被同一用户的另一个本地进程替换
路径，这是常见 TOCTOU 残余。当前单用户模型下为低优先级；如需抵抗并发本地攻击者，
应采用目录文件描述符相对操作、`O_NOFOLLOW` 或平台等价机制。

## 6. 已验证的正向控制

| 控制 | 证据与结论 |
|---|---|
| 回环绑定 | `resolveServerAddress()` 拒绝 `0.0.0.0` 和任意非回环 host |
| Shell 注入 | 生产执行使用 `spawn(executable, args)` 与 `shell: false`；未发现拼接 shell 命令 |
| 输出/超时 | Judge 与 Reference 示例执行具有墙钟、输出上限、取消和进程组终止 |
| Reference 并发 | Playground 默认单并发，过载返回 `429` |
| Workspace 路径 | 编辑文件采用 allowlist；拒绝绝对路径、`..`、反斜线、NUL、设备名和符号链接 |
| Reference 路径 | Schema safe path 加载后再做 realpath root confinement |
| Authoring 发布 | CAS、lock、staging、backup 和原子 root swap；拒绝越界及符号链接 |
| 归档完整性 | 文件/manifest checksum、重复路径、事件解析、投影重建和失败回滚 |
| SQL 注入 | 动态值使用 SQLite prepared statements；`database.exec()` 只执行静态迁移/事务 |
| Markdown/XSS | 未启用 raw HTML/MDX；`react-markdown` 默认 URL transform 拒绝危险 scheme |
| 外部链接 | Reference Source Schema 只接受 HTTPS；新标签链接带 `rel="noreferrer"` |
| 私有 Judge | 浏览器 DTO 和 Teacher Pack 排除 private-test 输入与期望值 |
| 环境泄露 | Native Judge 子进程使用最小环境，不继承完整 `process.env` |
| 密钥扫描 | 对当前跟踪树的常见私钥、AWS、GitHub 和 OpenAI token 模式扫描无命中 |
| 锁文件 | `package-lock.json` 已提交，CI 使用 `npm ci` |

“无命中”不证明仓库历史从未包含密钥，也不替代专用 secret scanner。

## 7. 修复路线

### P0：下一次功能扩展前

1. SEC-F03：选择并验证无公告的 Monaco/DOMPurify 依赖组合。
2. SEC-F04：增加依赖与密钥扫描，固定 GitHub Actions SHA。
3. SEC-F02：为所有 Judge 入口增加共享并发准入与有限队列。
4. 每项修复完成后同步 `docs/08-SECURITY_AND_PRIVACY.md`，持续区分“已实现”和“未来控制”。

### P1：本地产品加固

1. SEC-F05：每次启动 session token、精确 target origin、Fetch Metadata。
2. SEC-F06：统一归档预算并增加恶意归档测试。
3. SEC-F07：为回执和 Job 事件设置有界保留策略。
4. 增加 CSP Report-Only、`nosniff`、Referrer Policy 和 frame policy。
5. 增加 `SECURITY.md` 与安全回归测试组。

### P2：范围扩展门禁

1. SEC-F01：容器/轻量 VM Judge Adapter 和 fail-closed 证明。
2. 隔离 Reference Authoring 的草稿示例执行。
3. 完成独立渗透测试、恶意 C++ corpus 和恢复/资源模糊测试。

以下任一需求出现时，P2 自动升级为阻断项：监听非回环地址、多人账户、远程部署、第三方
课程包、共享备份、自动运行 AI 生成代码、把判题作为公共 API。

## 8. 建议验证命令

```bash
npm audit --omit=dev
npm ls monaco-editor dompurify
npm run check
npm run test:e2e:production
git diff --check
```

新增安全门禁后还应提供稳定命令，例如：

```bash
npm run check:security
npm run test:security
```

不要在安全报告中保存真实 token、完整用户源代码、私有 Judge 输入或本地绝对凭据路径。

## 9. 处置原则

- 本文是审计结果，不自动改变已接受 ADR；架构边界变化应新增或修订 ADR。
- 修复应按 finding 分成小提交，不把依赖升级、Judge 隔离、目录归档和 UI 改版混在一起。
- 若选择暂不修复，必须记录接受人、理由、适用部署范围、补偿控制和复审日期。
- 修复完成后更新状态与证据，不直接删除 finding；保留审计轨迹。
- 每次依赖、执行边界、导入格式、监听地址或信任模型变化后重新审计。

本审计由 **GPT-5.6 Sol** 完成。
