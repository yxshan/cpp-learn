import { expect, test } from "@playwright/test";

test("[T-E2E-001] learner completes the first local C++ loop", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从第一段 C++ 程序开始" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "开始第一课" }).click();
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

  await page.getByRole("button", { name: "Grade", exact: true }).click();
  await expect(page.getByText("Grade 通过，学习证据已记录")).toBeVisible();

  await page.getByRole("button", { name: "返回总览" }).click();
  await expect(page.getByText("已练习概念")).toBeVisible();
  await expect(page.getByText("GRADE").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});
