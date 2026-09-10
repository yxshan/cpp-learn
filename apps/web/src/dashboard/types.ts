import type { ActivitiesResult } from "@cpp-learn/contracts";

export type CatalogActivity = ActivitiesResult["activities"][number];

export interface ProjectGroup {
  readonly project: NonNullable<CatalogActivity["project"]>;
  readonly milestones: CatalogActivity[];
}
