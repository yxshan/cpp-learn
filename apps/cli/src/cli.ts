import { randomUUID } from "node:crypto";

import type { BootstrapResult, LearningPlatform } from "@cpp-learn/contracts";

export interface CliDependencies {
  readonly argv: readonly string[];
  readonly platform: LearningPlatform;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly serve?: () => Promise<void>;
  readonly archive?: {
    exportTo(outputPath: string): Promise<{
      readonly schemaVersion: 1;
      readonly createdAt: string;
      readonly fileCount: number;
    }>;
    restoreFrom(inputPath: string): Promise<{
      readonly schemaVersion: 1;
      readonly restoredFiles: number;
    }>;
  };
}

function formatDoctorReport(report: BootstrapResult): string {
  const symbol = (ready: boolean): string => (ready ? "✓" : "✗");
  return [
    `C++ Learn ${report.ready ? "is ready" : "needs attention"}`,
    `${symbol(report.services.curriculum.ready)} Curriculum: ${report.services.curriculum.activityCount} activities`,
    `${symbol(report.services.toolchain.ready)} Toolchain: ${report.services.toolchain.compiler ?? "unavailable"}`,
    `${symbol(report.services.record.ready)} Learning record`,
    "",
  ].join("\n");
}

export async function runCli(dependencies: CliDependencies): Promise<number> {
  const [command, ...flags] = dependencies.argv;
  const flagValue = (name: string): string | undefined => {
    const index = flags.indexOf(name);
    return index >= 0 ? flags[index + 1] : undefined;
  };

  if (command === "doctor") {
    const report = await dependencies.platform.query({ type: "bootstrap.get" });
    if (flags.includes("--json")) {
      dependencies.stdout(`${JSON.stringify(report)}\n`);
    } else {
      dependencies.stdout(formatDoctorReport(report));
    }
    return report.ready ? 0 : 3;
  }

  if (command === "status") {
    const dashboard = await dependencies.platform.query({
      type: "dashboard.get",
    });
    if (flags.includes("--json")) {
      dependencies.stdout(`${JSON.stringify(dashboard)}\n`);
    } else {
      dependencies.stdout(
        [
          `Attempts: ${dashboard.attempts.length}`,
          `Practiced concepts: ${Object.values(dashboard.conceptStates).filter((state) => state === "practiced").length}`,
          "",
        ].join("\n"),
      );
    }
    return 0;
  }

  if (command === "reviews") {
    const result = await dependencies.platform.query({
      type: "reviews.get",
      dueOnly: flags.includes("--due"),
    });
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : result.reviews.length === 0
          ? "No scheduled Reviews\n"
          : `${result.reviews
              .map(
                (review) =>
                  `${review.status.toUpperCase()} ${review.activityId} · ${review.conceptId} · ${review.dueAt}`,
              )
              .join("\n")}\n`,
    );
    return 0;
  }

  if (command === "progress") {
    const result = await dependencies.platform.query({ type: "progress.get" });
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : result.concepts.length === 0
          ? "No Concept Evidence yet\n"
          : `${result.concepts
              .map(
                (concept) =>
                  `${concept.conceptId}: ${concept.state} — ${concept.explanation}`,
              )
              .join("\n")}\n`,
    );
    return 0;
  }

  if (command === "hint") {
    const activityId = flagValue("--activity");
    const attemptId = flagValue("--attempt");
    const hintId = flagValue("--hint");
    if (!activityId || !attemptId || !hintId) {
      dependencies.stderr(
        "Usage: cpplearn hint --activity ID --attempt ID --hint ID [--confirm-solution] [--json]\n",
      );
      return 2;
    }
    const result = await dependencies.platform.dispatch({
      type: "hint.reveal",
      commandId: `cli_${randomUUID()}`,
      activityId,
      attemptId,
      hintId,
      confirmFullSolution: flags.includes("--confirm-solution"),
    });
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : `${result.hint.title}\n\n${result.hint.content}\n`,
    );
    return 0;
  }

  if (command === "reflect") {
    const activityId = flagValue("--activity");
    const attemptId = flagValue("--attempt");
    const promptId = flagValue("--prompt");
    const answer = flagValue("--answer");
    if (!activityId || !attemptId || !promptId || !answer) {
      dependencies.stderr(
        "Usage: cpplearn reflect --activity ID --attempt ID --prompt ID --answer TEXT [--json]\n",
      );
      return 2;
    }
    const result = await dependencies.platform.dispatch({
      type: "reflection.submit",
      commandId: `cli_${randomUUID()}`,
      activityId,
      attemptId,
      answers: [{ promptId, answer }],
    });
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : "Reflection recorded\n",
    );
    return 0;
  }

  if (command === "next") {
    const minutesFlag = flags.indexOf("--minutes");
    const rawMinutes = minutesFlag >= 0 ? flags[minutesFlag + 1] : undefined;
    const minutes = rawMinutes === undefined ? undefined : Number(rawMinutes);
    if (
      minutesFlag >= 0 &&
      (minutes === undefined || !Number.isInteger(minutes) || minutes < 1)
    ) {
      dependencies.stderr("Usage: cpplearn next [--minutes N] [--json]\n");
      return 2;
    }
    const result = await dependencies.platform.query(
      minutes === undefined
        ? { type: "activity.next" }
        : { type: "activity.next", minutes },
    );
    if (!result.activity) {
      dependencies.stderr("No available Activity\n");
      return 1;
    }
    if (flags.includes("--json")) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else {
      dependencies.stdout(
        `Next Activity: ${result.activity.title} (${result.activity.id})\n`,
      );
    }
    return 0;
  }

  if (command === "check") {
    const activityFlag = flags.indexOf("--activity");
    const activityId = activityFlag >= 0 ? flags[activityFlag + 1] : undefined;
    if (!activityId) {
      dependencies.stderr("Usage: cpplearn check --activity <id> [--json]\n");
      return 2;
    }
    const checkAttemptId = flagValue("--attempt");
    const result = await dependencies.platform.dispatch({
      type: "activity.grade",
      commandId: `cli_${randomUUID()}`,
      activityId,
      ...(checkAttemptId ? { attemptId: checkAttemptId } : {}),
    });
    if (flags.includes("--json")) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else {
      dependencies.stdout(
        `Grade ${result.report.verdict}: ${activityId} (${result.jobId})\n`,
      );
    }
    return 0;
  }

  if (command === "export" && dependencies.archive) {
    const outputFlag = flags.indexOf("--output");
    const outputPath = outputFlag >= 0 ? flags[outputFlag + 1] : undefined;
    if (!outputPath) {
      dependencies.stderr("Usage: cpplearn export --output PATH [--json]\n");
      return 2;
    }
    const result = await dependencies.archive.exportTo(outputPath);
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : `Exported ${result.fileCount} files to ${outputPath}\n`,
    );
    return 0;
  }

  if (command === "restore" && dependencies.archive) {
    const inputFlag = flags.indexOf("--input");
    const inputPath = inputFlag >= 0 ? flags[inputFlag + 1] : undefined;
    if (!inputPath) {
      dependencies.stderr("Usage: cpplearn restore --input PATH [--json]\n");
      return 2;
    }
    const result = await dependencies.archive.restoreFrom(inputPath);
    dependencies.stdout(
      flags.includes("--json")
        ? `${JSON.stringify(result)}\n`
        : `Restored ${result.restoredFiles} files from ${inputPath}\n`,
    );
    return 0;
  }

  if (command === "serve" && dependencies.serve) {
    await dependencies.serve();
    return 0;
  }

  dependencies.stderr(
    "Usage: cpplearn <doctor | next | status | reviews | progress | hint | reflect | check | export | restore | serve> [options]\n",
  );
  return 2;
}
