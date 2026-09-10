import { createHash } from "node:crypto";

import type { AuthoringDraftManifest } from "./index.ts";

/**
 * Draft input digest.
 *
 * Only author inputs participate: generated files (`report.json`,
 * `preview.html`, `publication-plan.json`, `repair/*`) are excluded so a
 * re-check does not look like a content change.
 */

const GENERATED_DRAFT_FILES = new Set([
  "report.json",
  "preview.html",
  "publication-plan.json",
]);

function isGeneratedDraftFile(path: string): boolean {
  return GENERATED_DRAFT_FILES.has(path) || path.startsWith("repair/");
}

function digestibleAuthoringContent(path: string, content: string): string {
  if (path !== "draft.json") return content;
  try {
    const draft = JSON.parse(content) as AuthoringDraftManifest;
    return JSON.stringify({
      schemaVersion: draft.schemaVersion,
      draftId: draft.draftId,
      profile: draft.profile,
      target: draft.target,
      targetPaths: draft.targetPaths,
      createdAt: draft.createdAt,
    });
  } catch {
    return content;
  }
}

export function authoringInputDigest(
  files: Readonly<Record<string, string>>,
): string {
  const hash = createHash("sha256");
  for (const path of Object.keys(files)
    .filter((candidate) => !isGeneratedDraftFile(candidate))
    .sort()) {
    const content = digestibleAuthoringContent(path, files[path]!);
    hash.update(`${path.length}:${path}${Buffer.byteLength(content)}:`);
    hash.update(content);
  }
  return hash.digest("hex");
}
