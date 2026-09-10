import type { ActivitiesResult } from "@cpp-learn/contracts";

import { numberFormatter } from "./format.js";
import type { CatalogFilter } from "./navigation.js";
import type { CatalogActivity } from "./types.js";

export function CatalogSection({
  catalog,
  catalogFilter,
  counts,
  filteredActivities,
  onSelectFilter,
  onOpenWorkspace,
}: {
  readonly catalog: ActivitiesResult | undefined;
  readonly catalogFilter: CatalogFilter;
  readonly counts: {
    readonly lessons: number;
    readonly exercisesAndReviews: number;
    readonly milestones: number;
  };
  readonly filteredActivities: readonly CatalogActivity[];
  readonly onSelectFilter: (filter: CatalogFilter) => void;
  readonly onOpenWorkspace: (activityId?: string) => void;
}) {
  return (
    <section
      id="curriculum"
      className="section-block"
      aria-labelledby="curriculum-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            MODERN C++ PATH /{" "}
            {numberFormatter.format(catalog?.activities.length ?? 0)} ACTIVITIES
          </p>
          <h2 id="curriculum-title">课程路径</h2>
        </div>
        <span className="last-check">
          {numberFormatter.format(counts.lessons)} 课 ·{" "}
          {numberFormatter.format(counts.exercisesAndReviews)} 次练习与复习 ·{" "}
          {numberFormatter.format(counts.milestones)} 个项目里程碑
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
              onClick={() => onSelectFilter(filter)}
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
              onClick={() => onOpenWorkspace(activity.id)}
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
                  {numberFormatter.format(activity.conceptIds.length)} 个概念
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
  );
}
