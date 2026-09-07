import { createHash } from "node:crypto";

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
          summary:
            options.reusedFrom === undefined
              ? "Use this operation when insertion position is known."
              : "",
          sourceIds: options.reusedFrom === undefined ? [source.id] : [],
          ...(options.reusedFrom === undefined
            ? {}
            : { reusedFrom: options.reusedFrom }),
        }
      : group,
  );
  const sources: AuthoringSourceLedger = {
    ...workspace.sources,
    sources: options.reusedFrom === undefined ? [source] : [],
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
              summary: "",
              sourceIds: [],
              reusedFrom: {
                draftId: "std-vector",
                draftRevision: 2,
                groupId: "selection",
                evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
              },
            }),
          ]),
        },
        sources: { sources: [] },
      },
    });
    await expect(
      authoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
      }),
    ).resolves.toMatchObject({
      ok: true,
      pack: {
        factGroups: [
          expect.objectContaining({
            summary: "Use this operation when insertion position is known.",
            sourceIds: [source.id],
          }),
        ],
        sources: [source],
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

  it("returns generated claims outside the context allowlist to an unverified review queue", async () => {
    const workspace = withSelectionFact(
      await prepared("vector-insert", "insert"),
    );
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([workspace]),
    });
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context fixture failed");

    const result = await authoring.reviewGeneratedClaims({
      context: context.pack,
      claims: [
        {
          id: "supported-selection",
          text: "Use it when the insertion position is known.",
          factGroupIds: ["selection"],
        },
        {
          id: "unsupported-complexity",
          text: "This operation has constant complexity.",
          factGroupIds: ["complexity"],
        },
        {
          id: "uncited-claim",
          text: "This operation never invalidates iterators.",
          factGroupIds: [],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      review: {
        status: "requires-review",
        acceptedClaimIds: ["supported-selection"],
        reviewQueue: [
          {
            claimId: "unsupported-complexity",
            status: "unverified",
            reason: "fact-not-allowed",
            unknownFactGroupIds: ["complexity"],
          },
          {
            claimId: "uncited-claim",
            status: "unverified",
            reason: "missing-fact-reference",
            unknownFactGroupIds: [],
          },
        ],
        digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });

    const { digest: originalDigest, ...forgedContents } = context.pack;
    void originalDigest;
    const forgedContentsWithPolicy = {
      ...forgedContents,
      policy: {
        ...forgedContents.policy,
        allowedFactGroupIds: ["selection", "complexity"],
      },
    };
    const forgedContext = {
      ...forgedContentsWithPolicy,
      digest: createHash("sha256")
        .update(JSON.stringify(forgedContentsWithPolicy))
        .digest("hex"),
    };
    await expect(
      authoring.reviewGeneratedClaims({
        context: forgedContext,
        claims: [
          {
            id: "forged-complexity",
            text: "This operation has constant complexity.",
            factGroupIds: ["complexity"],
          },
        ],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "context_changed",
      issues: [expect.objectContaining({ keyword: "digest" })],
    });
  });

  it("rejects a context workspace whose artifacts belong to another draft", async () => {
    const workspace = withSelectionFact(
      await prepared("vector-insert", "insert"),
    );
    const mismatched: DraftWorkspace = {
      ...workspace,
      facts: { ...workspace.facts, draftId: "another-draft" },
    };
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([mismatched]),
    });

    await expect(
      authoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "draft_unreadable",
      issues: [
        expect.objectContaining({
          path: "/facts/draftId",
          keyword: "draft-id-mismatch",
        }),
      ],
    });
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

    const revisedDraft = {
      ...sourceWorkspace.draft,
      revision: 3,
    };
    const revisedFiles = {
      ...sourceWorkspace.files,
      "draft.json": `${JSON.stringify(revisedDraft, null, 2)}\n`,
    };
    const revisedReport = {
      ...sourceWorkspace.report,
      draftRevision: 3,
      inputDigest: authoringInputDigest(revisedFiles),
    };
    const revisedSource: DraftWorkspace = {
      ...sourceWorkspace,
      draft: revisedDraft,
      report: revisedReport,
      files: {
        ...revisedFiles,
        "report.json": `${JSON.stringify(revisedReport, null, 2)}\n`,
      },
    };
    const revisedAuthoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([
        revisedSource,
        targetWorkspace,
      ]),
    });
    await expect(
      revisedAuthoring.buildContext({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "context_blocked",
      issues: [
        expect.objectContaining({ keyword: "fact-reuse-revision-stale" }),
      ],
    });
  });

  it("rejects unrelated reuse and does not ignore reuse while resuming a draft", async () => {
    const sourceWorkspace = withSelectionFact(
      await prepared("std-vector", "std::vector"),
      { state: "checked" },
    );
    const unrelatedAuthoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([sourceWorkspace]),
      clock: () => now,
    });
    await expect(
      unrelatedAuthoring.prepare({
        target: {
          entryId: "vector-insert",
          kind: "member",
          slug: "standard-library/containers/vector/insert",
          title: "std::vector::insert",
        },
        reuse: { draftId: "std-vector", factGroupIds: ["selection"] },
      }),
    ).resolves.toEqual({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ keyword: "fact-reuse-unrelated" })],
    });

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
    const target = {
      entryId: "vector-insert",
      kind: "member" as const,
      slug: "standard-library/containers/vector/insert",
      title: "std::vector::insert",
    };
    await expect(authoring.prepare({ target })).resolves.toMatchObject({
      ok: true,
      created: true,
    });
    await expect(
      authoring.prepare({
        target,
        reuse: { draftId: "std-vector", factGroupIds: ["selection"] },
      }),
    ).resolves.toEqual({
      ok: false,
      code: "draft_conflict",
      issues: [expect.objectContaining({ path: "/reuse" })],
    });
  });
});
