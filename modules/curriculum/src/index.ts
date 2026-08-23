import {
  validateActivity,
  type ValidationIssue
} from "@cpp-learn/content-schema";
import type { CurriculumReadiness } from "@cpp-learn/contracts";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type CatalogValidationResult =
  | { readonly ok: true; readonly activityCount: number }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export function validateCatalog(
  activities: readonly unknown[]
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
      (path) => typeof path === "string" && path.endsWith(".json")
    )
  );
}

function resolveInsideCatalogRoot(catalogRoot: string, manifestPath: string): string {
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

export function createFilesystemCurriculumProbe(
  dependencies: FilesystemCurriculumProbeDependencies
): () => Promise<CurriculumReadiness> {
  return async () => {
    try {
      const catalog = JSON.parse(
        await readFile(dependencies.catalogPath, "utf8")
      ) as unknown;
      if (!isCatalogManifest(catalog)) {
        return { ready: false, activityCount: 0, issues: ["Catalog manifest is invalid"] };
      }

      const catalogRoot = dirname(dependencies.catalogPath);
      const activities = await Promise.all(
        catalog.activityManifests.map(async (manifestPath) => {
          const path = resolveInsideCatalogRoot(catalogRoot, manifestPath);
          return JSON.parse(await readFile(path, "utf8")) as unknown;
        })
      );
      const validation = validateCatalog(activities);
      if (!validation.ok) {
        return {
          ready: false,
          activityCount: 0,
          issues: validation.issues.map(
            (issue) => `${issue.path}: ${issue.message}`
          )
        };
      }
      return { ready: true, activityCount: validation.activityCount };
    } catch (error) {
      return {
        ready: false,
        activityCount: 0,
        issues: [error instanceof Error ? error.message : "Curriculum is unavailable"]
      };
    }
  };
}
