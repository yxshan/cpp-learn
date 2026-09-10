import type { SCHEMA_VERSION } from "./index.ts";

import type { ExecutionMode, JudgeReport } from "./judge.ts";
import type { AttemptIndependence, ConceptState } from "./index.ts";

/**
 * Learning Record events
 *
 * The append-only event union. Every event is an immutable fact; projections rebuild from these.
 */

export interface AttemptCompletedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "attempt.completed";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly activityId: string;
  readonly conceptIds: readonly string[];
  readonly mode: ExecutionMode;
  readonly attemptId?: string;
  readonly independence?: AttemptIndependence;
  readonly hintsUsed?: number;
  readonly fullSolutionExposed?: boolean;
  readonly report: JudgeReport;
}

export interface RecoveryPerformedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "recovery.performed";
  readonly occurredAt: string;
  readonly quarantinedFile: string;
  readonly invalidBytes: number;
}

export interface HintRevealedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "hint.revealed";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly hintId: string;
  readonly order: number;
  readonly fullSolutionExposed: boolean;
}

export interface ReflectionSubmittedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "reflection.submitted";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly answers: readonly {
    readonly promptId: string;
    readonly answer: string;
  }[];
}

export interface EvidenceRecordedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "evidence.recorded";
  readonly occurredAt: string;
  readonly evidenceId: string;
  readonly conceptId: string;
  readonly activityId: string;
  readonly attemptId: string;
  readonly source: "automated_grade" | "review" | "teacher_observation";
  readonly outcome: "pass" | "fail";
  readonly independence: AttemptIndependence;
  readonly supportingEventIds: readonly string[];
}

export interface ConceptStateChangedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "concept.state.changed";
  readonly occurredAt: string;
  readonly conceptId: string;
  readonly previousState: ConceptState;
  readonly nextState: ConceptState;
  readonly evidenceIds: readonly string[];
  readonly explanation: string;
}

export interface ReviewScheduledEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "review.scheduled";
  readonly occurredAt: string;
  readonly reviewId: string;
  readonly conceptId: string;
  readonly sourceActivityId: string;
  readonly dueAt: string;
  readonly intervalDays: number;
  readonly reason: string;
}

export interface ReviewCompletedEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: "review.completed";
  readonly occurredAt: string;
  readonly reviewId: string;
  readonly conceptId: string;
  readonly attemptId: string;
  readonly evidenceId: string;
}

export interface TeacherObservationEvent {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly eventId: string;
  readonly type:
    "teacher.observation.accepted" | "teacher.observation.rejected";
  readonly occurredAt: string;
  readonly commandId: string;
  readonly observationId: string;
  readonly attemptId: string;
  readonly activityId: string;
  readonly rubricId: string;
  readonly outcome: "pass" | "revise";
  readonly summary: string;
  readonly reason?: string;
}

export type LearningRecordEvent =
  | AttemptCompletedEvent
  | RecoveryPerformedEvent
  | HintRevealedEvent
  | ReflectionSubmittedEvent
  | EvidenceRecordedEvent
  | ConceptStateChangedEvent
  | ReviewScheduledEvent
  | ReviewCompletedEvent
  | TeacherObservationEvent;
