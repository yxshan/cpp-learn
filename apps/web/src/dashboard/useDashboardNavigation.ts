import { useCallback, useEffect, useRef, useState } from "react";

import {
  createNavigationState,
  initialCatalogFilter,
  initialSectionId,
  initialWorkspaceActivityId,
  navigationState,
  type CatalogFilter,
  type SectionId,
} from "./navigation.js";

/**
 * Dashboard navigation.
 *
 * The dashboard is addressable and every change is a history entry, so opening a
 * lesson, closing it, switching catalog filters and pressing Back all travel the
 * same path. Browser history is the single source of truth: the refs here mirror
 * the current entry so a popstate handler can tell "the learner navigated" from
 * "we navigated the learner", and can refuse to leave a dirty buffer.
 */
export interface DashboardNavigation {
  readonly workspaceActivityId: string | undefined;
  readonly catalogFilter: CatalogFilter;
  readonly activeSection: SectionId;
  readonly openWorkspace: (activityId?: string) => void;
  readonly closeWorkspace: () => void;
  readonly setWorkspaceDirty: (dirty: boolean) => void;
  readonly selectCatalogFilter: (filter: CatalogFilter) => void;
}

export function useDashboardNavigation(): DashboardNavigation {
  const [workspaceActivityId, setWorkspaceActivityId] = useState<
    string | undefined
  >(initialWorkspaceActivityId);
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilter>(initialCatalogFilter);
  const [activeSection, setActiveSection] =
    useState<SectionId>(initialSectionId);

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

  const selectCatalogFilter = (filter: CatalogFilter): void => {
    setCatalogFilter(filter);
    const url = new URL(window.location.href);
    if (filter === "core") url.searchParams.delete("catalog");
    else url.searchParams.set("catalog", filter);
    window.history.replaceState(null, "", url);
  };

  return {
    workspaceActivityId,
    catalogFilter,
    activeSection,
    openWorkspace,
    closeWorkspace,
    setWorkspaceDirty,
    selectCatalogFilter,
  };
}
