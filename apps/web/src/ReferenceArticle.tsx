import { Children, isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type {
  ReferenceEntryDetail,
  ReferenceExampleView,
  ReferencePlaygroundRunResult,
  ReferenceSearchItem,
} from "@cpp-learn/contracts";

import {
  HttpRequestError,
  cancelReferenceRun,
  runReferenceExample,
} from "./api.js";
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
  object: "对象",
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

const playgroundVerdictLabels: Readonly<
  Record<ReferencePlaygroundRunResult["verdict"], string>
> = {
  success: "运行成功",
  compile_error: "编译失败",
  runtime_error: "运行失败",
  timeout: "运行超时",
  output_limit: "输出超限",
  cancelled: "运行已取消",
  system_error: "运行环境异常",
};

function ReferenceExamplePlayground({
  entryId,
  example,
}: {
  readonly entryId: string;
  readonly example: ReferenceExampleView;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(example.source);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReferencePlaygroundRunResult>();
  const [error, setError] = useState<string>();
  const [activeRunId, setActiveRunId] = useState<string>();
  const [cancelling, setCancelling] = useState(false);

  if (example.kind !== "run" || example.verification === "unsupported") {
    return null;
  }

  const execute = async (): Promise<void> => {
    const runId = `ref_run_${globalThis.crypto.randomUUID()}`;
    setRunning(true);
    setActiveRunId(runId);
    setResult(undefined);
    setError(undefined);
    try {
      setResult(await runReferenceExample(entryId, example.id, runId, source));
    } catch (caught) {
      setError(
        caught instanceof HttpRequestError && caught.status === 429
          ? "本机编译器正在处理另一个任务，请稍后重试。"
          : "暂时无法运行该示例，请检查本机编译环境后重试。",
      );
    } finally {
      setRunning(false);
      setActiveRunId(undefined);
      setCancelling(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!activeRunId || cancelling) return;
    setCancelling(true);
    try {
      const cancellation = await cancelReferenceRun(activeRunId);
      if (!cancellation.cancelled) {
        setError("运行已经结束，无需取消。");
        setCancelling(false);
      }
    } catch {
      setError("取消请求失败，运行仍会受超时限制。");
      setCancelling(false);
    }
  };

  const restoreOriginal = (): void => {
    setSource(example.source);
    setResult(undefined);
    setError(undefined);
  };

  const discard = (): void => {
    if (
      source !== example.source &&
      !window.confirm("确定放弃当前 Playground 修改并关闭吗？")
    ) {
      return;
    }
    restoreOriginal();
    setOpen(false);
  };

  return (
    <div className="reference-playground">
      <button
        type="button"
        className="reference-playground-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "收起 Playground" : "在 Playground 中运行"}
      </button>
      {open && (
        <div className="reference-playground-panel">
          <div className="reference-playground-heading">
            <div className="reference-playground-heading-copy">
              <strong>临时代码区</strong>
              <span>运行结果不会计入课程进度或掌握证据。</span>
            </div>
            <div className="reference-playground-heading-actions">
              <button
                type="button"
                onClick={restoreOriginal}
                disabled={running || source === example.source}
              >
                重置代码
              </button>
              <button type="button" onClick={discard} disabled={running}>
                放弃修改并关闭
              </button>
            </div>
          </div>
          <label htmlFor={`reference-playground-${entryId}-${example.id}`}>
            编辑 {example.id}.cpp
          </label>
          <textarea
            id={`reference-playground-${entryId}-${example.id}`}
            value={source}
            disabled={running}
            spellCheck={false}
            onChange={(event) => {
              setSource(event.target.value);
              setResult(undefined);
              setError(undefined);
            }}
          />
          <div className="reference-playground-actions">
            <button
              type="button"
              onClick={() => void execute()}
              disabled={running || source.trim().length === 0}
            >
              {running ? "运行中…" : "运行代码"}
            </button>
            {running && (
              <button
                type="button"
                className="reference-playground-cancel"
                onClick={() => void cancel()}
                disabled={cancelling}
              >
                {cancelling ? "正在取消…" : "取消运行"}
              </button>
            )}
            <span>{example.standard.toUpperCase()} · 本机临时执行</span>
          </div>
          {(result || error) && (
            <div
              className={`reference-playground-result${result?.verdict === "success" ? " is-success" : " is-error"}`}
              role="status"
              aria-label="运行结果"
            >
              <strong>
                {result
                  ? playgroundVerdictLabels[result.verdict]
                  : "运行请求失败"}
              </strong>
              {result ? (
                result.stdout || result.stderr ? (
                  <div className="reference-playground-streams">
                    {result.stdout && (
                      <div className="reference-playground-stream">
                        <span>stdout</span>
                        <pre>{result.stdout}</pre>
                      </div>
                    )}
                    {result.stderr && (
                      <div className="reference-playground-stream">
                        <span>stderr / 编译诊断</span>
                        <pre>{result.stderr}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="reference-playground-empty">
                    程序没有产生输出。
                  </p>
                )
              ) : (
                <pre>{error}</pre>
              )}
              {result && (
                <small>
                  {result.toolchain.compiler} · {result.stages.length}{" "}
                  个执行阶段
                </small>
              )}
            </div>
          )}
          <p className="reference-playground-notice">
            当前为可信任的本地执行环境，不是用于运行未知代码的安全沙箱。
          </p>
        </div>
      )}
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

function ArticleHeading({
  level,
  children,
}: {
  readonly level: 2 | 3;
  readonly children?: ReactNode | undefined;
}) {
  const title = nodeText(children);
  const id = headingId(title);
  const className = /javascript|js\s*类比/i.test(title)
    ? "is-js-comparison"
    : undefined;
  const content = (
    <>
      <span>{children}</span>
      <a
        className="reference-section-anchor"
        href={`#${encodeURIComponent(id)}`}
        aria-label={`链接到“${title}”`}
      >
        #
      </a>
    </>
  );

  return level === 2 ? (
    <h2 id={id} className={className}>
      {content}
    </h2>
  ) : (
    <h3 id={id} className={className}>
      {content}
    </h3>
  );
}

const sourceKindLabels = {
  primary: "标准来源",
  secondary: "参考资料",
  vendor: "实现资料",
} as const;

export function ReferenceArticle({
  entry,
  relatedEntries,
  currentUrl: currentUrlInput,
}: {
  readonly entry: ReferenceEntryDetail;
  readonly relatedEntries: Readonly<Record<string, ReferenceLinkTarget>>;
  readonly currentUrl?: URL | string;
}) {
  const currentUrl =
    currentUrlInput === undefined
      ? new URL(window.location.href)
      : new URL(currentUrlInput);

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
        <div className="reference-definition-grid" aria-label="条目定义信息">
          <div>
            <span>定义于头文件</span>
            <code>{entry.header ?? "—"}</code>
          </div>
          <div>
            <span>命名空间</span>
            <code>{entry.namespace ?? "—"}</code>
          </div>
          <div>
            <span>标准支持</span>
            <strong>
              {entry.since ? `${entry.since.toUpperCase()} 起` : "未指定"}
            </strong>
          </div>
          <div>
            <span>示例状态</span>
            <strong>{aggregateVerification(entry)}</strong>
          </div>
        </div>
        {(entry.deprecatedSince || entry.removedSince) && (
          <div className="reference-badges" aria-label="版本状态">
            {entry.deprecatedSince && (
              <span>弃用 · {entry.deprecatedSince.toUpperCase()}</span>
            )}
            {entry.removedSince && (
              <span>移除 · {entry.removedSince.toUpperCase()}</span>
            )}
          </div>
        )}
      </header>

      <div className="reference-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <ArticleHeading level={2}>{children}</ArticleHeading>
            ),
            h2: ({ children }) => (
              <ArticleHeading level={2}>{children}</ArticleHeading>
            ),
            h3: ({ children }) => (
              <ArticleHeading level={3}>{children}</ArticleHeading>
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
            table: ({ children }) => (
              <div className="reference-table-scroll">
                <table>{children}</table>
              </div>
            ),
            blockquote: ({ children }) => (
              <blockquote className="reference-callout">{children}</blockquote>
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
            <div
              className="reference-example"
              key={`${entry.id}:${example.id}`}
            >
              <header>
                <code>{example.id}.cpp</code>
                <span>
                  {example.standard.toUpperCase()} · {example.verification}
                </span>
              </header>
              <CodeBlock className="language-cpp">{example.source}</CodeBlock>
              <ReferenceExamplePlayground
                entryId={entry.id}
                example={example}
              />
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
        <div>
          {entry.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>{sourceKindLabels[source.kind]}</span>
              {source.title} ↗
            </a>
          ))}
        </div>
      </footer>
    </article>
  );
}
