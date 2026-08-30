export type ReferenceEntryKind =
  | "landing"
  | "header"
  | "type"
  | "object"
  | "function"
  | "member"
  | "concept"
  | "guide";

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
  content: string;
  exampleCount: number;
  primarySourceCount: number;
  relatedEntryCount: number;
}

export interface ReferenceQualityBaseline {
  schemaVersion: 1;
  catalogVersion: number;
  knownGaps: ReferenceQualityFinding[];
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
}

interface CatalogFile {
  version: number;
  entries: string[];
}

interface EntryFile {
  id: string;
  kind: ReferenceEntryKind;
  relatedEntryIds: string[];
  content: { path: string };
  examples: unknown[];
  sources: { kind: string }[];
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

function markdownHeadings(content: string): string[] {
  return content
    .split("\n")
    .map((line) => /^#{2,3}\s+(.+)$/u.exec(line)?.[1]?.trim())
    .filter((heading): heading is string => heading !== undefined);
}

function hasHeading(headings: string[], area: TextArea): boolean {
  return headings.some((heading) => headingPatterns[area].test(heading));
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
  const headings = markdownHeadings(input.content);
  const missing: ReferenceQualityArea[] = [];
  const requiredAreas: TextArea[] = ["quick-info", "selection", "mistakes"];

  for (const area of requiredAreas) {
    if (!hasHeading(headings, area)) missing.push(area);
  }

  const directsReadersToInclude =
    /(?:显式|直接)[^。\n]{0,40}(?:包含|#include)|#include\s*<[^>]+>/u.test(
      input.content,
    );
  const rejectsTransitiveIncludes =
    /传递包含|间接[^。\n]{0,20}包含|偶然[^。\n]{0,20}(?:包含|带入|暴露)|顺带[^。\n]{0,20}(?:声明|包含)|不要依赖[^。\n]{0,30}包含/u.test(
      input.content,
    );
  if (!(directsReadersToInclude && rejectsTransitiveIncludes)) {
    missing.push("direct-include");
  }

  const hasFacilityHeading = headings.some((heading) =>
    /主要实体|主要设施|设施与|设施地图/u.test(heading),
  );
  const hasMarkdownTable = /^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+/mu.test(
    input.content,
  );
  if (!(hasFacilityHeading && hasMarkdownTable)) missing.push("facility-map");

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
  baseline,
}: {
  catalogVersion: number;
  findings: ReferenceQualityFinding[];
  baseline: ReferenceQualityBaseline;
}): ReferenceQualityBaselineComparison {
  const currentKeys = new Set(findings.map(findingKey));
  const baselineKeys = new Set(baseline.knownGaps.map(findingKey));

  return {
    newFindings: sortFindings(
      findings.filter((finding) => !baselineKeys.has(findingKey(finding))),
    ),
    resolvedFindings: sortFindings(
      baseline.knownGaps.filter(
        (finding) => !currentKeys.has(findingKey(finding)),
      ),
    ),
    catalogVersionMatches: baseline.catalogVersion === catalogVersion,
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function auditReferenceCatalog(
  catalogPath: string,
): Promise<ReferenceQualityAudit> {
  const absoluteCatalogPath = resolve(catalogPath);
  const referenceRoot = dirname(absoluteCatalogPath);
  const catalog = await readJson<CatalogFile>(absoluteCatalogPath);
  const findings: ReferenceQualityFinding[] = [];
  let auditedEntryCount = 0;

  for (const entryPath of catalog.entries) {
    const entry = await readJson<EntryFile>(resolve(referenceRoot, entryPath));
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
  };
}

export async function loadReferenceQualityBaseline(
  baselinePath: string,
): Promise<ReferenceQualityBaseline> {
  return readJson<ReferenceQualityBaseline>(resolve(baselinePath));
}
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
