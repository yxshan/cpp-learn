import { expect, test } from "@playwright/test";

test("[T-E2E-001/T-E2E-005] learner completes an explainable C++ learning loop", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从第一段 C++ 程序开始" }),
  ).toBeVisible();
  await expect(
    page.locator("#curriculum").getByRole("heading", { name: "课程路径" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Project：CLI 数据管理器 Milestone 1/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Project：CLI 数据管理器 Milestone 3/,
    }),
  ).toBeVisible();
  await expect(page.getByText("阶段 06 · 职业项目路径")).toBeVisible();
  // Compare the rendered count with what the catalog actually activates, so
  // growing the curriculum cannot leave this assertion behind.
  const activated = (await (
    await request.get("/api/v1/activities")
  ).json()) as {
    activities: readonly unknown[];
  };
  await expect(
    page.getByText(`${activated.activities.length} 个学习活动`),
  ).toBeVisible();
  const projects = page.locator("#projects");
  await expect(
    projects.getByRole("heading", { name: "工程项目作品集" }),
  ).toBeVisible();
  await expect(projects.locator(".project-card")).toHaveCount(5);
  await expect(
    projects.getByRole("heading", { name: "Web 与 C++ 服务契约" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "开始第一课" }).click();
  await expect(page).toHaveURL(/activity=source-to-program/);
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /上一节/ })).toBeDisabled();
  await expect(page.getByText("revision 0")).toBeVisible();
  const starterLines = page.locator(".monaco-editor .view-line");
  await expect(starterLines).toHaveCount(8);
  const starterText = (await starterLines.allTextContents())
    .join("\n")
    .replaceAll("\u00a0", " ");
  expect(starterText).toContain("TODO: print");

  const lessonPanel = page.locator(".lesson-panel");
  const codingPanel = page.locator(".coding-panel");
  const editorTopBefore = await codingPanel.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  await lessonPanel.evaluate((element) => {
    element.scrollTop = Math.min(
      900,
      element.scrollHeight - element.clientHeight,
    );
  });
  await expect
    .poll(() => lessonPanel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await codingPanel.evaluate(
      (element) => element.getBoundingClientRect().top,
    ),
  ).toBe(editorTopBefore);

  await page.getByRole("button", { name: /下一节/ }).click();
  await expect(
    page.getByRole("heading", { name: "延迟复习：编译与运行" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/activity=source-to-program-review/);
  await page.getByRole("button", { name: /上一节/ }).click();
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();

  const editor = page.locator(".monaco-editor textarea").first();
  await editor.click({ force: true });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(
    '#include <iostream>\n\nint main() {\n    // My first graded C++ program\n    std::cout << "Hello, C++!\\n";\n    return 0;\n}\n',
  );

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地工作区")).toBeVisible();

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Run 通过（不会计入掌握证据）")).toBeVisible();
  await expect(page.getByText("automated_pass")).toBeVisible();

  await page
    .getByLabel("用自己的话说明编译错误与运行时错误分别发生在哪个阶段。")
    .fill("编译错误发生在生成可执行程序之前；运行时错误发生在进程启动之后。");
  await page.getByRole("button", { name: "保存反思" }).click();
  await expect(
    page.getByText("反思已记录；后续 Grade 会按本次尝试评估证据"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Grade", exact: true }).click();
  await expect(page.getByText("Grade 通过，学习证据已记录")).toBeVisible();

  await page.getByRole("button", { name: "返回总览" }).click();
  await expect(page).not.toHaveURL(/activity=/);
  await expect(page.getByText("已练习概念")).toBeVisible();
  await expect(page.getByText("GRADE").first()).toBeVisible();
  const knowledgeMap = page.locator("#knowledge-map");
  await expect(
    knowledgeMap.getByText("compile-link-run", { exact: true }),
  ).toBeVisible();
  await expect(
    knowledgeMap.getByText("demonstrated", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "Demonstrated Evidence schedules a delayed Review to test retention.",
      )
      .first(),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("[T-UI-001] narrow training layout does not overflow the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?activity=source-to-program");
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  await expect(page.getByRole("button", { name: /下一节/ })).toBeVisible();
});

test("[T-UI-002] browser history protects unsaved learner code", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始第一课" }).click();
  const editor = page.locator(".monaco-editor textarea").first();
  await editor.click({ force: true });
  await page.keyboard.insertText("// unsaved history guard\n");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("当前代码尚未保存");
    await dialog.dismiss();
  });
  await page.goBack();
  await expect(page).toHaveURL(/activity=source-to-program/);
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.goBack();
  await expect(page).not.toHaveURL(/activity=/);
  await expect(
    page.getByRole("heading", { name: "从第一段 C++ 程序开始" }),
  ).toBeVisible();
});

test("[T-UI-003] stale activity responses cannot replace the current workspace", async ({
  page,
}) => {
  for (const path of [
    "**/api/v1/activities/source-to-program-review",
    "**/api/v1/workspaces/source-to-program-review",
  ]) {
    await page.route(path, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
  }

  await page.goto("/?activity=source-to-program");
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /下一节/ }).click();
  await page.getByRole("button", { name: /下一节/ }).click();
  await expect(page).toHaveURL(/activity=values-and-types/);
  await expect(
    page.getByRole("heading", { name: "值、类型与输入输出" }),
  ).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(
    page.getByRole("heading", { name: "值、类型与输入输出" }),
  ).toBeVisible();
});

test("[T-A11Y-001] critical catalog and lesson navigation works by keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#overview")).toBeFocused();

  const allActivities = page.getByRole("button", { name: /^全部/ });
  await allActivities.focus();
  await page.keyboard.press("Space");
  await expect(allActivities).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/catalog=all/);

  const firstActivity = page.getByRole("button", {
    name: /从源代码到可执行程序/,
  });
  await firstActivity.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/activity=source-to-program/);
  const nextActivity = page.getByRole("button", { name: /下一节/ });
  await nextActivity.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "延迟复习：编译与运行" }),
  ).toBeVisible();
});

test("[T-UI-004] Project evidence navigation and interactive traces stay usable on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "项目", exact: true }).click();
  await expect(
    page.locator("#projects").getByText("PORTFOLIO / 5 PROGRESSIVE PROJECTS"),
  ).toBeVisible();
  const anchorPosition = await page.evaluate(() => ({
    sectionTop: document.querySelector("#projects")?.getBoundingClientRect()
      .top,
    headerBottom: document.querySelector(".sidebar")?.getBoundingClientRect()
      .bottom,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(anchorPosition.scrollWidth).toBe(anchorPosition.innerWidth);
  expect(anchorPosition.sectionTop).toBeGreaterThanOrEqual(
    anchorPosition.headerBottom ?? 0,
  );

  await page
    .locator("#projects")
    .getByRole("button", { name: /本地日志索引 Milestone 1/ })
    .click();
  await expect(page).toHaveURL(/activity=local-log-index-m1/);
  await expect(
    page.getByRole("heading", { name: "Portfolio Project 2：本地日志索引" }),
  ).toBeVisible();

  await page.goto("/?activity=network-service-design");
  const trace = page.locator(".network-trace");
  await expect(trace.locator(":scope > li")).toHaveCount(6);
  await expect(trace.locator(":scope > li.current strong")).toHaveText(
    "socket bytes",
  );
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByText("当前步骤 2 / 6")).toBeVisible();

  await page.goto("/?activity=concurrent-task-queues");
  await expect(page.locator(".lifetime-trace")).toBeVisible();
  await expect(page.locator(".network-trace")).toHaveCount(0);
});

test("[T-UI-005] C++ starter code is formatted and editor tools can format or reset the active file", async ({
  page,
}) => {
  await page.route("**/api/v1/workspaces/modern-vocabulary", async (route) => {
    const starter = '#include <iostream>\nint main(){std::cout<<"TODO\\n";}\n';
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        workspace: {
          activityId: "modern-vocabulary",
          revision: 0,
          files: { "main.cpp": starter },
          starterFiles: { "main.cpp": starter },
        },
      }),
    });
  });
  await page.goto("/?activity=modern-vocabulary");
  await expect(
    page.getByRole("heading", { name: "Lambda、optional、variant 与 ranges" }),
  ).toBeVisible();

  const visibleLines = page.locator(".monaco-editor .view-line");
  await expect(visibleLines).toHaveCount(6);
  await expect(page.getByRole("button", { name: "格式化代码" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "重置当前文件" }),
  ).toBeEnabled();

  const editor = page.locator(".monaco-editor textarea").first();
  await editor.click({ force: true });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("int main(){int answer=42;return answer;}");
  await page.getByRole("button", { name: "格式化代码" }).click();
  await expect(
    page.getByText("已格式化 main.cpp；保存后写入工作区"),
  ).toBeVisible();
  await expect(visibleLines).toHaveCount(5);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("恢复为课程初始代码");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "重置当前文件" }).click();
  await expect(
    page.getByText("已重置 main.cpp；保存后写入工作区"),
  ).toBeVisible();
  await expect(visibleLines).toHaveCount(6);

  await page.setViewportSize({ width: 390, height: 844 });
  const editorToolsFit = await page.evaluate(() => {
    const panel = document
      .querySelector(".coding-panel")
      ?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll(".editor-tools button")];
    return Boolean(
      panel &&
      buttons.length === 2 &&
      buttons.every((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.left >= panel.left && bounds.right <= panel.right;
      }),
    );
  });
  expect(editorToolsFit).toBe(true);
});
