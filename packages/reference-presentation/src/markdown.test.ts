import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { articleHeadings, headingId, parseArticleBlocks } from "./markdown.ts";
import type { ArticleBlock } from "./types.ts";

function collect(blocks: readonly ArticleBlock[]): ArticleBlock[] {
  const all: ArticleBlock[] = [];
  for (const block of blocks) {
    all.push(block);
    if (block.kind === "blockquote") all.push(...collect(block.children));
    if (block.kind === "list") {
      for (const item of block.items) all.push(...collect(item));
    }
  }
  return all;
}

describe("[T-REF-011] shared Reference block model", () => {
  it("parses every published Entry without dropping content", () => {
    const entriesRoot = fileURLToPath(
      new URL("../../../reference/entries", import.meta.url),
    );
    const ids = readdirSync(entriesRoot);
    let parsed = 0;
    const unsupported = new Set<string>();
    for (const id of ids) {
      const path = join(entriesRoot, id, "content.md");
      let markdown: string;
      try {
        markdown = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      parsed += 1;
      for (const block of collect(parseArticleBlocks(markdown))) {
        if (block.kind === "unsupported") unsupported.add(block.nodeType);
      }
    }
    expect(parsed).toBeGreaterThanOrEqual(120);
    expect([...unsupported]).toEqual([]);
  });

  it("keeps outline anchors identical to rendered heading ids", () => {
    const markdown = [
      "# 标题",
      "",
      "## 复杂度",
      "",
      "正文。",
      "",
      "### JS 类比：size()",
      "",
      "正文。",
      "",
    ].join("\n");
    const blocks = parseArticleBlocks(markdown);
    const headings = blocks.filter((block) => block.kind === "heading");
    expect(headings.map((heading) => heading.id)).toEqual([
      headingId("复杂度"),
      headingId("JS 类比：size()"),
    ]);
    expect(articleHeadings(markdown)).toEqual([
      { level: 2, title: "复杂度", id: "复杂度" },
      { level: 3, title: "JS 类比：size()", id: headingId("JS 类比：size()") },
    ]);
  });

  it("marks JavaScript-comparison sections for styling", () => {
    const blocks = parseArticleBlocks("## JS 类比\n\n正文。\n");
    expect(blocks[0]).toMatchObject({
      kind: "heading",
      depth: 2,
      jsComparison: true,
    });
  });

  it("carries GFM table alignment and list nesting", () => {
    const blocks = parseArticleBlocks(
      "| A | B |\n|---:|:---:|\n| 1 | 2 |\n\n- 外层\n  - 内层\n",
    );
    const table = blocks.find((block) => block.kind === "table");
    expect(table).toMatchObject({ kind: "table", align: ["right", "center"] });
    const list = blocks.find((block) => block.kind === "list");
    expect(list?.kind).toBe("list");
    if (list?.kind === "list") {
      const nested = list.items[0]?.find((block) => block.kind === "list");
      expect(nested?.kind).toBe("list");
    }
  });

  it("strips the duplicated leading title", () => {
    const blocks = parseArticleBlocks("# std::vector\n\n正文。\n");
    expect(blocks.some((block) => block.kind === "heading")).toBe(false);
  });
});
