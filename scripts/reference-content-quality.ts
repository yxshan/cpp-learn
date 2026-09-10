import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  ReferenceCatalogManifest,
  ReferenceEntryManifest,
} from "@cpp-learn/reference";
import {
  auditReferenceContent,
  SEMANTIC_AREA_ORDER,
  sortReferenceQualityFindings,
  type ReferenceQualityFinding,
  type SemanticAreaId,
} from "@cpp-learn/reference-policy";
import {
  validateReferenceCatalogManifest,
  validateReferenceEntryManifest,
} from "@cpp-learn/reference-schema";

/**
 * The quality *policy* — semantic areas, heading aliases, and per-kind
 * requirements — lives in `@cpp-learn/reference-policy` so that the quality
 * gate, the authoring scaffolder, and the repair planner cannot drift apart.
 * This module owns only the catalog-level audit and the reviewed-debt baseline.
 */

/** Retained alias: the quality gate has always called this an area. */
export type ReferenceQualityArea = SemanticAreaId;

export type { ReferenceQualityFinding };

export { auditReferenceContent };
export type { ReferenceQualityInput } from "@cpp-learn/reference-policy";

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

function findingKey(finding: ReferenceQualityFinding): string {
  return `${finding.entryId}\u0000${finding.area}`;
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
    newFindings: sortReferenceQualityFindings(
      findings.filter((finding) => !baselineKeys.has(findingKey(finding))),
    ),
    resolvedFindings: sortReferenceQualityFindings(
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
    !SEMANTIC_AREA_ORDER.includes(area as ReferenceQualityArea)
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

  const sortedFindings = sortReferenceQualityFindings(findings);
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
