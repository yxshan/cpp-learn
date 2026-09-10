import type { ReferenceEntryKind } from "@cpp-learn/contracts";

import {
  entryKindPolicy,
  headingMatchesArea,
  SEMANTIC_AREA_ORDER,
  type HeadingAreaId,
  type SemanticAreaId,
} from "./areas.ts";

export interface ReferenceQualityFinding {
  entryId: string;
  area: SemanticAreaId;
}

export interface ReferenceQualityInput {
  id: string;
  kind: ReferenceEntryKind;
  header?: string;
  content: string;
  exampleCount: number;
  primarySourceCount: number;
  relatedEntryCount: number;
}

interface MarkdownSection {
  heading: string;
  body: string;
}

function markdownSections(content: string): MarkdownSection[] {
  const matches = [...content.matchAll(/^#{2,3}\s+(.+)$/gmu)];
  return matches.map((match, index) => ({
    heading: match[1]?.trim() ?? "",
    body: content.slice(
      (match.index ?? 0) + match[0].length,
      matches[index + 1]?.index ?? content.length,
    ),
  }));
}

function hasHeading(headings: readonly string[], area: HeadingAreaId): boolean {
  return headings.some((heading) => headingMatchesArea(area, heading));
}

function markdownTable(
  body: string,
): { headers: string[]; rows: string[][] } | undefined {
  const lines = body.split("\n");
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];
    if (
      headerLine === undefined ||
      separatorLine === undefined ||
      !/^\|.*\|$/u.test(headerLine) ||
      !/^\|(?:\s*:?-+:?\s*\|)+$/u.test(separatorLine)
    ) {
      continue;
    }
    const cells = (line: string): string[] =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
    const rows: string[][] = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex];
      if (row === undefined || !/^\|.*\|$/u.test(row)) break;
      rows.push(cells(row));
    }
    return { headers: cells(headerLine), rows };
  }
  return undefined;
}

export function sortReferenceQualityFindings(
  findings: readonly ReferenceQualityFinding[],
): ReferenceQualityFinding[] {
  return [...findings].sort(
    (left, right) =>
      left.entryId.localeCompare(right.entryId) ||
      SEMANTIC_AREA_ORDER.indexOf(left.area) -
        SEMANTIC_AREA_ORDER.indexOf(right.area),
  );
}

function auditCommonMetadata(
  input: ReferenceQualityInput,
  minimumExamples: number,
): SemanticAreaId[] {
  const missing: SemanticAreaId[] = [];
  if (input.exampleCount < minimumExamples) missing.push("examples");
  if (input.relatedEntryCount < 2) missing.push("related");
  if (input.primarySourceCount < 1) missing.push("sources");
  return missing;
}

/**
 * Header Entries are read as navigation pages, so they must additionally tell
 * the reader to include the header directly and must map their facilities with
 * a version column.
 */
function auditHeaderDedicatedRules(
  input: ReferenceQualityInput,
  sections: readonly MarkdownSection[],
): SemanticAreaId[] {
  const missing: SemanticAreaId[] = [];

  const inclusionSection = sections.find(({ heading }) =>
    /直接包含|什么时候包含/u.test(heading),
  );
  const ownHeader = input.header;
  const ownsHeaderDirective =
    ownHeader !== undefined &&
    inclusionSection?.body.includes(`#include ${ownHeader}`) === true;
  const namesOwnHeader =
    ownHeader !== undefined &&
    inclusionSection?.body.includes(ownHeader) === true;
  const directsReadersToInclude =
    inclusionSection !== undefined &&
    (ownsHeaderDirective ||
      (namesOwnHeader &&
        /(?:(?:应|必须|需要|请)[^。\n]{0,40})?(?:显式|直接)包含|(?:应|必须|需要|请)[^。\n]{0,40}包含/u.test(
          inclusionSection.body,
        )));
  const rejectsTransitiveIncludes =
    inclusionSection !== undefined &&
    /传递包含|间接[^。\n]{0,20}(?:包含|提供|声明)|偶然[^。\n]{0,20}(?:包含|带入|暴露)|顺带[^。\n]{0,20}(?:声明|包含)|不要依赖[^。\n]{0,30}包含/u.test(
      inclusionSection.body,
    );
  if (!(directsReadersToInclude && rejectsTransitiveIncludes)) {
    missing.push("direct-include");
  }

  const facilitySection = sections.find(({ heading }) =>
    /主要实体|主要设施|设施与|设施地图/u.test(heading),
  );
  const facilityTable =
    facilitySection === undefined
      ? undefined
      : markdownTable(facilitySection.body);
  const versionColumn = facilityTable?.headers.findIndex((header) =>
    /版本|标准/u.test(header),
  );
  const everyFacilityHasVersion =
    versionColumn !== undefined &&
    versionColumn >= 0 &&
    facilityTable !== undefined &&
    facilityTable.rows.length > 0 &&
    facilityTable.rows.every((row) =>
      /C\+\+(?:98|03|11|14|17|20|23|26)/u.test(row[versionColumn] ?? ""),
    );
  if (!everyFacilityHasVersion) {
    missing.push("facility-map");
  }

  return missing;
}

/**
 * Evaluates one Entry against its kind policy. Pure: no filesystem, no catalog,
 * no clock. Every consumer that needs "is this area covered" answers it here.
 */
export function auditReferenceContent(
  input: ReferenceQualityInput,
): ReferenceQualityFinding[] {
  const policy = entryKindPolicy(input.kind);
  if (!policy.audited) return [];

  const sections = markdownSections(input.content);
  const headings = sections.map(({ heading }) => heading);
  const missing: SemanticAreaId[] = [];

  for (const area of policy.requiredAreas) {
    if (area === "direct-include" || area === "facility-map") continue;
    if (!hasHeading(headings, area as HeadingAreaId)) missing.push(area);
  }

  if (policy.dedicatedRules.length > 0) {
    missing.push(...auditHeaderDedicatedRules(input, sections));
  }

  missing.push(...auditCommonMetadata(input, policy.minimumExamples));

  return sortReferenceQualityFindings(
    missing.map((area) => ({ entryId: input.id, area })),
  );
}
