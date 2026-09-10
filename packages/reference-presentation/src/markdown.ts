import type { Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString as mdastToString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";

import type {
  ArticleBlock,
  ArticleHeading,
  ArticleInline,
  TableAlignment,
} from "./types.ts";

/**
 * Stable anchor id for a heading. The Web table of contents, the in-article
 * anchors, and the CLI preview all derive ids from this one function, so a deep
 * link keeps working across every consumer.
 */
export function headingId(title: string): string {
  return title
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[<>`'"“”‘’()[\]{}]/g, "")
    .replace(/[^\p{L}\p{N}_:+-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const JS_COMPARISON_PATTERN = /javascript|js\s*类比/i;

function parseInline(nodes: readonly RootContent[]): ArticleInline[] {
  const inline: ArticleInline[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        inline.push({ kind: "text", value: node.value });
        break;
      case "inlineCode":
        inline.push({ kind: "code", value: node.value });
        break;
      case "strong":
        inline.push({ kind: "strong", children: parseInline(node.children) });
        break;
      case "emphasis":
        inline.push({
          kind: "emphasis",
          children: parseInline(node.children),
        });
        break;
      case "link":
        inline.push({
          kind: "link",
          href: node.url,
          children: parseInline(node.children),
        });
        break;
      default:
        inline.push({ kind: "text", value: mdastToString(node) });
        break;
    }
  }
  return inline;
}

function toAlignment(value: unknown): TableAlignment | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined;
}

function parseBlocks(nodes: readonly RootContent[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        blocks.push({
          kind: "paragraph",
          children: parseInline(node.children),
        });
        break;
      case "heading": {
        const title = mdastToString(node);
        const depth = node.depth <= 2 ? 2 : 3;
        blocks.push({
          kind: "heading",
          depth,
          id: headingId(title),
          title,
          jsComparison: JS_COMPARISON_PATTERN.test(title),
          children: parseInline(node.children),
        });
        break;
      }
      case "code":
        blocks.push({
          kind: "code",
          value: node.value,
          ...(node.lang ? { language: node.lang } : {}),
        });
        break;
      case "blockquote":
        blocks.push({
          kind: "blockquote",
          children: parseBlocks(node.children),
        });
        break;
      case "list": {
        const start =
          node.ordered === true && node.start !== null && node.start !== 1
            ? node.start
            : undefined;
        blocks.push({
          kind: "list",
          ordered: node.ordered === true,
          items: node.children.map((item) => parseBlocks(item.children)),
          ...(start === undefined ? {} : { start }),
        });
        break;
      }
      case "table": {
        const align = (node.align ?? []).map(toAlignment);
        const [headerRow, ...bodyRows] = node.children;
        blocks.push({
          kind: "table",
          header: (headerRow?.children ?? []).map((cell) =>
            parseInline(cell.children),
          ),
          rows: bodyRows.map((row) =>
            row.children.map((cell) => parseInline(cell.children)),
          ),
          align,
        });
        break;
      }
      default:
        blocks.push({ kind: "unsupported", nodeType: node.type });
        break;
    }
  }
  return blocks;
}

function parseTree(markdown: string): Root {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

/**
 * Parses Entry Markdown into the shared block model. The leading `#` title is
 * removed because the article header already renders the Entry title.
 */
export function parseArticleBlocks(markdown: string): readonly ArticleBlock[] {
  return parseBlocks(parseTree(markdown.replace(/^#\s+.+\n+/, "")).children);
}

/**
 * Table of contents entries. Uses the same parser and id function as the
 * rendered article so anchors cannot drift from the outline.
 */
export function articleHeadings(markdown: string): readonly ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const visit = (blocks: readonly ArticleBlock[]): void => {
    for (const block of blocks) {
      if (block.kind === "heading") {
        headings.push({
          level: block.depth,
          title: block.title,
          id: block.id,
        });
      } else if (block.kind === "blockquote") {
        visit(block.children);
      } else if (block.kind === "list") {
        for (const item of block.items) visit(item);
      }
    }
  };
  visit(parseArticleBlocks(markdown));
  return headings;
}
