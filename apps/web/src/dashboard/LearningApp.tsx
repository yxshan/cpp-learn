import { Suspense, lazy } from "react";

import { CatalogSection } from "./CatalogSection.js";
import { EnvironmentSection } from "./EnvironmentSection.js";
import { Footer } from "./Footer.js";
import { KnowledgeMap } from "./KnowledgeMap.js";
import { ProjectsSection } from "./ProjectsSection.js";
import { RecordsSection } from "./RecordsSection.js";
import { ReviewsSection } from "./ReviewsSection.js";
import { StageBanner } from "./StageBanner.js";
import { Topbar } from "./Topbar.js";
import { useBackupRestore } from "./useBackupRestore.js";
import { useDashboardNavigation } from "./useDashboardNavigation.js";
import { useDashboardQueries } from "./useDashboardQueries.js";
import { useDashboardView } from "./useDashboardView.js";

const LessonWorkspace = lazy(async () => {
  const module = await import("../lesson/LessonWorkspace.js");
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

export function LearningApp() {
  const {
    bootstrap,
    dashboard,
    progress,
    reviews,
    catalog,
    error,
    refresh,
    refreshLearningRecord,
  } = useDashboardQueries();
  const { dataMessage, downloadBackup, restoreFromFile } = useBackupRestore();
  const {
    workspaceActivityId,
    catalogFilter,
    activeSection,
    openWorkspace,
    closeWorkspace,
    setWorkspaceDirty,
    selectCatalogFilter,
  } = useDashboardNavigation();
  const {
    currentActivityIndex,
    previousActivity,
    nextActivity,
    practiced,
    catalogCounts,
    filteredActivities,
    projectGroups,
  } = useDashboardView({
    catalog,
    dashboard,
    catalogFilter,
    workspaceActivityId,
  });

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
          onEvidenceChanged={refreshLearningRecord}
        />
      </Suspense>
    );
  }

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
            <a className="nav-item" href="/reference">
              <span aria-hidden="true">07</span>API 文档
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
        <Topbar ready={bootstrap?.ready} />

        <StageBanner
          firstActivity={catalog?.activities[0]}
          activityCount={catalog?.activities.length}
          onOpenWorkspace={openWorkspace}
        />

        {error && (
          <section className="error-panel" role="alert">
            <strong>本地服务暂时不可用</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()}>
              重新连接
            </button>
          </section>
        )}

        <CatalogSection
          catalog={catalog}
          catalogFilter={catalogFilter}
          counts={catalogCounts}
          filteredActivities={filteredActivities}
          onSelectFilter={selectCatalogFilter}
          onOpenWorkspace={openWorkspace}
        />

        <ProjectsSection
          projectGroups={projectGroups}
          progress={progress}
          dashboard={dashboard}
          onOpenWorkspace={openWorkspace}
        />

        <EnvironmentSection bootstrap={bootstrap} />

        <RecordsSection
          dashboard={dashboard}
          practiced={practiced}
          dataMessage={dataMessage}
          onOpenWorkspace={openWorkspace}
          onDownloadBackup={downloadBackup}
          onRestoreFile={restoreFromFile}
        />
        <section id="reviews" className="section-block learning-loop-grid">
          <ReviewsSection
            dueReviewCount={dashboard?.dueReviewCount}
            reviews={reviews}
            onOpenWorkspace={openWorkspace}
          />
          <KnowledgeMap progress={progress} />
        </section>
        <Footer />
      </main>
    </div>
  );
}
