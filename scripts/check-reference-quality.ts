import { resolve } from "node:path";

import {
  auditReferenceCatalog,
  compareReferenceQualityBaseline,
  loadReferenceQualityBaseline,
  type ReferenceQualityFinding,
} from "./reference-content-quality.ts";

const catalogPath = resolve("reference", "catalog.json");
const baselinePath = resolve("reference", "quality-baseline.json");

function printFindings(
  label: string,
  findings: ReferenceQualityFinding[],
): void {
  if (findings.length === 0) return;
  console.error(`${label}:`);
  for (const { entryId, area } of findings) {
    console.error(`  - ${entryId}: ${area}`);
  }
}

const audit = await auditReferenceCatalog(catalogPath);
const baseline = await loadReferenceQualityBaseline(baselinePath);
const comparison = compareReferenceQualityBaseline({
  catalogVersion: audit.catalogVersion,
  findings: audit.findings,
  entryVersions: audit.entryVersions,
  baseline,
});

printFindings("New Reference quality findings", comparison.newFindings);
printFindings(
  "Resolved findings or stale not-applicable decisions still present in the baseline",
  comparison.resolvedFindings,
);

if (!comparison.catalogVersionMatches) {
  console.error(
    `Reference catalog version ${audit.catalogVersion} does not match quality baseline version ${baseline.catalogVersion}.`,
  );
}

if (
  comparison.newFindings.length > 0 ||
  comparison.resolvedFindings.length > 0 ||
  !comparison.catalogVersionMatches
) {
  process.exitCode = 1;
} else {
  console.log(
    `Reference quality gate passed: ${audit.auditedEntryCount}/${audit.totalEntryCount} entries audited, ${audit.findings.length} reviewed gaps, no regressions.`,
  );
}
