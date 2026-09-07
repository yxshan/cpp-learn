import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type DraftWorkspace,
} from "./index.js";

async function readyBatch(): Promise<DraftWorkspace[]> {
  const workspaces: DraftWorkspace[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
      clock: () => new Date("2026-09-07T10:00:00.000Z"),
    });
    const prepared = await authoring.prepare({
      target: {
        entryId: `vector-member-${index}`,
        kind: "member",
        slug: `standard-library/containers/vector/member-${index}`,
        title: `std::vector::member_${index}`,
      },
    });
    if (!prepared.ok) throw new Error("fixture preparation failed");
    const draft = {
      ...prepared.workspace.draft,
      revision: 2,
      state: "checked" as const,
    };
    const files = {
      ...prepared.workspace.files,
      "draft.json": `${JSON.stringify(draft, null, 2)}\n`,
    };
    const report = {
      ...prepared.workspace.report,
      draftRevision: 2,
      inputDigest: authoringInputDigest(files),
      status: "ready" as const,
      findings:
        index === 1
          ? [
              {
                severity: "warning" as const,
                risk: "high" as const,
                code: "content-quality",
                path: "content.md/complexity",
                message: "Human review completed",
              },
            ]
          : [],
      reviewQueue: [],
      cacheEvidence: [
        {
          key: `example-${index}`,
          status: index === 5 ? ("miss" as const) : ("hit" as const),
        },
      ],
    };
    workspaces.push({
      ...prepared.workspace,
      draft,
      report,
      files: {
        ...files,
        "report.json": `${JSON.stringify(report, null, 2)}\n`,
      },
    });
  }
  return workspaces;
}

describe("[T-AUTH-010] authoring batch measurement", () => {
  it("evaluates the five-Entry throughput and escaped-correction targets", async () => {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(await readyBatch()),
    });

    const result = await authoring.measureBatch({
      batchId: "vector-members-batch-1",
      draftIds: [
        "vector-member-1",
        "vector-member-2",
        "vector-member-3",
        "vector-member-4",
        "vector-member-5",
      ],
      authorActiveMinutes: 75,
      machineMinutes: 12,
      fullGateMinutes: 4,
      postPublicationCorrections: 0,
      baselinePostPublicationCorrections: 0,
      baselineEntries: 5,
      flakyReruns: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      report: {
        schemaVersion: 1,
        batchId: "vector-members-batch-1",
        status: "meets-target",
        entries: 5,
        readyEntries: 5,
        cache: { hits: 4, misses: 1, hitRate: 0.8 },
        findings: { hard: 0, warning: 1, highRisk: 1 },
        quality: { correctionRate: 0, baselineCorrectionRate: 0 },
        targets: {
          fiveEntryBatch: true,
          activeMinutesWithinTarget: true,
          noEscapedCorrectionRegression: true,
        },
        digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
  });

  it("reports rather than hides a correction regression", async () => {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(await readyBatch()),
    });

    const result = await authoring.measureBatch({
      batchId: "vector-members-batch-2",
      draftIds: [
        "vector-member-1",
        "vector-member-2",
        "vector-member-3",
        "vector-member-4",
        "vector-member-5",
      ],
      authorActiveMinutes: 60,
      machineMinutes: 10,
      fullGateMinutes: 3,
      postPublicationCorrections: 1,
      baselinePostPublicationCorrections: 0,
      baselineEntries: 5,
      flakyReruns: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      report: {
        status: "needs-attention",
        targets: { noEscapedCorrectionRegression: false },
      },
    });
  });
});
