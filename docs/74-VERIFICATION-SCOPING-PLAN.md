# 验证范围裁剪方案

| Field | Value |
|---|---|
| Document ID | VERIFY-SCOPE-001 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Prepared by | DeepSeek Harness Agent |
| Fixed point | `739767d` |

本文回答一个问题：**如果只改了一个模块、且逻辑上清楚不可能影响其他模块，能不能少跑验证？**
答案是可以，但**真正的杠杆不在"模块"上**。下面是实测数据与由此得出的方案。

## 1. 时间实际花在哪里（实测）

在 `739767d` 上逐个计时 `npm run check` 的组成部分：

| 步骤 | 耗时 | 占比 |
|---|---:|---:|
| `check:content` | **175s** | 46% |
| `check:reference` | **183s** | 48% |
| `test` | 9s | 2.4% |
| `build` | 6s | 1.6% |
| `typecheck` | 3s | 0.8% |
| `format:check` | 3s | 0.8% |
| `lint` | 2s | 0.5% |
| `check:docs` | 1s | 0.3% |
| `check:reference-quality` | 0s | 0% |
| **合计** | **≈382s** | |

另有 `npm run test:e2e` ≈ 60s（不在 `check` 内）。

**结论：94% 的时间在两个内容编译检查上**。它们编译 C++：`check:content` 编译 70 个 Activity 的
起始代码与参考解，`check:reference` 编译并运行 120 个 Entry 的 226 个示例。
代码侧的门禁（typecheck / lint / test / build / docs）加起来只有约 21s。

这直接推翻了"按代码模块裁剪"的直觉：**按模块裁剪代码门禁，最多省下 15s；按内容裁剪内容门禁，
能省下 350s 以上。**

## 2. 两条独立的裁剪轴

### 轴 A：内容轴（高杠杆）

| 改动 | 现在的代价 | 可裁剪到 |
|---|---:|---|
| 一个 Activity 的 lesson/starter/tests | 175s（全部 Activity） | 已支持：`npm run check:content -- --activity <id>` |
| 一个 Reference Entry 的 content/example | 183s（全部 226 个示例） | **暂不支持**，需新增 `--entry` |
| 一个 Activity 或 Entry 的**元数据/Schema** | 全量 | 不可裁剪 |

`check-content.ts` **已经有** `--activity <id>`，说明这个设计意图已经存在，只是没有推广。
`check-reference.ts` 没有对应能力，永远验证全部示例。

### 轴 B：代码轴（低杠杆）

代码门禁只有约 21s。即便完全按依赖图裁剪，收益上限也就是十几秒。
唯一值得裁的是 `test` 里的 `modules/judge/src/judge.test.ts`（41 测试 / 约 6.8s，占 `npm test`
的七成以上）—— 它只在 judge 或 contracts 变化时需要跑。

## 3. 方案

### 3.1 给 `check-reference.ts` 加按 Entry 限定的能力（最高优先级）

照搬 `check-content.ts` 已有的 `--activity`：

```bash
npm run check:reference -- --entry std-vector          # 只验该 Entry 的示例
npm run check:reference -- --changed                   # 从 git diff 推导
```

`--changed` 用 `git diff --name-only <base> -- reference/entries reference/catalog.json`
推导出受影响的 Entry id。要点：

- **本地验证清单是累积的**：`check-reference.ts` 会写一份
  `.cpp-learn/data/reference-verification.json`。增量运行必须**合并**进已有清单，而不是
  整体覆盖，否则未跑的 Entry 会变成 `not-checked`，Reference 页面会退化成"未验证"。
- `catalog.json`、`entry.json` 的 Schema、或 `reference/` 之外的共享代码变化时，**不接受
  限定**，直接跑全量。
- 预计一个 Entry 的改动从 183s 降到约 5s。

### 3.2 给 `check-content.ts` 加 `--changed`

`--activity` 已存在，但用起来需要手工查 id。补一个 `--changed` 从
`git diff --name-only -- curriculum/` 推导 Activity id，把已存在的能力变得可用。

### 3.3 代码门禁按**声明的**依赖图裁剪

仓库现在的依赖图是干净且无环的：`apps/*` 之间零依赖，`packages/*` 只依赖 `contracts`
（`composition` 例外，它依赖领域模块）。因此"受影响集合"= 改动包 + 其反向依赖闭包。

但这个方案的**收益只有十几秒**，所以它的价值不是省时间，而是**让门禁选择的规则明确并且可审计**。
建议做成 `scripts/check-scope.mjs`：

```bash
npm run check:changed            # 相对 origin/main
npm run check:changed -- --base HEAD~1
```

它必须**打印选中了哪些门禁、以及每个被跳过的门禁的理由**。不解释的跳过就是事故的开始。

## 4. 这个方案成立的前提：边界必须被强制，而不是被声称

"逻辑上清楚不可能影响其他模块"是一句**断言**。当前仓库里没有任何东西阻止：

- `apps/web` 直接 `import "../../cli/src/cli.ts"`；
- 一个模块用相对路径伸手进另一个模块的 `src/` 内部；
- 新包忘记在 `package.json` 里声明依赖，却靠 npm 提升的 `node_modules` 正常 import。

只要出现任一种，依赖图就是**错的**，而基于它做的裁剪会安静地漏检。所以在依赖裁剪之前，
必须先加一道**边界测试**：

> 遍历仓库内所有跨包 import，断言每一个都对应 `package.json` 里声明过的依赖；
> 未被声明的跨包 import 直接让测试失败。

这道测试很便宜（一个脚本 + 一次 glob），但它把"我认为不会影响"变成"机器证明不会影响"。
**没有它，本方案的轴 B 不成立**；有了它，轴 B 才可以从"经验"升级为"规则"。

## 5. 永远不能裁剪的改动

以下变化会改变其他检查的含义，命中任意一条都必须跑全量 `npm run check`（并加跑 E2E）：

| 路径 | 原因 |
|---|---|
| `packages/contracts/**` | 所有包的 DTO 与解析器 |
| 任意 `*.schema.json` | 声明式内容与工件的契约 |
| `package.json`、`package-lock.json` | 依赖解析、工具版本 |
| `tsconfig.json`、`eslint.config.js`、`vitest.config.ts`、`playwright*.config.ts` | 所有检查的执行语义 |
| `packages/composition/**` | 服务端组合根与全部 HTTP 路由 |
| `judge-private/**` | 私有判题输入 |
| `scripts/check-*.ts` | 门禁本身 |

## 6. 风险分级与预期收益

| 级别 | 触发条件 | 跑什么 | 预期耗时 |
|---|---|---|---|
| T0 | 只改 `docs/**` | `check:docs` + 相关文件 Prettier | 约 5s |
| T1 | 只改单个 Activity 的内容 | `check:content --changed` + 相关 E2E | 约 10s |
| T2 | 只改单个 Reference Entry 的内容 | `check:reference --changed` + `check:reference-quality` | 约 10s |
| T3 | 只改叶子包与其反向依赖闭包 | typecheck + lint + `test`（限定）+ build | 约 20s |
| T4 | 命中 §5 或跨领域改动 | 全量 `npm run check` + 两条 E2E | 约 450s |

## 7. 两条约束

1. **裁剪只用于内循环，CI 永远跑全量。** 本地方便迭代，合并门禁不变。
2. **裁剪必须 fail closed。** 路径分类不出来的改动、或边界测试失败时，`check:changed`
   必须退化为全量，而不是猜一个较小的集合。

## 8. 建议的执行顺序

1. **边界测试**（§4）—— 其他两项都依赖它，且它本身就能发现现存问题。
2. **`check-reference --entry/--changed`**（§3.1）—— 单项收益最大，约 180s → 5s。
3. **`check-content --changed`**（§3.2）—— 把已有能力变得可用。
4. **`scripts/check-scope.mjs`**（§3.3）—— 收益最小，但让规则可审计。

前三项都是"给已有机制加参数"，风险低；第四项引入了新的门禁选择逻辑，建议在边界测试
稳定运行一段时间后再做。

本方案由 **DeepSeek Harness Agent** 依据 2026-09-10 在 `739767d` 上的实测耗时编写。
