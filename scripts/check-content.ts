import { resolve } from "node:path";

import { createFilesystemCurriculumProbe } from "@cpp-learn/curriculum";

const probe = createFilesystemCurriculumProbe({
  catalogPath: resolve("curriculum", "catalog.json"),
});
const readiness = await probe();

if (!readiness.ready) {
  throw new Error(
    `Curriculum content check failed: ${(readiness.issues ?? []).join("; ")}`,
  );
}

console.log(
  `Curriculum content check passed (${readiness.activityCount} activities).`,
);
