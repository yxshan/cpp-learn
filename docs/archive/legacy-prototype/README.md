# 原型归档

这里是项目早期原型的归档。**其中任何内容都不是当前运行时路径**：Curriculum adapter 不激活
它们，Reference loader 不加载它们，生产构建不打包它们。保留它们只是为了不丢失历史材料。

归档前已用两步确认无引用：全仓搜索 `assets/`、`lessons/`、`exercises/`、`learning-records/`
与 `compile-run-debug.html`，`apps/`、`modules/`、`packages/`、`scripts/`、`.github/` 与
`curriculum/`、`reference/` 中零命中；随后完整门禁与浏览器 E2E 通过。

## 内容

| 路径 | 原位置 | 归档原因 |
|---|---|---|
| `assets/course.css` | 根 `assets/` | 仅供下面两个静态页面使用 |
| `lessons/0001-source-to-program.html` | 根 `lessons/` | 第一课的静态 HTML 原型，不是当前课程内容 |
| `reference/compile-run-debug.html` | 生产 `reference/` 根 | 早期静态速查页，不属于当前 Entry renderer |
| `learning-records/0001-existing-frontend-foundation.md` | 根 `learning-records/` | 早期人工学习记录，不是事件存储 |
| `exercises/0001-first-program/` | 根 `exercises/` | 原型练习；见下 |

同一目录内保留了原有的相对结构（`lessons/` 引用 `../assets/` 与 `../reference/`），因此页面
在归档内仍可打开。

## `exercises/0001-first-program/`

- `check.sh` 直接在宿主机编译并运行程序，**没有超时、输出上限、环境过滤或进程组清理**。
  文件头已标注它不是判题路径。运行与判分 Activity 的正确入口是 CLI：

  ```bash
  ./cpplearn check --activity <activity-id>
  ```

- `first_program` 曾是一个已提交的 arm64 Mach-O 可执行文件。它无法通过代码审查证明来源，
  因此已从 Git 删除；同目录的 `.gitignore` 保证重新编译的产物不会被再次提交。

不要扩展这些文件，也不要把它们的结果当作学习证据。
