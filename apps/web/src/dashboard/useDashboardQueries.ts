import { useCallback, useEffect, useState } from "react";

import type {
  ActivitiesResult,
  BootstrapResult,
  DashboardResult,
  ProgressResult,
  ReviewsResult,
} from "@cpp-learn/contracts";

import {
  getActivities,
  getBootstrap,
  getDashboard,
  getProgress,
  getReviews,
} from "../api.js";

/**
 * Dashboard queries.
 *
 * The five read models the dashboard needs are fetched together on purpose:
 * they are rendered as one screen, and a screen that mixes a fresh catalogue
 * with a stale learning record is worse than one that keeps the previous
 * snapshot until every query settles.
 */
export interface DashboardQueries {
  readonly bootstrap: BootstrapResult | undefined;
  readonly dashboard: DashboardResult | undefined;
  readonly progress: ProgressResult | undefined;
  readonly reviews: ReviewsResult | undefined;
  readonly catalog: ActivitiesResult | undefined;
  readonly error: string | undefined;
  readonly refresh: () => Promise<void>;
  /** Re-reads only the learning record, as Grade does when it records evidence. */
  readonly refreshLearningRecord: () => Promise<void>;
}

export function useDashboardQueries(): DashboardQueries {
  const [bootstrap, setBootstrap] = useState<BootstrapResult>();
  const [dashboard, setDashboard] = useState<DashboardResult>();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<ProgressResult>();
  const [reviews, setReviews] = useState<ReviewsResult>();
  const [catalog, setCatalog] = useState<ActivitiesResult>();

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

  const refreshLearningRecord = useCallback(async (): Promise<void> => {
    const [nextDashboard, nextProgress, nextReviews] = await Promise.all([
      getDashboard(),
      getProgress(),
      getReviews(false),
    ]);
    setDashboard(nextDashboard);
    setProgress(nextProgress);
    setReviews(nextReviews);
  }, []);

  return {
    bootstrap,
    dashboard,
    progress,
    reviews,
    catalog,
    error,
    refresh,
    refreshLearningRecord,
  };
}
