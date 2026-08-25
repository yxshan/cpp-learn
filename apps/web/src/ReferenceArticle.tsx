import { Children, isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import type {
  ReferenceEntryDetail,
  ReferenceSearchItem,
} from "@cpp-learn/contracts";

import { referenceEntryUrl, referenceSearchUrl } from "./reference-location.js";
import type { ReferenceLinkTarget } from "./reference-links.js";

export interface ArticleHeading {
  readonly level: 2 | 3;
  readonly title: string;
  readonly id: string;
}

export const referenceKindLabels: Readonly<
  Record<ReferenceSearchItem["kind"], string>
> = {
  landing: "概览",
  header: "头文件",
  type: "类型",
  function: "函数",
  member: "成员",
  concept: "概念",
  guide: "指南",
};

function headingId(title: string): string {
  return title
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[<>`'"“”‘’()[\]{}]/g, "")
    .replace(/[^\p{L}\p{N}_:+-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode | undefined }>(child)
          ? nodeText(child.props.children)
          : "",
    )
    .join("");
}

export function articleHeadings(markdown: string): readonly ArticleHeading[] {
  return [...markdown.matchAll(/^(##|###)\s+(.+)$/gm)].map((match) => ({
    level: match[1] === "##" ? 2 : 3,
    title: String(match[2])
      .replace(/\s+#+$/, "")
      .trim(),
    id: headingId(
      String(match[2])
        .replace(/\s+#+$/, "")
        .trim(),
    ),
  }));
}

function aggregateVerification(entry: ReferenceEntryDetail): string {
  const states = entry.examples.map((example) => example.verification);
  if (states.includes("unsupported")) return "本机不支持";
  if (states.length > 0 && states.every((state) => state === "verified")) {
    return "本机已验证";
  }
  return "尚未本机验证";
}

function CodeBlock({
  className,
  children,
}: {
  readonly className?: string | undefined;
  readonly children?: ReactNode | undefined;
}) {
  const source = String(children ?? "").replace(/\n$/, "");
  const block = Boolean(className) || source.includes("\n");
  const [message, setMessage] = useState("复制代码");
  if (!block) return <code className={className}>{children}</code>;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(source);
      setMessage("已复制");
    } catch {
      setMessage("复制失败");
    }
  };

  return (
    <div className="reference-code-block">
      <button type="button" onClick={() => void copy()}>
        {message}
      </button>
      <pre>
        <code className={className}>{source}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

function MarkdownPre({
  children,
}: {
  readonly children?: ReactNode | undefined;
}) {
  const className = isValidElement<{ className?: string | undefined }>(children)
    ? children.props.className
    : undefined;
  return <CodeBlock className={className}>{nodeText(children)}</CodeBlock>;
}

export function ReferenceArticle({
  entry,
  relatedEntries,
}: {
  readonly entry: ReferenceEntryDetail;
  readonly relatedEntries: Readonly<Record<string, ReferenceLinkTarget>>;
}) {
  const currentUrl = new URL(window.location.href);

  return (
    <article className="reference-article">
      <header className="reference-article-header">
        <div className="reference-kicker">
          <span>{referenceKindLabels[entry.kind]}</span>
          {entry.header && <code>{entry.header}</code>}
        </div>
        <h1 translate={entry.kind === "landing" ? undefined : "no"}>
          {entry.title}
        </h1>
        <p>{entry.summary}</p>
        <div className="reference-badges" aria-label="条目状态">
          {entry.since && <span>标准 · {entry.since.toUpperCase()} 起</span>}
          {entry.deprecatedSince && (
            <span>弃用 · {entry.deprecatedSince.toUpperCase()}</span>
          )}
          {entry.removedSince && (
            <span>移除 · {entry.removedSince.toUpperCase()}</span>
          )}
          <span>{aggregateVerification(entry)}</span>
        </div>
      </header>

      <div className="reference-markdown">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h2 id={headingId(nodeText(children))}>{children}</h2>
            ),
            h2: ({ children }) => (
              <h2 id={headingId(nodeText(children))}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 id={headingId(nodeText(children))}>{children}</h3>
            ),
            pre: MarkdownPre,
            code: ({ className, children }) => (
              <code className={className}>{children}</code>
            ),
            a: ({ href, children }) => (
              <a href={href} rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {entry.content.replace(/^#\s+.+\n+/, "")}
        </ReactMarkdown>
      </div>

      {entry.examples.length > 0 && (
        <section
          className="reference-examples"
          aria-labelledby="reference-examples-title"
        >
          <div>
            <p className="eyebrow">VERIFIED SOURCE</p>
            <h2 id="reference-examples-title">完整示例</h2>
          </div>
          {entry.examples.map((example) => (
            <div key={example.id}>
              <header>
                <code>{example.id}.cpp</code>
                <span>
                  {example.standard.toUpperCase()} · {example.verification}
                </span>
              </header>
              <CodeBlock className="language-cpp">{example.source}</CodeBlock>
              {example.expectedStdout !== undefined && (
                <pre className="reference-output" aria-label="预期输出">
                  {example.expectedStdout}
                </pre>
              )}
            </div>
          ))}
        </section>
      )}

      <section
        className="reference-related"
        aria-labelledby="reference-related-title"
      >
        <div>
          <p className="eyebrow">KEEP EXPLORING</p>
          <h2 id="reference-related-title">相关内容</h2>
        </div>
        <div>
          {entry.relatedEntryIds.map((entryId) => {
            const related = relatedEntries[entryId];
            return (
              <a
                key={entryId}
                href={
                  related
                    ? referenceEntryUrl(currentUrl, related.slug)
                    : referenceSearchUrl(currentUrl, entryId)
                }
              >
                <span>API 条目</span>
                <strong>{related?.title ?? entryId}</strong>
              </a>
            );
          })}
          {entry.relatedActivityIds.map((activityId) => (
            <a
              key={activityId}
              href={`/?activity=${encodeURIComponent(activityId)}`}
            >
              <span>相关课程</span>
              <strong>{activityId}</strong>
            </a>
          ))}
        </div>
      </section>

      <footer className="reference-sources">
        <strong>核对来源 · {entry.verifiedAt}</strong>
        {entry.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.title} ↗
          </a>
        ))}
      </footer>
    </article>
  );
}
