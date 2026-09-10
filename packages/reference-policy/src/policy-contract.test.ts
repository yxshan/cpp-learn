import { describe, expect, it } from "vitest";

import type { ReferenceEntryKind } from "@cpp-learn/contracts";

import {
  entryKindPolicy,
  headingMatchesArea,
  REPAIR_HEADINGS_BY_AREA,
  repairableHeadings,
  SEMANTIC_AREA_ORDER,
  type HeadingAreaId,
  type SemanticAreaId,
} from "./index.ts";

const ALL_KINDS: readonly ReferenceEntryKind[] = [
  "landing",
  "header",
  "type",
  "object",
  "function",
  "member",
  "concept",
  "guide",
];

/**
 * These two directions are the contract between "the gate says area X is
 * missing" and "repair writes a heading for area X". Breaking either one
 * produces a finding a human must fix by hand, or an infinite repair loop —
 * exactly the class of defect that motivated extracting this package.
 */
describe("[T-REF-013] quality policy and repair planner agree", () => {
  it("every repairable heading is accepted by the area matcher", () => {
    const mismatches: string[] = [];
    for (const [area, headings] of Object.entries(REPAIR_HEADINGS_BY_AREA)) {
      for (const heading of headings ?? []) {
        if (!headingMatchesArea(area as HeadingAreaId, heading)) {
          mismatches.push(`${area} <- "${heading}"`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("every required area has at least one repairable heading", () => {
    const required = new Set<SemanticAreaId>();
    for (const kind of ALL_KINDS) {
      const policy = entryKindPolicy(kind);
      if (!policy.audited) continue;
      for (const area of policy.requiredAreas) required.add(area);
      for (const area of policy.dedicatedRules) required.add(area);
    }

    const unfixable = [...required]
      .filter(
        (area) =>
          area !== "examples" &&
          area !== "related" &&
          area !== "sources" &&
          repairableHeadings(area).length === 0,
      )
      .sort();
    expect(unfixable).toEqual([]);
  });

  it("keeps every area either heading-driven or metadata-driven", () => {
    const metadataAreas: readonly SemanticAreaId[] = [
      "examples",
      "related",
      "sources",
    ];
    const headingAreas = SEMANTIC_AREA_ORDER.filter(
      (area) => !metadataAreas.includes(area),
    );
    // Every heading-driven area must have a matcher and a canonical heading.
    for (const area of headingAreas) {
      const headingArea = area as HeadingAreaId;
      const canonical = repairableHeadings(headingArea)[0] ?? "";
      expect(
        headingMatchesArea(headingArea, canonical),
        `${area} must have a matcher and a canonical heading`,
      ).toBe(true);
    }
  });
});
