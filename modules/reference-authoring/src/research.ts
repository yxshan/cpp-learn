import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import authoringResearchProposalSchema from "./authoring-research-proposal.schema.json" with { type: "json" };
import authoringResearchRequestSchema from "./authoring-research-request.schema.json" with { type: "json" };
import { authoringFactEvidenceDigest } from "./fact-evidence.js";
import type {
  AuthoringFactKind,
  AuthoringValidationIssue,
  DraftWorkspace,
} from "./index.js";

export const AUTHORING_NORMATIVE_FACT_KINDS = [
  "signature",
  "availability",
  "parameters",
  "return",
  "ownership",
  "errors",
  "complexity",
  "lifetime_invalidation",
  "thread_safety",
  "scope",
  "direct_include",
  "facility_map",
] as const satisfies readonly AuthoringFactKind[];

export interface AuthoringResearchRequest {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly sources: readonly {
    readonly id: string;
    readonly kind: "primary" | "secondary" | "vendor";
    readonly title: string;
    readonly url: string;
    readonly locator: string;
    readonly excerpt: string;
    readonly standardSection?: string;
  }[];
  readonly facts: readonly {
    readonly id: string;
    readonly kind: AuthoringFactKind;
    readonly summary: string;
    readonly sourceIds: readonly string[];
  }[];
}

export interface AuthoringResearchProposal {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly draftRevision: number;
  readonly draftInputDigest: string;
  readonly sourceRecords: readonly {
    readonly id: string;
    readonly action: "create" | "reuse";
    readonly inputIds: readonly string[];
    readonly kind: "primary" | "secondary" | "vendor";
    readonly title: string;
    readonly url: string;
    readonly standardSection?: string;
    readonly evidence: readonly {
      readonly locator: string;
      readonly excerptDigest: string;
    }[];
  }[];
  readonly factGroups: readonly {
    readonly id: string;
    readonly kind: AuthoringFactKind;
    readonly status: "unverified";
    readonly summary: string;
    readonly sourceIds: readonly string[];
    readonly verification: {
      readonly required: true;
      readonly state: "pending_human";
      readonly reason: "normative-fact" | "proposed-fact";
    };
    readonly reusableFacts: readonly {
      readonly draftId: string;
      readonly draftRevision: number;
      readonly groupId: string;
      readonly evidenceDigest: string;
      readonly matchedBy: "shared-source" | "same-summary";
    }[];
  }[];
  readonly policy: {
    readonly mode: "proposal-only";
    readonly allowsAutomaticVerification: false;
  };
  readonly digest: string;
}

export type ProposeSourceFactsResult =
  | { readonly ok: true; readonly proposal: AuthoringResearchProposal }
  | {
      readonly ok: false;
      readonly code: "invalid_request" | "draft_not_found" | "draft_unreadable";
      readonly issues: readonly AuthoringValidationIssue[];
    };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateResearchRequest = ajv.compile(authoringResearchRequestSchema);
const validateResearchProposal = ajv.compile(authoringResearchProposalSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  return error.instancePath || "/";
}

function normalizedProse(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export function validateAuthoringResearchRequest(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (!validateResearchRequest(value)) {
    return (validateResearchRequest.errors ?? []).map((error) => ({
      path: issuePath(error),
      message: error.message ?? "invalid value",
      keyword: error.keyword,
    }));
  }
  const request = value as unknown as AuthoringResearchRequest;
  const issues: AuthoringValidationIssue[] = [];
  const sourceIds = new Set<string>();
  const sourcesById = new Map<
    string,
    AuthoringResearchRequest["sources"][number]
  >();
  for (const [index, source] of request.sources.entries()) {
    if (sourceIds.has(source.id)) {
      issues.push({
        path: `/sources/${index}/id`,
        message: `Duplicate supplied source ID: ${source.id}`,
        keyword: "duplicate-source-id",
      });
    }
    sourceIds.add(source.id);
    sourcesById.set(source.id, source);
  }
  const factIds = new Set<string>();
  for (const [factIndex, fact] of request.facts.entries()) {
    if (factIds.has(fact.id)) {
      issues.push({
        path: `/facts/${factIndex}/id`,
        message: `Duplicate proposed fact ID: ${fact.id}`,
        keyword: "duplicate-fact-id",
      });
    }
    factIds.add(fact.id);
    for (const [sourceIndex, sourceId] of fact.sourceIds.entries()) {
      if (!sourceIds.has(sourceId)) {
        issues.push({
          path: `/facts/${factIndex}/sourceIds/${sourceIndex}`,
          message: `Fact source is not present in the supplied source material: ${sourceId}`,
          keyword: "source-not-supplied",
        });
      }
    }
    const summary = normalizedProse(fact.summary);
    if (
      summary.length >= 80 &&
      fact.sourceIds.some((sourceId) => {
        const source = sourcesById.get(sourceId);
        if (source === undefined) return false;
        const excerpt = normalizedProse(source.excerpt);
        return excerpt.includes(summary) || summary.includes(excerpt);
      })
    ) {
      issues.push({
        path: `/facts/${factIndex}/summary`,
        message:
          "Proposed prose contains a long verbatim source excerpt; summarize the fact in original language",
        keyword: "source-excerpt-copy",
      });
    }
  }
  return issues;
}

export function validateAuthoringResearchProposal(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (validateResearchProposal(value)) return [];
  return (validateResearchProposal.errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword,
  }));
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

export function validateAuthoringResearchWorkspace(
  workspace: DraftWorkspace,
  request: AuthoringResearchRequest,
): readonly AuthoringValidationIssue[] {
  const issues: AuthoringValidationIssue[] = [];
  const ledgerSourcesByUrl = new Map<
    string,
    (typeof workspace.sources.sources)[number][]
  >();
  for (const source of workspace.sources.sources) {
    const canonicalUrl = canonicalSourceUrl(source.url);
    const matches = ledgerSourcesByUrl.get(canonicalUrl) ?? [];
    matches.push(source);
    ledgerSourcesByUrl.set(canonicalUrl, matches);
  }
  const ledgerById = new Map(
    workspace.sources.sources.map((source) => [source.id, source]),
  );
  const suppliedKindByUrl = new Map<
    string,
    "primary" | "secondary" | "vendor"
  >();
  for (const [index, source] of request.sources.entries()) {
    const canonicalUrl = canonicalSourceUrl(source.url);
    const ledgerSources = ledgerSourcesByUrl.get(canonicalUrl) ?? [];
    if (ledgerSources.length > 1) {
      issues.push({
        path: `/sources/${index}/url`,
        message: `Canonical URL maps to multiple Source Ledger records: ${ledgerSources.map(({ id }) => id).join(", ")}`,
        keyword: "source-ledger-url-conflict",
      });
      continue;
    }
    const ledgerSource = ledgerSources[0];
    if (ledgerSource !== undefined && ledgerSource.kind !== source.kind) {
      issues.push({
        path: `/sources/${index}/kind`,
        message: `Source class conflicts with the existing Source Ledger record ${ledgerSource.id}`,
        keyword: "source-class-conflict",
      });
    }
    const priorKind = suppliedKindByUrl.get(canonicalUrl);
    if (priorKind !== undefined && priorKind !== source.kind) {
      issues.push({
        path: `/sources/${index}/kind`,
        message: "Equivalent supplied URLs must retain one source class",
        keyword: "source-class-conflict",
      });
    }
    suppliedKindByUrl.set(canonicalUrl, source.kind);
    const sameId = ledgerById.get(source.id);
    if (
      sameId !== undefined &&
      canonicalSourceUrl(sameId.url) !== canonicalUrl
    ) {
      issues.push({
        path: `/sources/${index}/id`,
        message: `Source ID already identifies another Source Ledger URL: ${source.id}`,
        keyword: "source-id-conflict",
      });
    }
  }
  for (const [index, fact] of request.facts.entries()) {
    const draftGroup = workspace.facts.groups.find(({ id }) => id === fact.id);
    if (draftGroup === undefined) {
      issues.push({
        path: `/facts/${index}/id`,
        message: `Proposed fact is not present in the draft Fact Sheet: ${fact.id}`,
        keyword: "fact-not-in-draft",
      });
    } else if (draftGroup.kind !== fact.kind) {
      issues.push({
        path: `/facts/${index}/kind`,
        message: `Proposed fact kind ${fact.kind} does not match draft Fact Sheet group ${draftGroup.kind}`,
        keyword: "fact-kind-mismatch",
      });
    }
  }
  return issues;
}

export function buildAuthoringResearchProposal(
  workspace: DraftWorkspace,
  request: AuthoringResearchRequest,
  draftInputDigest: string,
  relatedWorkspaces: readonly DraftWorkspace[] = [],
): AuthoringResearchProposal {
  const normativeKinds = new Set<AuthoringFactKind>(
    AUTHORING_NORMATIVE_FACT_KINDS,
  );
  const existingSourcesByUrl = new Map(
    workspace.sources.sources.map((source) => [
      canonicalSourceUrl(source.url),
      source,
    ]),
  );
  const recordsByUrl = new Map<
    string,
    {
      id: string;
      action: "create" | "reuse";
      inputIds: string[];
      kind: "primary" | "secondary" | "vendor";
      title: string;
      url: string;
      standardSection?: string;
      evidence: { locator: string; excerptDigest: string }[];
    }
  >();
  const resolvedSourceIds = new Map<string, string>();
  for (const source of request.sources) {
    const canonicalUrl = canonicalSourceUrl(source.url);
    const existingRecord = recordsByUrl.get(canonicalUrl);
    if (existingRecord !== undefined) {
      existingRecord.inputIds.push(source.id);
      existingRecord.evidence.push({
        locator: source.locator,
        excerptDigest: digest(source.excerpt),
      });
      resolvedSourceIds.set(source.id, existingRecord.id);
      continue;
    }
    const ledgerSource = existingSourcesByUrl.get(canonicalUrl);
    const record = {
      id: ledgerSource?.id ?? source.id,
      action:
        ledgerSource === undefined ? ("create" as const) : ("reuse" as const),
      inputIds: [source.id],
      kind: ledgerSource?.kind ?? source.kind,
      title: ledgerSource?.title ?? source.title,
      url: canonicalUrl,
      ...((ledgerSource?.standardSection ?? source.standardSection) ===
      undefined
        ? {}
        : {
            standardSection:
              ledgerSource?.standardSection ?? source.standardSection,
          }),
      evidence: [
        {
          locator: source.locator,
          excerptDigest: digest(source.excerpt),
        },
      ],
    };
    recordsByUrl.set(canonicalUrl, record);
    resolvedSourceIds.set(source.id, record.id);
  }
  const sourceRecords = [...recordsByUrl.values()];
  const suppliedSourcesById = new Map(
    request.sources.map((source) => [source.id, source]),
  );
  const factGroups = request.facts.map((fact) => {
    const factSourceUrls = new Set(
      fact.sourceIds.map((sourceId) =>
        canonicalSourceUrl(suppliedSourcesById.get(sourceId)!.url),
      ),
    );
    const reusableFacts = relatedWorkspaces.flatMap((related) =>
      related.facts.groups.flatMap((group) => {
        if (group.status !== "verified" || group.kind !== fact.kind) return [];
        const relatedSourceUrls = group.sourceIds.flatMap((sourceId) => {
          const source = related.sources.sources.find(
            ({ id }) => id === sourceId,
          );
          return source === undefined ? [] : [canonicalSourceUrl(source.url)];
        });
        const matchedBy = relatedSourceUrls.some((url) =>
          factSourceUrls.has(url),
        )
          ? ("shared-source" as const)
          : group.summary.trim() === fact.summary.trim()
            ? ("same-summary" as const)
            : undefined;
        if (matchedBy === undefined) return [];
        return [
          {
            draftId: related.draft.draftId,
            draftRevision: related.draft.revision,
            groupId: group.id,
            evidenceDigest: authoringFactEvidenceDigest(
              group,
              related.sources.sources,
            ),
            matchedBy,
          },
        ];
      }),
    );
    return {
      id: fact.id,
      kind: fact.kind,
      status: "unverified" as const,
      summary: fact.summary,
      sourceIds: [
        ...new Set(
          fact.sourceIds.map((sourceId) => resolvedSourceIds.get(sourceId)!),
        ),
      ],
      verification: {
        required: true as const,
        state: "pending_human" as const,
        reason: normativeKinds.has(fact.kind)
          ? ("normative-fact" as const)
          : ("proposed-fact" as const),
      },
      reusableFacts,
    };
  });
  const proposalWithoutDigest = {
    schemaVersion: 1 as const,
    draftId: request.draftId,
    draftRevision: workspace.draft.revision,
    draftInputDigest,
    sourceRecords,
    factGroups,
    policy: {
      mode: "proposal-only" as const,
      allowsAutomaticVerification: false as const,
    },
  };
  return { ...proposalWithoutDigest, digest: digest(proposalWithoutDigest) };
}

export { authoringResearchProposalSchema, authoringResearchRequestSchema };
