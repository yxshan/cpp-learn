import type { LearningPlatform } from "@cpp-learn/contracts";

export interface CliDependencies {
  readonly argv: readonly string[];
  readonly platform: LearningPlatform;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

function formatDoctorReport(
  report: Awaited<ReturnType<LearningPlatform["query"]>>,
): string {
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

  if (command !== "doctor") {
    dependencies.stderr("Usage: cpplearn doctor [--json]\n");
    return 2;
  }

  const report = await dependencies.platform.query({ type: "bootstrap.get" });
  if (flags.includes("--json")) {
    dependencies.stdout(`${JSON.stringify(report)}\n`);
  } else {
    dependencies.stdout(formatDoctorReport(report));
  }

  return report.ready ? 0 : 3;
}
