import {
  SCHEMA_VERSION,
  type ActivityDetail,
  type AttemptCompletedEvent,
  type CommandResult,
  type CommandResultFor,
  type CurriculumReadiness,
  type LearningCommand,
  type LearningPlatform,
  type LearningQuery,
  type JudgeReport,
  type JudgeSpec,
  type PlatformEvent,
  type QueryResultFor,
  type RecordReadiness,
  type ToolchainReadiness,
} from "@cpp-learn/contracts";

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
    getNextActivity?(minutes?: number): Promise<ActivityDetail | undefined>;
    getJudge(activityId: string): Promise<JudgeSpec | undefined>;
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
    }): Promise<JudgeReport>;
  };
  readonly record: {
    append(event: AttemptCompletedEvent): Promise<void>;
    list(): Promise<readonly AttemptCompletedEvent[]>;
  };
}

export function createLearningPlatform(
  dependencies: LearningPlatformDependencies,
): LearningPlatform {
  const commandReceipts = new Map<
    string,
    { readonly fingerprint: string; readonly result: Promise<CommandResult> }
  >();
  const retainedJobEvents = new Map<string, readonly PlatformEvent[]>();

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
            const jobId = `job_${command.commandId}`;
            retainedJobEvents.set(jobId, [
              {
                schemaVersion: SCHEMA_VERSION,
                jobId,
                sequence: 1,
                type: "judge.queued",
              },
            ]);
            const report = await dependencies.judge.execute({
              jobId,
              mode,
              activity,
              spec,
              snapshot,
            });
            const event: AttemptCompletedEvent = {
              schemaVersion: SCHEMA_VERSION,
              eventId: `evt_${command.commandId}`,
              type: "attempt.completed",
              occurredAt: dependencies.clock().toISOString(),
              commandId: command.commandId,
              activityId: command.activityId,
              conceptIds: activity.conceptIds,
              mode,
              report,
            };
            await dependencies.record.append(event);
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
                type: "judge.report.ready",
              },
            ]);
            return {
              schemaVersion: SCHEMA_VERSION,
              commandId: command.commandId,
              jobId,
              snapshotId: snapshot.id,
              status: "completed",
              report,
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
        case "activity.next": {
          const activity = await dependencies.curriculum.getNextActivity?.(
            query.minutes,
          );
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
          } as QueryResultFor<Q>;
        }
        case "dashboard.get": {
          const events = await dependencies.record.list();
          const conceptStates: Record<
            string,
            "unseen" | "introduced" | "practiced" | "demonstrated" | "retained"
          > = {};
          for (const event of events) {
            if (
              event.mode !== "grade" ||
              event.report.verdict !== "automated_pass"
            ) {
              continue;
            }
            for (const conceptId of event.conceptIds) {
              conceptStates[conceptId] = "practiced";
            }
          }
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
