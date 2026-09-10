import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { createHash } from "node:crypto";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import { createNativeJudge } from "@cpp-learn/judge";

const curriculum = createFilesystemCurriculum({
  catalogPath: resolve("curriculum", "catalog.json"),
  privateJudgePath: resolve("judge-private", "tests.json"),
});
const readiness = await curriculum.readiness();

if (!readiness.ready) {
  throw new Error(
    `Curriculum content check failed: ${(readiness.issues ?? []).join("; ")}`,
  );
}

const judge = createNativeJudge();

/**
 * Compiling every Activity's starter, reference solution and mutations takes
 * about three minutes. `--activity` and `--changed` narrow that to the
 * Activities that actually changed so the inner loop stays usable; the full run
 * remains the merge gate.
 */
const argv = process.argv.slice(2);
const flagValue = (flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
};

const explicitActivityId = flagValue("--activity");
const changed = argv.includes("--changed");
const base = flagValue("--base");
if (explicitActivityId !== undefined && changed) {
  throw new Error("--activity and --changed are mutually exclusive");
}

/**
 * A catalog or private-judge change can affect any Activity, so those opt out of
 * scoping entirely.
 */
function changedActivityIds(): {
  readonly ids: Set<string>;
  readonly full: boolean;
} {
  const output = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      base ?? "HEAD",
      "--",
      "curriculum",
      "judge-private",
    ],
    { encoding: "utf8" },
  );
  const paths = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (
    paths.some(
      (path) =>
        path === "curriculum/catalog.json" || path.startsWith("judge-private/"),
    )
  ) {
    return { ids: new Set(), full: true };
  }
  const ids = new Set<string>();
  for (const path of paths) {
    const match = /^curriculum\/activities\/([^/]+)\//u.exec(path);
    if (match?.[1] !== undefined) ids.add(match[1]);
  }
  return { ids, full: false };
}

const allCases = await curriculum.listVerificationCases();
let selectedIds: Set<string> | undefined;
let scopeNote = "";
if (changed) {
  const selection = changedActivityIds();
  if (!selection.full) {
    selectedIds = selection.ids;
    scopeNote = `; --changed selected ${selectedIds.size} of ${allCases.length} Activities`;
  }
} else if (explicitActivityId !== undefined) {
  selectedIds = new Set([explicitActivityId]);
}

const cases =
  selectedIds === undefined
    ? allCases
    : allCases.filter((candidate) => selectedIds.has(candidate.activity.id));
if (explicitActivityId !== undefined && cases.length === 0) {
  throw new Error(`Unknown Activity: ${explicitActivityId}`);
}
const workspaces = await curriculum.listWorkspaceActivities();
let mutationCount = 0;
let starterCount = 0;
for (const candidate of cases) {
  const execute = async (
    label: string,
    files: Readonly<Record<string, string>>,
  ) => {
    const digest = createHash("sha256")
      .update(JSON.stringify(files))
      .digest("hex");
    return judge.execute({
      jobId: `content_${candidate.activity.id}_${label}`,
      mode: "grade",
      activity: candidate.activity,
      spec: candidate.judge,
      snapshot: {
        id: `snap_${digest.slice(0, 20)}`,
        activityId: candidate.activity.id,
        digest,
        files,
      },
      signal: new AbortController().signal,
    });
  };
  const workspace = workspaces.find(
    (activity) => activity.activityId === candidate.activity.id,
  );
  if (!workspace)
    throw new Error(`Missing Workspace: ${candidate.activity.id}`);
  const starter = await execute("starter", workspace.starterFiles);
  starterCount += 1;
  if (
    starter.verdict === "automated_pass" ||
    starter.verdict === "judge_system_error" ||
    starter.verdict === "cancelled"
  ) {
    throw new Error(
      `Starter for ${candidate.activity.id} must be a valid unsolved case, received ${starter.verdict}`,
    );
  }
  const reference = await execute("reference", candidate.referenceFiles);
  if (reference.verdict !== "automated_pass") {
    const diagnostics = reference.stages
      .map(
        (stage) =>
          `${stage.kind}: ${stage.outcome}${stage.feedback ? ` (${stage.feedback})` : ""}`,
      )
      .join("\n");
    throw new Error(
      `Reference solution failed for ${candidate.activity.id}: ${reference.verdict}\n${diagnostics}`,
    );
  }
  for (const mutation of candidate.mutations) {
    mutationCount += 1;
    const report = await execute(`mutation_${mutation.id}`, mutation.files);
    if (report.verdict !== mutation.expectedVerdict) {
      throw new Error(
        `Mutation ${candidate.activity.id}/${mutation.id} expected ${mutation.expectedVerdict}, received ${report.verdict}`,
      );
    }
  }
}

console.log(
  `Curriculum content check passed (${readiness.activityCount} activities, ` +
    `${starterCount} starters, ${cases.length} references, ${mutationCount} ` +
    `mutations${scopeNote}).`,
);
