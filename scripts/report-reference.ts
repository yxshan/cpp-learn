import { resolve } from "node:path";

import {
  DEFAULT_NATIVE_CPP_COMPILER,
  createNativeToolchainProbe,
  executeProcess,
} from "@cpp-learn/judge";
import {
  createFilesystemReferenceCatalog,
  createReferenceCoverageReport,
  referenceVerificationManifestPath,
} from "@cpp-learn/reference";

import { resolveReferenceDataRoot } from "./reference-data-root.ts";
import {
  auditReferenceCatalog,
  loadReferenceQualityBaseline,
} from "./reference-content-quality.ts";

const compiler = DEFAULT_NATIVE_CPP_COMPILER;
const toolchain = await createNativeToolchainProbe({
  execute: executeProcess,
  compiler,
})();
const dataRoot = resolveReferenceDataRoot();
const reference = createFilesystemReferenceCatalog({
  catalogPath: resolve("reference", "catalog.json"),
  ...(toolchain.ready && toolchain.compiler !== undefined
    ? {
        verification: {
          manifestPath: referenceVerificationManifestPath(dataRoot),
          compilerFingerprint: toolchain.compiler,
        },
      }
    : {}),
});
const report = await createReferenceCoverageReport(reference);
const qualityAudit = await auditReferenceCatalog(
  resolve("reference", "catalog.json"),
);
const qualityBaseline = await loadReferenceQualityBaseline(
  resolve("reference", "quality-baseline.json"),
);

console.log(
  JSON.stringify(
    {
      ...report,
      quality: {
        auditedEntryCount: qualityAudit.auditedEntryCount,
        skippedEntryCount: qualityAudit.skippedEntryCount,
        entriesWithFindings: qualityAudit.entriesWithFindings,
        knownGapCount: qualityBaseline.knownGaps.length,
        findingsByArea: qualityAudit.findingsByArea,
      },
    },
    undefined,
    2,
  ),
);
