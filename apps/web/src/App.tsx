import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
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

type CatalogFilter = "core" | "exercise" | "review" | "all";
type SectionId =
  | "overview"
  | "curriculum"
  | "projects"
  | "environment"
  | "records"
  | "reviews";
type CatalogActivity = ActivitiesResult["activities"][number];

interface ProjectGroup {
  readonly project: NonNullable<CatalogActivity["project"]>;
  readonly milestones: CatalogActivity[];
}

interface NavigationState {
  readonly index: number;
  readonly overviewIndex?: number | undefined;
}

const numberFormatter = new Intl.NumberFormat("zh-CN");
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function initialCatalogFilter(): CatalogFilter {
  const value = new URLSearchParams(window.location.search).get("catalog");
  return value === "exercise" || value === "review" || value === "all"
    ? value
    : "core";
}

function initialWorkspaceActivityId(): string | undefined {
  return (
    new URLSearchParams(window.location.search).get("activity") ?? undefined
  );
}

function initialSectionId(): SectionId {
  const section = window.location.hash.slice(1);
  return section === "curriculum" ||
    section === "projects" ||
    section === "environment" ||
    section === "records" ||
    section === "reviews"
    ? section
    : "overview";
}

function navigationState(
  value: unknown = window.history.state,
): NavigationState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record["__cppLearnIndex"] !== "number") return undefined;
  return {
    index: record["__cppLearnIndex"],
    overviewIndex:
      typeof record["__cppLearnOverviewIndex"] === "number"
        ? record["__cppLearnOverviewIndex"]
        : undefined,
  };
}

function createNavigationState(
  index: number,
  overviewIndex?: number,
): Record<string, number> {
  return overviewIndex === undefined
    ? { __cppLearnIndex: index }
    : {
        __cppLearnIndex: index,
        __cppLearnOverviewIndex: overviewIndex,
      };
}

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
      <div
        className={`status-icon ${ready ? "is-ready" : "needs-attention"}`}
        aria-hidden="true"
      >
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
  const [workspaceActivityId, setWorkspaceActivityId] = useState<
    string | undefined
  >(initialWorkspaceActivityId);
  const [progress, setProgress] = useState<ProgressResult>();
  const [reviews, setReviews] = useState<ReviewsResult>();
  const [catalog, setCatalog] = useState<ActivitiesResult>();
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilter>(initialCatalogFilter);
  const [activeSection, setActiveSection] =
    useState<SectionId>(initialSectionId);
  const [dataMessage, setDataMessage] = useState("可导出校验后的本地备份");
  const workspaceActivityIdRef = useRef(workspaceActivityId);
  const workspaceDirtyRef = useRef(false);
  const historyIndexRef = useRef(navigationState()?.index ?? 0);
  const restoringHistoryRef = useRef(false);

  const changeWorkspaceActivity = useCallback(
    (activityId: string | undefined): void => {
      workspaceActivityIdRef.current = activityId;
      setWorkspaceActivityId(activityId);
    },
    [],
  );

  const confirmWorkspaceChange = useCallback((): boolean => {
    if (!workspaceDirtyRef.current) return true;
    const accepted = window.confirm(
      "当前代码尚未保存。离开本课程会丢失这些修改，是否继续？",
    );
    if (accepted) workspaceDirtyRef.current = false;
    return accepted;
  }, []);

  const setWorkspaceDirty = useCallback((dirty: boolean): void => {
    workspaceDirtyRef.current = dirty;
  }, []);

  const openWorkspace = useCallback(
    (activityId?: string): void => {
      if (!activityId) return;
      const currentActivityId = workspaceActivityIdRef.current;
      if (activityId === currentActivityId) return;
      if (currentActivityId && !confirmWorkspaceChange()) return;

      const currentState = navigationState();
      const currentIndex = currentState?.index ?? historyIndexRef.current;
      const overviewIndex =
        currentState?.overviewIndex ??
        (currentActivityId ? undefined : currentIndex);
      const nextIndex = currentIndex + 1;
      const url = new URL(window.location.href);
      url.searchParams.set("activity", activityId);
      window.history.pushState(
        createNavigationState(nextIndex, overviewIndex),
        "",
        url,
      );
      historyIndexRef.current = nextIndex;
      workspaceDirtyRef.current = false;
      changeWorkspaceActivity(activityId);
    },
    [changeWorkspaceActivity, confirmWorkspaceChange],
  );

  const closeWorkspace = useCallback((): void => {
    if (!confirmWorkspaceChange()) return;
    const currentState = navigationState();
    if (
      currentState?.overviewIndex !== undefined &&
      currentState.overviewIndex < currentState.index
    ) {
      window.history.go(currentState.overviewIndex - currentState.index);
      return;
    }

    const currentIndex = currentState?.index ?? historyIndexRef.current;
    const url = new URL(window.location.href);
    url.searchParams.delete("activity");
    window.history.replaceState(
      createNavigationState(currentIndex, currentIndex),
      "",
      url,
    );
    workspaceDirtyRef.current = false;
    changeWorkspaceActivity(undefined);
  }, [changeWorkspaceActivity, confirmWorkspaceChange]);

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

  useEffect(() => {
    const existingState = navigationState();
    if (existingState) {
      historyIndexRef.current = existingState.index;
    } else {
      window.history.replaceState(
        createNavigationState(
          historyIndexRef.current,
          workspaceActivityIdRef.current ? undefined : historyIndexRef.current,
        ),
        "",
        window.location.href,
      );
    }

    const syncWorkspaceFromUrl = (event: PopStateEvent): void => {
      const targetState = navigationState(event.state);
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        if (targetState) historyIndexRef.current = targetState.index;
        return;
      }

      const targetActivityId = initialWorkspaceActivityId();
      if (targetActivityId === workspaceActivityIdRef.current) {
        if (targetState) historyIndexRef.current = targetState.index;
        return;
      }

      if (!confirmWorkspaceChange()) {
        if (targetState) {
          restoringHistoryRef.current = true;
          window.history.go(historyIndexRef.current - targetState.index);
        } else {
          const url = new URL(window.location.href);
          const currentActivityId = workspaceActivityIdRef.current;
          if (currentActivityId) {
            url.searchParams.set("activity", currentActivityId);
          } else {
            url.searchParams.delete("activity");
          }
          const nextIndex = historyIndexRef.current + 1;
          window.history.pushState(createNavigationState(nextIndex), "", url);
          historyIndexRef.current = nextIndex;
        }
        return;
      }

      workspaceDirtyRef.current = false;
      if (targetState) historyIndexRef.current = targetState.index;
      changeWorkspaceActivity(targetActivityId);
    };
    window.addEventListener("popstate", syncWorkspaceFromUrl);
    return () => window.removeEventListener("popstate", syncWorkspaceFromUrl);
  }, [changeWorkspaceActivity, confirmWorkspaceChange]);

  useEffect(() => {
    const syncSectionFromHash = (): void =>
      setActiveSection(initialSectionId());
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);

  const currentActivityIndex =
    catalog?.activities.findIndex(
      (activity) => activity.id === workspaceActivityId,
    ) ?? -1;
  const previousActivity =
    currentActivityIndex > 0
      ? catalog?.activities[currentActivityIndex - 1]
      : undefined;
  const nextActivity =
    currentActivityIndex >= 0 &&
    currentActivityIndex < (catalog?.activities.length ?? 0) - 1
      ? catalog?.activities[currentActivityIndex + 1]
      : undefined;

  if (workspaceActivityId) {
    return (
      <Suspense
        fallback={
          <div className="workspace-loading">正在加载本地代码编辑器…</div>
        }
      >
        <LessonWorkspace
          key={workspaceActivityId}
          activityId={workspaceActivityId}
          currentPosition={
            currentActivityIndex >= 0 ? currentActivityIndex + 1 : undefined
          }
          totalActivities={catalog?.activities.length}
          previousActivity={previousActivity}
          nextActivity={nextActivity}
          onBack={closeWorkspace}
          onNavigate={openWorkspace}
          onDirtyChange={setWorkspaceDirty}
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
  const catalogCounts = {
    lessons:
      catalog?.activities.filter((activity) => activity.kind === "lesson")
        .length ?? 0,
    exercisesAndReviews:
      catalog?.activities.filter(
        (activity) =>
          activity.kind === "exercise" || activity.kind === "review",
      ).length ?? 0,
    milestones:
      catalog?.activities.filter(
        (activity) => activity.kind === "project-milestone",
      ).length ?? 0,
  };
  const filteredActivities =
    catalog?.activities.filter((activity) => {
      if (catalogFilter === "core") {
        return (
          activity.kind === "lesson" || activity.kind === "project-milestone"
        );
      }
      if (catalogFilter === "exercise") return activity.kind === "exercise";
      if (catalogFilter === "review") return activity.kind === "review";
      return true;
    }) ?? [];
  const projectGroups: ProjectGroup[] = [];
  for (const activity of catalog?.activities ?? []) {
    if (!activity.project) continue;
    const group = projectGroups.find(
      (candidate) => candidate.project.id === activity.project?.id,
    );
    if (group) group.milestones.push(activity);
    else
      projectGroups.push({
        project: activity.project,
        milestones: [activity],
      });
  }

  const selectCatalogFilter = (filter: CatalogFilter): void => {
    setCatalogFilter(filter);
    const url = new URL(window.location.href);
    if (filter === "core") url.searchParams.delete("catalog");
    else url.searchParams.set("catalog", filter);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#overview">
        跳到主要内容
      </a>
      <header className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <BrandMark />
            <div>
              <strong translate="no">C++ Learn</strong>
              <span>现代 C++ 工程学习路径</span>
            </div>
          </div>
          <nav aria-label="主导航">
            <a
              className={`nav-item ${activeSection === "overview" ? "active" : ""}`}
              href="#overview"
              aria-current={
                activeSection === "overview" ? "location" : undefined
              }
            >
              <span aria-hidden="true">01</span>总览
            </a>
            <a
              className={`nav-item ${activeSection === "curriculum" ? "active" : ""}`}
              href="#curriculum"
              aria-current={
                activeSection === "curriculum" ? "location" : undefined
              }
            >
              <span aria-hidden="true">02</span>课程
            </a>
            <a
              className={`nav-item ${activeSection === "projects" ? "active" : ""}`}
              href="#projects"
              aria-current={
                activeSection === "projects" ? "location" : undefined
              }
            >
              <span aria-hidden="true">03</span>项目
            </a>
            <a
              className={`nav-item ${activeSection === "environment" ? "active" : ""}`}
              href="#environment"
              aria-current={
                activeSection === "environment" ? "location" : undefined
              }
            >
              <span aria-hidden="true">04</span>环境
            </a>
            <a
              className={`nav-item ${activeSection === "records" ? "active" : ""}`}
              href="#records"
              aria-current={
                activeSection === "records" ? "location" : undefined
              }
            >
              <span aria-hidden="true">05</span>记录
            </a>
            <a
              className={`nav-item ${activeSection === "reviews" ? "active" : ""}`}
              href="#reviews"
              aria-current={
                activeSection === "reviews" ? "location" : undefined
              }
            >
              <span aria-hidden="true">06</span>复习
            </a>
          </nav>
          <div className="sidebar-footer">
            <span className="local-pulse" aria-hidden="true" />
            <div>
              <strong>本地模式</strong>
              <span>数据保存在此设备</span>
            </div>
          </div>
        </div>
      </header>

      <main id="overview" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">学习控制台</p>
            <h1>从第一段 C++ 程序开始</h1>
          </div>
          <div className="topbar-actions">
            <span
              className={`overall-status ${bootstrap?.ready ? "is-ready" : ""}`}
              role="status"
              aria-live="polite"
            >
              <i aria-hidden="true" />
              {bootstrap?.ready ? "环境已就绪" : "正在检查环境"}
            </span>
            <span className="session-mark" aria-hidden="true">
              LOCAL / 01
            </span>
          </div>
        </header>

        <section className="stage-banner" aria-labelledby="stage-title">
          <div className="stage-copy">
            <span className="stage-chip">阶段 06 · 职业项目路径</span>
            <h2 id="stage-title">
              从可判定练习走向能解释、能复现的 C++ 工程作品。
            </h2>
            <p>
              70 个活动覆盖现代
              C++、算法、工具链、系统、网络、数据库、并发与生产就绪；5
              个渐进式项目把代码、测试、基准和事故复盘连成作品集。
            </p>
            <div className="stage-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => openWorkspace(catalog?.activities[0]?.id)}
                disabled={!catalog?.activities[0]}
              >
                开始第一课
              </button>
              <span>
                完整路径{" "}
                <strong>{catalog?.activities.length ?? 0} 个学习活动</strong>
              </span>
            </div>
          </div>
          <div className="code-window" aria-hidden="true" translate="no">
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
            <button type="button" onClick={() => void refresh()}>
              重新连接
            </button>
          </section>
        )}

        <section
          id="curriculum"
          className="section-block"
          aria-labelledby="curriculum-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                MODERN C++ PATH /{" "}
                {numberFormatter.format(catalog?.activities.length ?? 0)}{" "}
                ACTIVITIES
              </p>
              <h2 id="curriculum-title">课程路径</h2>
            </div>
            <span className="last-check">
              {numberFormatter.format(catalogCounts.lessons)} 课 ·{" "}
              {numberFormatter.format(catalogCounts.exercisesAndReviews)}{" "}
              次练习与复习 · {numberFormatter.format(catalogCounts.milestones)}{" "}
              个项目里程碑
            </span>
          </div>
          <div className="catalog-toolbar">
            <div role="group" aria-label="筛选课程路径">
              {(
                [
                  ["core", "主线与项目"],
                  ["exercise", "练习"],
                  ["review", "复习"],
                  ["all", "全部"],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={catalogFilter === filter}
                  className={catalogFilter === filter ? "active" : ""}
                  onClick={() => selectCatalogFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span aria-live="polite">
              当前显示 {numberFormatter.format(filteredActivities.length)} 项
            </span>
          </div>
          <div className="catalog-guide" aria-label="课程结构说明">
            <div>
              <strong>主线课程</strong>
              <span>建立模型</span>
            </div>
            <i aria-hidden="true" />
            <div>
              <strong>刻意练习</strong>
              <span>写代码验证</span>
            </div>
            <i aria-hidden="true" />
            <div>
              <strong>延迟复习</strong>
              <span>形成长期证据</span>
            </div>
          </div>
          <div className="activity-grid">
            {filteredActivities.map((activity) => {
              const index = catalog?.activities.indexOf(activity) ?? 0;
              return (
                <button
                  key={activity.id}
                  className="activity-card"
                  type="button"
                  onClick={() => openWorkspace(activity.id)}
                >
                  <span className="activity-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="activity-copy">
                    <span className={`activity-kind kind-${activity.kind}`}>
                      {activity.kind === "lesson"
                        ? "课程"
                        : activity.kind === "review"
                          ? "复习"
                          : activity.kind === "exercise"
                            ? "练习"
                            : "项目"}
                    </span>
                    <strong>{activity.title}</strong>
                    <small>
                      {numberFormatter.format(activity.estimatedMinutes)} 分钟 ·{" "}
                      {numberFormatter.format(activity.conceptIds.length)}{" "}
                      个概念
                    </small>
                  </span>
                  <span className="activity-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              );
            })}
            {!catalog &&
              Array.from({ length: 6 }, (_, index) => (
                <div
                  className="activity-card activity-skeleton"
                  aria-hidden="true"
                  key={index}
                />
              ))}
          </div>
        </section>

        <section
          id="projects"
          className="section-block portfolio-section"
          aria-labelledby="projects-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">PORTFOLIO / 5 PROGRESSIVE PROJECTS</p>
              <h2 id="projects-title">工程项目作品集</h2>
            </div>
            <span className="last-check">
              构建 · 测试 · 基准 · 复盘 · 面试叙事
            </span>
          </div>
          <p className="portfolio-intro">
            每个项目使用持久 Workspace
            跨里程碑演进。下方概念状态直接来自学习证据；项目代码与 Portfolio
            文档保留在本机，并随备份由学习者拥有。
          </p>
          <div className="project-grid">
            {projectGroups.map(({ project, milestones }, projectIndex) => {
              const conceptIds = Array.from(
                new Set(
                  milestones.flatMap((milestone) => milestone.conceptIds),
                ),
              );
              const milestoneIds = new Set(
                milestones.map((milestone) => milestone.id),
              );
              const projectEvidenceByConcept = new Map(
                conceptIds.map((conceptId) => {
                  const concept = progress?.concepts.find(
                    (candidate) => candidate.conceptId === conceptId,
                  );
                  return [
                    conceptId,
                    concept?.evidence?.filter(
                      (evidence) =>
                        evidence.outcome === "pass" &&
                        milestoneIds.has(evidence.activityId),
                    ) ?? [],
                  ] as const;
                }),
              );
              const evidencedConcepts = [
                ...projectEvidenceByConcept.values(),
              ].filter((evidence) => evidence.length > 0).length;
              const progressPercent = conceptIds.length
                ? Math.round((evidencedConcepts / conceptIds.length) * 100)
                : 0;
              return (
                <article className="project-card" key={project.id}>
                  <div className="project-card-heading">
                    <span>{String(projectIndex + 1).padStart(2, "0")}</span>
                    <div>
                      <p>PROJECT / {project.id}</p>
                      <h3>{project.title}</h3>
                    </div>
                  </div>
                  <p>{project.portfolioOutcome}</p>
                  <div className="project-progress">
                    <div>
                      <span>概念证据</span>
                      <strong>{progressPercent}%</strong>
                    </div>
                    <span
                      role="progressbar"
                      aria-label={`${project.title}概念证据进度`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPercent}
                    >
                      <i style={{ width: `${progressPercent}%` }} />
                    </span>
                  </div>
                  <div className="project-concepts" aria-label="关联概念状态">
                    {conceptIds.map((conceptId) => {
                      const state =
                        dashboard?.conceptStates[conceptId] ?? "unseen";
                      const projectEvidence =
                        projectEvidenceByConcept.get(conceptId) ?? [];
                      const latestEvidence = projectEvidence.at(-1);
                      const sourceMilestone = latestEvidence
                        ? milestones.find(
                            (milestone) =>
                              milestone.id === latestEvidence.activityId,
                          )
                        : undefined;
                      return (
                        <span className={`state-${state}`} key={conceptId}>
                          {conceptId} ·{" "}
                          {sourceMilestone
                            ? `M${sourceMilestone.project?.milestone} 证据`
                            : "尚无项目证据"}
                        </span>
                      );
                    })}
                  </div>
                  <div className="project-milestones">
                    {milestones.map((milestone) => (
                      <button
                        key={milestone.id}
                        type="button"
                        onClick={() => openWorkspace(milestone.id)}
                      >
                        <span>
                          M{milestone.project?.milestone ?? 1} /{" "}
                          {milestone.project?.milestoneCount ?? 1}
                        </span>
                        <strong>
                          {milestone.title.replace(/^Project：/, "")}
                        </strong>
                        <i aria-hidden="true">→</i>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
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
                ? `检测于 ${timeFormatter.format(new Date(bootstrap.generatedAt))}`
                : "检测中"}
            </span>
          </div>
          <div className="status-grid">
            <StatusCard
              eyebrow="CURRICULUM"
              title="课程目录"
              detail={`${numberFormatter.format(
                bootstrap?.services.curriculum.activityCount ?? 0,
              )} 个活动已校验`}
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
                type="button"
                onClick={() => openWorkspace("source-to-program")}
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
                <strong>
                  {numberFormatter.format(dashboard?.attempts.length ?? 0)}
                </strong>
                <span>运行与判题</span>
              </div>
              <div>
                <strong>{numberFormatter.format(practiced)}</strong>
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
                type="button"
                onClick={() => void downloadBackup()}
              >
                导出本地备份
              </button>
              <label className="secondary-button file-button">
                恢复备份
                <input
                  type="file"
                  name="backup"
                  autoComplete="off"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void restoreFromFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <span aria-live="polite">{dataMessage}</span>
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
                {numberFormatter.format(dashboard?.dueReviewCount ?? 0)} DUE
              </span>
            </div>
            <div className="review-list">
              {reviews?.reviews.map((review) => (
                <div key={`${review.activityId}-${review.conceptId}`}>
                  <div>
                    <strong>{review.conceptId}</strong>
                    <span>{review.reason}</span>
                    <small>
                      {dateTimeFormatter.format(new Date(review.dueAt))}
                    </small>
                  </div>
                  <button
                    className={
                      review.status === "due"
                        ? "primary-button"
                        : "secondary-button"
                    }
                    disabled={review.status !== "due"}
                    type="button"
                    onClick={() => openWorkspace(review.activityId)}
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
                    {numberFormatter.format(
                      concept.supportingEvidenceIds.length,
                    )}{" "}
                    条支持证据
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
          <span>cpp-learn · Stage 6</span>
          <span>Local-first · C++20 · React</span>
        </footer>
      </main>
    </div>
  );
}
