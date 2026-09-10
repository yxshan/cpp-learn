import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createNativeToolchainProbe, executeProcess } from "@cpp-learn/judge";
import {
  createFilesystemReferenceCatalog,
  createReferenceExampleVerifier,
  referenceVerificationManifestPath,
  resolveReferenceCppCompiler,
  type ReferenceVerificationManifest,
} from "@cpp-learn/reference";
import { validateReferenceVerificationManifest } from "@cpp-learn/reference-schema";

import { resolveReferenceDataRoot } from "./reference-data-root.ts";

/**
 * Verify the published Reference examples against the local toolchain.
 *
 * The full run compiles every example and takes about three minutes. `--entry`
 * and `--changed` narrow it to the Entries that actually changed so the inner
 * loop stays usable; the merge below is what makes that safe. The verification
 * manifest is cumulative evidence — overwriting it with a scoped run would
 * silently downgrade every Entry that was not re-compiled to `not-checked`.
 */

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
const allEntryIds = [
  ...new Set(navigation.categories.flatMap((category) => category.entryIds)),
];
const knownEntryIds = new Set(allEntryIds);

function flagValues(argv: readonly string[], flag: string): string[] {
  const values: string[] = [];
  argv.forEach((value, index) => {
    if (value !== flag) return;
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    values.push(next);
  });
  return values;
}

const argv = process.argv.slice(2);
const explicitEntries = flagValues(argv, "--entry");
const changed = argv.includes("--changed");
const baseFlag = argv.indexOf("--base");
const base = baseFlag >= 0 ? argv[baseFlag + 1] : undefined;
if (baseFlag >= 0 && base === undefined)
  throw new Error("--base requires a ref");

/**
 * Resolves the Entries a `--changed` run must re-verify. A change to
 * `catalog.json` can affect any Entry, so it opts out of scoping entirely.
 */
function changedEntryIds(): {
  readonly ids: Set<string>;
  readonly full: boolean;
} {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", base ?? "HEAD", "--", "reference"],
    { encoding: "utf8" },
  );
  const paths = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (paths.some((path) => path === "reference/catalog.json")) {
    return { ids: new Set(), full: true };
  }
  const ids = new Set<string>();
  for (const path of paths) {
    const match = /^reference\/entries\/([^/]+)\//u.exec(path);
    if (match?.[1] !== undefined) ids.add(match[1]);
  }
  return { ids, full: false };
}

let selectedEntryIds: readonly string[];
let scopedReason: string | undefined;
if (changed) {
  const selection = changedEntryIds();
  if (selection.full) {
    selectedEntryIds = allEntryIds;
  } else {
    selectedEntryIds = allEntryIds.filter((id) => selection.ids.has(id));
    scopedReason = `--changed selected ${selectedEntryIds.length} of ${allEntryIds.length} Entries`;
  }
} else if (explicitEntries.length > 0) {
  for (const id of explicitEntries) {
    if (!knownEntryIds.has(id)) {
      throw new Error(`--entry ${id} is not an activated Reference Entry`);
    }
  }
  selectedEntryIds = allEntryIds.filter((id) => explicitEntries.includes(id));
  scopedReason = `--entry selected ${selectedEntryIds.length} of ${allEntryIds.length} Entries`;
} else {
  selectedEntryIds = allEntryIds;
}

const compiler = resolveReferenceCppCompiler();
const toolchain = await createNativeToolchainProbe({
  execute: executeProcess,
  compiler,
})();
if (!toolchain.ready || toolchain.compiler === undefined) {
  throw new Error("Reference content check failed: compiler unavailable");
}

const dataRoot = resolveReferenceDataRoot();
const verificationPath = referenceVerificationManifestPath(dataRoot);
const isFullRun = selectedEntryIds.length === allEntryIds.length;

/**
 * Reuses the previous manifest only when it still describes this catalog and
 * this compiler; otherwise earlier evidence is worthless and the run starts from
 * an empty manifest.
 */
async function previousExamples(): Promise<
  ReferenceVerificationManifest["examples"]
> {
  if (isFullRun) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(verificationPath, "utf8")) as unknown;
  } catch {
    return [];
  }
  if (validateReferenceVerificationManifest(parsed).length > 0) return [];
  const manifest = parsed as ReferenceVerificationManifest;
  if (
    manifest.catalogVersion !== readiness.catalogVersion ||
    manifest.compilerFingerprint !== toolchain.compiler
  ) {
    return [];
  }
  return manifest.examples;
}

const selected = new Set(selectedEntryIds);
const reused = (await previousExamples()).filter(
  (record) => !selected.has(record.entryId),
);

const verifyExample = createReferenceExampleVerifier({ compiler });
const verificationExamples: ReferenceVerificationManifest["examples"][number][] =
  [...reused];
let exampleCount = 0;

for (const entryId of selectedEntryIds) {
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

const scope = scopedReason === undefined ? "" : `; ${scopedReason}`;
console.log(
  `Reference content check passed (${readiness.entryCount ?? 0} Entries, ` +
    `${exampleCount} examples compiled${scope}; manifest holds ` +
    `${verificationExamples.length} records).`,
);
