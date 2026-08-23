import { randomUUID } from "node:crypto";

import type { BootstrapResult, LearningPlatform } from "@cpp-learn/contracts";

export interface CliDependencies {
  readonly argv: readonly string[];
  readonly platform: LearningPlatform;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly serve?: () => Promise<void>;
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

  if (command === "next") {
    const result = await dependencies.platform.query({ type: "activity.next" });
    if (!result.activity) {
      dependencies.stderr("No available Activity\n");
      return 5;
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
    const result = await dependencies.platform.dispatch({
      type: "activity.grade",
      commandId: `cli_${randomUUID()}`,
      activityId,
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

  if (command === "serve" && dependencies.serve) {
    await dependencies.serve();
    return 0;
  }

  dependencies.stderr(
    "Usage: cpplearn <doctor [--json] | next [--json] | status [--json] | check --activity <id> [--json] | serve>\n",
  );
  return 2;
}
