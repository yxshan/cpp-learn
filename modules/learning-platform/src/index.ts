import {
  SCHEMA_VERSION,
  type ActivityDetail,
  type AttemptIndependence,
  type AttemptCompletedEvent,
  type CommandResult,
  type CommandResultFor,
  type ConceptState,
  type ConceptStateChangedEvent,
  type CurriculumReadiness,
  type EvidenceRecordedEvent,
  type HintKind,
  type HintRevealedEvent,
  type LearningCommand,
  type LearningPlatform,
  type LearningQuery,
  type LearningRecordEvent,
  type JudgeReport,
  type JudgeSpec,
  type PlatformEvent,
  type QueryResultFor,
  type RecordReadiness,
  type ReflectionPrompt,
  type ReflectionSubmittedEvent,
  type ReviewCompletedEvent,
  type ReviewScheduledEvent,
  type TeacherObservationEvent,
  type ToolchainReadiness,
} from "@cpp-learn/contracts";

interface LearningDefinition {
  readonly hints: readonly {
    readonly id: string;
    readonly title: string;
    readonly kind: HintKind;
    readonly content: string;
  }[];
  readonly reflections: readonly ReflectionPrompt[];
  readonly reviewIds: readonly string[];
  readonly reviewOf?: string;
  readonly evidencePolicy: {
    readonly automatedPass: boolean;
    readonly demonstratedRequiresReflection: boolean;
    readonly demonstratedRequiresIndependent: boolean;
    readonly reviewAfterDays: number;
    readonly teacherReviewRequired?: boolean;
  };
  readonly teacherRubric: { readonly id: string; readonly prompt: string };
  readonly starterFiles: Readonly<Record<string, string>>;
}

export interface LearningPlatformProbes {
  curriculum(): Promise<CurriculumReadiness>;
  toolchain(): Promise<ToolchainReadiness>;
  record(): Promise<RecordReadiness>;
}

export interface LearningPlatformDependencies {
  readonly clock: () => Date;
  readonly probes: LearningPlatformProbes;
  readonly curriculum: {
    getActivity(activityId: string): Promise<ActivityDetail | undefined>;
    listActivities?(): Promise<readonly ActivityDetail[]>;
    getNextActivity?(minutes?: number): Promise<ActivityDetail | undefined>;
    getJudge(activityId: string): Promise<JudgeSpec | undefined>;
    getLearning?(activityId: string): Promise<LearningDefinition | undefined>;
  };
  readonly workspace: {
    open(activityId: string): Promise<{
      readonly activityId: string;
      readonly revision: number;
      readonly files: Readonly<Record<string, string>>;
    }>;
    save(request: {
      readonly activityId: string;
      readonly baseRevision: number;
      readonly changes: readonly {
        readonly path: string;
        readonly content: string;
      }[];
    }): Promise<
      | { readonly ok: true; readonly revision: number }
      | {
          readonly ok: false;
          readonly code: "revision_conflict" | "invalid_path";
        }
    >;
    snapshot(activityId: string): Promise<{
      readonly id: string;
      readonly activityId: string;
      readonly digest: string;
    }>;
    readSnapshot(snapshotId: string): Promise<{
      readonly id: string;
      readonly activityId: string;
      readonly digest: string;
      readonly files: Readonly<Record<string, string>>;
    }>;
  };
  readonly judge: {
    execute(request: {
      readonly jobId: string;
      readonly mode: "run" | "grade";
      readonly activity: ActivityDetail;
      readonly spec: JudgeSpec;
      readonly snapshot: {
        readonly id: string;
        readonly activityId: string;
        readonly digest: string;
        readonly files: Readonly<Record<string, string>>;
      };
      readonly signal: AbortSignal;
    }): Promise<JudgeReport>;
  };
  readonly record: {
    append(event: AttemptCompletedEvent): Promise<void>;
    appendEvent?(event: LearningRecordEvent): Promise<void>;
    appendBatch?(events: readonly LearningRecordEvent[]): Promise<void>;
    list(): Promise<readonly AttemptCompletedEvent[]>;
    events?(): Promise<readonly LearningRecordEvent[]>;
    projection?(): Promise<{
      readonly concepts: Readonly<
        Record<
          string,
          {
            readonly state: ConceptState;
            readonly explanation: string;
            readonly supportingEvidenceIds: readonly string[];
          }
        >
      >;
      readonly reviews?: readonly ReviewScheduledEvent[];
    }>;
  };
}

function addDays(instant: Date, days: number): string {
  return new Date(instant.getTime() + days * 86_400_000).toISOString();
}

function stateRank(state: ConceptState): number {
  return [
    "unseen",
    "introduced",
    "practiced",
    "demonstrated",
    "retained",
  ].indexOf(state);
}

function hasStrongVerification(report: JudgeReport): boolean {
  return report.stages.some(
    (stage) =>
      (stage.kind === "private_test" || stage.kind === "property_test") &&
      stage.outcome === "pass",
  );
}

export function createLearningPlatform(
  dependencies: LearningPlatformDependencies,
): LearningPlatform {
  const commandReceipts = new Map<
    string,
    { readonly fingerprint: string; readonly result: Promise<CommandResult> }
  >();
  const retainedJobEvents = new Map<string, readonly PlatformEvent[]>();
  const activeJobs = new Map<string, AbortController>();

  const learningEvents = async (): Promise<readonly LearningRecordEvent[]> =>
    dependencies.record.events
      ? dependencies.record.events()
      : dependencies.record.list();

  const appendLearningEvent = async (
    event: LearningRecordEvent,
  ): Promise<void> => {
    if (event.type === "attempt.completed") {
      await dependencies.record.append(event);
      return;
    }
    if (!dependencies.record.appendEvent) {
      throw new Error("Learning record does not support Stage 3 events");
    }
    await dependencies.record.appendEvent(event);
  };

  const appendLearningEvents = async (
    events: readonly LearningRecordEvent[],
  ): Promise<void> => {
    if (dependencies.record.appendBatch) {
      await dependencies.record.appendBatch(events);
      return;
    }
    for (const event of events) await appendLearningEvent(event);
  };

  const ensureAttemptScope = async (
    attemptId: string,
    activityId: string,
  ): Promise<void> => {
    const conflicting = (await learningEvents()).find(
      (event) =>
        "attemptId" in event &&
        event.attemptId === attemptId &&
        "activityId" in event &&
        event.activityId !== activityId,
    );
    if (conflicting) {
      throw new Error("Attempt identifier belongs to a different Activity");
    }
  };

  const conceptProjection = async () => {
    if (dependencies.record.projection) {
      return new Map(
        Object.entries((await dependencies.record.projection()).concepts),
      );
    }
    const events = await learningEvents();
    const concepts = new Map<
      string,
      {
        state: ConceptState;
        explanation: string;
        supportingEvidenceIds: readonly string[];
      }
    >();
    for (const event of events) {
      if (event.type === "concept.state.changed") {
        const current = concepts.get(event.conceptId)?.state ?? "unseen";
        if (stateRank(event.nextState) >= stateRank(current)) {
          concepts.set(event.conceptId, {
            state: event.nextState,
            explanation: event.explanation,
            supportingEvidenceIds: event.evidenceIds,
          });
        }
      } else if (
        event.type === "attempt.completed" &&
        event.mode === "grade" &&
        event.report.verdict === "automated_pass"
      ) {
        for (const conceptId of event.conceptIds) {
          if (!concepts.has(conceptId)) {
            concepts.set(conceptId, {
              state: "practiced",
              explanation:
                "A passing Grade supplied automated practice evidence.",
              supportingEvidenceIds: [event.eventId],
            });
          }
        }
      }
    }
    return concepts;
  };

  const reviewProjection = async () => {
    if (dependencies.record.projection) {
      return [...((await dependencies.record.projection()).reviews ?? [])].sort(
        (left, right) => left.dueAt.localeCompare(right.dueAt),
      );
    }
    const latest = new Map<string, ReviewScheduledEvent>();
    for (const event of await learningEvents()) {
      if (event.type === "review.scheduled") {
        latest.set(`${event.reviewId}:${event.conceptId}`, event);
      } else if (event.type === "review.completed") {
        latest.delete(`${event.reviewId}:${event.conceptId}`);
      }
    }
    return [...latest.values()].sort((left, right) =>
      left.dueAt.localeCompare(right.dueAt),
    );
  };

  const deriveGradeEvidence = async (
    commandId: string,
    attemptId: string,
    activity: ActivityDetail,
    report: JudgeReport,
    attemptEvent: AttemptCompletedEvent,
  ): Promise<readonly LearningRecordEvent[]> => {
    const derived: LearningRecordEvent[] = [];
    const learning = await dependencies.curriculum.getLearning?.(activity.id);
    if (!learning || !learning.evidencePolicy.automatedPass) return derived;
    const events = await learningEvents();
    const independence: AttemptIndependence =
      attemptEvent.independence ?? "independent";
    const reflectionEvents = events.filter(
      (event): event is ReflectionSubmittedEvent =>
        event.type === "reflection.submitted" &&
        event.attemptId === attemptId &&
        event.activityId === activity.id,
    );
    const requiredPrompts = learning.reflections
      .filter((prompt) => prompt.required)
      .map((prompt) => prompt.id);
    const answeredPrompts = new Set(
      reflectionEvents.flatMap((event) =>
        event.answers.map((answer) => answer.promptId),
      ),
    );
    const reflectionSatisfied = requiredPrompts.every((promptId) =>
      answeredPrompts.has(promptId),
    );
    const strongVerificationPass = hasStrongVerification(report);
    const automatedPass = report.verdict === "automated_pass";
    const now = dependencies.clock();
    const concepts = await conceptProjection();
    const scheduledReviews = await reviewProjection();
    const reviewCoverage = new Map<string, readonly string[]>();
    for (const reviewId of learning.reviewIds) {
      const review = await dependencies.curriculum.getActivity(reviewId);
      if (review) reviewCoverage.set(reviewId, review.conceptIds);
    }

    for (const conceptId of activity.conceptIds) {
      const previous = concepts.get(conceptId)?.state ?? "unseen";
      const evidenceId = `evidence_${commandId}_${conceptId}`;
      const evidence: EvidenceRecordedEvent = {
        schemaVersion: SCHEMA_VERSION,
        eventId: `evt_${evidenceId}`,
        type: "evidence.recorded",
        occurredAt: now.toISOString(),
        evidenceId,
        conceptId,
        activityId: activity.id,
        attemptId,
        source: activity.kind === "review" ? "review" : "automated_grade",
        outcome: automatedPass ? "pass" : "fail",
        independence,
        supportingEventIds: [
          attemptEvent.eventId,
          ...reflectionEvents.map((event) => event.eventId),
        ],
      };
      derived.push(evidence);
      if (!automatedPass) {
        if (activity.kind === "review") {
          const prior = scheduledReviews.find(
            (review) =>
              review.reviewId === activity.id && review.conceptId === conceptId,
          );
          if (prior) {
            derived.push({
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_review_retry_${commandId}_${conceptId}`,
              type: "review.scheduled",
              occurredAt: now.toISOString(),
              reviewId: activity.id,
              conceptId,
              sourceActivityId: prior.sourceActivityId,
              dueAt: addDays(
                now,
                Math.max(1, Math.floor(prior.intervalDays / 2)),
              ),
              intervalDays: Math.max(1, Math.floor(prior.intervalDays / 2)),
              reason:
                "A failed Review shortens the interval without erasing prior Evidence.",
            });
          }
        }
        continue;
      }

      const independentEnough =
        !learning.evidencePolicy.demonstratedRequiresIndependent ||
        independence === "independent";
      const reflectedEnough =
        !learning.evidencePolicy.demonstratedRequiresReflection ||
        reflectionSatisfied;
      let target: ConceptState = "practiced";
      let explanation =
        "A passing Grade supplied automated practice evidence; demonstration requirements remain open.";

      if (activity.kind === "review") {
        const scheduled = scheduledReviews.find(
          (review) =>
            review.reviewId === activity.id && review.conceptId === conceptId,
        );
        if (
          scheduled &&
          Date.parse(scheduled.dueAt) <= now.getTime() &&
          stateRank(previous) >= stateRank("demonstrated") &&
          independentEnough &&
          reflectedEnough &&
          strongVerificationPass
        ) {
          target = "retained";
          explanation =
            "An independent delayed Review passed strong verification with the required reflection.";
        } else {
          target = previous;
          explanation =
            "The Review passed, but delayed independent-retention requirements were not all satisfied.";
        }
      } else if (
        strongVerificationPass &&
        independentEnough &&
        reflectedEnough &&
        independence !== "solution_exposed" &&
        !learning.evidencePolicy.teacherReviewRequired
      ) {
        target = "demonstrated";
        explanation =
          "An independent Grade passed strong verification with the required reflection.";
      }

      if (stateRank(target) < stateRank(previous)) target = previous;
      if (target !== previous) {
        const stateEvent: ConceptStateChangedEvent = {
          schemaVersion: SCHEMA_VERSION,
          eventId: `evt_state_${commandId}_${conceptId}`,
          type: "concept.state.changed",
          occurredAt: now.toISOString(),
          conceptId,
          previousState: previous,
          nextState: target,
          evidenceIds: [evidenceId],
          explanation,
        };
        derived.push(stateEvent);
      }
      if (activity.kind === "review" && target === "retained") {
        const completed: ReviewCompletedEvent = {
          schemaVersion: SCHEMA_VERSION,
          eventId: `evt_review_completed_${commandId}_${conceptId}`,
          type: "review.completed",
          occurredAt: now.toISOString(),
          reviewId: activity.id,
          conceptId,
          attemptId,
          evidenceId,
        };
        derived.push(completed);
      }
      if (target === "demonstrated" && previous !== "demonstrated") {
        for (const reviewId of learning.reviewIds) {
          if (!reviewCoverage.get(reviewId)?.includes(conceptId)) continue;
          const intervalDays = learning.evidencePolicy.reviewAfterDays;
          derived.push({
            schemaVersion: SCHEMA_VERSION,
            eventId: `evt_review_${commandId}_${conceptId}_${reviewId}`,
            type: "review.scheduled",
            occurredAt: now.toISOString(),
            reviewId,
            conceptId,
            sourceActivityId: activity.id,
            dueAt: addDays(now, intervalDays),
            intervalDays,
            reason:
              "Demonstrated Evidence schedules a delayed Review to test retention.",
          });
        }
      }
    }
    return derived;
  };

  return {
    async dispatch<C extends LearningCommand>(
      command: C,
    ): Promise<CommandResultFor<C>> {
      const fingerprint = JSON.stringify(command);
      const existing = commandReceipts.get(command.commandId);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new Error("Command identifier reused with a different payload");
        }
        return existing.result as Promise<CommandResultFor<C>>;
      }

      const execution = (async (): Promise<CommandResult> => {
        switch (command.type) {
          case "teacher-pack.create": {
            const [activity, learning, workspace, allEvents, concepts] =
              await Promise.all([
                dependencies.curriculum.getActivity(command.activityId),
                dependencies.curriculum.getLearning?.(command.activityId),
                dependencies.workspace.open(command.activityId),
                learningEvents(),
                conceptProjection(),
              ]);
            if (!activity || !learning) {
              throw new Error(`Unknown Activity: ${command.activityId}`);
            }
            const attempts = allEvents.filter(
              (event): event is AttemptCompletedEvent =>
                event.type === "attempt.completed" &&
                event.activityId === command.activityId &&
                (!command.attemptId || event.attemptId === command.attemptId),
            );
            const latest = attempts.at(-1);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              pack: {
                activity: {
                  id: activity.id,
                  version: activity.version,
                  title: activity.title,
                  markdown: activity.markdown,
                  reflections: learning.reflections,
                  teacherRubric: learning.teacherRubric,
                },
                learnerDiff: Object.keys(workspace.files)
                  .sort()
                  .filter(
                    (path) =>
                      (learning.starterFiles[path] ?? "") !==
                      (workspace.files[path] ?? ""),
                  )
                  .map((path) => ({
                    path,
                    starter: learning.starterFiles[path] ?? "",
                    current: workspace.files[path] ?? "",
                  })),
                publicDiagnostics:
                  latest?.report.stages
                    .filter((stage) => stage.kind !== "private_test")
                    .flatMap((stage) => stage.diagnostics ?? []) ?? [],
                recentAttempts: attempts.slice(-5).map((attempt) => ({
                  ...(attempt.attemptId
                    ? { attemptId: attempt.attemptId }
                    : {}),
                  mode: attempt.mode,
                  verdict: attempt.report.verdict,
                  completedAt: attempt.report.completedAt,
                })),
                concepts: activity.conceptIds.map((conceptId) => {
                  const concept = concepts.get(conceptId);
                  return {
                    conceptId,
                    state: concept?.state ?? "unseen",
                    explanation:
                      concept?.explanation ?? "No supporting Evidence yet.",
                  };
                }),
              },
            };
          }
          case "teacher-observation.submit": {
            await ensureAttemptScope(command.attemptId, command.activityId);
            const priorObservation = (await learningEvents()).find(
              (candidate): candidate is TeacherObservationEvent =>
                (candidate.type === "teacher.observation.accepted" ||
                  candidate.type === "teacher.observation.rejected") &&
                candidate.commandId === command.commandId,
            );
            if (priorObservation) {
              if (
                priorObservation.observationId !== command.observationId ||
                priorObservation.attemptId !== command.attemptId ||
                priorObservation.activityId !== command.activityId ||
                priorObservation.rubricId !== command.rubricId ||
                priorObservation.outcome !== command.outcome ||
                priorObservation.summary !== command.summary.trim()
              ) {
                throw new Error(
                  "Command identifier reused with a different payload",
                );
              }
              return {
                schemaVersion: SCHEMA_VERSION,
                commandId: command.commandId,
                observationId: command.observationId,
                accepted:
                  priorObservation.type === "teacher.observation.accepted",
                ...(priorObservation.reason
                  ? { reason: priorObservation.reason }
                  : {}),
              };
            }
            const learning = await dependencies.curriculum.getLearning?.(
              command.activityId,
            );
            const attempt = (await dependencies.record.list()).find(
              (candidate) =>
                candidate.attemptId === command.attemptId &&
                candidate.activityId === command.activityId,
            );
            const summary = command.summary.trim();
            const accepted = Boolean(
              learning &&
              attempt &&
              command.rubricId === learning.teacherRubric.id &&
              summary.length > 0 &&
              summary.length <= 4_000,
            );
            const reason = accepted
              ? undefined
              : "Observation does not match an applicable Activity attempt and rubric.";
            const event: TeacherObservationEvent = {
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_${command.commandId}`,
              type: accepted
                ? "teacher.observation.accepted"
                : "teacher.observation.rejected",
              occurredAt: dependencies.clock().toISOString(),
              commandId: command.commandId,
              observationId: command.observationId,
              attemptId: command.attemptId,
              activityId: command.activityId,
              rubricId: command.rubricId,
              outcome: command.outcome,
              summary,
              ...(reason ? { reason } : {}),
            };
            const observationEvents: LearningRecordEvent[] = [event];
            if (
              accepted &&
              command.outcome === "pass" &&
              learning?.evidencePolicy.teacherReviewRequired &&
              attempt?.report.verdict === "automated_pass" &&
              attempt.independence === "independent"
            ) {
              const activity = await dependencies.curriculum.getActivity(
                command.activityId,
              );
              const allEvents = await learningEvents();
              const reflections = allEvents.filter(
                (candidate): candidate is ReflectionSubmittedEvent =>
                  candidate.type === "reflection.submitted" &&
                  candidate.attemptId === command.attemptId &&
                  candidate.activityId === command.activityId,
              );
              const answered = new Set(
                reflections.flatMap((reflection) =>
                  reflection.answers.map((answer) => answer.promptId),
                ),
              );
              const reflectionSatisfied = learning.reflections
                .filter((prompt) => prompt.required)
                .every((prompt) => answered.has(prompt.id));
              const strongVerificationPass = hasStrongVerification(
                attempt.report,
              );
              if (activity && reflectionSatisfied && strongVerificationPass) {
                const concepts = await conceptProjection();
                const now = dependencies.clock();
                const reviewCoverage = new Map<string, readonly string[]>();
                for (const reviewId of learning.reviewIds) {
                  const review =
                    await dependencies.curriculum.getActivity(reviewId);
                  if (review) reviewCoverage.set(reviewId, review.conceptIds);
                }
                for (const conceptId of activity.conceptIds) {
                  const previous = concepts.get(conceptId)?.state ?? "unseen";
                  const evidenceId = `evidence_${command.commandId}_${conceptId}`;
                  observationEvents.push({
                    schemaVersion: SCHEMA_VERSION,
                    eventId: `evt_${evidenceId}`,
                    type: "evidence.recorded",
                    occurredAt: now.toISOString(),
                    evidenceId,
                    conceptId,
                    activityId: activity.id,
                    attemptId: command.attemptId,
                    source: "teacher_observation",
                    outcome: "pass",
                    independence: "independent",
                    supportingEventIds: [
                      attempt.eventId,
                      event.eventId,
                      ...reflections.map((reflection) => reflection.eventId),
                    ],
                  });
                  if (stateRank(previous) < stateRank("demonstrated")) {
                    observationEvents.push({
                      schemaVersion: SCHEMA_VERSION,
                      eventId: `evt_state_${command.commandId}_${conceptId}`,
                      type: "concept.state.changed",
                      occurredAt: now.toISOString(),
                      conceptId,
                      previousState: previous,
                      nextState: "demonstrated",
                      evidenceIds: [evidenceId],
                      explanation:
                        "An applicable Teacher Observation joined independent strong verification and required reflection.",
                    });
                    for (const reviewId of learning.reviewIds) {
                      if (!reviewCoverage.get(reviewId)?.includes(conceptId))
                        continue;
                      observationEvents.push({
                        schemaVersion: SCHEMA_VERSION,
                        eventId: `evt_review_${command.commandId}_${conceptId}_${reviewId}`,
                        type: "review.scheduled",
                        occurredAt: now.toISOString(),
                        reviewId,
                        conceptId,
                        sourceActivityId: activity.id,
                        dueAt: addDays(
                          now,
                          learning.evidencePolicy.reviewAfterDays,
                        ),
                        intervalDays: learning.evidencePolicy.reviewAfterDays,
                        reason:
                          "Teacher-reviewed demonstration schedules a delayed retention check.",
                      });
                    }
                  }
                }
              }
            }
            await appendLearningEvents(observationEvents);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              observationId: command.observationId,
              accepted,
              ...(reason ? { reason } : {}),
            };
          }
          case "hint.reveal": {
            await ensureAttemptScope(command.attemptId, command.activityId);
            const learning = await dependencies.curriculum.getLearning?.(
              command.activityId,
            );
            if (!learning)
              throw new Error(`Unknown Activity: ${command.activityId}`);
            const hintIndex = learning.hints.findIndex(
              (hint) => hint.id === command.hintId,
            );
            if (hintIndex < 0) throw new Error("Unknown hint");
            const hint = learning.hints[hintIndex];
            if (!hint) throw new Error("Unknown hint");
            if (hint.kind !== "solution" && command.confirmFullSolution) {
              throw new Error("Confirmation is valid only for a full solution");
            }
            if (hint.kind === "solution" && !command.confirmFullSolution) {
              throw new Error("A full solution requires explicit confirmation");
            }
            const allEvents = await learningEvents();
            const priorCommand = allEvents.find(
              (event): event is HintRevealedEvent =>
                event.type === "hint.revealed" &&
                event.commandId === command.commandId,
            );
            if (priorCommand) {
              if (
                priorCommand.attemptId !== command.attemptId ||
                priorCommand.activityId !== command.activityId ||
                priorCommand.hintId !== command.hintId
              ) {
                throw new Error(
                  "Command identifier reused with a different payload",
                );
              }
              return {
                schemaVersion: SCHEMA_VERSION,
                commandId: command.commandId,
                hint,
                assistance:
                  hint.kind === "solution" ? "solution_exposed" : "assisted",
              };
            }
            const priorHints = allEvents.filter(
              (event): event is HintRevealedEvent =>
                event.type === "hint.revealed" &&
                event.attemptId === command.attemptId &&
                event.activityId === command.activityId,
            );
            if (hintIndex !== priorHints.length) {
              throw new Error("Hints must be revealed in order");
            }
            const event: HintRevealedEvent = {
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_${command.commandId}`,
              type: "hint.revealed",
              occurredAt: dependencies.clock().toISOString(),
              commandId: command.commandId,
              attemptId: command.attemptId,
              activityId: command.activityId,
              hintId: hint.id,
              order: hintIndex + 1,
              fullSolutionExposed: hint.kind === "solution",
            };
            const hintEvents: LearningRecordEvent[] = [event];
            if (hint.kind === "solution") {
              const activity = await dependencies.curriculum.getActivity(
                command.activityId,
              );
              if (!activity) {
                throw new Error(`Unknown Activity: ${command.activityId}`);
              }
              const now = dependencies.clock();
              const intervalDays = Math.max(
                1,
                Math.floor(learning.evidencePolicy.reviewAfterDays / 2),
              );
              const reviewCoverage = new Map<string, readonly string[]>();
              for (const reviewId of learning.reviewIds) {
                const review =
                  await dependencies.curriculum.getActivity(reviewId);
                if (review) reviewCoverage.set(reviewId, review.conceptIds);
              }
              for (const conceptId of activity.conceptIds) {
                for (const reviewId of learning.reviewIds) {
                  if (!reviewCoverage.get(reviewId)?.includes(conceptId))
                    continue;
                  hintEvents.push({
                    schemaVersion: SCHEMA_VERSION,
                    eventId: `evt_solution_review_${command.commandId}_${conceptId}_${reviewId}`,
                    type: "review.scheduled",
                    occurredAt: now.toISOString(),
                    reviewId,
                    conceptId,
                    sourceActivityId: activity.id,
                    dueAt: addDays(now, intervalDays),
                    intervalDays,
                    reason:
                      "Full-solution exposure schedules a compensating independent Review variant.",
                  });
                }
              }
            }
            await appendLearningEvents(hintEvents);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              hint,
              assistance:
                hint.kind === "solution" ? "solution_exposed" : "assisted",
            };
          }
          case "reflection.submit": {
            await ensureAttemptScope(command.attemptId, command.activityId);
            const normalizedAnswers = command.answers.map((answer) => ({
              promptId: answer.promptId,
              answer: answer.answer.trim(),
            }));
            const priorReflection = (await learningEvents()).find(
              (candidate): candidate is ReflectionSubmittedEvent =>
                candidate.type === "reflection.submitted" &&
                candidate.commandId === command.commandId,
            );
            if (priorReflection) {
              if (
                priorReflection.attemptId !== command.attemptId ||
                priorReflection.activityId !== command.activityId ||
                JSON.stringify(priorReflection.answers) !==
                  JSON.stringify(normalizedAnswers)
              ) {
                throw new Error(
                  "Command identifier reused with a different payload",
                );
              }
              return {
                schemaVersion: SCHEMA_VERSION,
                commandId: command.commandId,
                accepted: true,
              };
            }
            const learning = await dependencies.curriculum.getLearning?.(
              command.activityId,
            );
            if (!learning)
              throw new Error(`Unknown Activity: ${command.activityId}`);
            const knownPrompts = new Set(
              learning.reflections.map((prompt) => prompt.id),
            );
            const answers = new Map(
              command.answers.map((answer) => [
                answer.promptId,
                answer.answer.trim(),
              ]),
            );
            if (
              command.answers.some(
                (answer) =>
                  !knownPrompts.has(answer.promptId) ||
                  answer.answer.trim().length === 0,
              ) ||
              learning.reflections.some(
                (prompt) => prompt.required && !answers.get(prompt.id),
              )
            ) {
              throw new Error("Reflection answers are incomplete or invalid");
            }
            const event: ReflectionSubmittedEvent = {
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_${command.commandId}`,
              type: "reflection.submitted",
              occurredAt: dependencies.clock().toISOString(),
              commandId: command.commandId,
              attemptId: command.attemptId,
              activityId: command.activityId,
              answers: normalizedAnswers,
            };
            await appendLearningEvent(event);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              accepted: true,
            };
          }
          case "job.cancel": {
            const controller = activeJobs.get(command.jobId);
            controller?.abort();
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              jobId: command.jobId,
              cancelled: controller !== undefined,
            };
          }
          case "workspace.save": {
            const result = await dependencies.workspace.save({
              activityId: command.activityId,
              baseRevision: command.baseRevision,
              changes: command.changes,
            });
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              result,
            };
          }
          case "activity.run":
          case "activity.grade": {
            const priorAttempt = (await dependencies.record.list()).find(
              (event) => event.commandId === command.commandId,
            );
            if (priorAttempt) {
              const requestedMode =
                command.type === "activity.run" ? "run" : "grade";
              const requestedAttemptId =
                command.attemptId ?? `attempt_${command.commandId}`;
              if (
                priorAttempt.activityId !== command.activityId ||
                priorAttempt.mode !== requestedMode ||
                (priorAttempt.attemptId !== undefined &&
                  priorAttempt.attemptId !== requestedAttemptId)
              ) {
                throw new Error(
                  "Command identifier reused with a different payload",
                );
              }
              return {
                schemaVersion: SCHEMA_VERSION,
                commandId: command.commandId,
                jobId: priorAttempt.report.jobId,
                snapshotId: priorAttempt.report.source.snapshotId,
                status: "completed",
                report: priorAttempt.report,
                ...((
                  await dependencies.curriculum.getLearning?.(
                    command.activityId,
                  )
                )?.evidencePolicy.teacherReviewRequired &&
                priorAttempt.report.verdict === "automated_pass"
                  ? { learningOutcome: "pending_teacher_review" as const }
                  : {}),
              };
            }
            const activity = await dependencies.curriculum.getActivity(
              command.activityId,
            );
            if (!activity)
              throw new Error(`Unknown Activity: ${command.activityId}`);
            const spec = await dependencies.curriculum.getJudge(
              command.activityId,
            );
            if (!spec) {
              throw new Error(
                `Missing Judge definition: ${command.activityId}`,
              );
            }
            const source = await dependencies.workspace.snapshot(
              command.activityId,
            );
            const snapshot = await dependencies.workspace.readSnapshot(
              source.id,
            );
            const mode = command.type === "activity.run" ? "run" : "grade";
            const attemptId =
              command.attemptId ?? `attempt_${command.commandId}`;
            await ensureAttemptScope(attemptId, command.activityId);
            const jobId = `job_${command.commandId}`;
            const controller = new AbortController();
            activeJobs.set(jobId, controller);
            retainedJobEvents.set(jobId, [
              {
                schemaVersion: SCHEMA_VERSION,
                jobId,
                sequence: 1,
                type: "judge.queued",
              },
            ]);
            let report: JudgeReport;
            try {
              report = await dependencies.judge.execute({
                jobId,
                mode,
                activity,
                spec,
                snapshot,
                signal: controller.signal,
              });
            } finally {
              activeJobs.delete(jobId);
            }
            const event: AttemptCompletedEvent = {
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_${command.commandId}`,
              type: "attempt.completed",
              occurredAt: dependencies.clock().toISOString(),
              commandId: command.commandId,
              activityId: command.activityId,
              conceptIds: activity.conceptIds,
              mode,
              attemptId,
              report,
            };
            if (mode === "grade") {
              const priorEvents = await learningEvents();
              const attemptHints = priorEvents.filter(
                (candidate): candidate is HintRevealedEvent =>
                  candidate.type === "hint.revealed" &&
                  candidate.attemptId === attemptId &&
                  candidate.activityId === activity.id,
              );
              const fullSolutionExposed = attemptHints.some(
                (hint) => hint.fullSolutionExposed,
              );
              Object.assign(event, {
                independence: fullSolutionExposed
                  ? "solution_exposed"
                  : attemptHints.length > 0
                    ? "assisted"
                    : "independent",
                hintsUsed: attemptHints.length,
                fullSolutionExposed,
              });
            }
            const gradeLearning =
              mode === "grade"
                ? await dependencies.curriculum.getLearning?.(activity.id)
                : undefined;
            const derivedEvents =
              mode === "grade"
                ? await deriveGradeEvidence(
                    command.commandId,
                    attemptId,
                    activity,
                    report,
                    event,
                  )
                : [];
            await appendLearningEvents([event, ...derivedEvents]);
            retainedJobEvents.set(jobId, [
              {
                schemaVersion: SCHEMA_VERSION,
                jobId,
                sequence: 1,
                type: "judge.queued",
              },
              {
                schemaVersion: SCHEMA_VERSION,
                jobId,
                sequence: 2,
                type:
                  report.verdict === "cancelled"
                    ? "judge.cancelled"
                    : report.verdict === "judge_system_error"
                      ? "judge.system-error"
                      : "judge.report.ready",
              },
            ]);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              jobId,
              snapshotId: snapshot.id,
              status: "completed",
              report,
              ...(gradeLearning?.evidencePolicy.teacherReviewRequired &&
              report.verdict === "automated_pass"
                ? { learningOutcome: "pending_teacher_review" as const }
                : {}),
            };
          }
        }
      })();
      commandReceipts.set(command.commandId, {
        fingerprint,
        result: execution,
      });
      return execution as Promise<CommandResultFor<C>>;
    },
    async query<Q extends LearningQuery>(query: Q): Promise<QueryResultFor<Q>> {
      switch (query.type) {
        case "bootstrap.get": {
          const [curriculum, toolchain, record] = await Promise.all([
            dependencies.probes.curriculum(),
            dependencies.probes.toolchain(),
            dependencies.probes.record(),
          ]);

          return {
            schemaVersion: SCHEMA_VERSION,
            generatedAt: dependencies.clock().toISOString(),
            ready: curriculum.ready && toolchain.ready && record.ready,
            services: { curriculum, toolchain, record },
          } as unknown as QueryResultFor<Q>;
        }
        case "activity.get": {
          const activity = await dependencies.curriculum.getActivity(
            query.activityId,
          );
          return {
            schemaVersion: SCHEMA_VERSION,
            activity: activity ?? null,
          } as unknown as QueryResultFor<Q>;
        }
        case "activities.list": {
          const activities = await dependencies.curriculum.listActivities?.();
          return {
            schemaVersion: SCHEMA_VERSION,
            activities: (activities ?? []).map((activity) => ({
              id: activity.id,
              version: activity.version,
              kind: activity.kind,
              title: activity.title,
              ...(activity.project ? { project: activity.project } : {}),
              estimatedMinutes: activity.estimatedMinutes,
              conceptIds: activity.conceptIds,
              prerequisiteIds: activity.prerequisiteIds ?? [],
            })),
          } as unknown as QueryResultFor<Q>;
        }
        case "activity.next": {
          const dueReview = (await reviewProjection()).find(
            (review) =>
              Date.parse(review.dueAt) <= dependencies.clock().getTime(),
          );
          const activity = dueReview
            ? await dependencies.curriculum.getActivity(dueReview.reviewId)
            : await dependencies.curriculum.getNextActivity?.(query.minutes);
          return {
            schemaVersion: SCHEMA_VERSION,
            activity: activity ?? null,
          } as unknown as QueryResultFor<Q>;
        }
        case "workspace.get": {
          const workspace = await dependencies.workspace.open(query.activityId);
          return {
            schemaVersion: SCHEMA_VERSION,
            workspace,
          } as unknown as QueryResultFor<Q>;
        }
        case "dashboard.get": {
          const events = await dependencies.record.list();
          const conceptStates = Object.fromEntries(
            [...(await conceptProjection()).entries()].map(
              ([conceptId, value]) => [conceptId, value.state],
            ),
          );
          const dueReviewCount = (await reviewProjection()).filter(
            (review) =>
              Date.parse(review.dueAt) <= dependencies.clock().getTime(),
          ).length;
          return {
            schemaVersion: SCHEMA_VERSION,
            attempts: events.map((event) => ({
              activityId: event.activityId,
              mode: event.mode,
              verdict: event.report.verdict,
              jobId: event.report.jobId,
              completedAt: event.report.completedAt,
            })),
            conceptStates,
            ...(dueReviewCount > 0 ? { dueReviewCount } : {}),
          } as unknown as QueryResultFor<Q>;
        }
        case "progress.get":
        case "concept.get": {
          const concepts = await conceptProjection();
          const reviews = await reviewProjection();
          const evidence = (await learningEvents()).filter(
            (event): event is EvidenceRecordedEvent =>
              event.type === "evidence.recorded",
          );
          const entries = [...concepts.entries()]
            .filter(
              ([conceptId]) =>
                query.type !== "concept.get" || conceptId === query.conceptId,
            )
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([conceptId, value]) => {
              const nextReview = reviews.find(
                (review) => review.conceptId === conceptId,
              );
              const conceptEvidence = evidence
                .filter((event) => event.conceptId === conceptId)
                .map((event) => ({
                  evidenceId: event.evidenceId,
                  activityId: event.activityId,
                  occurredAt: event.occurredAt,
                  source: event.source,
                  outcome: event.outcome,
                  independence: event.independence,
                }));
              return {
                conceptId,
                ...value,
                ...(conceptEvidence.length > 0
                  ? { evidence: conceptEvidence }
                  : {}),
                ...(nextReview ? { nextReviewAt: nextReview.dueAt } : {}),
              };
            });
          return {
            schemaVersion: SCHEMA_VERSION,
            concepts: entries,
          } as unknown as QueryResultFor<Q>;
        }
        case "reviews.get": {
          const now = dependencies.clock().getTime();
          const reviews = (await reviewProjection())
            .filter(
              (review) => !query.dueOnly || Date.parse(review.dueAt) <= now,
            )
            .map((review) => ({
              activityId: review.reviewId,
              conceptId: review.conceptId,
              dueAt: review.dueAt,
              intervalDays: review.intervalDays,
              reason: review.reason,
              status:
                Date.parse(review.dueAt) <= now
                  ? ("due" as const)
                  : ("scheduled" as const),
            }));
          return {
            schemaVersion: SCHEMA_VERSION,
            reviews,
          } as unknown as QueryResultFor<Q>;
        }
        case "attempt.get": {
          const events = await learningEvents();
          const completed = [...events]
            .reverse()
            .find(
              (event): event is AttemptCompletedEvent =>
                event.type === "attempt.completed" &&
                event.attemptId === query.attemptId,
            );
          const hints = events.filter(
            (event): event is HintRevealedEvent =>
              event.type === "hint.revealed" &&
              event.attemptId === query.attemptId,
          );
          const reflections = events.filter(
            (event): event is ReflectionSubmittedEvent =>
              event.type === "reflection.submitted" &&
              event.attemptId === query.attemptId,
          );
          const evidence = events.filter(
            (event): event is EvidenceRecordedEvent =>
              event.type === "evidence.recorded" &&
              event.attemptId === query.attemptId,
          );
          const activityId =
            completed?.activityId ??
            hints[0]?.activityId ??
            reflections[0]?.activityId;
          return {
            schemaVersion: SCHEMA_VERSION,
            attempt: activityId
              ? {
                  attemptId: query.attemptId,
                  activityId,
                  independence:
                    completed?.independence ??
                    (hints.some((hint) => hint.fullSolutionExposed)
                      ? "solution_exposed"
                      : hints.length > 0
                        ? "assisted"
                        : "independent"),
                  ...(completed ? { completed } : {}),
                  hints,
                  reflections,
                  evidence,
                }
              : null,
          } as unknown as QueryResultFor<Q>;
        }
        case "job.get": {
          const report = (await dependencies.record.list())
            .map((event) => event.report)
            .find((candidate) => candidate.jobId === query.jobId);
          return {
            schemaVersion: SCHEMA_VERSION,
            report: report ?? null,
          } as QueryResultFor<Q>;
        }
      }
    },
    async *events(jobId) {
      for (const event of retainedJobEvents.get(jobId) ?? []) yield event;
    },
  };
}
