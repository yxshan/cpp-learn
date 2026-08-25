import { expect, test } from "@playwright/test";

test("[T-REF-008] production Reference works with outbound network blocked", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
      return;
    }
    externalRequests.push(url.href);
    await route.abort("blockedbyclient");
  });

  await page.goto("/reference/standard-library/containers/vector");
  await expect(
    page.getByRole("heading", { name: "std::vector", exact: true }),
  ).toBeVisible();
  const scriptSources = await page
    .locator("script[src]")
    .evaluateAll((scripts) =>
      scripts.map((script) => script.getAttribute("src") ?? ""),
    );
  expect(scriptSources).toEqual([
    expect.stringMatching(/^\/assets\/index-[^/]+\.js$/),
  ]);
  expect(externalRequests).toEqual([]);
});
