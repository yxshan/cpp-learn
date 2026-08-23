import { describe, expect, it } from "vitest";

import type {
  ActivityDetail,
  AttemptCompletedEvent,
  JudgeReport,
  LearningRecordEvent,
} from "@cpp-learn/contracts";

import {
  createLearningPlatform,
  type LearningPlatformDependencies,
} from "./index.js";

const activity: ActivityDetail = {
  id: "learning-loop",
  version: 1,
  kind: "exercise",
  title: "Learning loop",
  estimatedMinutes: 20,
  conceptIds: ["compile-link-run"],
  markdown: "# Learning loop\n",
  workspace: { editablePaths: ["main.cpp"] },
  learning: {
    hints: [
      { id: "nudge", title: "Nudge", kind: "nudge" },
      { id: "solution", title: "Solution", kind: "solution" },
    ],
    reflections: [
      { id: "explain", prompt: "Explain compile versus run.", required: true },
    ],
    reviewIds: ["learning-loop-review"],
  },
};

const reviewActivity: ActivityDetail = {
  ...activity,
  id: "learning-loop-review",
  kind: "review",
  title: "Learning loop review",
  learning: {
    ...activity.learning!,
    reviewIds: [],
    reviewOf: activity.id,
  },
};

function passingReport(
  jobId: string,
  selectedActivity: ActivityDetail = activity,
): JudgeReport {
  return {
    schemaVersion: 1,
    reportId: `report_${jobId}`,
    jobId,
    mode: "grade",
    activity: { id: selectedActivity.id, version: 1, judgeVersion: 1 },
    source: { snapshotId: "snap_1", digest: "digest" },
    toolchain: { compiler: "clang", standard: "c++20" },
    verdict: "automated_pass",
    stages: [
      { kind: "compile", outcome: "pass", durationMs: 1 },
      { kind: "public_test", outcome: "pass", durationMs: 1 },
      { kind: "private_test", outcome: "pass", durationMs: 1 },
    ],
    startedAt: "2026-08-23T08:00:00.000Z",
    completedAt: "2026-08-23T08:00:00.003Z",
  };
}

function platformFixture(
  now = "2026-08-23T08:00:00.000Z",
  teacherReviewRequired = false,
  forcedVerdict: JudgeReport["verdict"] = "automated_pass",
  verificationStageKind: "private_test" | "property_test" = "private_test",
) {
  const events: LearningRecordEvent[] = [];
  const batches: (readonly LearningRecordEvent[])[] = [];
  const attempts = (): AttemptCompletedEvent[] =>
    events.filter(
      (event): event is AttemptCompletedEvent =>
        event.type === "attempt.completed",
    );
  const dependencies: LearningPlatformDependencies = {
    clock: () => new Date(now),
    probes: {
      curriculum: async () => ({ ready: true, activityCount: 2 }),
      toolchain: async () => ({ ready: true, compiler: "clang" }),
      record: async () => ({ ready: true }),
    },
    curriculum: {
      getActivity: async (activityId) =>
        activityId === activity.id
          ? activity
          : activityId === reviewActivity.id
            ? reviewActivity
            : undefined,
      getJudge: async (activityId) => ({
        activityId,
        activityVersion: 1,
        judgeVersion: 1,
        expectedStdout: "",
        timeoutMs: 1_000,
        privateTests: [
          {
            name: "private",
            stdin: "",
            expectedStdout: "",
            failureCategory: "behavior",
          },
        ],
      }),
      getLearning: async (activityId) => ({
        hints: [
          {
            id: "nudge",
            title: "Nudge",
            kind: "nudge",
            content: "Think about compilation first.",
          },
          {
            id: "solution",
            title: "Solution",
            kind: "solution",
            content: "REFERENCE_SOLUTION_DO_NOT_EXPORT",
          },
        ],
        reflections: activity.learning?.reflections ?? [],
        reviewIds: activityId === reviewActivity.id ? [] : [reviewActivity.id],
        ...(activityId === reviewActivity.id ? { reviewOf: activity.id } : {}),
        evidencePolicy: {
          automatedPass: true,
          demonstratedRequiresReflection: true,
          demonstratedRequiresIndependent: true,
          reviewAfterDays: 1,
          teacherReviewRequired,
        },
        teacherRubric: { id: "explanation-v1", prompt: "Check explanation." },
        starterFiles: { "main.cpp": "int main() {}\n" },
      }),
    },
    workspace: {
      open: async () => ({
        activityId: activity.id,
        revision: 1,
        files: { "main.cpp": "int main() { return 0; }\n" },
      }),
      save: async () => ({ ok: true, revision: 2 }),
      snapshot: async () => ({
        id: "snap_1",
        activityId: activity.id,
        digest: "digest",
      }),
      readSnapshot: async () => ({
        id: "snap_1",
        activityId: activity.id,
        digest: "digest",
        files: { "main.cpp": "int main() { return 0; }\n" },
      }),
    },
    judge: {
      execute: async ({ jobId, activity: selectedActivity }) => ({
        ...passingReport(jobId, selectedActivity),
        verdict: forcedVerdict,
        stages: [
          { kind: "compile", outcome: "pass", durationMs: 1 },
          { kind: "public_test", outcome: "pass", durationMs: 1 },
          { kind: verificationStageKind, outcome: "pass", durationMs: 1 },
        ],
      }),
    },
    record: {
      append: async (event) => {
        events.push(event);
      },
      appendEvent: async (event) => {
        events.push(event);
      },
      appendBatch: async (batch) => {
        batches.push([...batch]);
        events.push(...batch);
      },
      list: async () => attempts(),
      events: async () => events,
    },
  };
  return {
    platform: createLearningPlatform(dependencies),
    dependencies,
    events,
    batches,
  };
}

describe("[T-LEARN-004] ordered assistance", () => {
  it("records a hint before returning its content and requires confirmation for a full solution", async () => {
    const { platform, events } = platformFixture();

    await expect(
      platform.dispatch({
        type: "hint.reveal",
        commandId: "cmd_hint_2",
        attemptId: "attempt_1",
        activityId: activity.id,
        hintId: "solution",
        confirmFullSolution: false,
      }),
    ).rejects.toThrow("explicit confirmation");
    await expect(
      platform.dispatch({
        type: "hint.reveal",
        commandId: "cmd_hint_1",
        attemptId: "attempt_1",
        activityId: activity.id,
        hintId: "nudge",
        confirmFullSolution: false,
      }),
    ).resolves.toMatchObject({
      hint: { id: "nudge", content: "Think about compilation first." },
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: "hint.revealed",
        hintId: "nudge",
        order: 1,
        fullSolutionExposed: false,
      }),
    ]);
    await expect(
      platform.dispatch({
        type: "hint.reveal",
        commandId: "cmd_hint_duplicate",
        attemptId: "attempt_1",
        activityId: activity.id,
        hintId: "nudge",
        confirmFullSolution: false,
      }),
    ).rejects.toThrow("in order");
  });

  it("replays persisted hint and reflection commands after Platform recreation", async () => {
    const { platform, dependencies, events } = platformFixture();
    const hint = {
      type: "hint.reveal" as const,
      commandId: "cmd_persisted_hint",
      attemptId: "attempt_persisted",
      activityId: activity.id,
      hintId: "nudge",
      confirmFullSolution: false,
    };
    const reflection = {
      type: "reflection.submit" as const,
      commandId: "cmd_persisted_reflection",
      attemptId: "attempt_persisted",
      activityId: activity.id,
      answers: [{ promptId: "explain", answer: "Compile, then run." }],
    };
    await platform.dispatch(hint);
    await platform.dispatch(reflection);

    const restarted = createLearningPlatform(dependencies);
    await expect(restarted.dispatch(hint)).resolves.toMatchObject({
      hint: { id: "nudge" },
    });
    await expect(restarted.dispatch(reflection)).resolves.toMatchObject({
      accepted: true,
    });
    expect(events).toHaveLength(2);
  });

  it("rejects reuse of an attempt identifier across Activities", async () => {
    const { platform } = platformFixture();
    await platform.dispatch({
      type: "hint.reveal",
      commandId: "cmd_scoped_hint",
      attemptId: "attempt_scoped",
      activityId: activity.id,
      hintId: "nudge",
      confirmFullSolution: false,
    });

    await expect(
      platform.dispatch({
        type: "reflection.submit",
        commandId: "cmd_cross_activity_reflection",
        attemptId: "attempt_scoped",
        activityId: reviewActivity.id,
        answers: [{ promptId: "explain", answer: "Should be isolated." }],
      }),
    ).rejects.toThrow("different Activity");
  });
});

describe("[T-LEARN-003] explainable Concept transitions", () => {
  it("uses an independent reflection and private Grade to demonstrate, then schedules Review", async () => {
    const { platform, events, batches } = platformFixture();
    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_reflection_1",
      attemptId: "attempt_1",
      activityId: activity.id,
      answers: [
        {
          promptId: "explain",
          answer: "Compilation creates a program; running starts its process.",
        },
      ],
    });
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_grade_1",
      attemptId: "attempt_1",
      activityId: activity.id,
    });

    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [
        {
          conceptId: "compile-link-run",
          state: "demonstrated",
          explanation: expect.stringContaining("independent"),
          supportingEvidenceIds: ["evidence_cmd_grade_1_compile-link-run"],
        },
      ],
    });
    await expect(
      platform.query({ type: "reviews.get", dueOnly: false }),
    ).resolves.toMatchObject({
      reviews: [
        {
          activityId: "learning-loop-review",
          conceptId: "compile-link-run",
          dueAt: "2026-08-24T08:00:00.000Z",
          status: "scheduled",
        },
      ],
    });
    expect(events.map((event) => event.type)).toEqual([
      "reflection.submitted",
      "attempt.completed",
      "evidence.recorded",
      "concept.state.changed",
      "review.scheduled",
    ]);
    expect(batches.at(-1)?.map((event) => event.type)).toEqual([
      "attempt.completed",
      "evidence.recorded",
      "concept.state.changed",
      "review.scheduled",
    ]);
  });

  it("[T-LEARN-009] accepts generated-property evidence as strong independent verification", async () => {
    const { platform } = platformFixture(
      "2026-08-23T08:00:00.000Z",
      false,
      "automated_pass",
      "property_test",
    );
    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_property_reflection",
      attemptId: "attempt_property",
      activityId: activity.id,
      answers: [
        {
          promptId: "explain",
          answer: "The generated cases exercise an invariant beyond examples.",
        },
      ],
    });
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_property_grade",
      attemptId: "attempt_property",
      activityId: activity.id,
    });

    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [
        {
          conceptId: "compile-link-run",
          state: "demonstrated",
          supportingEvidenceIds: [
            "evidence_cmd_property_grade_compile-link-run",
          ],
        },
      ],
    });
  });

  it("schedules each Concept only into a Review that declares coverage for it", async () => {
    const { platform, dependencies } = platformFixture();
    const sourceWithTwoConcepts: ActivityDetail = {
      ...activity,
      conceptIds: ["compile-link-run", "second-concept"],
      learning: {
        ...activity.learning!,
        reviewIds: ["learning-loop-review", "second-review"],
      },
    };
    const secondReview: ActivityDetail = {
      ...reviewActivity,
      id: "second-review",
      conceptIds: ["second-concept"],
      learning: {
        ...reviewActivity.learning!,
        reviewOf: activity.id,
      },
    };
    const originalLearning = dependencies.curriculum.getLearning!;
    Object.assign(dependencies.curriculum, {
      getActivity: async (activityId: string) =>
        activityId === activity.id
          ? sourceWithTwoConcepts
          : activityId === reviewActivity.id
            ? reviewActivity
            : activityId === secondReview.id
              ? secondReview
              : undefined,
      getLearning: async (activityId: string) => {
        const learning = await originalLearning(activityId);
        return activityId === activity.id && learning
          ? {
              ...learning,
              reviewIds: [reviewActivity.id, secondReview.id],
            }
          : learning;
      },
    });

    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_mapped_review_reflection",
      attemptId: "attempt_mapped_review",
      activityId: activity.id,
      answers: [{ promptId: "explain", answer: "Map evidence by Concept." }],
    });
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_mapped_review_grade",
      attemptId: "attempt_mapped_review",
      activityId: activity.id,
    });

    const result = await platform.query({
      type: "reviews.get",
      dueOnly: false,
    });
    expect(result.reviews).toEqual([
      expect.objectContaining({
        activityId: "learning-loop-review",
        conceptId: "compile-link-run",
      }),
      expect.objectContaining({
        activityId: "second-review",
        conceptId: "second-concept",
      }),
    ]);

    await platform.dispatch({
      type: "hint.reveal",
      commandId: "cmd_mapped_hint",
      attemptId: "attempt_mapped_solution",
      activityId: activity.id,
      hintId: "nudge",
      confirmFullSolution: false,
    });
    await platform.dispatch({
      type: "hint.reveal",
      commandId: "cmd_mapped_solution",
      attemptId: "attempt_mapped_solution",
      activityId: activity.id,
      hintId: "solution",
      confirmFullSolution: true,
    });
    const afterSolution = await platform.query({
      type: "reviews.get",
      dueOnly: false,
    });
    expect(afterSolution.reviews).toEqual([
      expect.objectContaining({
        activityId: "learning-loop-review",
        conceptId: "compile-link-run",
      }),
      expect.objectContaining({
        activityId: "second-review",
        conceptId: "second-concept",
      }),
    ]);
  });

  it("[T-LEARN-007] caps a solution-exposed passing attempt at practiced and schedules a compensating Review", async () => {
    const { platform, batches } = platformFixture();
    await platform.dispatch({
      type: "hint.reveal",
      commandId: "cmd_hint_1",
      attemptId: "attempt_solution",
      activityId: activity.id,
      hintId: "nudge",
      confirmFullSolution: false,
    });
    await platform.dispatch({
      type: "hint.reveal",
      commandId: "cmd_hint_2",
      attemptId: "attempt_solution",
      activityId: activity.id,
      hintId: "solution",
      confirmFullSolution: true,
    });
    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_reflection_2",
      attemptId: "attempt_solution",
      activityId: activity.id,
      answers: [
        { promptId: "explain", answer: "Compiler first, process second." },
      ],
    });
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_grade_solution",
      attemptId: "attempt_solution",
      activityId: activity.id,
    });

    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [expect.objectContaining({ state: "practiced" })],
    });
    await expect(
      platform.query({ type: "attempt.get", attemptId: "attempt_solution" }),
    ).resolves.toMatchObject({
      attempt: {
        attemptId: "attempt_solution",
        independence: "solution_exposed",
        hints: [
          expect.objectContaining({ hintId: "nudge" }),
          expect.objectContaining({ hintId: "solution" }),
        ],
        reflections: [
          expect.objectContaining({ commandId: "cmd_reflection_2" }),
        ],
        evidence: [expect.objectContaining({ outcome: "pass" })],
      },
    });
    await expect(
      platform.query({ type: "reviews.get", dueOnly: false }),
    ).resolves.toMatchObject({
      reviews: [
        expect.objectContaining({
          activityId: reviewActivity.id,
          reason: expect.stringContaining("Full-solution exposure"),
        }),
      ],
    });
    expect(
      batches.some(
        (batch) =>
          batch.some((event) => event.type === "hint.revealed") &&
          batch.some((event) => event.type === "review.scheduled"),
      ),
    ).toBe(true);
  });
});

describe("[T-LEARN-008] delayed Review retention", () => {
  it("promotes demonstrated to retained only through an independent due Review variant", async () => {
    const { platform, events } = platformFixture("2026-08-25T08:00:00.000Z");
    events.push(
      {
        schemaVersion: 1,
        eventId: "evt_prior_state",
        type: "concept.state.changed",
        occurredAt: "2026-08-23T08:00:00.000Z",
        conceptId: "compile-link-run",
        previousState: "practiced",
        nextState: "demonstrated",
        evidenceIds: ["evidence_prior"],
        explanation: "Prior independent demonstration.",
      },
      {
        schemaVersion: 1,
        eventId: "evt_prior_review",
        type: "review.scheduled",
        occurredAt: "2026-08-23T08:00:00.000Z",
        reviewId: reviewActivity.id,
        conceptId: "compile-link-run",
        sourceActivityId: activity.id,
        dueAt: "2026-08-24T08:00:00.000Z",
        intervalDays: 1,
        reason: "Delayed retention check.",
      },
    );
    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_review_reflection",
      attemptId: "attempt_review",
      activityId: reviewActivity.id,
      answers: [
        { promptId: "explain", answer: "Recall in a different context." },
      ],
    });
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_review_grade",
      attemptId: "attempt_review",
      activityId: reviewActivity.id,
    });

    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [expect.objectContaining({ state: "retained" })],
    });
    await expect(
      platform.query({ type: "reviews.get", dueOnly: false }),
    ).resolves.toEqual({ schemaVersion: 1, reviews: [] });
  });

  it("keeps prior mastery and shortens the interval after a failed Review", async () => {
    const { platform, events } = platformFixture(
      "2026-08-25T08:00:00.000Z",
      false,
      "public_failure",
    );
    events.push(
      {
        schemaVersion: 1,
        eventId: "evt_prior_state_failed_review",
        type: "concept.state.changed",
        occurredAt: "2026-08-20T08:00:00.000Z",
        conceptId: "compile-link-run",
        previousState: "practiced",
        nextState: "demonstrated",
        evidenceIds: ["evidence_prior"],
        explanation: "Prior demonstration stays valid.",
      },
      {
        schemaVersion: 1,
        eventId: "evt_prior_schedule_failed_review",
        type: "review.scheduled",
        occurredAt: "2026-08-20T08:00:00.000Z",
        reviewId: reviewActivity.id,
        conceptId: "compile-link-run",
        sourceActivityId: activity.id,
        dueAt: "2026-08-24T08:00:00.000Z",
        intervalDays: 4,
        reason: "Initial interval.",
      },
    );
    await platform.dispatch({
      type: "activity.grade",
      commandId: "cmd_failed_review",
      attemptId: "attempt_failed_review",
      activityId: reviewActivity.id,
    });

    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [expect.objectContaining({ state: "demonstrated" })],
    });
    await expect(
      platform.query({ type: "reviews.get", dueOnly: false }),
    ).resolves.toMatchObject({
      reviews: [
        expect.objectContaining({
          intervalDays: 2,
          dueAt: "2026-08-27T08:00:00.000Z",
        }),
      ],
    });
  });
});

describe("[T-TEACH-001/T-TEACH-002] Teacher Pack boundary", () => {
  it("contains approved learner context while excluding private stages and solution hints", async () => {
    const { platform, events } = platformFixture();
    const report = passingReport("job_prior");
    events.push({
      schemaVersion: 1,
      eventId: "evt_prior_attempt",
      type: "attempt.completed",
      occurredAt: "2026-08-23T08:00:00.003Z",
      commandId: "cmd_prior",
      attemptId: "attempt_prior",
      activityId: activity.id,
      conceptIds: activity.conceptIds,
      mode: "grade",
      report: {
        ...report,
        stages: [
          ...report.stages,
          {
            kind: "private_test",
            outcome: "fail",
            durationMs: 1,
            stderr: "secret-private-input",
            feedback: "secret-private-expected",
          },
        ],
      },
    });

    const result = await platform.dispatch({
      type: "teacher-pack.create",
      commandId: "cmd_teacher_pack",
      activityId: activity.id,
    });
    const serialized = JSON.stringify(result);
    expect(result).toMatchObject({
      pack: {
        activity: { id: activity.id, title: activity.title },
        learnerDiff: [expect.objectContaining({ path: "main.cpp" })],
        recentAttempts: [
          expect.objectContaining({ attemptId: "attempt_prior" }),
        ],
      },
    });
    expect(serialized).not.toContain("secret-private");
    expect(serialized).not.toContain("REFERENCE_SOLUTION_DO_NOT_EXPORT");
    expect(serialized).not.toContain("Solution");
  });
});

describe("[T-TEACH-003] Teacher Observation policy", () => {
  it("validates the applicable rubric and never lets an observation write Concept state directly", async () => {
    const { platform, events } = platformFixture();
    events.push({
      schemaVersion: 1,
      eventId: "evt_attempt_for_teacher",
      type: "attempt.completed",
      occurredAt: "2026-08-23T08:00:00.003Z",
      commandId: "cmd_attempt_for_teacher",
      attemptId: "attempt_for_teacher",
      activityId: activity.id,
      conceptIds: activity.conceptIds,
      mode: "grade",
      independence: "independent",
      report: passingReport("job_teacher"),
    });

    await expect(
      platform.dispatch({
        type: "teacher-observation.submit",
        commandId: "cmd_bad_observation",
        observationId: "observation_bad",
        attemptId: "attempt_for_teacher",
        activityId: activity.id,
        rubricId: "invented-rubric",
        outcome: "pass",
        summary: "Looks good.",
      }),
    ).resolves.toMatchObject({ accepted: false });
    await expect(
      platform.dispatch({
        type: "teacher-observation.submit",
        commandId: "cmd_good_observation",
        observationId: "observation_good",
        attemptId: "attempt_for_teacher",
        activityId: activity.id,
        rubricId: "explanation-v1",
        outcome: "pass",
        summary:
          "The explanation distinguishes compilation from process execution.",
      }),
    ).resolves.toMatchObject({ accepted: true });

    expect(events.slice(-2).map((event) => event.type)).toEqual([
      "teacher.observation.rejected",
      "teacher.observation.accepted",
    ]);
    await expect(platform.query({ type: "progress.get" })).resolves.toEqual({
      schemaVersion: 1,
      concepts: [
        {
          conceptId: "compile-link-run",
          state: "practiced",
          explanation: "A passing Grade supplied automated practice evidence.",
          supportingEvidenceIds: ["evt_attempt_for_teacher"],
        },
      ],
    });
  });

  it("[T-TEACH-004] keeps an open-ended pass pending until an applicable observation joins the Evidence chain", async () => {
    const { platform } = platformFixture("2026-08-23T08:00:00.000Z", true);
    await platform.dispatch({
      type: "reflection.submit",
      commandId: "cmd_open_reflection",
      attemptId: "attempt_open",
      activityId: activity.id,
      answers: [{ promptId: "explain", answer: "Build first, run second." }],
    });
    await expect(
      platform.dispatch({
        type: "activity.grade",
        commandId: "cmd_open_grade",
        attemptId: "attempt_open",
        activityId: activity.id,
      }),
    ).resolves.toMatchObject({ learningOutcome: "pending_teacher_review" });
    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [expect.objectContaining({ state: "practiced" })],
    });

    await platform.dispatch({
      type: "teacher-observation.submit",
      commandId: "cmd_open_observation",
      observationId: "observation_open",
      attemptId: "attempt_open",
      activityId: activity.id,
      rubricId: "explanation-v1",
      outcome: "pass",
      summary: "The explanation correctly separates compilation and execution.",
    });
    await expect(
      platform.query({ type: "progress.get" }),
    ).resolves.toMatchObject({
      concepts: [
        expect.objectContaining({
          state: "demonstrated",
          explanation: expect.stringContaining("Teacher Observation"),
        }),
      ],
    });
  });

  it("replays a persisted Teacher Observation after Platform recreation", async () => {
    const { platform, dependencies, events } = platformFixture();
    events.push({
      schemaVersion: 1,
      eventId: "evt_attempt_observation_replay",
      type: "attempt.completed",
      occurredAt: "2026-08-23T08:00:00.003Z",
      commandId: "cmd_attempt_observation_replay",
      attemptId: "attempt_observation_replay",
      activityId: activity.id,
      conceptIds: activity.conceptIds,
      mode: "grade",
      independence: "independent",
      report: passingReport("job_observation_replay"),
    });
    const command = {
      type: "teacher-observation.submit" as const,
      commandId: "cmd_observation_replay",
      observationId: "observation_replay",
      attemptId: "attempt_observation_replay",
      activityId: activity.id,
      rubricId: "explanation-v1",
      outcome: "pass" as const,
      summary: "Compilation produces the program before execution.",
    };
    await platform.dispatch(command);
    const eventCount = events.length;

    const restarted = createLearningPlatform(dependencies);
    await expect(restarted.dispatch(command)).resolves.toMatchObject({
      observationId: "observation_replay",
      accepted: true,
    });
    expect(events).toHaveLength(eventCount);
  });
});
