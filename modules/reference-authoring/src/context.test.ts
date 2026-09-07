import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type AuthoringFactGroup,
  type AuthoringSourceLedger,
  type DraftWorkspace,
} from "./index.js";

const now = new Date("2026-09-07T09:00:00.000Z");
const source = {
  id: "working-draft-vector",
  kind: "primary" as const,
  title: "C++ Working Draft [vector]",
  url: "https://eel.is/c++draft/vector",
  verifiedAt: "2026-09-07",
  standardSection: "[vector]",
};

async function prepared(entryId: string, title: string) {
  const result = await createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => now,
  }).prepare({
    target: {
      entryId,
      kind: "member",
      slug: `standard-library/containers/vector/${entryId}`,
      title,
    },
  });
  if (!result.ok) throw new Error("fixture preparation failed");
  return result.workspace;
}

function withSelectionFact(
  workspace: DraftWorkspace,
  options: {
    readonly state?: "draft" | "checked";
    readonly reusedFrom?: AuthoringFactGroup["reusedFrom"];
  } = {},
): DraftWorkspace {
  const groups = workspace.facts.groups.map((group) =>
    group.id === "selection"
      ? {
          ...group,
          status: "verified" as const,
          summary: "Use this operation when insertion position is known.",
          sourceIds: [source.id],
          ...(options.reusedFrom === undefined
            ? {}
            : { reusedFrom: options.reusedFrom }),
        }
      : group,
  );
  const sources: AuthoringSourceLedger = {
    ...workspace.sources,
    sources: [source],
  };
  const revision = options.state === "checked" ? 2 : workspace.draft.revision;
  const draft = {
    ...workspace.draft,
    revision,
    state: options.state ?? workspace.draft.state,
  };
  const files = {
    ...workspace.files,
    "draft.json": `${JSON.stringify(draft, null, 2)}\n`,
    "facts.json": `${JSON.stringify({ ...workspace.facts, groups }, null, 2)}\n`,
    "sources.json": `${JSON.stringify(sources, null, 2)}\n`,
  };
  const report = {
    ...workspace.report,
    draftRevision: revision,
    inputDigest: authoringInputDigest(files),
    status:
      options.state === "checked"
        ? ("ready" as const)
        : ("not_checked" as const),
  };
  return {
    ...workspace,
    draft,
    facts: { ...workspace.facts, groups },
    sources,
    report,
    files: {
      ...files,
      "report.json": `${JSON.stringify(report, null, 2)}\n`,
    },
  };
}

describe("[T-AUTH-A3-CONTEXT-001] constrained AI context packs", () => {
  it("seeds a related draft from explicitly selected verified fact groups", async () => {
    const sourceWorkspace = withSelectionFact(
      await prepared("std-vector", "std::vector"),
      { state: "checked" },
    );
    const drafts = createInMemoryReferenceDraftRepository([sourceWorkspace]);
    const authoring = createReferenceAuthoring({
      drafts,
      catalog: {
        load: async () => ({
          entries: [
            {
              id: "std-vector",
              slug: "standard-library/containers/vector",
              kind: "type",
              title: "std::vector",
              symbol: "std::vector",
              header: "<vector>",
              categories: ["containers"],
              relatedEntryIds: [],
            },
          ],
          entryIds: ["std-vector"],
          categoryIds: ["containers"],
          slugsByEntryId: {
            "std-vector": "standard-library/containers/vector",
          },
          redirects: [],
        }),
      },
      clock: () => now,
    });

    const result = await authoring.prepare({
      target: {
        entryId: "vector-insert",
        kind: "member",
        slug: "standard-library/containers/vector/insert",
        title: "std::vector::insert",
      },
      reuse: {
        draftId: "std-vector",
        factGroupIds: ["selection"],
      },
    });

    expect(result).toMatchObject({
      ok: true,
      workspace: {
        facts: {
          groups: expect.arrayContaining([
            expect.objectContaining({
              id: "selection",
              status: "verified",
              summary: "Use this operation when insertion position is known.",
              reusedFrom: {
                draftId: "std-vector",
                draftRevision: 2,
                groupId: "selection",
                evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
              },
            }),
          ]),
        },
        sources: { sources: [source] },
      },
    });
  });

  it("emits only explicitly requested verified facts with their source evidence", async () => {
    const workspace = withSelectionFact(
      await prepared("vector-insert", "insert"),
    );
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([workspace]),
    });

    const result = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });

    expect(result).toMatchObject({
      ok: true,
      pack: {
        schemaVersion: 1,
        draftId: "vector-insert",
        factGroups: [
          {
            id: "selection",
            kind: "selection",
            sourceIds: [source.id],
            evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
          },
        ],
        sources: [source],
        policy: {
          mode: "verified-facts-only",
          allowedFactGroupIds: ["selection"],
        },
        digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
    expect(result.ok && result.pack.factGroups).toHaveLength(1);
  });

  it("rejects an unverified fact instead of exposing it to an AI Adapter", async () => {
    const workspace = withSelectionFact(
      await prepared("vector-insert", "insert"),
    );
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([workspace]),
    });

    await expect(
      authoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["errors"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "context_blocked",
      issues: [
        expect.objectContaining({
          path: "/factGroupIds/0",
          keyword: "fact-not-verified",
        }),
      ],
    });
  });

  it("rejects a normative fact that lacks primary Working Draft evidence", async () => {
    const workspace = await prepared("vector-insert", "insert");
    const secondary = {
      id: "cppreference-vector",
      kind: "secondary" as const,
      title: "std::vector",
      url: "https://en.cppreference.com/w/cpp/container/vector",
      verifiedAt: "2026-09-07",
    };
    const groups = workspace.facts.groups.map((group) =>
      group.id === "complexity"
        ? {
            ...group,
            status: "verified" as const,
            summary: "Amortized constant time.",
            sourceIds: [secondary.id],
          }
        : group,
    );
    const candidate: DraftWorkspace = {
      ...workspace,
      facts: { ...workspace.facts, groups },
      sources: { ...workspace.sources, sources: [secondary] },
    };
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([candidate]),
    });

    await expect(
      authoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["complexity"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "context_blocked",
      issues: [
        expect.objectContaining({ keyword: "fact-primary-source-missing" }),
      ],
    });
  });

  it("reuses a revision-bound verified fact across related drafts and rejects a stale digest", async () => {
    const sourceWorkspace = withSelectionFact(
      await prepared("std-vector", "std::vector"),
      { state: "checked" },
    );
    const sourceAuthoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([sourceWorkspace]),
    });
    const sourceContext = await sourceAuthoring.buildContext({
      draftId: "std-vector",
      factGroupIds: ["selection"],
    });
    if (!sourceContext.ok) throw new Error("source context failed");
    const evidenceDigest = sourceContext.pack.factGroups[0]!.evidenceDigest;
    const targetBase = await prepared("vector-insert", "std::vector::insert");
    const proposal = {
      ...targetBase.proposal,
      relatedEntryIds: ["std-vector"],
    };
    const targetWorkspace = withSelectionFact(
      {
        ...targetBase,
        proposal,
        files: {
          ...targetBase.files,
          "catalog-proposal.json": `${JSON.stringify(proposal, null, 2)}\n`,
        },
      },
      {
        reusedFrom: {
          draftId: "std-vector",
          draftRevision: 2,
          groupId: "selection",
          evidenceDigest,
        },
      },
    );
    const repository = createInMemoryReferenceDraftRepository([
      sourceWorkspace,
      targetWorkspace,
    ]);
    const authoring = createReferenceAuthoring({ drafts: repository });

    await expect(
      authoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
      }),
    ).resolves.toMatchObject({ ok: true });

    const staleTarget = withSelectionFact(targetWorkspace, {
      reusedFrom: {
        draftId: "std-vector",
        draftRevision: 2,
        groupId: "selection",
        evidenceDigest: "0".repeat(64),
      },
    });
    const staleAuthoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([
        sourceWorkspace,
        staleTarget,
      ]),
    });
    await expect(
      staleAuthoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "context_blocked",
      issues: [
        expect.objectContaining({ keyword: "fact-reuse-digest-mismatch" }),
      ],
    });
    await expect(
      staleAuthoring.check({ draftId: "vector-insert" }),
    ).resolves.toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "fact-reuse-digest-mismatch" }),
        ]),
      },
    });
  });
});
