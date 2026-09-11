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

  const entryResponse = await page.goto(
    "/reference/standard-library/containers/vector",
  );
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

  // Hardening headers must reach the browser on the real production response,
  // not only in a unit test of the server.
  const headers = entryResponse?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy-report-only"]).toContain(
    "default-src 'self'",
  );
});
