import { createHash } from "node:crypto";

import { authoringInputDigest } from "../digest.ts";
import { correctionRates, hardFindingCategory } from "../gates.ts";
import {
  buildAuthoringResearchProposal,
  validateAuthoringResearchProposal,
  validateAuthoringResearchRequest,
  validateAuthoringResearchWorkspace,
} from "../research.ts";
import {
  validateAuthoringBatchReport,
  validateAuthoringCatalogProposal,
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringReport,
  validateAuthoringSourceLedger,
} from "../validation.ts";

import type {
  AuthoringBatchReport,
  AuthoringResearchRequest,
  DraftWorkspace,
  MeasureAuthoringBatchRequest,
  MeasureAuthoringBatchResult,
  ProposeSourceFactsResult,
  ReferenceDraftRepository,
} from "../index.ts";

/**
 * Research proposals and batch measurement.
 *
 * A research proposal only ever suggests: proposed facts stay `unverified`
 * until a human verifies them, and the proposal cannot change a source's
 * classification. Measurement records what a batch actually cost so throughput
 * claims can be checked against evidence rather than asserted.
 */
export interface ResearchMeasureOperationsContext {
  readonly drafts: ReferenceDraftRepository;
}

export interface ResearchMeasureOperations {
  readonly proposeSourceFacts: (
    request: unknown,
  ) => Promise<ProposeSourceFactsResult>;
  readonly measureBatch: (
    request: MeasureAuthoringBatchRequest,
  ) => Promise<MeasureAuthoringBatchResult>;
}

export function createResearchMeasureOperations(
  context: ResearchMeasureOperationsContext,
): ResearchMeasureOperations {
  async function proposeSourceFacts(
    request: unknown,
  ): Promise<ProposeSourceFactsResult> {
    const requestIssues = validateAuthoringResearchRequest(request);
    if (requestIssues.length > 0) {
      return { ok: false, code: "invalid_request", issues: requestIssues };
    }
    const proposalRequest = request as AuthoringResearchRequest;
    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(proposalRequest.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/draftId",
            message:
              error instanceof Error ? error.message : "Draft is unreadable",
            keyword: "read",
          },
        ],
      };
    }
    if (workspace === undefined) {
      return { ok: false, code: "draft_not_found", issues: [] };
    }
    const workspaceIssues = validateAuthoringResearchWorkspace(
      workspace,
      proposalRequest,
    );
    if (workspaceIssues.length > 0) {
      return { ok: false, code: "invalid_request", issues: workspaceIssues };
    }
    const relatedWorkspaces: DraftWorkspace[] = [];
    for (const relatedDraftId of workspace.proposal.relatedEntryIds) {
      let related: DraftWorkspace | undefined;
      try {
        related = await context.drafts.get(relatedDraftId);
      } catch {
        continue;
      }
      if (
        related !== undefined &&
        related.draft.state === "checked" &&
        related.report.status === "ready" &&
        related.report.draftRevision === related.draft.revision &&
        related.report.inputDigest === authoringInputDigest(related.files)
      ) {
        relatedWorkspaces.push(related);
      }
    }
    const proposal = buildAuthoringResearchProposal(
      workspace,
      proposalRequest,
      authoringInputDigest(workspace.files),
      relatedWorkspaces,
    );
    const proposalIssues = validateAuthoringResearchProposal(proposal);
    return proposalIssues.length === 0
      ? { ok: true, proposal }
      : {
          ok: false,
          code: "invalid_request",
          issues: proposalIssues.map((issue) => ({
            ...issue,
            path: `/proposal${issue.path === "/" ? "" : issue.path}`,
          })),
        };
  }

  async function measureBatch(
    request: MeasureAuthoringBatchRequest,
  ): Promise<MeasureAuthoringBatchResult> {
    const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
    const durationValues = [
      request.timing.authorActiveMinutes,
      request.timing.machineMinutes,
      request.timing.fullGateMinutes,
      request.timing.baselineAuthorActiveMinutes,
    ];
    const countValues = [
      request.quality.prePublicationCorrections.factual,
      request.quality.prePublicationCorrections.example,
      request.quality.postPublicationCorrections.factual,
      request.quality.postPublicationCorrections.example,
      request.quality.baselinePostPublicationCorrections.factual,
      request.quality.baselinePostPublicationCorrections.example,
      request.quality.highRiskClaimsReviewed,
      request.quality.flakyReruns,
    ];
    if (
      !stableId.test(request.batchId) ||
      request.draftIds.length < 1 ||
      request.draftIds.length > 5 ||
      new Set(request.draftIds).size !== request.draftIds.length ||
      request.draftIds.some((id) => !stableId.test(id)) ||
      durationValues.some((value) => !Number.isFinite(value) || value < 0) ||
      countValues.some((value) => !Number.isInteger(value) || value < 0) ||
      !Number.isInteger(request.timing.baselineEntries) ||
      request.timing.baselineEntries < 1
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message:
              "Batch identity, one to five unique drafts, non-negative timings, and integer counters are required",
            keyword: "request",
          },
        ],
      };
    }
    const workspaces: DraftWorkspace[] = [];
    for (const [index, draftId] of request.draftIds.entries()) {
      let workspace: DraftWorkspace | undefined;
      try {
        workspace = await context.drafts.get(draftId);
      } catch (error) {
        return {
          ok: false,
          code: "batch_unreadable",
          issues: [
            {
              path: `/draftIds/${index}`,
              message:
                error instanceof Error ? error.message : "Draft is unreadable",
              keyword: "read",
            },
          ],
        };
      }
      if (workspace === undefined) {
        return {
          ok: false,
          code: "draft_not_found",
          issues: [
            {
              path: `/draftIds/${index}`,
              message: `Draft is missing: ${draftId}`,
              keyword: "required",
            },
          ],
        };
      }
      const artifactIssues = [
        ...validateAuthoringDraft(workspace.draft),
        ...validateAuthoringCatalogProposal(workspace.proposal),
        ...validateAuthoringFactSheet(workspace.facts),
        ...validateAuthoringSourceLedger(workspace.sources),
        ...validateAuthoringReport(workspace.report),
      ];
      const artifactDraftIds = [
        workspace.draft.draftId,
        workspace.proposal.draftId,
        workspace.facts.draftId,
        workspace.sources.draftId,
        workspace.report.draftId,
      ];
      if (
        artifactIssues.length > 0 ||
        artifactDraftIds.some((candidate) => candidate !== draftId)
      ) {
        return {
          ok: false,
          code: "batch_unreadable",
          issues:
            artifactIssues.length > 0
              ? artifactIssues.map((issue) => ({
                  ...issue,
                  path: `/draftIds/${index}${issue.path}`,
                }))
              : [
                  {
                    path: `/draftIds/${index}`,
                    message: `Batch member artifacts must all belong to ${draftId}`,
                    keyword: "draft-id-mismatch",
                  },
                ],
        };
      }
      workspaces.push(workspace);
    }
    let examples = 0;
    const examplesByDraft = new Map<string, number>();
    try {
      for (const workspace of workspaces) {
        const entry = JSON.parse(workspace.files["entry.json"] ?? "null") as {
          examples?: unknown;
        } | null;
        if (entry === null || !Array.isArray(entry.examples)) {
          throw new Error(
            `Draft ${workspace.draft.draftId} has no valid Entry examples list`,
          );
        }
        examples += entry.examples.length;
        examplesByDraft.set(workspace.draft.draftId, entry.examples.length);
      }
    } catch (error) {
      return {
        ok: false,
        code: "batch_unreadable",
        issues: [
          {
            path: "/draftIds",
            message:
              error instanceof Error
                ? error.message
                : "Batch Entry manifests are unreadable",
            keyword: "parse",
          },
        ],
      };
    }
    const cacheEvidence = workspaces.flatMap(
      ({ report }) => report.cacheEvidence,
    );
    const hits = cacheEvidence.filter(({ status }) => status === "hit").length;
    const misses = cacheEvidence.filter(
      ({ status }) => status === "miss",
    ).length;
    const notChecked = cacheEvidence.length - hits - misses;
    const checkedCacheRecords = hits + misses;
    const findings = workspaces.flatMap(({ report }) => report.findings);
    const hardFindings = findings.filter(({ severity }) => severity === "hard");
    const hardByCategory = Object.fromEntries(
      [...new Set(hardFindings.map(({ code }) => hardFindingCategory(code)))]
        .sort()
        .map((category) => [
          category,
          hardFindings.filter(
            ({ code }) => hardFindingCategory(code) === category,
          ).length,
        ]),
    );
    const readyEntries = workspaces.filter(
      (workspace) =>
        workspace.draft.draftId === workspace.proposal.draftId &&
        workspace.draft.draftId === workspace.facts.draftId &&
        workspace.draft.draftId === workspace.sources.draftId &&
        workspace.draft.draftId === workspace.report.draftId &&
        workspace.draft.state === "checked" &&
        workspace.report.status === "ready" &&
        workspace.report.draftRevision === workspace.draft.revision &&
        workspace.report.inputDigest === authoringInputDigest(workspace.files),
    ).length;
    const postPublicationCorrectionRates = correctionRates(
      request.quality.postPublicationCorrections,
      workspaces.length,
    );
    const baselinePostPublicationCorrectionRates = correctionRates(
      request.quality.baselinePostPublicationCorrections,
      request.timing.baselineEntries,
    );
    const activeMinutesPerEntry =
      request.timing.authorActiveMinutes / workspaces.length;
    const baselineActiveMinutesPerEntry =
      request.timing.baselineAuthorActiveMinutes /
      request.timing.baselineEntries;
    const noFactualDefectRegression =
      postPublicationCorrectionRates.factual <=
      baselinePostPublicationCorrectionRates.factual;
    const noExampleDefectRegression =
      postPublicationCorrectionRates.example <=
      baselinePostPublicationCorrectionRates.example;
    const targets = {
      fiveEntryBatch:
        workspaces.length === 5 && readyEntries === workspaces.length,
      activeMinutesWithinTarget:
        request.timing.authorActiveMinutes >= 60 &&
        request.timing.authorActiveMinutes <= 90,
      throughputImproved: activeMinutesPerEntry < baselineActiveMinutesPerEntry,
      noFactualDefectRegression,
      noExampleDefectRegression,
      noEscapedCorrectionRegression:
        noFactualDefectRegression && noExampleDefectRegression,
      allHighRiskClaimsReviewed:
        request.quality.highRiskClaimsReviewed >=
        findings.filter(({ risk }) => risk === "high").length,
      noFlakyReruns: request.quality.flakyReruns === 0,
    };
    const reportWithoutDigest: Omit<AuthoringBatchReport, "digest"> = {
      schemaVersion: 1,
      batchId: request.batchId,
      draftIds: [...request.draftIds],
      drafts: workspaces.map((workspace) => ({
        draftId: workspace.draft.draftId,
        draftRevision: workspace.draft.revision,
        inputDigest: authoringInputDigest(workspace.files),
        status: workspace.report.status,
        examples: examplesByDraft.get(workspace.draft.draftId) ?? 0,
      })),
      status: Object.values(targets).every(Boolean)
        ? "meets-target"
        : "needs-attention",
      entries: workspaces.length,
      readyEntries,
      examples,
      cache: {
        hits,
        misses,
        notChecked,
        hitRate: checkedCacheRecords === 0 ? 0 : hits / checkedCacheRecords,
      },
      findings: {
        hard: hardFindings.length,
        warning: findings.filter(({ severity }) => severity === "warning")
          .length,
        highRisk: findings.filter(({ risk }) => risk === "high").length,
        hardByCategory,
      },
      timing: {
        ...request.timing,
        activeMinutesPerEntry,
        baselineActiveMinutesPerEntry,
      },
      quality: {
        ...request.quality,
        postPublicationCorrectionRates,
        baselinePostPublicationCorrectionRates,
      },
      targets,
    };
    const report: AuthoringBatchReport = {
      ...reportWithoutDigest,
      digest: createHash("sha256")
        .update(JSON.stringify(reportWithoutDigest))
        .digest("hex"),
    };
    const reportIssues = validateAuthoringBatchReport(report);
    if (reportIssues.length > 0) {
      return {
        ok: false,
        code: "batch_unreadable",
        issues: reportIssues,
      };
    }
    return { ok: true, report };
  }

  return {
    proposeSourceFacts,
    measureBatch,
  };
}
