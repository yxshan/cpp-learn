import { expect, test } from "@playwright/test";

test("[T-E2E-001/T-E2E-005] learner completes an explainable C++ learning loop", async ({
  page,
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
  await expect(page.getByText("阶段 05 · 算法与系统")).toBeVisible();

  await page.getByRole("button", { name: "开始第一课" }).click();
  await expect(page).toHaveURL(/activity=source-to-program/);
  await expect(
    page.getByRole("heading", { name: "从源代码到可执行程序" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /上一节/ })).toBeDisabled();

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
