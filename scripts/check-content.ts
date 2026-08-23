import { resolve } from "node:path";

import { createHash } from "node:crypto";

import { createFilesystemCurriculum } from "@cpp-learn/curriculum";
import { createNativeJudge } from "@cpp-learn/judge";

const curriculum = createFilesystemCurriculum({
  catalogPath: resolve("curriculum", "catalog.json"),
});
const readiness = await curriculum.readiness();

if (!readiness.ready) {
  throw new Error(
    `Curriculum content check failed: ${(readiness.issues ?? []).join("; ")}`,
  );
}

const judge = createNativeJudge();
const cases = await curriculum.listVerificationCases();
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
    throw new Error(
      `Reference solution failed for ${candidate.activity.id}: ${reference.verdict}`,
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
  `Curriculum content check passed (${readiness.activityCount} activities, ${starterCount} starters, ${cases.length} references, ${mutationCount} mutations).`,
);
