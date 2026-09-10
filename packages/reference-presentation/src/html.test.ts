import { describe, expect, it } from "vitest";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";

import { renderArticleDocument } from "./html.ts";

function entryFixture(
  overrides: Partial<ReferenceEntryDetail> = {},
): ReferenceEntryDetail {
  return {
    schemaVersion: 2,
    catalogVersion: 20,
    id: "std-vector-insert",
    version: 1,
    slug: "standard-library/containers/vector/insert",
    kind: "member",
    title: "std::vector::insert",
    summary: "插入元素。",
    aliases: [],
    categories: ["containers"],
    relatedEntryIds: ["std-vector"],
    content: "# title\n\n| 参数 | 含义 |\n| --- | --- |\n| pos | 插入位置 |\n",
    examples: [],
    sources: [],
    verifiedAt: "2026-09-06",
    relatedActivityIds: [],
    ...overrides,
  };
}

describe("[T-AUTH-A2-PREVIEW-002] production Reference preview renderer", () => {
  it("renders GFM tables and production article links into a standalone document", () => {
    const html = renderArticleDocument({
      entry: entryFixture(),
      relatedEntries: {
        "std-vector": {
          slug: "standard-library/containers/vector",
          title: "std::vector",
        },
      },
      currentUrl:
        "http://127.0.0.1:4173/reference/standard-library/containers/vector/insert",
      stylesheet: ":root { --canvas: #fff; }",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('class="reference-table-scroll"');
    expect(html).toContain("<table>");
    expect(html).toContain(
      'href="/reference/standard-library/containers/vector"',
    );
    expect(html).toContain("--canvas");
  });

  it("keeps the search context on related Entry links", () => {
    const html = renderArticleDocument({
      entry: entryFixture(),
      relatedEntries: {
        "std-vector": {
          slug: "standard-library/containers/vector",
          title: "std::vector",
        },
      },
      currentUrl:
        "http://127.0.0.1:4173/reference/standard-library/containers/vector/insert?q=vector",
    });
    expect(html).toContain(
      'href="/reference/standard-library/containers/vector?q=vector"',
    );
  });

  it("escapes markup and never emits raw Entry HTML", () => {
    const html = renderArticleDocument({
      entry: entryFixture({
        summary: "<script>alert(1)</script>",
        content: "# t\n\n< img > 和 `a < b`\n",
      }),
      relatedEntries: {},
      currentUrl: "http://127.0.0.1:4173/reference/x",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt; img &gt;");
    expect(html).toContain("<code>a &lt; b</code>");
  });

  it("renders the collapsed Playground control only for run examples", () => {
    const example = {
      id: "basic",
      kind: "run" as const,
      standard: "c++20" as const,
      path: "examples/basic.cpp",
      source: "int main() {}\n",
      digest: "d",
      verification: "not-checked" as const,
    };
    const withRun = renderArticleDocument({
      entry: entryFixture({ examples: [example] }),
      relatedEntries: {},
      currentUrl: "http://127.0.0.1:4173/reference/x",
    });
    expect(withRun).toContain('class="reference-playground-toggle"');
    expect(withRun).toContain('aria-expanded="false"');

    const withCompile = renderArticleDocument({
      entry: entryFixture({
        examples: [{ ...example, kind: "compile" as const }],
      }),
      relatedEntries: {},
      currentUrl: "http://127.0.0.1:4173/reference/x",
    });
    expect(withCompile).not.toContain("reference-playground-toggle");
  });
});
