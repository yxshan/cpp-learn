import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  ActivitiesResult,
  BootstrapResult,
  DashboardResult,
  ProgressResult,
  ReviewsResult,
} from "@cpp-learn/contracts";

import {
  exportBackup,
  getActivities,
  getBootstrap,
  getDashboard,
  getProgress,
  getReviews,
  restoreBackup,
} from "./api.js";

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
  const [workspaceActivityId, setWorkspaceActivityId] = useState<string>();
  const [progress, setProgress] = useState<ProgressResult>();
  const [reviews, setReviews] = useState<ReviewsResult>();
  const [catalog, setCatalog] = useState<ActivitiesResult>();
  const [dataMessage, setDataMessage] = useState("可导出校验后的本地备份");

  const downloadBackup = async (): Promise<void> => {
    try {
      const archive = await exportBackup(`web_export_${crypto.randomUUID()}`);
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(archive, null, 2)}\n`], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "cpp-learn-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setDataMessage("备份已导出；文件仅在你的设备上生成");
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : "导出失败");
    }
  };

  const restoreFromFile = async (file: File): Promise<void> => {
    if (!window.confirm("恢复会覆盖备份中包含的本地文件，是否继续？")) return;
    try {
      const archive = JSON.parse(await file.text()) as unknown;
      const result = await restoreBackup(
        archive,
        `web_restore_${crypto.randomUUID()}`,
      );
      setDataMessage(`已恢复 ${result.restoredFiles} 个文件，请重启本地服务`);
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : "恢复失败");
    }
  };

  const refresh = useCallback(async () => {
    try {
      const [
        nextBootstrap,
        nextDashboard,
        nextProgress,
        nextReviews,
        nextCatalog,
      ] = await Promise.all([
        getBootstrap(),
        getDashboard(),
        getProgress(),
        getReviews(false),
        getActivities(),
      ]);
      setBootstrap(nextBootstrap);
      setDashboard(nextDashboard);
      setProgress(nextProgress);
      setReviews(nextReviews);
      setCatalog(nextCatalog);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法连接本地学习服务");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (workspaceActivityId) {
    return (
      <Suspense
        fallback={
          <div className="workspace-loading">正在加载本地代码编辑器…</div>
        }
      >
        <LessonWorkspace
          activityId={workspaceActivityId}
          onBack={() => setWorkspaceActivityId(undefined)}
          onEvidenceChanged={async () => {
            const [nextDashboard, nextProgress, nextReviews] =
              await Promise.all([
                getDashboard(),
                getProgress(),
                getReviews(false),
              ]);
            setDashboard(nextDashboard);
            setProgress(nextProgress);
            setReviews(nextReviews);
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
          <button
            className="nav-item"
            onClick={() => setWorkspaceActivityId(catalog?.activities[0]?.id)}
            disabled={!catalog?.activities[0]}
          >
            <span>▶</span>当前课程
          </button>
          <a className="nav-item" href="#environment">
            <span>⌘</span>开发环境
          </a>
          <a className="nav-item" href="#records">
            <span>▤</span>学习记录
          </a>
          <a className="nav-item" href="#reviews">
            <span>↻</span>复习队列
          </a>
          <a className="nav-item" href="#knowledge-map">
            <span>◇</span>知识地图
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
            <span className="stage-chip">STAGE 4 · MODERN C++ CURRICULUM</span>
            <h2 id="stage-title">
              从语言心智模型走向可验证的现代 C++ 工程能力。
            </h2>
            <p>
              10 个 Lesson、15 个 Exercise/Review 与首个渐进式 Project
              共用一套可解释 Evidence、真实 Clang Judge 和本地学习记录。
            </p>
            <div className="stage-actions">
              <button
                className="primary-button"
                onClick={() =>
                  setWorkspaceActivityId(catalog?.activities[0]?.id)
                }
              >
                开始第一课
              </button>
              <span>
                初始课程{" "}
                <strong>{catalog?.activities.length ?? 0} Activities</strong>
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

        <section id="curriculum" className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MODERN C++ TRACK</p>
              <h2>课程目录</h2>
            </div>
            <span className="last-check">
              10 Lessons · 15 Exercises/Reviews · 1 Project
            </span>
          </div>
          <div className="activity-grid">
            {catalog?.activities.map((activity) => (
              <button
                key={activity.id}
                className="activity-card"
                onClick={() => setWorkspaceActivityId(activity.id)}
              >
                <span className={`activity-kind kind-${activity.kind}`}>
                  {activity.kind}
                </span>
                <strong>{activity.title}</strong>
                <small>
                  {activity.estimatedMinutes} 分钟 ·{" "}
                  {activity.conceptIds.length} Concepts
                </small>
              </button>
            ))}
          </div>
        </section>

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
              detail="追加式 JSONL · SQLite 投影 · 可恢复"
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
                onClick={() => setWorkspaceActivityId("source-to-program")}
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
            <div className="data-actions">
              <button
                className="secondary-button"
                onClick={() => void downloadBackup()}
              >
                导出本地备份
              </button>
              <label className="secondary-button file-button">
                恢复备份
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void restoreFromFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <span>{dataMessage}</span>
            </div>
          </article>
        </section>
        <section id="reviews" className="section-block learning-loop-grid">
          <article className="current-card">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">REVIEW QUEUE</p>
                <h2>延迟复习</h2>
              </div>
              <span className="time-pill">
                {dashboard?.dueReviewCount ?? 0} DUE
              </span>
            </div>
            <div className="review-list">
              {reviews?.reviews.map((review) => (
                <div key={`${review.activityId}-${review.conceptId}`}>
                  <div>
                    <strong>{review.conceptId}</strong>
                    <span>{review.reason}</span>
                    <small>
                      {new Date(review.dueAt).toLocaleString("zh-CN")}
                    </small>
                  </div>
                  <button
                    className={
                      review.status === "due"
                        ? "primary-button"
                        : "secondary-button"
                    }
                    disabled={review.status !== "due"}
                    onClick={() => setWorkspaceActivityId(review.activityId)}
                  >
                    {review.status === "due" ? "开始复习" : "尚未到期"}
                  </button>
                </div>
              ))}
              {reviews?.reviews.length === 0 && (
                <p className="muted">
                  形成 demonstrated 证据后会自动安排延迟复习。
                </p>
              )}
            </div>
          </article>
          <article id="knowledge-map" className="path-card">
            <p className="eyebrow">KNOWLEDGE MAP</p>
            <h2>概念证据地图</h2>
            <div className="concept-list">
              {progress?.concepts.map((concept) => (
                <div key={concept.conceptId}>
                  <span className={`concept-state state-${concept.state}`}>
                    {concept.state}
                  </span>
                  <strong>{concept.conceptId}</strong>
                  <p>{concept.explanation}</p>
                  <small>
                    {concept.supportingEvidenceIds.length} 条支持证据
                  </small>
                </div>
              ))}
              {progress?.concepts.length === 0 && (
                <p className="muted">
                  完成 Grade 后，这里会显示状态与支持证据。
                </p>
              )}
            </div>
          </article>
        </section>
        <footer>
          <span>cpp-learn · Stage 3</span>
          <span>Local-first · C++20 · React</span>
        </footer>
      </main>
    </div>
  );
}
