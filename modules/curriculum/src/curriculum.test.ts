import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
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

  it("validates optional stable Reference identifiers", () => {
    const candidate = activity("reference-links", []);
    const result = validateCatalog([
      { ...candidate, referenceIds: ["std-vector", "Bad Reference"] },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/referenceIds/1" }),
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

  it("rejects CMake target names that can be interpreted as command options", () => {
    const candidate = activity("unsafe-cmake-target", []);
    const result = validateCatalog([
      {
        ...candidate,
        judge: {
          ...candidate.judge,
          buildProfile: {
            kind: "cmake",
            target: "--parallel",
            testTarget: "tests",
            ctest: true,
          },
        },
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("buildProfile/target"),
          keyword: "pattern",
        }),
      ]),
    });
  });

  it("requires coherent Project metadata for every Project Milestone", () => {
    const missingMetadata = activity("project-milestone", []);
    const missingResult = validateCatalog([
      {
        ...missingMetadata,
        kind: "project-milestone",
        workspace: {
          ...missingMetadata.workspace,
          persistenceId: "portfolio-project",
        },
      },
    ]);
    expect(missingResult).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "project-metadata" }),
      ]),
    });

    const mismatchedResult = validateCatalog([
      {
        ...missingMetadata,
        kind: "project-milestone",
        workspace: {
          ...missingMetadata.workspace,
          persistenceId: "portfolio-project",
        },
        project: {
          id: "different-project",
          title: "Portfolio Project",
          milestone: 1,
          milestoneCount: 1,
          portfolioOutcome: "A reproducible project artifact.",
        },
      },
    ]);
    expect(mismatchedResult).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "project-metadata" }),
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
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "graph" }),
      ]),
    });
  });

  it("rejects a Review link that cannot rehearse any source Concept", () => {
    const unrelatedReview = {
      ...completeActivity,
      id: "unrelated-review",
      kind: "review",
      conceptIds: ["unrelated-concept"],
      prerequisiteIds: ["learning-loop"],
      learning: {
        ...completeActivity.learning,
        reviewIds: [],
        reviewOf: "learning-loop",
      },
    } as const;

    expect(
      validateCatalog([
        {
          ...completeActivity,
          learning: {
            ...completeActivity.learning,
            reviewIds: ["unrelated-review"],
          },
        },
        unrelatedReview,
      ]),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ keyword: "review-coverage" }),
      ]),
    });
  });

  it("rejects Review links that leave any source Concept uncovered", () => {
    const partialReview = {
      ...completeActivity,
      id: "partial-review",
      kind: "review",
      prerequisiteIds: ["learning-loop"],
      learning: {
        ...completeActivity.learning,
        reviewIds: [],
        reviewOf: "learning-loop",
      },
    } as const;

    expect(
      validateCatalog([
        {
          ...completeActivity,
          conceptIds: ["learning-loop-concept", "uncovered-concept"],
          learning: {
            ...completeActivity.learning,
            reviewIds: ["partial-review"],
          },
        },
        partialReview,
      ]),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          keyword: "review-coverage",
          message: expect.stringContaining("uncovered-concept"),
        }),
      ]),
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

  it("rejects any Hint that exposes a performance-check expected output", () => {
    const result = validateCatalog([
      {
        ...completeActivity,
        judge: {
          ...completeActivity.judge,
          performanceCheck: {
            name: "growth",
            baselineStdin: "1000\n",
            baselineExpectedStdout: "private-baseline-result\n",
            scaledStdin: "2000\n",
            scaledExpectedStdout: "private-scaled-result\n",
            repetitions: 3,
            maxMedianRatio: 3,
            failureCategory: "growth boundary",
          },
        },
        learning: {
          ...completeActivity.learning,
          hints: [
            completeActivity.learning.hints[0],
            completeActivity.learning.hints[1],
            {
              ...completeActivity.learning.hints[2],
              content: "The scaled result is private-scaled-result.",
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
  it("keeps the initial 10 Lessons, 15 Exercises/Reviews, and two Project Milestones available", async () => {
    const curriculum = createFilesystemCurriculum({
      catalogPath: resolve("curriculum", "catalog.json"),
      privateJudgePath: resolve("judge-private", "tests.json"),
    });

    const activities = await curriculum.listActivities();
    expect(
      activities.filter((activity) => activity.kind === "lesson").length,
    ).toBeGreaterThanOrEqual(10);
    expect(
      activities.filter(
        (activity) =>
          activity.kind === "exercise" || activity.kind === "review",
      ).length,
    ).toBeGreaterThanOrEqual(15);
    expect(
      activities.filter((activity) => activity.kind === "project-milestone")
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(activities)).not.toContain("referenceFiles");
  });
});

describe("[T-CONTENT-007] Stage 5 algorithms and systems release", () => {
  it("keeps generated, performance, CMake, and Project persistence details behind Curriculum interfaces", async () => {
    const curriculum = createFilesystemCurriculum({
      catalogPath: resolve("curriculum", "catalog.json"),
      privateJudgePath: resolve("judge-private", "tests.json"),
    });

    await expect(
      curriculum.getJudge("deterministic-sort-properties"),
    ).resolves.toMatchObject({
      propertyTests: [{ seed: 20_260_823, cases: 16 }],
    });
    await expect(
      curriculum.getJudge("complexity-growth-check"),
    ).resolves.toMatchObject({
      performanceCheck: {
        repetitions: 3,
        maxMedianRatio: 3.2,
        baselineExpectedStdout: "31996000\n",
        scaledExpectedStdout: "127992000\n",
      },
    });
    await expect(
      curriculum.getJudge("cli-data-manager-m3"),
    ).resolves.toMatchObject({
      buildProfile: {
        kind: "cmake",
        target: "cli-data-manager",
        testTarget: "record_store_tests",
        ctest: true,
      },
    });

    const projectWorkspaces = (
      await curriculum.listWorkspaceActivities()
    ).filter(({ activityId }) => activityId.startsWith("cli-data-manager-m"));
    expect(projectWorkspaces).toHaveLength(3);
    expect(
      projectWorkspaces.every(
        ({ persistenceId }) => persistenceId === "cli-data-manager",
      ),
    ).toBe(true);
    const activities = await curriculum.listActivities();
    expect(activities.length).toBeGreaterThanOrEqual(42);
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "hash-index-invariants" }),
        expect.objectContaining({ id: "hash-index-invariants-review" }),
        expect.objectContaining({ id: "complexity-growth-review" }),
        expect.objectContaining({ id: "cmake-ctest-review" }),
      ]),
    );
    const publicActivities = JSON.stringify(activities);
    expect(publicActivities).not.toContain("propertyTests");
    expect(publicActivities).not.toContain("performanceCheck");
    expect(publicActivities).not.toContain("buildProfile");
  });
});

describe("[T-CONTENT-008] Stage 6 career-track release", () => {
  it("keeps private Judge values outside public Activity manifests", async () => {
    const catalogPath = resolve("curriculum", "catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as {
      readonly activityManifests: readonly string[];
    };
    const manifests = await Promise.all(
      catalog.activityManifests.map((path) =>
        readFile(resolve("curriculum", path), "utf8"),
      ),
    );
    expect(manifests.join("\n")).not.toContain('"privateTests"');

    const privateRegistry = await readFile(
      resolve("judge-private", "tests.json"),
      "utf8",
    );
    expect(privateRegistry).toContain('"source-to-program"');
    const curriculum = createFilesystemCurriculum({
      catalogPath,
      privateJudgePath: resolve("judge-private", "tests.json"),
    });
    await expect(curriculum.getJudge("source-to-program")).resolves.toEqual(
      expect.objectContaining({
        privateTests: [expect.objectContaining({ name: "stable execution" })],
      }),
    );
  });

  it("publishes five coherent Projects and the complete career curriculum", async () => {
    const curriculum = createFilesystemCurriculum({
      catalogPath: resolve("curriculum", "catalog.json"),
      privateJudgePath: resolve("judge-private", "tests.json"),
    });

    const activities = await curriculum.listActivities();
    expect(activities).toHaveLength(70);
    const milestones = activities.filter(
      (activity) => activity.kind === "project-milestone",
    );
    const projectIds = new Set(
      milestones.map((activity) => activity.project?.id),
    );
    expect(projectIds).toEqual(
      new Set([
        "cli-data-manager",
        "local-log-index",
        "cpp-http-service",
        "concurrent-task-queue",
        "web-service-contract",
      ]),
    );
    expect(milestones).toHaveLength(11);
    for (const activityId of [
      "cli-data-manager-m3",
      "local-log-index-m2",
      "cpp-http-service-m2",
      "concurrent-task-queue-m2",
      "web-service-contract-m2",
    ]) {
      expect(
        (await curriculum.getJudge(activityId))?.performanceCheck,
      ).toBeDefined();
    }
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "network-service-design" }),
        expect.objectContaining({ id: "persistence-query-plans" }),
        expect.objectContaining({ id: "concurrent-task-queues" }),
        expect.objectContaining({ id: "production-readiness" }),
        expect.objectContaining({ id: "modern-vocabulary" }),
        expect.objectContaining({ id: "engineering-diagnostics" }),
        expect.objectContaining({ id: "virtual-memory-tools" }),
        expect.objectContaining({ id: "udp-event-loops" }),
        expect.objectContaining({ id: "cache-persistence" }),
        expect.objectContaining({ id: "memory-model-deadlocks" }),
      ]),
    );
  });

  it("ships executable engineering/Web evidence and substantive final disclosures", async () => {
    const catalog = JSON.parse(
      await readFile(resolve("curriculum", "catalog.json"), "utf8"),
    ) as { readonly activityManifests: readonly string[] };
    const documents = await Promise.all(
      catalog.activityManifests.map(async (manifestPath) =>
        JSON.parse(await readFile(resolve("curriculum", manifestPath), "utf8")),
      ),
    );
    const byId = new Map(
      documents.map((document) => [document.id as string, document]),
    );
    const requiredPairs = [
      "modern-vocabulary",
      "modern-vocabulary-review",
      "engineering-diagnostics",
      "engineering-diagnostics-review",
      "virtual-memory-tools",
      "virtual-memory-tools-review",
      "udp-event-loops",
      "udp-event-loops-review",
      "cache-persistence",
      "cache-persistence-review",
      "memory-model-deadlocks",
      "memory-model-deadlocks-review",
    ];
    for (const activityId of requiredPairs) {
      const solution = byId
        .get(activityId)
        ?.learning.hints.find(
          (hint: { readonly kind: string }) => hint.kind === "solution",
        );
      expect(solution?.content.length, activityId).toBeGreaterThan(180);
      expect(solution?.content, activityId).not.toContain(
        "使用课程指定的标准接口实现最小闭环",
      );
    }

    const diagnostics = byId.get("engineering-diagnostics");
    expect(diagnostics?.workspace.starterFiles["CMakeLists.txt"]).toContain(
      "-Werror",
    );
    expect(diagnostics?.workspace.starterFiles["git_bisect.cmake"]).toContain(
      "bisect run",
    );
    expect(
      byId.get("engineering-diagnostics-review")?.workspace.starterFiles[
        "REVIEW.md"
      ],
    ).toContain("TODO");

    const webFinal = byId.get("web-service-contract-m2");
    expect(webFinal?.workspace.starterFiles).toEqual(
      expect.objectContaining({
        "package.json": expect.stringContaining('"vite build"'),
        "tsconfig.json": expect.stringContaining('"react-jsx"'),
        "component.test.tsx": expect.stringContaining("renderToStaticMarkup"),
      }),
    );
    expect(webFinal?.judge.buildProfile.runtimeTools).toEqual([
      "node",
      "web-frontend",
    ]);
  });
});
