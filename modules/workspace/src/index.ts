import { posix } from "node:path";

export type EditablePathResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly code: "invalid_path" };

export function validateEditablePath(
  candidate: string,
  editablePaths: readonly string[]
): EditablePathResult {
  if (
    candidate.length === 0 ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    posix.isAbsolute(candidate) ||
    candidate.split("/").includes("..")
  ) {
    return { ok: false, code: "invalid_path" };
  }

  const normalizedPath = posix.normalize(candidate);
  if (normalizedPath !== candidate || !editablePaths.includes(normalizedPath)) {
    return { ok: false, code: "invalid_path" };
  }

  return { ok: true, path: normalizedPath };
}
