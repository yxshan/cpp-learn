import type { ReferenceEntryDetail } from "@cpp-learn/contracts";

import { referenceEntryUrl, referenceSearchUrl } from "./links.ts";
import { parseArticleBlocks } from "./markdown.ts";
import type { ArticleBlock, ArticleInline } from "./types.ts";

const referenceKindLabels: Readonly<Record<string, string>> = {
  landing: "概览",
  header: "头文件",
  type: "类型",
  object: "对象",
  function: "函数",
  member: "成员",
  concept: "概念",
  guide: "指南",
};

const sourceKindLabels: Readonly<Record<string, string>> = {
  primary: "标准来源",
  secondary: "参考资料",
  vendor: "实现资料",
};

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function inlineHtml(nodes: readonly ArticleInline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeText(node.value);
        case "code":
          return `<code>${escapeText(node.value)}</code>`;
        case "strong":
          return `<strong>${inlineHtml(node.children)}</strong>`;
        case "emphasis":
          return `<em>${inlineHtml(node.children)}</em>`;
        case "link":
          return `<a href="${escapeAttribute(node.href)}" rel="noreferrer">${inlineHtml(node.children)}</a>`;
      }
    })
    .join("");
}

function codeBlockHtml(language: string | undefined, source: string): string {
  const className = language
    ? ` class="language-${escapeAttribute(language)}"`
    : "";
  return [
    '<div class="reference-code-block">',
    '<button type="button">复制代码</button>',
    `<pre><code${className}>${escapeText(source.replace(/\n$/, ""))}</code></pre>`,
    '<span class="sr-only" aria-live="polite">复制代码</span>',
    "</div>",
  ].join("");
}

function blockHtml(blocks: readonly ArticleBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading": {
          const anchor = `<a class="reference-section-anchor" href="#${encodeURIComponent(block.id)}" aria-label="链接到“${escapeAttribute(block.title)}”">#</a>`;
          const className = block.jsComparison
            ? ' class="is-js-comparison"'
            : "";
          const inner = `<span>${inlineHtml(block.children)}</span>${anchor}`;
          return block.depth === 2
            ? `<h2 id="${escapeAttribute(block.id)}"${className}>${inner}</h2>`
            : `<h3 id="${escapeAttribute(block.id)}"${className}>${inner}</h3>`;
        }
        case "paragraph":
          return `<p>${inlineHtml(block.children)}</p>`;
        case "code":
          return codeBlockHtml(block.language, block.value);
        case "blockquote":
          return `<blockquote class="reference-callout">${blockHtml(block.children)}</blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const start =
            block.ordered && block.start !== undefined
              ? ` start="${block.start}"`
              : "";
          const items = block.items
            .map((item) => `<li>${blockHtml(item)}</li>`)
            .join("");
          return `<${tag}${start}>${items}</${tag}>`;
        }
        case "table": {
          const cell = (
            tag: "th" | "td",
            index: number,
            content: readonly ArticleInline[],
          ): string => {
            const align = block.align[index];
            const attribute = align ? ` align="${align}"` : "";
            return `<${tag}${attribute}>${inlineHtml(content)}</${tag}>`;
          };
          const header = `<thead><tr>${block.header
            .map((content, index) => cell("th", index, content))
            .join("")}</tr></thead>`;
          const body =
            block.rows.length === 0
              ? ""
              : `<tbody>${block.rows
                  .map(
                    (row) =>
                      `<tr>${row
                        .map((content, index) => cell("td", index, content))
                        .join("")}</tr>`,
                  )
                  .join("")}</tbody>`;
          return `<div class="reference-table-scroll"><table>${header}${body}</table></div>`;
        }
        case "unsupported":
          return `<!-- unsupported markdown node: ${escapeText(block.nodeType)} -->`;
      }
    })
    .join("");
}

function aggregateVerification(entry: ReferenceEntryDetail): string {
  const states = entry.examples.map((example) => example.verification);
  if (states.includes("unsupported")) return "本机不支持";
  if (states.length > 0 && states.every((state) => state === "verified")) {
    return "本机已验证";
  }
  return "尚未本机验证";
}

function articleHtml(
  entry: ReferenceEntryDetail,
  relatedEntries: Readonly<
    Record<string, { readonly slug: string; readonly title: string }>
  >,
  currentUrl: URL,
): string {
  const parts: string[] = ['<article class="reference-article">'];

  parts.push('<header class="reference-article-header">');
  parts.push('<div class="reference-kicker">');
  parts.push(
    `<span>${escapeText(referenceKindLabels[entry.kind] ?? entry.kind)}</span>`,
  );
  if (entry.header) parts.push(`<code>${escapeText(entry.header)}</code>`);
  parts.push("</div>");
  const translate = entry.kind === "landing" ? "" : ' translate="no"';
  parts.push(`<h1${translate}>${escapeText(entry.title)}</h1>`);
  parts.push(`<p>${escapeText(entry.summary)}</p>`);
  parts.push(
    '<div class="reference-definition-grid" aria-label="条目定义信息">',
  );
  parts.push(
    `<div><span>定义于头文件</span><code>${escapeText(entry.header ?? "—")}</code></div>`,
  );
  parts.push(
    `<div><span>命名空间</span><code>${escapeText(entry.namespace ?? "—")}</code></div>`,
  );
  parts.push(
    `<div><span>标准支持</span><strong>${escapeText(entry.since ? `${entry.since.toUpperCase()} 起` : "未指定")}</strong></div>`,
  );
  parts.push(
    `<div><span>示例状态</span><strong>${escapeText(aggregateVerification(entry))}</strong></div>`,
  );
  parts.push("</div>");
  if (entry.deprecatedSince || entry.removedSince) {
    parts.push('<div class="reference-badges" aria-label="版本状态">');
    if (entry.deprecatedSince) {
      parts.push(
        `<span>弃用 · ${escapeText(entry.deprecatedSince.toUpperCase())}</span>`,
      );
    }
    if (entry.removedSince) {
      parts.push(
        `<span>移除 · ${escapeText(entry.removedSince.toUpperCase())}</span>`,
      );
    }
    parts.push("</div>");
  }
  parts.push("</header>");

  parts.push('<div class="reference-markdown">');
  parts.push(blockHtml(parseArticleBlocks(entry.content)));
  parts.push("</div>");

  if (entry.examples.length > 0) {
    parts.push(
      '<section class="reference-examples" aria-labelledby="reference-examples-title">',
    );
    parts.push(
      '<div><p class="eyebrow">VERIFIED SOURCE</p><h2 id="reference-examples-title">完整示例</h2></div>',
    );
    for (const example of entry.examples) {
      parts.push('<div class="reference-example">');
      parts.push(
        `<header><code>${escapeText(example.id)}.cpp</code><span>${escapeText(example.standard.toUpperCase())} · ${escapeText(example.verification)}</span></header>`,
      );
      parts.push(codeBlockHtml("cpp", example.source));
      if (example.kind === "run" && example.verification !== "unsupported") {
        parts.push('<div class="reference-playground">');
        parts.push(
          '<button type="button" class="reference-playground-toggle" aria-expanded="false">在 Playground 中运行</button>',
        );
        parts.push("</div>");
      }
      if (example.expectedStdout !== undefined) {
        parts.push(
          `<pre class="reference-output" aria-label="预期输出">${escapeText(example.expectedStdout)}</pre>`,
        );
      }
      parts.push("</div>");
    }
    parts.push("</section>");
  }

  parts.push(
    '<section class="reference-related" aria-labelledby="reference-related-title">',
  );
  parts.push(
    '<div><p class="eyebrow">KEEP EXPLORING</p><h2 id="reference-related-title">相关内容</h2></div>',
  );
  parts.push("<div>");
  for (const entryId of entry.relatedEntryIds) {
    const related = relatedEntries[entryId];
    const href = related
      ? referenceEntryUrl(currentUrl, related.slug)
      : referenceSearchUrl(currentUrl, entryId);
    parts.push(
      `<a href="${escapeAttribute(href)}"><span>API 条目</span><strong>${escapeText(related?.title ?? entryId)}</strong></a>`,
    );
  }
  for (const activityId of entry.relatedActivityIds) {
    parts.push(
      `<a href="/?activity=${encodeURIComponent(activityId)}"><span>相关课程</span><strong>${escapeText(activityId)}</strong></a>`,
    );
  }
  parts.push("</div></section>");

  parts.push('<footer class="reference-sources">');
  parts.push(`<strong>核对来源 · ${escapeText(entry.verifiedAt)}</strong>`);
  parts.push("<div>");
  for (const source of entry.sources) {
    parts.push(
      `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer"><span>${escapeText(sourceKindLabels[source.kind] ?? source.kind)}</span>${escapeText(source.title)} ↗</a>`,
    );
  }
  parts.push("</div></footer>");

  parts.push("</article>");
  return parts.join("");
}

export interface RenderArticleDocumentRequest {
  readonly entry: ReferenceEntryDetail;
  readonly relatedEntries: Readonly<
    Record<string, { readonly slug: string; readonly title: string }>
  >;
  readonly currentUrl: URL | string;
  /** Inlined verbatim; the caller owns stylesheet resolution. */
  readonly stylesheet?: string;
}

/**
 * Renders a standalone HTML document for one Entry. Used by the CLI author
 * preview; the Web Adapter renders the same block model through React.
 */
export function renderArticleDocument({
  entry,
  relatedEntries,
  currentUrl,
  stylesheet = "",
}: RenderArticleDocumentRequest): string {
  const url = new URL(currentUrl);
  const title = entry.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} · C++ Learn Preview</title>`,
    `<style>${stylesheet.replaceAll("</style", "<\\/style")}</style>`,
    "</head>",
    '<body><main class="reference-main">',
    articleHtml(entry, relatedEntries, url),
    "</main></body></html>",
    "",
  ].join("\n");
}
