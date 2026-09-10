import type { DashboardResult, ProgressResult } from "@cpp-learn/contracts";

import type { ProjectGroup } from "./types.js";

export function ProjectsSection({
  projectGroups,
  progress,
  dashboard,
  onOpenWorkspace,
}: {
  readonly projectGroups: readonly ProjectGroup[];
  readonly progress: ProgressResult | undefined;
  readonly dashboard: DashboardResult | undefined;
  readonly onOpenWorkspace: (activityId?: string) => void;
}) {
  return (
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
        <span className="last-check">构建 · 测试 · 基准 · 复盘 · 面试叙事</span>
      </div>
      <p className="portfolio-intro">
        每个项目使用持久 Workspace
        跨里程碑演进。下方概念状态直接来自学习证据；项目代码与 Portfolio
        文档保留在本机，并随备份由学习者拥有。
      </p>
      <div className="project-grid">
        {projectGroups.map(({ project, milestones }, projectIndex) => {
          const conceptIds = Array.from(
            new Set(milestones.flatMap((milestone) => milestone.conceptIds)),
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
                  const state = dashboard?.conceptStates[conceptId] ?? "unseen";
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
                    onClick={() => onOpenWorkspace(milestone.id)}
                  >
                    <span>
                      M{milestone.project?.milestone ?? 1} /{" "}
                      {milestone.project?.milestoneCount ?? 1}
                    </span>
                    <strong>{milestone.title.replace(/^Project：/, "")}</strong>
                    <i aria-hidden="true">→</i>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
