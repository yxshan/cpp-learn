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
