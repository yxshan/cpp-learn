import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ReferenceEntryKind } from "@cpp-learn/contracts";
import type {
  ReferenceCatalogManifest,
  ReferenceEntryManifest,
} from "@cpp-learn/reference";
import {
  validateReferenceCatalogManifest,
  validateReferenceEntryManifest,
} from "@cpp-learn/reference-schema";

export type ReferenceQualityArea =
  | "quick-info"
  | "selection"
  | "interface"
  | "parameters"
  | "returns"
  | "complexity"
  | "errors"
  | "lifetime"
  | "examples"
  | "mistakes"
  | "javascript"
  | "related"
  | "sources"
  | "direct-include"
  | "facility-map";

export interface ReferenceQualityFinding {
  entryId: string;
  area: ReferenceQualityArea;
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

export interface ReferenceQualityBaseline {
  schemaVersion: 1;
  catalogVersion: number;
  review: {
    id: string;
    reviewedAt: string;
    fixedPoint: string;
    scope: string;
  };
  acceptedEntryVersions: Record<string, number>;
  knownGaps: ReferenceQualityFinding[];
  notApplicable: (ReferenceQualityFinding & {
    reason: string;
    reviewedAt: string;
  })[];
}

export interface ReferenceQualityBaselineComparison {
  newFindings: ReferenceQualityFinding[];
  resolvedFindings: ReferenceQualityFinding[];
  catalogVersionMatches: boolean;
}

export interface ReferenceQualityAudit {
  catalogVersion: number;
  totalEntryCount: number;
  auditedEntryCount: number;
  skippedEntryCount: number;
  findings: ReferenceQualityFinding[];
  findingsByArea: Partial<Record<ReferenceQualityArea, number>>;
  entriesWithFindings: number;
  entryVersions: Record<string, number>;
}

type TextArea = Exclude<
  ReferenceQualityArea,
  "examples" | "related" | "sources" | "direct-include" | "facility-map"
>;

const headingPatterns: Record<TextArea, RegExp> = {
  "quick-info": /快速信息/u,
  selection: /什么时候|何时|选择|适用|使用场景|用途/u,
  interface: /声明|重载|接口|主要操作|基本模型|主要实体|设施|观察|成员/u,
  parameters: /参数|约束|前置条件|输入|范围要求|调用条件/u,
  returns: /返回|结果/u,
  complexity: /复杂度/u,
  errors: /异常|错误|失败|未定义行为|前提/u,
  lifetime: /生命周期|失效|所有权|引用|迭代器|线程安全|并发|控制块/u,
  mistakes: /常见错误|常见误区|误区/u,
  javascript: /JavaScript|TypeScript/u,
};

const areaOrder: ReferenceQualityArea[] = [
  "quick-info",
  "selection",
  "interface",
  "parameters",
  "returns",
  "complexity",
  "errors",
  "lifetime",
  "direct-include",
  "facility-map",
  "examples",
  "mistakes",
  "javascript",
  "related",
  "sources",
];

const commonSemanticAreas: TextArea[] = [
  "quick-info",
  "selection",
  "interface",
  "complexity",
  "errors",
  "lifetime",
  "mistakes",
  "javascript",
];

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

function markdownHeadings(content: string): string[] {
  return markdownSections(content).map(({ heading }) => heading);
}

function hasHeading(headings: string[], area: TextArea): boolean {
  return headings.some((heading) => headingPatterns[area].test(heading));
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

function findingKey(finding: ReferenceQualityFinding): string {
  return `${finding.entryId}\u0000${finding.area}`;
}

function sortFindings(
  findings: ReferenceQualityFinding[],
): ReferenceQualityFinding[] {
  return [...findings].sort(
    (left, right) =>
      left.entryId.localeCompare(right.entryId) ||
      areaOrder.indexOf(left.area) - areaOrder.indexOf(right.area),
  );
}

function auditCommonMetadata(
  input: ReferenceQualityInput,
  minimumExamples: number,
): ReferenceQualityArea[] {
  const missing: ReferenceQualityArea[] = [];
  if (input.exampleCount < minimumExamples) missing.push("examples");
  if (input.relatedEntryCount < 2) missing.push("related");
  if (input.primarySourceCount < 1) missing.push("sources");
  return missing;
}

function auditHeader(input: ReferenceQualityInput): ReferenceQualityArea[] {
  const sections = markdownSections(input.content);
  const headings = sections.map(({ heading }) => heading);
  const missing: ReferenceQualityArea[] = [];
  const requiredAreas: TextArea[] = ["quick-info", "selection", "mistakes"];

  for (const area of requiredAreas) {
    if (!hasHeading(headings, area)) missing.push(area);
  }

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

  missing.push(...auditCommonMetadata(input, 1));
  return missing;
}

export function auditReferenceContent(
  input: ReferenceQualityInput,
): ReferenceQualityFinding[] {
  if (input.kind === "landing" || input.kind === "guide") return [];

  if (input.kind === "header") {
    return sortFindings(
      auditHeader(input).map((area) => ({ entryId: input.id, area })),
    );
  }

  const headings = markdownHeadings(input.content);
  const requiredAreas = [...commonSemanticAreas];
  if (input.kind === "function" || input.kind === "member") {
    requiredAreas.splice(3, 0, "parameters", "returns");
  }

  const missing: ReferenceQualityArea[] = requiredAreas.filter(
    (area) => !hasHeading(headings, area),
  );
  missing.push(...auditCommonMetadata(input, 2));

  return sortFindings(missing.map((area) => ({ entryId: input.id, area })));
}

export function compareReferenceQualityBaseline({
  catalogVersion,
  findings,
  entryVersions,
  baseline,
}: {
  catalogVersion: number;
  findings: ReferenceQualityFinding[];
  entryVersions: Readonly<Record<string, number>>;
  baseline: ReferenceQualityBaseline;
}): ReferenceQualityBaselineComparison {
  const currentKeys = new Set(findings.map(findingKey));
  const reviewedFindings = [
    ...baseline.knownGaps,
    ...baseline.notApplicable.map(({ entryId, area }) => ({ entryId, area })),
  ];
  const baselineKeys = new Set(
    reviewedFindings
      .filter(
        ({ entryId }) =>
          baseline.acceptedEntryVersions[entryId] === entryVersions[entryId],
      )
      .map(findingKey),
  );

  return {
    newFindings: sortFindings(
      findings.filter((finding) => !baselineKeys.has(findingKey(finding))),
    ),
    resolvedFindings: sortFindings(
      reviewedFindings.filter(
        (finding) =>
          !currentKeys.has(findingKey(finding)) ||
          baseline.acceptedEntryVersions[finding.entryId] !==
            entryVersions[finding.entryId],
      ),
    ),
    catalogVersionMatches: baseline.catalogVersion === catalogVersion,
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFinding(value: unknown, label: string): ReferenceQualityFinding {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const { entryId, area } = value;
  if (
    typeof entryId !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entryId)
  ) {
    throw new Error(`${label}.entryId is invalid`);
  }
  if (
    typeof area !== "string" ||
    !areaOrder.includes(area as ReferenceQualityArea)
  ) {
    throw new Error(`${label}.area is invalid`);
  }
  return { entryId, area: area as ReferenceQualityArea };
}

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parseDate(value: unknown, label: string): string {
  const date = parseNonEmptyString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  return date;
}

export function parseReferenceQualityBaseline(
  value: unknown,
): ReferenceQualityBaseline {
  if (!isRecord(value)) throw new Error("quality baseline must be an object");
  if (value["schemaVersion"] !== 1) {
    throw new Error("quality baseline schemaVersion must be 1");
  }
  const catalogVersion = value["catalogVersion"];
  if (!Number.isInteger(catalogVersion) || (catalogVersion as number) < 1) {
    throw new Error(
      "quality baseline catalogVersion must be a positive integer",
    );
  }
  const reviewValue = value["review"];
  if (!isRecord(reviewValue))
    throw new Error("quality baseline review is required");
  const fixedPoint = parseNonEmptyString(
    reviewValue["fixedPoint"],
    "review.fixedPoint",
  );
  if (!/^[0-9a-f]{7,40}$/u.test(fixedPoint)) {
    throw new Error("review.fixedPoint must be a Git commit ID");
  }
  const knownGapValues = value["knownGaps"];
  const notApplicableValues = value["notApplicable"];
  const acceptedVersionValues = value["acceptedEntryVersions"];
  if (!Array.isArray(knownGapValues) || !Array.isArray(notApplicableValues)) {
    throw new Error("quality baseline findings must be arrays");
  }
  if (!isRecord(acceptedVersionValues)) {
    throw new Error("quality baseline acceptedEntryVersions is required");
  }
  const knownGaps = knownGapValues.map((finding, index) =>
    parseFinding(finding, `knownGaps[${index}]`),
  );
  const notApplicable = notApplicableValues.map((decision, index) => {
    const finding = parseFinding(decision, `notApplicable[${index}]`);
    if (!isRecord(decision))
      throw new Error("notApplicable decision is invalid");
    return {
      ...finding,
      reason: parseNonEmptyString(
        decision["reason"],
        `notApplicable[${index}].reason`,
      ),
      reviewedAt: parseDate(
        decision["reviewedAt"],
        `notApplicable[${index}].reviewedAt`,
      ),
    };
  });
  const knownKeys = new Set<string>();
  for (const finding of knownGaps) {
    const key = findingKey(finding);
    if (knownKeys.has(key))
      throw new Error(`duplicate knownGap: ${finding.entryId}:${finding.area}`);
    knownKeys.add(key);
  }
  const notApplicableKeys = new Set<string>();
  for (const decision of notApplicable) {
    const key = findingKey(decision);
    if (notApplicableKeys.has(key)) {
      throw new Error(
        `duplicate notApplicable decision: ${decision.entryId}:${decision.area}`,
      );
    }
    if (knownKeys.has(key)) {
      throw new Error(
        `${decision.entryId}:${decision.area} cannot be both knownGap and notApplicable`,
      );
    }
    notApplicableKeys.add(key);
  }
  const reviewedEntryIds = new Set(
    [...knownGaps, ...notApplicable].map(({ entryId }) => entryId),
  );
  const acceptedEntryVersions: Record<string, number> = {};
  for (const [entryId, version] of Object.entries(acceptedVersionValues)) {
    if (!reviewedEntryIds.has(entryId)) {
      throw new Error(
        `acceptedEntryVersions contains unreviewed Entry: ${entryId}`,
      );
    }
    if (!Number.isInteger(version) || (version as number) < 1) {
      throw new Error(
        `acceptedEntryVersions.${entryId} must be a positive integer`,
      );
    }
    acceptedEntryVersions[entryId] = version as number;
  }
  for (const entryId of reviewedEntryIds) {
    if (acceptedEntryVersions[entryId] === undefined) {
      throw new Error(`acceptedEntryVersions is missing ${entryId}`);
    }
  }

  return {
    schemaVersion: 1,
    catalogVersion: catalogVersion as number,
    review: {
      id: parseNonEmptyString(reviewValue["id"], "review.id"),
      reviewedAt: parseDate(reviewValue["reviewedAt"], "review.reviewedAt"),
      fixedPoint,
      scope: parseNonEmptyString(reviewValue["scope"], "review.scope"),
    },
    acceptedEntryVersions,
    knownGaps,
    notApplicable,
  };
}

export async function auditReferenceCatalog(
  catalogPath: string,
): Promise<ReferenceQualityAudit> {
  const absoluteCatalogPath = resolve(catalogPath);
  const referenceRoot = dirname(absoluteCatalogPath);
  const rawCatalog = await readJson(absoluteCatalogPath);
  const catalogIssues = validateReferenceCatalogManifest(rawCatalog);
  if (catalogIssues.length > 0) {
    throw new Error("Reference catalog schema is invalid for quality audit");
  }
  const catalog = rawCatalog as ReferenceCatalogManifest;
  const findings: ReferenceQualityFinding[] = [];
  const entryVersions: Record<string, number> = {};
  let auditedEntryCount = 0;

  for (const entryPath of catalog.entries) {
    const rawEntry = await readJson(resolve(referenceRoot, entryPath));
    const entryIssues = validateReferenceEntryManifest(rawEntry);
    if (entryIssues.length > 0) {
      throw new Error(`${entryPath} schema is invalid for quality audit`);
    }
    const entry = rawEntry as ReferenceEntryManifest;
    entryVersions[entry.id] = entry.version;
    if (entry.kind === "landing" || entry.kind === "guide") continue;

    auditedEntryCount += 1;
    const content = await readFile(
      resolve(referenceRoot, entry.content.path),
      "utf8",
    );
    findings.push(
      ...auditReferenceContent({
        id: entry.id,
        kind: entry.kind,
        ...(entry.header === undefined ? {} : { header: entry.header }),
        content,
        exampleCount: entry.examples.length,
        primarySourceCount: entry.sources.filter(
          ({ kind }) => kind === "primary",
        ).length,
        relatedEntryCount: entry.relatedEntryIds.length,
      }),
    );
  }

  const sortedFindings = sortFindings(findings);
  const findingsByArea: Partial<Record<ReferenceQualityArea, number>> = {};
  for (const { area } of sortedFindings) {
    findingsByArea[area] = (findingsByArea[area] ?? 0) + 1;
  }

  return {
    catalogVersion: catalog.version,
    totalEntryCount: catalog.entries.length,
    auditedEntryCount,
    skippedEntryCount: catalog.entries.length - auditedEntryCount,
    findings: sortedFindings,
    findingsByArea,
    entriesWithFindings: new Set(sortedFindings.map(({ entryId }) => entryId))
      .size,
    entryVersions,
  };
}

export async function loadReferenceQualityBaseline(
  baselinePath: string,
): Promise<ReferenceQualityBaseline> {
  return parseReferenceQualityBaseline(await readJson(resolve(baselinePath)));
}
