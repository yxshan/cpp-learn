import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createNativeToolchainProbe, executeProcess } from "@cpp-learn/judge";
import {
  createFilesystemReferenceCatalog,
  createReferenceExampleVerifier,
  referenceVerificationManifestPath,
  resolveReferenceCppCompiler,
  type ReferenceVerificationManifest,
} from "@cpp-learn/reference";

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
const compiler = resolveReferenceCppCompiler();
const toolchain = await createNativeToolchainProbe({
  execute: executeProcess,
  compiler,
})();
if (!toolchain.ready || toolchain.compiler === undefined) {
  throw new Error("Reference content check failed: compiler unavailable");
}
const verifyExample = createReferenceExampleVerifier({ compiler });
const verificationExamples: ReferenceVerificationManifest["examples"][number][] =
  [];
let exampleCount = 0;

for (const entryId of entryIds) {
  const entry = await reference.getEntry(entryId);
  if (!entry) throw new Error(`Reference navigation contains ${entryId}`);
  for (const example of entry.examples) {
    exampleCount += 1;
    await verifyExample({
      identity: `${entry.id}/${example.id}`,
      example,
      source: example.source,
    });
    verificationExamples.push({
      entryId: entry.id,
      exampleId: example.id,
      sourceDigest: example.digest,
      standard: example.standard,
      verification: "verified",
    });
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
