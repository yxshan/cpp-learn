export function Topbar({ ready }: { readonly ready: boolean | undefined }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">学习控制台</p>
        <h1>从第一段 C++ 程序开始</h1>
      </div>
      <div className="topbar-actions">
        <span
          className={`overall-status ${ready ? "is-ready" : ""}`}
          role="status"
          aria-live="polite"
        >
          <i aria-hidden="true" />
          {ready ? "环境已就绪" : "正在检查环境"}
        </span>
        <span className="session-mark" aria-hidden="true">
          LOCAL / 01
        </span>
      </div>
    </header>
  );
}
