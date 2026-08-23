import { describe, expect, it } from "vitest";

import { validateCatalog } from "./index.js";

describe("[T-CONTENT-001] Curriculum catalog validation", () => {
  it("rejects invalid required content and reports every detected contract error", () => {
    const result = validateCatalog([
      {
        schemaVersion: 1,
        id: "Bad id",
        version: 0,
        kind: "video",
        title: "",
        estimatedMinutes: -1,
        conceptIds: [],
        prerequisiteIds: [],
        content: { format: "shell", path: "../lesson.sh" },
        evidencePolicy: { automatedPass: false },
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(6);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/id" }),
          expect.objectContaining({ path: "/version" }),
          expect.objectContaining({ path: "/kind" }),
          expect.objectContaining({ path: "/title" }),
          expect.objectContaining({ path: "/estimatedMinutes" }),
          expect.objectContaining({ path: "/conceptIds" }),
        ]),
      );
    }
  });
});

describe("[T-CONTENT-003] Curriculum prerequisite graph", () => {
  const activity = (id: string, prerequisiteIds: readonly string[]) => ({
    schemaVersion: 1,
    id,
    version: 1,
    kind: "lesson",
    title: id,
    estimatedMinutes: 10,
    conceptIds: [`${id}-concept`],
    prerequisiteIds,
    content: { format: "markdown", path: `activities/${id}/lesson.md` },
    workspace: {
      editablePaths: ["main.cpp"],
      starterFiles: { "main.cpp": "int main() {}\n" },
    },
    judge: { version: 1, expectedStdout: "", timeoutMs: 1_000 },
    evidencePolicy: { automatedPass: true },
  });

  it("rejects a cyclic required prerequisite graph", () => {
    const result = validateCatalog([
      activity("activity-a", ["activity-b"]),
      activity("activity-b", ["activity-a"]),
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ keyword: "graph" })],
    });
  });

  it("rejects prerequisites that do not exist in the catalog", () => {
    expect(
      validateCatalog([activity("activity-a", ["missing-activity"])]),
    ).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          keyword: "graph",
          message: expect.stringContaining("unknown prerequisite"),
        }),
      ],
    });
  });

  it("rejects private-test feedback that copies hidden input or expected output", () => {
    const candidate = activity("private-leak", []);
    const result = validateCatalog([
      {
        ...candidate,
        judge: {
          ...candidate.judge,
          privateTests: [
            {
              name: "hidden case",
              stdin: "secret-input-value\n",
              expectedStdout: "secret-output-value\n",
              failureCategory: "Failed for secret-input-value",
            },
          ],
        },
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ keyword: "privacy" })],
    });
  });
});
