import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { CppStandard } from "@cpp-learn/contracts";
import { runBoundedProcess } from "@cpp-learn/judge";
import { createFilesystemReferenceCatalog } from "@cpp-learn/reference";

const standardFlag: Readonly<Record<CppStandard, string>> = {
  "c++98": "c++98",
  "c++03": "c++03",
  "c++11": "c++11",
  "c++14": "c++14",
  "c++17": "c++17",
  "c++20": "c++20",
  "c++23": "c++23",
  "c++26-draft": "c++2c",
};

const reference = createFilesystemReferenceCatalog({
  catalogPath: resolve("reference", "catalog.json"),
});
const readiness = await reference.readiness();
if (!readiness.ready) {
  throw new Error(
    `Reference content check failed: ${(readiness.issueCodes ?? []).join(", ")}`,
  );
}

const navigation = await reference.getNavigation();
const entryIds = [
  ...new Set(navigation.categories.flatMap((category) => category.entryIds)),
];
const compiler = "/usr/bin/clang++";
const environment = {
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
};
let exampleCount = 0;

for (const entryId of entryIds) {
  const entry = await reference.getEntry(entryId);
  if (!entry) throw new Error(`Reference navigation contains ${entryId}`);
  for (const example of entry.examples) {
    exampleCount += 1;
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-reference-"));
    try {
      const sourcePath = join(root, `${entry.id}-${example.id}.cpp`);
      const outputPath = join(root, "example");
      await writeFile(sourcePath, example.source, "utf8");
      const compilation = await runBoundedProcess({
        executable: compiler,
        args: [
          `-std=${standardFlag[example.standard]}`,
          "-Wall",
          "-Wextra",
          "-Wpedantic",
          "-Werror",
          sourcePath,
          "-o",
          outputPath,
        ],
        cwd: root,
        timeoutMs: 10_000,
        maxOutputBytes: 64 * 1024,
        environment: { ...environment, TMPDIR: root },
      });

      if (example.kind === "expected-compile-failure") {
        if (compilation.exitCode === 0) {
          throw new Error(`${entry.id}/${example.id} unexpectedly compiled`);
        }
        if (
          example.expectedDiagnosticCategory &&
          !compilation.stderr
            .toLocaleLowerCase("en-US")
            .includes(
              example.expectedDiagnosticCategory.toLocaleLowerCase("en-US"),
            )
        ) {
          throw new Error(
            `${entry.id}/${example.id} missed diagnostic category ${example.expectedDiagnosticCategory}`,
          );
        }
        continue;
      }
      if (
        compilation.exitCode !== 0 ||
        compilation.timedOut ||
        compilation.outputLimitExceeded
      ) {
        throw new Error(
          `${entry.id}/${example.id} failed to compile:\n${compilation.stderr}`,
        );
      }
      if (example.kind === "run") {
        const execution = await runBoundedProcess({
          executable: outputPath,
          args: [],
          cwd: root,
          timeoutMs: 2_000,
          maxOutputBytes: 64 * 1024,
          environment: { ...environment, TMPDIR: root },
          ...(example.stdin === undefined ? {} : { stdin: example.stdin }),
        });
        if (
          execution.exitCode !== 0 ||
          execution.timedOut ||
          execution.outputLimitExceeded ||
          execution.stdout !== example.expectedStdout
        ) {
          throw new Error(
            `${entry.id}/${example.id} produced an invalid result:\n${execution.stderr}${execution.stdout}`,
          );
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

console.log(
  `Reference content check passed (${readiness.entryCount ?? 0} Entries, ${exampleCount} examples).`,
);
