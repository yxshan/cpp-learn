/**
 * Dashboard navigation state.
 *
 * The dashboard is addressable: the catalog filter, the selected Activity, and
 * the active section all live in the URL so that a direct link, a refresh, and
 * browser back/forward all restore the same view. Keeping the encoding in one
 * module is what makes that guarantee checkable.
 */

export type CatalogFilter = "core" | "exercise" | "review" | "all";

export type SectionId =
  | "overview"
  | "curriculum"
  | "projects"
  | "environment"
  | "records"
  | "reviews";

export interface NavigationState {
  readonly index: number;
  readonly overviewIndex?: number | undefined;
}

export function initialCatalogFilter(): CatalogFilter {
  const value = new URLSearchParams(window.location.search).get("catalog");
  return value === "exercise" || value === "review" || value === "all"
    ? value
    : "core";
}

export function initialWorkspaceActivityId(): string | undefined {
  return (
    new URLSearchParams(window.location.search).get("activity") ?? undefined
  );
}

export function initialSectionId(): SectionId {
  const section = window.location.hash.slice(1);
  return section === "curriculum" ||
    section === "projects" ||
    section === "environment" ||
    section === "records" ||
    section === "reviews"
    ? section
    : "overview";
}

export function navigationState(
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

export function createNavigationState(
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
