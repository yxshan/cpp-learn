import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ReferenceEntryDetail,
  ReferenceNavigation,
  ReferenceSearchItem,
} from "@cpp-learn/contracts";

import {
  getReferenceEntry,
  getReferenceNavigation,
  HttpRequestError,
  resolveReferenceSlug,
  searchReference,
} from "./api.js";
import { articleHeadings } from "@cpp-learn/reference-presentation";

import { ReferenceArticle, referenceKindLabels } from "./ReferenceArticle.js";
import {
  canonicalReferenceUrl,
  parseReferenceLocation,
  referenceCategoryUrl,
  referenceEntryUrl,
  referenceSearchUrl,
} from "./reference-location.js";
import { useReferenceLinks } from "./reference-links.js";

type ViewStatus =
  "loading" | "ready" | "empty" | "not-found" | "degraded" | "error";

export function ReferenceBrowser() {
  const [location, setLocation] = useState(() =>
    parseReferenceLocation(new URL(window.location.href)),
  );
  const [navigation, setNavigation] = useState<ReferenceNavigation>();
  const [entry, setEntry] = useState<ReferenceEntryDetail>();
  const [results, setResults] = useState<readonly ReferenceSearchItem[]>([]);
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [message, setMessage] = useState("正在加载本地 C++ Reference…");
  const [searchInput, setSearchInput] = useState(location.query);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    location.category,
  );
  const [navigationOpen, setNavigationOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const requestSequenceRef = useRef(0);

  const syncFromWindow = useCallback(() => {
    const next = parseReferenceLocation(new URL(window.location.href));
    setLocation(next);
    setSearchInput(next.query);
    setSelectedCategory(next.category);
    setNavigationOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", syncFromWindow);
    return () => window.removeEventListener("popstate", syncFromWindow);
  }, [syncFromWindow]);

  useEffect(() => {
    let active = true;
    void getReferenceNavigation()
      .then((value) => {
        if (active) setNavigation(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const loadList = useCallback(
    async (query: string, category?: string): Promise<void> => {
      const sequence = ++requestSequenceRef.current;
      setStatus("loading");
      setMessage(query ? `正在搜索“${query}”…` : "正在读取 Reference 目录…");
      setEntry(undefined);
      try {
        const result = await searchReference({
          text: query,
          ...(category === undefined ? {} : { category }),
          limit: 50,
        });
        if (sequence !== requestSequenceRef.current) return;
        setResults(result.results);
        setStatus(result.results.length === 0 ? "empty" : "ready");
      } catch (cause) {
        if (sequence !== requestSequenceRef.current) return;
        setResults([]);
        setStatus(
          cause instanceof HttpRequestError && cause.status === 503
            ? "degraded"
            : "error",
        );
        setMessage(
          cause instanceof HttpRequestError && cause.status === 503
            ? "Reference 内容当前不可用，课程与代码训练仍可正常使用。"
            : "无法读取本地 Reference，请检查服务后重试。",
        );
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (!location.slug) {
        await loadList(location.query, selectedCategory);
        return;
      }
      setStatus("loading");
      const sequence = ++requestSequenceRef.current;
      setMessage("正在打开 API 文档…");
      setResults([]);
      try {
        const resolution = await resolveReferenceSlug(location.slug);
        if (!active || sequence !== requestSequenceRef.current) return;
        if (resolution.redirected) {
          const canonical = canonicalReferenceUrl(
            new URL(window.location.href),
            resolution.canonicalSlug,
          );
          window.history.replaceState(window.history.state, "", canonical);
          setLocation(parseReferenceLocation(canonical));
        }
        const detail = await getReferenceEntry(resolution.entryId);
        if (!active || sequence !== requestSequenceRef.current) return;
        setEntry(detail);
        setStatus("ready");
        requestAnimationFrame(() => {
          const target = window.location.hash
            ? document.getElementById(
                decodeURIComponent(window.location.hash.slice(1)),
              )
            : mainRef.current;
          target?.scrollIntoView({ block: "start" });
          if (!window.location.hash) mainRef.current?.focus();
        });
      } catch (cause) {
        if (!active || sequence !== requestSequenceRef.current) return;
        setEntry(undefined);
        if (cause instanceof HttpRequestError && cause.status === 404) {
          setStatus("not-found");
          setMessage("没有找到这篇 C++ API 文档。");
        } else if (cause instanceof HttpRequestError && cause.status === 503) {
          setStatus("degraded");
          setMessage("Reference 内容当前不可用，课程与代码训练仍可正常使用。");
        } else {
          setStatus("error");
          setMessage("无法读取本地 Reference，请检查服务后重试。");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadList, location.query, location.slug, selectedCategory]);

  const navigate = useCallback(
    (url: string): void => {
      window.history.pushState(null, "", url);
      syncFromWindow();
    },
    [syncFromWindow],
  );

  const submitSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    navigate(referenceSearchUrl(new URL(window.location.href), searchInput));
  };

  const selectCategory = (categoryId: string): void => {
    const next = selectedCategory === categoryId ? undefined : categoryId;
    setNavigationOpen(false);
    navigate(referenceCategoryUrl(new URL(window.location.href), next));
  };

  const headings = useMemo(
    () => (entry ? articleHeadings(entry.content) : []),
    [entry],
  );
  const relatedEntries = useReferenceLinks(entry?.relatedEntryIds);

  useEffect(() => {
    document.title = entry
      ? `${entry.title} · C++ Reference`
      : location.query
        ? `${location.query} · C++ Reference 搜索`
        : "C++ Reference · C++ Learn";
  }, [entry, location.query]);

  return (
    <div className="reference-page">
      <a className="skip-link" href="#reference-main">
        跳到文档正文
      </a>
      <header className="reference-header">
        <a
          className="reference-brand"
          href="/"
          aria-label="返回 C++ Learn 学习控制台"
        >
          <span aria-hidden="true" translate="no">
            C++
          </span>
          <strong>Reference</strong>
        </a>
        <form
          className="reference-search"
          role="search"
          onSubmit={submitSearch}
        >
          <label htmlFor="reference-search-input">搜索 C++ API</label>
          <div>
            <input
              id="reference-search-input"
              name="q"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={searchInput}
              placeholder="std::vector、<algorithm>、动态数组…"
              maxLength={200}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button type="submit">搜索</button>
          </div>
        </form>
        <a className="reference-course-link" href="/">
          学习控制台 ↗
        </a>
      </header>

      <div className="reference-mobile-tools">
        <button
          type="button"
          aria-expanded={navigationOpen}
          aria-controls="reference-navigation"
          onClick={() => setNavigationOpen((open) => !open)}
        >
          {navigationOpen ? "关闭目录" : "浏览目录"}
        </button>
        <span>
          {entry?.title ??
            (location.query ? `搜索：${location.query}` : "C++ 标准库")}
        </span>
      </div>

      <div className="reference-layout">
        <aside
          id="reference-navigation"
          className={`reference-navigation ${navigationOpen ? "is-open" : ""}`}
          aria-label="Reference 分类"
        >
          <a className="reference-nav-home" href="/reference">
            Reference 首页
          </a>
          <p>按主题浏览</p>
          <nav>
            {navigation?.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.id}
                className={category.parentId ? "is-child" : ""}
                onClick={() => selectCategory(category.id)}
              >
                <span>{category.title}</span>
                <small>{category.entryIds.length}</small>
              </button>
            ))}
          </nav>
          <div className="reference-nav-note">
            <strong>离线可用</strong>
            <span>内容和搜索索引均随本地应用发布。</span>
          </div>
        </aside>

        <main id="reference-main" ref={mainRef} tabIndex={-1}>
          <nav className="reference-breadcrumbs" aria-label="面包屑">
            <a href="/reference">Reference</a>
            {entry && <span>{entry.title}</span>}
            {!entry && location.query && <span>搜索结果</span>}
          </nav>

          {status === "loading" && (
            <section className="reference-state" aria-live="polite">
              <i aria-hidden="true" />
              <h1>{message}</h1>
              <p>所有内容均从本机目录读取。</p>
            </section>
          )}

          {(status === "degraded" ||
            status === "error" ||
            status === "not-found") && (
            <section className="reference-state is-error" role="alert">
              <span aria-hidden="true">
                {status === "not-found" ? "404" : "!"}
              </span>
              <h1>{message}</h1>
              <p>你可以返回 Reference 首页，或继续使用课程与代码训练。</p>
              <div>
                <a href="/reference">Reference 首页</a>
                <a href="/">学习控制台</a>
              </div>
            </section>
          )}

          {!entry && (status === "ready" || status === "empty") && (
            <section
              className="reference-index"
              aria-labelledby="reference-index-title"
            >
              <header>
                <p className="eyebrow">
                  C++ STANDARD LIBRARY / LOCAL REFERENCE
                </p>
                <h1 id="reference-index-title">
                  {location.query
                    ? `“${location.query}”的搜索结果`
                    : selectedCategory
                      ? navigation?.categories.find(
                          (item) => item.id === selectedCategory,
                        )?.title
                      : "查 API，也理解背后的工程约束"}
                </h1>
                <p>
                  从符号、头文件或中文概念开始。每篇条目强调标准版本、复杂度、生命周期、异常与可运行示例。
                </p>
              </header>
              <div
                className="reference-result-meta"
                role="status"
                aria-live="polite"
              >
                <span>{results.length} 个条目</span>
                {(location.query || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(undefined);
                      navigate("/reference");
                    }}
                  >
                    清除筛选
                  </button>
                )}
              </div>
              {results.length > 0 ? (
                <div className="reference-results">
                  {results.map((result) => (
                    <a
                      key={result.id}
                      href={referenceEntryUrl(
                        new URL(window.location.href),
                        result.slug,
                      )}
                    >
                      <span className="reference-result-kind">
                        {referenceKindLabels[result.kind]}
                      </span>
                      <strong
                        translate={result.kind === "landing" ? undefined : "no"}
                      >
                        {result.title}
                      </strong>
                      <p>{result.summary}</p>
                      <small>
                        {result.header ?? result.symbol ?? result.id}
                        {result.since
                          ? ` · ${result.since.toUpperCase()} 起`
                          : ""}
                      </small>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="reference-empty">
                  <strong>没有匹配的条目</strong>
                  <p>尝试完整符号、头文件名或更短的中文概念。</p>
                </div>
              )}
            </section>
          )}

          {entry && status === "ready" && (
            <ReferenceArticle entry={entry} relatedEntries={relatedEntries} />
          )}
        </main>

        <aside className="reference-toc" aria-label="本文目录">
          {entry && headings.length > 0 ? (
            <>
              <p>本文目录</p>
              <nav>
                {headings.map((heading) => (
                  <a
                    key={`${heading.level}-${heading.id}`}
                    className={heading.level === 3 ? "is-child" : ""}
                    href={`#${encodeURIComponent(heading.id)}`}
                  >
                    {heading.title}
                  </a>
                ))}
              </nav>
            </>
          ) : (
            <div className="reference-toc-tip">
              <span>TIP</span>
              <p>可搜索完整符号、头文件或中文名称。</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
