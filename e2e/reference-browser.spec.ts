import { expect, test } from "@playwright/test";

import { e2eApiOrigin } from "./runtime.js";

test("[T-REF-006] symbol, header, and Chinese search open std::vector", async ({
  page,
}) => {
  await page.goto("/reference");
  await expect(
    page.getByRole("heading", { name: "查 API，也理解背后的工程约束" }),
  ).toBeVisible();
  const initialResults = page.locator(".reference-results > a");
  const initialCount = await initialResults.count();
  expect(initialCount).toBeGreaterThan(0);
  await expect(page.getByRole("status")).toHaveText(`${initialCount} 个条目`);

  for (const query of ["std::vector", "<vector>", "动态数组"]) {
    const search = page.getByLabel("搜索 C++ API");
    await search.fill(query);
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(query)}`));
    const result = page.getByRole("link", { name: /std::vector 连续存储/ });
    await expect(result).toBeVisible();
    await result.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "std::vector", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(
      /\/reference\/standard-library\/containers\/vector/,
    );
  }
});

test("[T-REF-006] canonical Entry anchors survive reload and history", async ({
  page,
}) => {
  await page.goto(
    "/reference/containers/vector?q=vector#%E5%A4%8D%E6%9D%82%E5%BA%A6",
  );
  await expect(
    page.getByRole("heading", { name: "std::vector", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/reference\/standard-library\/containers\/vector\?q=vector#%E5%A4%8D%E6%9D%82%E5%BA%A6$/,
  );
  await expect(page.locator("#复杂度")).toBeVisible();

  await page.reload();
  await expect(page.locator("#复杂度")).toBeVisible();
  await page.getByLabel("搜索 C++ API").fill("std::sort");
  await page.getByLabel("搜索 C++ API").press("Enter");
  await page.getByRole("link", { name: /std::sort 将随机访问范围/ }).click();
  await expect(
    page.getByRole("heading", { name: "std::sort", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".reference-related")
      .getByRole("link", { name: /std::vector/ }),
  ).toHaveAttribute(
    "href",
    "/reference/standard-library/containers/vector?q=std%3A%3Asort",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "“std::sort”的搜索结果" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "std::vector", exact: true }),
  ).toBeVisible();
});

test("[T-REF-006] category filters survive reload through URL state", async ({
  page,
}) => {
  await page.goto("/reference");
  const algorithms = page.getByRole("button", { name: /^算法/ });
  const categoryCount = await algorithms.locator("small").innerText();
  await algorithms.click();
  await expect(page).toHaveURL(/category=algorithms/);
  await expect(page.getByRole("status")).toContainText(
    `${categoryCount} 个条目`,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /^算法/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("status")).toContainText(
    `${categoryCount} 个条目`,
  );
});

test("[T-REF-006] keyboard table of contents and Activity navigation work", async ({
  page,
}) => {
  await page.goto("/reference/standard-library/containers/vector");
  const complexity = page.getByRole("link", { name: "复杂度", exact: true });
  await complexity.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#%E5%A4%8D%E6%9D%82%E5%BA%A6$/);

  const activity = page
    .locator(".reference-related")
    .getByRole("link", { name: /相关课程/ })
    .first();
  await activity.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/activity=stl-containers-algorithms/);
  await expect(
    page.getByRole("heading", { name: "STL 容器、迭代器与算法" }),
  ).toBeVisible();
  const reference = page.getByRole("link", {
    name: "打开 std::vector API 文档",
  });
  await expect(reference).toHaveAttribute(
    "href",
    "/reference/standard-library/containers/vector",
  );
  await reference.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "std::vector", exact: true }),
  ).toBeVisible();
});

test("[T-REF-006] Markdown tables render as readable semantic tables", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reference/standard-library/headers/unordered-map");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "实体组" }),
  ).toBeVisible();
  await expect(
    table.getByRole("cell", { name: "std::erase_if" }),
  ).toBeVisible();

  const widths = await page
    .locator(".reference-table-scroll")
    .evaluate((element) => ({
      table: element.scrollWidth,
      wrapper: element.clientWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
  expect(widths.table).toBeGreaterThan(widths.wrapper);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test("[T-REF-007] narrow browsing and copy feedback create no learning writes", async ({
  context,
  page,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET")
      writes.push(`${request.method()} ${request.url()}`);
  });
  const workspaceBefore = await request
    .get(`${e2eApiOrigin}/api/v1/workspaces/stl-containers-algorithms`)
    .then((response) => response.json());
  const dashboardBefore = await request
    .get(`${e2eApiOrigin}/api/v1/dashboard`)
    .then((response) => response.json());

  await page.goto("/reference/standard-library/containers/vector");
  await expect(
    page.getByRole("heading", { name: "std::vector", exact: true }),
  ).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  await page.goto(
    "/reference/standard-library/containers/vector#%E5%A4%8D%E6%9D%82%E5%BA%A6",
  );
  const anchoredHeadingTop = await page
    .locator("#复杂度")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(anchoredHeadingTop).toBeGreaterThanOrEqual(171);

  const firstCodeBlock = page.locator(".reference-code-block").first();
  const copy = firstCodeBlock.getByRole("button", { name: "复制代码" });
  await copy.click();
  await expect(
    firstCodeBlock.getByRole("button", { name: "已复制" }),
  ).toBeVisible();
  const workspaceAfter = await request
    .get(`${e2eApiOrigin}/api/v1/workspaces/stl-containers-algorithms`)
    .then((response) => response.json());
  const dashboardAfter = await request
    .get(`${e2eApiOrigin}/api/v1/dashboard`)
    .then((response) => response.json());
  expect(workspaceAfter).toEqual(workspaceBefore);
  expect(dashboardAfter).toEqual(dashboardBefore);
  expect(writes).toEqual([]);
});

test("[T-REF-008] Reference browsing makes no external network request", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      externalRequests.push(request.url());
    }
  });

  await page.goto("/reference?q=unique_ptr");
  await page.getByRole("link", { name: /^类型 std::unique_ptr/ }).click();
  await expect(
    page.getByRole("heading", { name: "std::unique_ptr", exact: true }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("[T-REF-009] edited Reference example runs without changing learning state", async ({
  page,
  request,
}) => {
  const dashboardBefore = await request
    .get(`${e2eApiOrigin}/api/v1/dashboard`)
    .then((response) => response.json());

  await page.goto("/reference/standard-library/containers/vector");
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();
  const editor = page.getByLabel("编辑 vector-basics.cpp");
  await expect(editor).toBeVisible();
  await editor.fill(
    '#include <iostream>\n\nint main() {\n  std::cout << "playground stdout\\n";\n  std::cerr << "playground stderr\\n";\n}\n',
  );
  await page.getByRole("button", { name: "运行代码" }).click();
  await expect(editor).toBeDisabled();

  await expect(page.getByRole("status", { name: "运行结果" })).toContainText(
    "playground stdout",
    { timeout: 10_000 },
  );
  await expect(page.getByRole("status", { name: "运行结果" })).toContainText(
    "playground stderr",
    { timeout: 10_000 },
  );
  await expect(page.getByText("运行成功")).toBeVisible();
  const dashboardAfter = await request
    .get(`${e2eApiOrigin}/api/v1/dashboard`)
    .then((response) => response.json());
  expect(dashboardAfter).toEqual(dashboardBefore);
});

test("[T-REF-009] same-named examples do not leak state across Entry navigation", async ({
  page,
}) => {
  await page.goto("/reference/standard-library/algorithms/count-if");
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();
  const countIfEditor = page.getByLabel("编辑 count-even.cpp");
  await countIfEditor.fill("// state must not cross the Entry boundary\n");

  await page
    .locator(
      '.reference-related a[href="/reference/standard-library/headers/algorithm"]',
    )
    .click();
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();

  await expect(page.getByLabel("编辑 count-even.cpp")).not.toHaveValue(
    /state must not cross/,
  );
});

test("[T-REF-009] Playground exposes bounded failure outcomes and cancellation", async ({
  page,
}) => {
  await page.goto("/reference/standard-library/containers/vector");
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();
  const editor = page.getByLabel("编辑 vector-basics.cpp");
  const run = page.getByRole("button", { name: "运行代码" });
  const status = page.getByRole("status", { name: "运行结果" });

  await editor.fill("int main( {}\n");
  await run.click();
  await expect(status).toContainText("编译失败", { timeout: 10_000 });
  await expect(status).toContainText(/error|错误/i);

  await editor.fill("int main() { return 7; }\n");
  await run.click();
  await expect(status).toContainText("运行失败", { timeout: 10_000 });

  await editor.fill(
    '#include <iostream>\n\nint main() {\n  for (;;) { std::cout << "0123456789"; }\n}\n',
  );
  await run.click();
  await expect(status).toContainText("输出超限", { timeout: 10_000 });

  const sleepingSource =
    "#include <chrono>\n#include <thread>\n\nint main() {\n" +
    "  std::this_thread::sleep_for(std::chrono::seconds(30));\n}\n";
  await editor.fill(sleepingSource);
  await run.click();
  await page.getByRole("button", { name: "取消运行" }).click();
  await expect(status).toContainText("运行已取消", { timeout: 10_000 });

  await editor.fill(sleepingSource);
  await run.click();
  await expect(status).toContainText("运行超时", { timeout: 12_000 });
});

test("[T-REF-009] Reset and explicit discard stay usable at 390 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reference/standard-library/containers/vector");
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();
  const editor = page.getByLabel("编辑 vector-basics.cpp");

  await editor.fill("// reset marker\n");
  await page.getByRole("button", { name: "重置代码" }).click();
  await expect(editor).toHaveValue(/std::vector/);

  await editor.fill("// discard marker\n");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "放弃修改并关闭" }).click();
  await expect(
    page.getByRole("button", { name: "在 Playground 中运行" }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "在 Playground 中运行" })
    .first()
    .click();
  await expect(page.getByLabel("编辑 vector-basics.cpp")).toHaveValue(
    /std::vector/,
  );

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
