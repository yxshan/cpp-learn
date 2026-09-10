import type { ActivitiesResult, DashboardResult } from "@cpp-learn/contracts";

import type { CatalogFilter } from "./navigation.js";
import type { ProjectGroup } from "./types.js";

/**
 * Dashboard view model.
 *
 * Everything the dashboard renders is derived here from the read models and the
 * current navigation state, so the shell only decides layout. Keeping the
 * derivation in one place is what makes "the summary agrees with the catalogue"
 * checkable rather than emergent.
 */
export interface DashboardViewInput {
  readonly catalog: ActivitiesResult | undefined;
  readonly dashboard: DashboardResult | undefined;
  readonly catalogFilter: CatalogFilter;
  readonly workspaceActivityId: string | undefined;
}

export interface DashboardView {
  readonly currentActivityIndex: number;
  readonly previousActivity: ActivitiesResult["activities"][number] | undefined;
  readonly nextActivity: ActivitiesResult["activities"][number] | undefined;
  readonly practiced: number;
  readonly catalogCounts: {
    readonly lessons: number;
    readonly exercisesAndReviews: number;
    readonly milestones: number;
  };
  readonly filteredActivities: ActivitiesResult["activities"];
  readonly projectGroups: readonly ProjectGroup[];
}

export function useDashboardView({
  catalog,
  dashboard,
  catalogFilter,
  workspaceActivityId,
}: DashboardViewInput): DashboardView {
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

  return {
    currentActivityIndex,
    previousActivity,
    nextActivity,
    practiced,
    catalogCounts,
    filteredActivities,
    projectGroups,
  };
}
