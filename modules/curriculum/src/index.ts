import {
  validateActivity,
  type ValidationIssue,
} from "@cpp-learn/content-schema";
import type { CurriculumReadiness } from "@cpp-learn/contracts";
import type { ActivityDetail } from "@cpp-learn/contracts";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type CatalogValidationResult =
  | { readonly ok: true; readonly activityCount: number }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface Activity {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly kind: "lesson" | "exercise" | "review" | "project-milestone";
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly conceptIds: readonly string[];
  readonly prerequisiteIds: readonly string[];
  readonly content: { readonly format: "markdown"; readonly path: string };
  readonly workspace: {
    readonly editablePaths: readonly string[];
    readonly starterFiles: Readonly<Record<string, string>>;
  };
  readonly judge: {
    readonly version: number;
    readonly expectedStdout: string;
    readonly timeoutMs: number;
  };
  readonly evidencePolicy: { readonly automatedPass: boolean };
}

export interface Curriculum {
  readiness(): Promise<CurriculumReadiness>;
  getActivity(activityId: string): Promise<ActivityDetail | undefined>;
  listWorkspaceActivities(): Promise<readonly WorkspaceActivityDefinition[]>;
  getJudge(activityId: string): Promise<JudgeDefinition | undefined>;
}

export interface WorkspaceActivityDefinition {
  readonly activityId: string;
  readonly editablePaths: readonly string[];
  readonly starterFiles: Readonly<Record<string, string>>;
}

export interface JudgeDefinition {
  readonly activityId: string;
  readonly activityVersion: number;
  readonly judgeVersion: number;
  readonly expectedStdout: string;
  readonly timeoutMs: number;
}

export function validateCatalog(
  activities: readonly unknown[],
): CatalogValidationResult {
  const issues = activities.flatMap((activity) => validateActivity(activity));

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, activityCount: activities.length };
}

interface CatalogManifest {
  readonly schemaVersion: 1;
  readonly activityManifests: readonly string[];
}

function isCatalogManifest(value: unknown): value is CatalogManifest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate["schemaVersion"] === 1 &&
    Array.isArray(candidate["activityManifests"]) &&
    candidate["activityManifests"].every(
      (path) => typeof path === "string" && path.endsWith(".json"),
    )
  );
}

function resolveInsideCatalogRoot(
  catalogRoot: string,
  manifestPath: string,
): string {
  const resolvedPath = resolve(catalogRoot, manifestPath);
  const pathFromRoot = relative(catalogRoot, resolvedPath);
  if (
    manifestPath.includes("\\") ||
    isAbsolute(manifestPath) ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Activity manifest path escapes the curriculum root");
  }
  return resolvedPath;
}

export interface FilesystemCurriculumProbeDependencies {
  readonly catalogPath: string;
}

async function loadActivities(
  dependencies: FilesystemCurriculumProbeDependencies,
): Promise<readonly Activity[]> {
  const catalog = JSON.parse(
    await readFile(dependencies.catalogPath, "utf8"),
  ) as unknown;
  if (!isCatalogManifest(catalog))
    throw new Error("Catalog manifest is invalid");

  const catalogRoot = dirname(dependencies.catalogPath);
  const candidates = await Promise.all(
    catalog.activityManifests.map(async (manifestPath) => {
      const path = resolveInsideCatalogRoot(catalogRoot, manifestPath);
      return JSON.parse(await readFile(path, "utf8")) as unknown;
    }),
  );
  const validation = validateCatalog(candidates);
  if (!validation.ok) {
    throw new Error(
      validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; "),
    );
  }
  const activities = candidates as readonly Activity[];
  await Promise.all(
    activities.map((activity) =>
      readFile(
        resolveInsideCatalogRoot(catalogRoot, activity.content.path),
        "utf8",
      ),
    ),
  );
  return activities;
}

export function createFilesystemCurriculumProbe(
  dependencies: FilesystemCurriculumProbeDependencies,
): () => Promise<CurriculumReadiness> {
  return async () => {
    try {
      const activities = await loadActivities(dependencies);
      return { ready: true, activityCount: activities.length };
    } catch (error) {
      return {
        ready: false,
        activityCount: 0,
        issues: [
          error instanceof Error ? error.message : "Curriculum is unavailable",
        ],
      };
    }
  };
}

export function createFilesystemCurriculum(
  dependencies: FilesystemCurriculumProbeDependencies,
): Curriculum {
  return {
    readiness: createFilesystemCurriculumProbe(dependencies),
    async getActivity(activityId) {
      const activities = await loadActivities(dependencies);
      const catalogRoot = dirname(dependencies.catalogPath);
      const activity = activities.find(
        (candidate) => candidate.id === activityId,
      );
      if (!activity) return undefined;
      const markdown = await readFile(
        resolveInsideCatalogRoot(catalogRoot, activity.content.path),
        "utf8",
      );
      return {
        id: activity.id,
        version: activity.version,
        kind: activity.kind,
        title: activity.title,
        estimatedMinutes: activity.estimatedMinutes,
        conceptIds: activity.conceptIds,
        markdown,
        workspace: { editablePaths: activity.workspace.editablePaths },
      };
    },
    async listWorkspaceActivities() {
      const activities = await loadActivities(dependencies);
      return activities.map((activity) => ({
        activityId: activity.id,
        editablePaths: activity.workspace.editablePaths,
        starterFiles: activity.workspace.starterFiles,
      }));
    },
    async getJudge(activityId) {
      const activity = (await loadActivities(dependencies)).find(
        (candidate) => candidate.id === activityId,
      );
      if (!activity) return undefined;
      return {
        activityId: activity.id,
        activityVersion: activity.version,
        judgeVersion: activity.judge.version,
        expectedStdout: activity.judge.expectedStdout,
        timeoutMs: activity.judge.timeoutMs,
      };
    },
  };
}
