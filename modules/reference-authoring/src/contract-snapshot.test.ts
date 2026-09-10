import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
} from "./index.ts";

/**
 * The 16-operation facade is the compatibility contract that ADR-0007 and the
 * CLI Adapter depend on. Internal lifecycle modules may move freely behind it,
 * but this set must not change without a deliberate, reviewed decision.
 */
const OPERATIONS = [
  "advanceBatch",
  "advanceRepair",
  "advanceRun",
  "applyGeneratedExample",
  "applyGeneratedSection",
  "applyGeneratedSummary",
  "applyGenerationBundle",
  "buildContext",
  "buildGenerationTemplate",
  "buildRepairPlan",
  "check",
  "measureBatch",
  "prepare",
  "proposeSourceFacts",
  "publish",
  "reviewGeneratedClaims",
] as const;

/**
 * Published artifact schemas. `$id` is part of the on-disk contract: drafts,
 * caches, and receipts already written by an earlier release reference it.
 */
const SCHEMA_IDS = [
  "reference-authoring-batch-report.v1.json",
  "reference-authoring-batch-run.v1.json",
  "reference-authoring-catalog-proposal.v1.json",
  "reference-authoring-context-pack.v2.json",
  "reference-authoring-draft.v1.json",
  "reference-authoring-example-generation-receipt.v1.json",
  "reference-authoring-example-generation.v1.json",
  "reference-authoring-facts.v1.json",
  "reference-authoring-generated-review.v1.json",
  "reference-authoring-generation-bundle-template.v1.json",
  "reference-authoring-generation-orchestration.v1.json",
  "reference-authoring-generation-receipt.v1.json",
  "reference-authoring-generation.v1.json",
  "reference-authoring-publication-plan.v1.json",
  "reference-authoring-repair.v1.json",
  "reference-authoring-report.v1.json",
  "reference-authoring-research-proposal.v1.json",
  "reference-authoring-research-request.v1.json",
  "reference-authoring-run.v1.json",
  "reference-authoring-sources.v1.json",
  "reference-authoring-summary-generation-receipt.v1.json",
  "reference-authoring-summary-generation.v1.json",
].map((name) => `https://cpp-learn.local/schemas/${name}`);

function collectSchemaIds(directory: string): string[] {
  const ids: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      ids.push(...collectSchemaIds(join(directory, entry.name)));
      continue;
    }
    if (!entry.name.endsWith(".schema.json")) continue;
    const parsed = JSON.parse(
      readFileSync(join(directory, entry.name), "utf8"),
    ) as { $id?: unknown };
    if (typeof parsed.$id === "string") ids.push(parsed.$id);
  }
  return ids;
}

describe("[T-AUTH-017] ReferenceAuthoring public contract snapshot", () => {
  it("exposes exactly the documented sixteen operations", () => {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    });
    expect(Object.keys(authoring).sort()).toEqual([...OPERATIONS].sort());
    for (const name of OPERATIONS) {
      expect(typeof authoring[name], `${name} must be callable`).toBe(
        "function",
      );
    }
  });

  it("keeps every authoring artifact schema identifier stable", () => {
    const srcDirectory = fileURLToPath(new URL(".", import.meta.url));
    const ids = collectSchemaIds(srcDirectory).sort();
    expect(ids).toEqual([...SCHEMA_IDS].sort());
  });
});
