import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";
import { renderArticleDocument } from "@cpp-learn/reference-presentation";

import { ReferenceArticle } from "./ReferenceArticle.js";

/**
 * The Web article renders the shared block model through React and the CLI
 * preview serializes the same model to HTML. These two leaf renderers are the
 * only place where Reference presentation can drift, so this test pins them
 * together: identical heading ids, identical table/code content, and identical
 * visible text.
 */
function headingIds(html: string): string[] {
  return [...html.matchAll(/<h[23] id="([^"]*)"/g)].map((match) =>
    decodeURIComponent(match[1] ?? ""),
  );
}

function visibleText(html: string): string {
  return html
    .replace(/^[\s\S]*<body[^>]*>/i, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tableCells(html: string): string[] {
  return [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((match) =>
    visibleText(match[1] ?? ""),
  );
}

function codeBlocks(html: string): string[] {
  return [...html.matchAll(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)].map(
    (match) =>
      (match[1] ?? "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
  );
}

const entry: ReferenceEntryDetail = {
  schemaVersion: 2,
  catalogVersion: 20,
  id: "std-vector",
  version: 3,
  slug: "standard-library/containers/vector",
  kind: "type",
  title: "std::vector",
  summary: "动态数组，元素连续存储。",
  symbol: "std::vector",
  header: "<vector>",
  namespace: "std",
  since: "c++98",
  deprecatedSince: "c++26-draft",
  aliases: ["vector"],
  categories: ["containers"],
  relatedEntryIds: ["std-array", "std-vector-size"],
  relatedActivityIds: ["stl-containers-algorithms"],
  content: [
    "# std::vector",
    "",
    "## 复杂度",
    "",
    "`push_back` 均摊 O(1)。见 [cppreference](https://en.cppreference.com/w/cpp/container/vector)。",
    "",
    "| 操作 | 均摊 |",
    "| ---: | :---: |",
    "| push_back | O(1) |",
    "| insert | O(n) |",
    "",
    "## JS 类比：Array",
    "",
    "> 与 JavaScript 数组不同，`std::vector` **不**做越界检查。",
    "",
    "1. 先 `reserve`",
    "2. 再 `push_back`",
    "",
    "- 迭代器可能失效",
    "  - 重新分配时全部失效",
    "",
    "```cpp",
    "#include <vector>",
    "",
    "int main() {",
    "  std::vector<int> v{1, 2, 3};",
    "}",
    "```",
    "",
  ].join("\n"),
  examples: [
    {
      id: "basic",
      kind: "run",
      standard: "c++20",
      source: "int main() { return 0; }\n",
      digest: "d1",
      verification: "verified",
      expectedStdout: "",
    },
    {
      id: "compile-only",
      kind: "compile",
      standard: "c++20",
      source: "static_assert(true);\n",
      digest: "d2",
      verification: "not-checked",
    },
  ],
  sources: [
    {
      kind: "primary",
      title: "N4861 [vector]",
      url: "https://eel.is/c++draft/vector",
    },
  ],
  verifiedAt: "2026-09-10",
};

const relatedEntries = {
  "std-array": {
    id: "std-array",
    slug: "standard-library/containers/array",
    title: "std::array",
  },
  "std-vector-size": {
    id: "std-vector-size",
    slug: "standard-library/containers/vector/size",
    title: "std::vector::size",
  },
};

const currentUrl =
  "http://127.0.0.1:4173/reference/standard-library/containers/vector";

describe("[T-REF-012] Web and CLI Reference renderers stay equivalent", () => {
  const react = renderToStaticMarkup(
    <ReferenceArticle
      entry={entry}
      relatedEntries={relatedEntries}
      currentUrl={currentUrl}
    />,
  );
  const html = renderArticleDocument({
    entry,
    relatedEntries,
    currentUrl,
    stylesheet: "",
  });

  it("resolves the same heading anchors", () => {
    expect(headingIds(react)).toEqual(headingIds(html));
    expect(headingIds(html)).toEqual([
      "复杂度",
      "js-类比:array",
      "reference-examples-title",
      "reference-related-title",
    ]);
  });

  it("renders the same table cells and code blocks", () => {
    expect(tableCells(react)).toEqual(tableCells(html));
    expect(tableCells(html)).toEqual([
      "操作",
      "均摊",
      "push_back",
      "O(1)",
      "insert",
      "O(n)",
    ]);
    expect(codeBlocks(react)).toEqual(codeBlocks(html));
    // One fenced Markdown block plus the two Entry examples.
    expect(codeBlocks(html)).toHaveLength(3);
  });

  it("renders the same visible text", () => {
    expect(visibleText(react)).toEqual(visibleText(html));
  });

  it("keeps long-form prose on the block model in both renderers", () => {
    expect(visibleText(html)).toContain("均摊 O(1)");
    expect(visibleText(html)).toContain("与 JavaScript 数组不同");
    expect(visibleText(html)).toContain("重新分配时全部失效");
    expect(visibleText(html)).toContain("std::array");
    expect(visibleText(html)).toContain("N4861 [vector]");
  });
});
