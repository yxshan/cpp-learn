import { expect, test } from "@playwright/test";

import { e2eApiOrigin } from "./runtime.js";

test("[T-REF-006] symbol, header, and Chinese search open std::vector", async ({
  page,
}) => {
  await page.goto("/reference");
  await expect(
    page.getByRole("heading", { name: "查 API，也理解背后的工程约束" }),
  ).toBeVisible();
  await expect(page.getByText("15 个条目")).toBeVisible();

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
  await page.getByRole("button", { name: /^算法/ }).click();
  await expect(page).toHaveURL(/category=algorithms/);
  await expect(page.getByText("4 个条目")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /^算法/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("4 个条目")).toBeVisible();
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
