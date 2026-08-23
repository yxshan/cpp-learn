import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { BootstrapResult, DashboardResult } from "@cpp-learn/contracts";

import { getBootstrap, getDashboard } from "./api.js";

const LessonWorkspace = lazy(async () => {
  const module = await import("./LessonWorkspace.js");
  return { default: module.LessonWorkspace };
});

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>&lt;</span>
      <span className="brand-plus">++</span>
      <span>/&gt;</span>
    </span>
  );
}

function StatusCard({
  eyebrow,
  title,
  detail,
  ready,
  icon,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly ready: boolean;
  readonly icon: ReactNode;
}) {
  return (
    <article className="status-card">
      <div className={`status-icon ${ready ? "is-ready" : "needs-attention"}`}>
        {icon}
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p className="muted">{detail}</p>
      </div>
      <span className={`status-dot ${ready ? "is-ready" : "needs-attention"}`}>
        {ready ? "正常" : "待处理"}
      </span>
    </article>
  );
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResult>();
  const [dashboard, setDashboard] = useState<DashboardResult>();
  const [error, setError] = useState<string>();
  const [showWorkspace, setShowWorkspace] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextBootstrap, nextDashboard] = await Promise.all([
        getBootstrap(),
        getDashboard(),
      ]);
      setBootstrap(nextBootstrap);
      setDashboard(nextDashboard);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法连接本地学习服务");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (showWorkspace) {
    return (
      <Suspense
        fallback={
          <div className="workspace-loading">正在加载本地代码编辑器…</div>
        }
      >
        <LessonWorkspace
          onBack={() => setShowWorkspace(false)}
          onEvidenceChanged={async () => {
            setDashboard(await getDashboard());
          }}
        />
      </Suspense>
    );
  }

  const practiced = Object.values(dashboard?.conceptStates ?? {}).filter(
    (state) => state === "practiced",
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>C++ Learn</strong>
            <span>Engineering Track</span>
          </div>
        </div>
        <nav aria-label="主导航">
          <p className="nav-label">学习空间</p>
          <a className="nav-item active" href="#overview">
            <span>⌁</span>总览
          </a>
          <button className="nav-item" onClick={() => setShowWorkspace(true)}>
            <span>▶</span>当前课程
          </button>
          <a className="nav-item" href="#environment">
            <span>⌘</span>开发环境
          </a>
          <a className="nav-item" href="#records">
            <span>▤</span>学习记录
          </a>
        </nav>
        <div className="sidebar-footer">
          <span className="local-pulse" />
          <div>
            <strong>本地模式</strong>
            <span>代码与记录保存在此设备</span>
          </div>
        </div>
      </aside>

      <main id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">学习控制台</p>
            <h1>从第一段 C++ 程序开始</h1>
          </div>
          <div className="topbar-actions">
            <span
              className={`overall-status ${bootstrap?.ready ? "is-ready" : ""}`}
            >
              <i />
              {bootstrap?.ready ? "环境已就绪" : "正在检查环境"}
            </span>
            <button className="avatar" aria-label="本地学习者">
              L
            </button>
          </div>
        </header>

        <section className="stage-banner" aria-labelledby="stage-title">
          <div className="stage-copy">
            <span className="stage-chip">STAGE 1 · FIRST LEARNING LOOP</span>
            <h2 id="stage-title">
              读懂、修改、运行，再用 Grade 证明你掌握了它。
            </h2>
            <p>
              同一份本地代码会经过 C++20 编译器与公开测试；只有 Grade
              通过才会形成概念学习证据。
            </p>
            <div className="stage-actions">
              <button
                className="primary-button"
                onClick={() => setShowWorkspace(true)}
              >
                开始第一课
              </button>
              <span>
                阶段进度 <strong>2 / 7</strong>
              </span>
            </div>
          </div>
          <div className="code-window" aria-label="C++ 示例代码">
            <div className="window-bar">
              <i />
              <i />
              <i />
              <span>main.cpp</span>
            </div>
            <pre>
              <code>
                <span className="code-purple">#include</span>{" "}
                <span className="code-green">&lt;iostream&gt;</span>
                {"\n\n"}
                <span className="code-blue">int</span> main() {"{"}
                {"\n"} std::cout &lt;&lt;{" "}
                <span className="code-green">"Hello, C++!"</span>;{"\n"}
                {"}"}
              </code>
            </pre>
            <div className="terminal-line">
              <span>$</span> clang++ -std=c++20 main.cpp <i>✓</i>
            </div>
          </div>
        </section>

        {error && (
          <section className="error-panel" role="alert">
            <strong>本地服务暂时不可用</strong>
            <span>{error}</span>
            <button onClick={() => void refresh()}>重试</button>
          </section>
        )}

        <section id="environment" className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SYSTEM READINESS</p>
              <h2>工程环境</h2>
            </div>
            <span className="last-check">
              {bootstrap
                ? `检测于 ${new Date(bootstrap.generatedAt).toLocaleTimeString("zh-CN")}`
                : "检测中"}
            </span>
          </div>
          <div className="status-grid">
            <StatusCard
              eyebrow="CURRICULUM"
              title="课程目录"
              detail={`${bootstrap?.services.curriculum.activityCount ?? 0} 个活动已校验`}
              ready={bootstrap?.services.curriculum.ready ?? false}
              icon="01"
            />
            <StatusCard
              eyebrow="TOOLCHAIN"
              title="C++20 工具链"
              detail={
                bootstrap?.services.toolchain.compiler ?? "正在探测 clang++"
              }
              ready={bootstrap?.services.toolchain.ready ?? false}
              icon="++"
            />
            <StatusCard
              eyebrow="LEARNING RECORD"
              title="本地学习记录"
              detail="追加式 JSONL · 可恢复"
              ready={bootstrap?.services.record.ready ?? false}
              icon="↳"
            />
          </div>
        </section>

        <section id="records" className="learning-grid section-block">
          <article className="current-card">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">CURRENT ACTIVITY</p>
                <h2>从源代码到可执行程序</h2>
              </div>
              <span className="time-pill">35 MIN</span>
            </div>
            <div className="lesson-row">
              <div className="lesson-number">01</div>
              <div className="lesson-copy">
                <span className="lesson-kind">LESSON + WORKSPACE</span>
                <h3>完成第一个可判定的 C++ 学习闭环</h3>
                <p>课程、代码编辑、编译运行、客观判题和学习记录已连通。</p>
                <div className="lesson-tags">
                  <span>Compile</span>
                  <span>Run</span>
                  <span>Evidence</span>
                </div>
              </div>
              <button
                className="lesson-button enabled"
                onClick={() => setShowWorkspace(true)}
              >
                进入课程 <span>→</span>
              </button>
            </div>
          </article>
          <article className="path-card">
            <p className="eyebrow">YOUR EVIDENCE</p>
            <h2>本地学习进度</h2>
            <div className="metric-row">
              <div>
                <strong>{dashboard?.attempts.length ?? 0}</strong>
                <span>运行与判题</span>
              </div>
              <div>
                <strong>{practiced}</strong>
                <span>已练习概念</span>
              </div>
            </div>
            <div className="attempt-list">
              {dashboard?.attempts
                .slice(-3)
                .reverse()
                .map((attempt) => (
                  <div key={attempt.jobId}>
                    <span>{attempt.mode.toUpperCase()}</span>
                    <strong>{attempt.verdict}</strong>
                  </div>
                ))}
              {dashboard?.attempts.length === 0 && (
                <p className="muted">
                  尚无记录，完成一次 Grade 后会显示在这里。
                </p>
              )}
            </div>
          </article>
        </section>
        <footer>
          <span>cpp-learn v0.1.0 · Stage 1</span>
          <span>Local-first · C++20 · React</span>
        </footer>
      </main>
    </div>
  );
}
