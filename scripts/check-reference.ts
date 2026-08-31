import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { CppStandard } from "@cpp-learn/contracts";
import {
  DEFAULT_NATIVE_CPP_COMPILER,
  createNativeToolchainProbe,
  executeProcess,
  runBoundedProcess,
} from "@cpp-learn/judge";
import {
  createFilesystemReferenceCatalog,
  referenceVerificationManifestPath,
  type ReferenceVerificationManifest,
} from "@cpp-learn/reference";

import {
  assertReferenceCompilationAccepted,
  resolveReferenceCompilerStandardFlag,
} from "./reference-example-verification.ts";
import { resolveReferenceDataRoot } from "./reference-data-root.ts";

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
const compiler = DEFAULT_NATIVE_CPP_COMPILER;
const environment = {
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
};
const toolchain = await createNativeToolchainProbe({
  execute: executeProcess,
  compiler,
})();
if (!toolchain.ready || toolchain.compiler === undefined) {
  throw new Error("Reference content check failed: compiler unavailable");
}
const compilerStandardFlags = new Map<CppStandard, string>();
const compilerStandardFlagFor = async (
  standard: CppStandard,
): Promise<string> => {
  const cached = compilerStandardFlags.get(standard);
  if (cached !== undefined) return cached;

  const selected = await resolveReferenceCompilerStandardFlag({
    standard,
    probe: async (candidate) => {
      const root = await mkdtemp(join(tmpdir(), "cpp-learn-standard-probe-"));
      try {
        const sourcePath = join(root, "probe.cpp");
        await writeFile(sourcePath, "int main() { return 0; }\n", "utf8");
        const result = await runBoundedProcess({
          executable: compiler,
          args: [`-std=${candidate}`, "-fsyntax-only", sourcePath],
          cwd: root,
          timeoutMs: 10_000,
          maxOutputBytes: 64 * 1024,
          environment: { ...environment, TMPDIR: root },
        });
        return (
          result.exitCode === 0 &&
          !result.timedOut &&
          !result.outputLimitExceeded
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  });
  compilerStandardFlags.set(standard, selected);
  return selected;
};
const verificationExamples: ReferenceVerificationManifest["examples"][number][] =
  [];
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
      const compilerStandardFlag = await compilerStandardFlagFor(
        example.standard,
      );
      const compilation = await runBoundedProcess({
        executable: compiler,
        args: [
          `-std=${compilerStandardFlag}`,
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

      assertReferenceCompilationAccepted({
        identity: `${entry.id}/${example.id}`,
        kind: example.kind,
        ...(example.expectedDiagnosticCategory === undefined
          ? {}
          : {
              expectedDiagnosticCategory: example.expectedDiagnosticCategory,
            }),
        compilation,
      });

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
      verificationExamples.push({
        entryId: entry.id,
        exampleId: example.id,
        sourceDigest: example.digest,
        standard: example.standard,
        verification: "verified",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

const verificationManifest: ReferenceVerificationManifest = {
  schemaVersion: 1,
  catalogVersion: readiness.catalogVersion,
  compilerFingerprint: toolchain.compiler,
  examples: verificationExamples,
};
const dataRoot = resolveReferenceDataRoot();
const verificationPath = referenceVerificationManifestPath(dataRoot);
const temporaryVerificationPath = join(
  dataRoot,
  `.reference-verification-${process.pid}.tmp`,
);
await mkdir(dirname(verificationPath), { recursive: true });
try {
  await writeFile(
    temporaryVerificationPath,
    `${JSON.stringify(verificationManifest, undefined, 2)}\n`,
    "utf8",
  );
  await rename(temporaryVerificationPath, verificationPath);
} finally {
  await rm(temporaryVerificationPath, { force: true });
}

console.log(
  `Reference content check passed (${readiness.entryCount ?? 0} Entries, ${exampleCount} examples; local verification cached).`,
);
