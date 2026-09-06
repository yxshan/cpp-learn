import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";

import type { ReferenceEntryDetail } from "@cpp-learn/contracts";

import { ReferenceArticle } from "./ReferenceArticle.js";
import type { ReferenceLinkTarget } from "./reference-links.js";

export interface RenderReferenceArticleDocumentRequest {
  readonly entry: ReferenceEntryDetail;
  readonly relatedEntries: Readonly<Record<string, ReferenceLinkTarget>>;
  readonly currentUrl: URL | string;
}

let stylesheet: Promise<string> | undefined;

function loadStylesheet(): Promise<string> {
  stylesheet ??= Promise.all(
    ["styles.css", "mdn-theme.css"].map((name) =>
      readFile(fileURLToPath(new URL(name, import.meta.url)), "utf8"),
    ),
  ).then((parts) => parts.join("\n").replaceAll("</style", "<\\/style"));
  return stylesheet;
}

export async function renderReferenceArticleDocument({
  entry,
  relatedEntries,
  currentUrl,
}: RenderReferenceArticleDocumentRequest): Promise<string> {
  const article = renderToStaticMarkup(
    <ReferenceArticle
      entry={entry}
      relatedEntries={relatedEntries}
      currentUrl={currentUrl}
    />,
  );
  const css = await loadStylesheet();
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${entry.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")} · C++ Learn Preview</title>`,
    `<style>${css}</style>`,
    "</head>",
    '<body><main class="reference-main">',
    article,
    "</main></body></html>\n",
  ].join("\n");
}
