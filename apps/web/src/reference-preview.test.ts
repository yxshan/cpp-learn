import { describe, expect, it } from "vitest";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";

import { renderReferenceArticleDocument } from "./reference-preview.js";

describe("[T-AUTH-A2-PREVIEW-002] production Reference preview renderer", () => {
  it("renders GFM tables and production article links into a standalone document", async () => {
    const entry: ReferenceEntryDetail = {
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
      content:
        "# title\n\n| 参数 | 含义 |\n| --- | --- |\n| pos | 插入位置 |\n",
      examples: [],
      sources: [],
      verifiedAt: "2026-09-06",
      relatedActivityIds: [],
    };

    const html = await renderReferenceArticleDocument({
      entry,
      relatedEntries: {
        "std-vector": {
          id: "std-vector",
          slug: "standard-library/containers/vector",
          title: "std::vector",
        },
      },
      currentUrl:
        "http://127.0.0.1:4173/reference/standard-library/containers/vector/insert",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('class="reference-table-scroll"');
    expect(html).toContain("<table>");
    expect(html).toContain(
      'href="/reference/standard-library/containers/vector"',
    );
    expect(html).toContain("--canvas");
  });
});
