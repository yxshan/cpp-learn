import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { createFilesystemCurriculum, validateCatalog } from "./index.js";

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
    objectives: [`Complete ${id}.`],
    victoryConditions: ["Reference behavior is reproduced."],
    sources: [
      {
        kind: "primary",
        title: "C++ language reference",
        url: "https://en.cppreference.com/w/cpp/language",
      },
      {
        kind: "reference",
        title: "C++ Core Guidelines",
        url: "https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines",
      },
    ],
    content: { format: "markdown", path: `activities/${id}/lesson.md` },
    workspace: {
      editablePaths: ["main.cpp"],
      starterFiles: { "main.cpp": "int main() {}\n" },
    },
    judge: { version: 1, expectedStdout: "", timeoutMs: 1_000 },
    evidencePolicy: {
      automatedPass: true,
      demonstratedRequiresReflection: true,
      demonstratedRequiresIndependent: true,
      reviewAfterDays: 1,
    },
    quality: {
      referenceFiles: { "main.cpp": "int main() { return 0; }\n" },
      mutations: [
        {
          id: "wrong-output",
          files: { "main.cpp": "int main() { return 1; }\n" },
          expectedVerdict: "runtime_error",
        },
      ],
      interactiveBlocks: [],
      printFallback: "Compile and run the listed source locally.",
    },
    learning: {
      hints: [
        { id: "nudge", title: "Nudge", kind: "nudge", content: "Think." },
        {
          id: "concept",
          title: "Concept",
          kind: "concept",
          content: "Recall.",
        },
      ],
      reflections: [{ id: "explain", prompt: "Explain.", required: true }],
      reviewIds: [],
      teacherRubric: { id: "rubric", prompt: "Check the explanation." },
    },
  });

  it("rejects a cyclic required prerequisite graph", () => {
    const result = validateCatalog([
      activity("activity-a", ["activity-b"]),
      activity("activity-b", ["activity-a"]),
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "graph" }),
      ]),
    });
  });

  it("rejects prerequisites that do not exist in the catalog", () => {
    expect(
      validateCatalog([activity("activity-a", ["missing-activity"])]),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          keyword: "graph",
          message: expect.stringContaining("unknown prerequisite"),
        }),
      ]),
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
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "privacy" }),
      ]),
    });
  });
});

describe("[T-CONTENT-005] Stage 3 learning-loop content", () => {
  const completeActivity = {
    schemaVersion: 1,
    id: "learning-loop",
    version: 1,
    kind: "exercise",
    title: "Learning loop",
    estimatedMinutes: 20,
    conceptIds: ["learning-loop-concept"],
    prerequisiteIds: [],
    objectives: ["Explain the learning loop."],
    victoryConditions: ["The program passes the declared Judge contract."],
    sources: [
      {
        kind: "primary",
        title: "C++ language reference",
        url: "https://en.cppreference.com/w/cpp/language",
      },
      {
        kind: "reference",
        title: "C++ Core Guidelines",
        url: "https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines",
      },
    ],
    content: { format: "markdown", path: "activities/learning-loop/lesson.md" },
    workspace: {
      editablePaths: ["main.cpp"],
      starterFiles: { "main.cpp": "int main() {}\n" },
    },
    judge: { version: 1, expectedStdout: "", timeoutMs: 1_000 },
    evidencePolicy: {
      automatedPass: true,
      demonstratedRequiresReflection: true,
      demonstratedRequiresIndependent: true,
      reviewAfterDays: 1,
    },
    quality: {
      referenceFiles: { "main.cpp": "int main() { return 0; }\n" },
      mutations: [
        {
          id: "compile-error",
          files: { "main.cpp": "int main( {\n" },
          expectedVerdict: "compile_error",
        },
      ],
      interactiveBlocks: [
        {
          id: "build-pipeline",
          type: "algorithm-trace",
          fallback: "source -> compile -> link -> execute",
        },
      ],
      printFallback: "Read the build pipeline from left to right.",
    },
    learning: {
      hints: [
        { id: "nudge", title: "Nudge", kind: "nudge", content: "Read main." },
        {
          id: "concept",
          title: "Concept",
          kind: "concept",
          content: "Compilation happens first.",
        },
        {
          id: "solution",
          title: "Solution",
          kind: "solution",
          content: "int main() { return 0; }",
        },
      ],
      reflections: [
        {
          id: "explain",
          prompt: "Explain compile versus run.",
          required: true,
        },
      ],
      reviewIds: ["learning-loop-review"],
      teacherRubric: {
        id: "explanation-v1",
        prompt:
          "Check that the explanation distinguishes compiler and process.",
      },
    },
  } as const;

  it("accepts ordered hints, reflection, evidence policy, and a linked Review variant", () => {
    const review = {
      ...completeActivity,
      id: "learning-loop-review",
      kind: "review",
      prerequisiteIds: ["learning-loop"],
      learning: {
        ...completeActivity.learning,
        reviewIds: [],
        reviewOf: "learning-loop",
      },
    } as const;

    expect(validateCatalog([completeActivity, review])).toEqual({
      ok: true,
      activityCount: 2,
    });
  });

  it("rejects insufficient hints and a missing Review link", () => {
    const invalidHints = validateCatalog([
      {
        ...completeActivity,
        learning: {
          ...completeActivity.learning,
          hints: [completeActivity.learning.hints[0]],
          reviewIds: [],
        },
      },
    ]);
    expect(invalidHints).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({ path: expect.stringContaining("hints") }),
      ],
    });

    expect(
      validateCatalog([
        {
          ...completeActivity,
          learning: {
            ...completeActivity.learning,
            reviewIds: ["missing-review"],
          },
        },
      ]),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ keyword: "graph" })],
    });
  });

  it("rejects Activities without source diversity, reference files, or mutation fixtures", () => {
    const review = {
      ...completeActivity,
      id: "learning-loop-review",
      kind: "review",
      prerequisiteIds: ["learning-loop"],
      learning: {
        ...completeActivity.learning,
        reviewIds: [],
        reviewOf: "learning-loop",
      },
    } as const;
    const result = validateCatalog([
      {
        ...completeActivity,
        sources: [
          completeActivity.sources[0],
          { ...completeActivity.sources[0], title: "Another primary source" },
        ],
        quality: {
          ...completeActivity.quality,
          referenceFiles: { "other.cpp": "int main() {}\n" },
          mutations: [
            completeActivity.quality.mutations[0],
            completeActivity.quality.mutations[0],
          ],
        },
      },
      review,
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "sources" }),
        expect.objectContaining({ keyword: "reference" }),
        expect.objectContaining({ keyword: "mutation" }),
      ]),
    });
  });

  it("rejects a graded hint that copies a reference-solution fragment", () => {
    const result = validateCatalog([
      {
        ...completeActivity,
        learning: {
          ...completeActivity.learning,
          hints: [
            {
              ...completeActivity.learning.hints[0],
              content: "int main() { return 0; }",
            },
            completeActivity.learning.hints[1],
            completeActivity.learning.hints[2],
          ],
        },
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "hint-leak" }),
      ]),
    });
  });

  it("rejects any Hint that exposes private Judge input or output", () => {
    const result = validateCatalog([
      {
        ...completeActivity,
        judge: {
          ...completeActivity.judge,
          privateTests: [
            {
              name: "hidden case",
              stdin: "private-seed-9281\n",
              expectedStdout: "private-result-4107\n",
              failureCategory: "hidden behavior differs",
            },
          ],
        },
        learning: {
          ...completeActivity.learning,
          hints: [
            completeActivity.learning.hints[0],
            completeActivity.learning.hints[1],
            {
              ...completeActivity.learning.hints[2],
              content: "Try the hidden input private-seed-9281 to verify it.",
            },
          ],
        },
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "hint-private-leak" }),
      ]),
    });
  });
});

describe("[T-CONTENT-006] Stage 4 initial Modern C++ release", () => {
  it("publishes 10 Lessons, 15 Exercises/Reviews, and one two-Milestone Project", async () => {
    const curriculum = createFilesystemCurriculum({
      catalogPath: resolve("curriculum", "catalog.json"),
    });

    const activities = await curriculum.listActivities();
    expect(
      activities.filter((activity) => activity.kind === "lesson"),
    ).toHaveLength(10);
    expect(
      activities.filter(
        (activity) =>
          activity.kind === "exercise" || activity.kind === "review",
      ),
    ).toHaveLength(15);
    expect(
      activities.filter((activity) => activity.kind === "project-milestone"),
    ).toHaveLength(2);
    expect(JSON.stringify(activities)).not.toContain("referenceFiles");
  });
});
