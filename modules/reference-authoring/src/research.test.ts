import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
} from "./index.js";

describe("[T-AUTH-A6-RESEARCH-001] [T-AUTH-013] source and fact-sheet proposals", () => {
  it("turns explicitly supplied source evidence into an unverified proposal without changing the draft", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    const prepared = await authoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "cpp-standard-vector-capacity",
          kind: "primary",
          title: "ISO C++ working draft: vector capacity",
          url: "https://eel.is/c++draft/vector.capacity#lib:size",
          locator: "[vector.capacity], size",
          excerpt: "constexpr size_type size() const noexcept;",
          standardSection: "[vector.capacity]",
        },
      ],
      facts: [
        {
          id: "signature",
          kind: "signature",
          summary: "size() 是 const、noexcept 的成员函数。",
          sourceIds: ["cpp-standard-vector-capacity"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        schemaVersion: 1,
        draftId: "std-vector-size",
        draftRevision: 1,
        sourceRecords: [
          {
            id: "cpp-standard-vector-capacity",
            action: "create",
            inputIds: ["cpp-standard-vector-capacity"],
            kind: "primary",
            title: "ISO C++ working draft: vector capacity",
            url: "https://eel.is/c++draft/vector.capacity",
            standardSection: "[vector.capacity]",
            evidence: [
              {
                locator: "[vector.capacity], size",
                excerptDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
              },
            ],
          },
        ],
        factGroups: [
          {
            id: "signature",
            kind: "signature",
            status: "unverified",
            summary: "size() 是 const、noexcept 的成员函数。",
            sourceIds: ["cpp-standard-vector-capacity"],
            verification: {
              required: true,
              state: "pending_human",
              reason: "normative-fact",
            },
            reusableFacts: [],
          },
        ],
        policy: {
          mode: "proposal-only",
          allowsAutomaticVerification: false,
        },
        digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
    expect(await drafts.get("std-vector-size")).toEqual(prepared.workspace);
  });

  it("rejects a fact that cites no explicitly supplied source", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "cpp-standard-vector-capacity",
          kind: "primary",
          title: "ISO C++ working draft: vector capacity",
          url: "https://eel.is/c++draft/vector.capacity",
          locator: "[vector.capacity]",
          excerpt: "constexpr size_type size() const noexcept;",
        },
      ],
      facts: [
        {
          id: "signature",
          kind: "signature",
          summary: "size() 是 const、noexcept 的成员函数。",
          sourceIds: ["not-supplied"],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/facts/0/sourceIds/0",
          message:
            "Fact source is not present in the supplied source material: not-supplied",
          keyword: "source-not-supplied",
        },
      ],
    });
  });

  it("deduplicates equivalent URLs against the Source Ledger and preserves the verified source class", async () => {
    const initialDrafts = createInMemoryReferenceDraftRepository();
    const initialAuthoring = createReferenceAuthoring({
      drafts: initialDrafts,
    });
    const prepared = await initialAuthoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const workspace = {
      ...prepared.workspace,
      sources: {
        schemaVersion: 1 as const,
        draftId: "std-vector-size",
        sources: [
          {
            id: "eel-vector-capacity",
            kind: "primary" as const,
            title: "ISO C++ working draft: vector capacity",
            url: "https://eel.is/c++draft/vector.capacity",
            verifiedAt: "2026-09-08",
            standardSection: "[vector.capacity]",
          },
        ],
      },
    };
    const drafts = createInMemoryReferenceDraftRepository([workspace]);
    const authoring = createReferenceAuthoring({ drafts });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "size-declaration",
          kind: "primary",
          title: "Working draft size declaration",
          url: "https://eel.is/c++draft/vector.capacity#lib:size",
          locator: "size declaration",
          excerpt: "constexpr size_type size() const noexcept;",
        },
        {
          id: "size-complexity",
          kind: "primary",
          title: "Working draft size complexity",
          url: "https://eel.is/c++draft/vector.capacity#lib:vector.capacity-2",
          locator: "size complexity",
          excerpt: "Complexity: Constant time.",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["size-declaration", "size-complexity"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        sourceRecords: [
          {
            id: "eel-vector-capacity",
            action: "reuse",
            inputIds: ["size-declaration", "size-complexity"],
            kind: "primary",
            title: "ISO C++ working draft: vector capacity",
            url: "https://eel.is/c++draft/vector.capacity",
            standardSection: "[vector.capacity]",
            evidence: [
              { locator: "size declaration" },
              { locator: "size complexity" },
            ],
          },
        ],
        factGroups: [
          {
            id: "complexity",
            sourceIds: ["eel-vector-capacity"],
            verification: { reason: "normative-fact" },
          },
        ],
      },
    });
  });

  it("blocks a supplied source from changing the class recorded in the Source Ledger", async () => {
    const initialDrafts = createInMemoryReferenceDraftRepository();
    const initialAuthoring = createReferenceAuthoring({
      drafts: initialDrafts,
    });
    const prepared = await initialAuthoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const workspace = {
      ...prepared.workspace,
      sources: {
        schemaVersion: 1 as const,
        draftId: "std-vector-size",
        sources: [
          {
            id: "cppreference-vector-size",
            kind: "secondary" as const,
            title: "cppreference: vector::size",
            url: "https://en.cppreference.com/w/cpp/container/vector/size.html",
            verifiedAt: "2026-09-08",
          },
        ],
      },
    };
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([workspace]),
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "claimed-primary",
          kind: "primary",
          title: "cppreference: vector::size",
          url: "https://en.cppreference.com/w/cpp/container/vector/size.html#Complexity",
          locator: "Complexity",
          excerpt: "Constant.",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["claimed-primary"],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/sources/0/kind",
          message:
            "Source class conflicts with the existing Source Ledger record cppreference-vector-size",
          keyword: "source-class-conflict",
        },
      ],
    });
  });

  it("suggests an eligible related fact without automatically reusing or verifying it", async () => {
    const relatedPrepared = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    }).prepare({
      target: {
        entryId: "std-vector",
        kind: "type",
        slug: "standard-library/containers/vector",
        title: "std::vector",
      },
    });
    expect(relatedPrepared.ok).toBe(true);
    if (!relatedPrepared.ok) return;
    const relatedSource = {
      id: "eel-vector-capacity",
      kind: "primary" as const,
      title: "ISO C++ working draft: vector capacity",
      url: "https://eel.is/c++draft/vector.capacity",
      verifiedAt: "2026-09-08",
      standardSection: "[vector.capacity]",
    };
    const relatedFacts = {
      ...relatedPrepared.workspace.facts,
      groups: relatedPrepared.workspace.facts.groups.map((group) =>
        group.id === "complexity"
          ? {
              ...group,
              status: "verified" as const,
              summary: "size() 的复杂度为常数时间。",
              sourceIds: [relatedSource.id],
            }
          : group,
      ),
    };
    const relatedSources = {
      ...relatedPrepared.workspace.sources,
      sources: [relatedSource],
    };
    const relatedDraft = {
      ...relatedPrepared.workspace.draft,
      revision: 2,
      state: "checked" as const,
    };
    const relatedFiles = {
      ...relatedPrepared.workspace.files,
      "draft.json": `${JSON.stringify(relatedDraft, null, 2)}\n`,
      "facts.json": `${JSON.stringify(relatedFacts, null, 2)}\n`,
      "sources.json": `${JSON.stringify(relatedSources, null, 2)}\n`,
    };
    const relatedReport = {
      ...relatedPrepared.workspace.report,
      draftRevision: 2,
      inputDigest: authoringInputDigest(relatedFiles),
      status: "ready" as const,
    };
    const relatedWorkspace = {
      ...relatedPrepared.workspace,
      draft: relatedDraft,
      facts: relatedFacts,
      sources: relatedSources,
      report: relatedReport,
      files: {
        ...relatedFiles,
        "report.json": `${JSON.stringify(relatedReport, null, 2)}\n`,
      },
    };

    const targetPrepared = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    }).prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    expect(targetPrepared.ok).toBe(true);
    if (!targetPrepared.ok) return;
    const proposal = {
      ...targetPrepared.workspace.proposal,
      relatedEntryIds: ["std-vector"],
    };
    const targetWorkspace = {
      ...targetPrepared.workspace,
      proposal,
      files: {
        ...targetPrepared.workspace.files,
        "catalog-proposal.json": `${JSON.stringify(proposal, null, 2)}\n`,
      },
    };
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([
        relatedWorkspace,
        targetWorkspace,
      ]),
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "size-complexity",
          kind: "primary",
          title: "Working draft size complexity",
          url: "https://eel.is/c++draft/vector.capacity#lib:vector.capacity-2",
          locator: "size complexity",
          excerpt: "Complexity: Constant time.",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["size-complexity"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        factGroups: [
          {
            id: "complexity",
            status: "unverified",
            reusableFacts: [
              {
                draftId: "std-vector",
                draftRevision: 2,
                groupId: "complexity",
                evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
                matchedBy: "shared-source",
              },
            ],
          },
        ],
      },
    });
  });

  it("rejects a proposed fact that does not match the draft Fact Sheet", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "cpp-standard-vector-capacity",
          kind: "primary",
          title: "ISO C++ working draft: vector capacity",
          url: "https://eel.is/c++draft/vector.capacity",
          locator: "[vector.capacity]",
          excerpt: "constexpr size_type size() const noexcept;",
        },
      ],
      facts: [
        {
          id: "signature",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["cpp-standard-vector-capacity"],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/facts/0/kind",
          message:
            "Proposed fact kind complexity does not match draft Fact Sheet group signature",
          keyword: "fact-kind-mismatch",
        },
      ],
    });
  });

  it("rejects a long verbatim excerpt used as proposed prose", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    const copiedText =
      "The operation returns the number of elements stored in the container and has constant-time complexity for every valid vector object.";

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "secondary-size",
          kind: "secondary",
          title: "Independent vector reference",
          url: "https://example.com/vector/size",
          locator: "description",
          excerpt: copiedText,
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: copiedText,
          sourceIds: ["secondary-size"],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/facts/0/summary",
          message:
            "Proposed prose contains a long verbatim source excerpt; summarize the fact in original language",
          keyword: "source-excerpt-copy",
        },
      ],
    });
  });

  it("fails closed when one canonical URL has multiple Source Ledger identities", async () => {
    const initial = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    }).prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const workspace = {
      ...initial.workspace,
      sources: {
        ...initial.workspace.sources,
        sources: [
          {
            id: "vector-capacity-a",
            kind: "primary" as const,
            title: "Working draft vector capacity A",
            url: "https://eel.is/c++draft/vector.capacity#one",
            verifiedAt: "2026-09-08",
          },
          {
            id: "vector-capacity-b",
            kind: "primary" as const,
            title: "Working draft vector capacity B",
            url: "https://eel.is/c++draft/vector.capacity#two",
            verifiedAt: "2026-09-08",
          },
        ],
      },
    };
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([workspace]),
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "size-complexity",
          kind: "primary",
          title: "Working draft size complexity",
          url: "https://eel.is/c++draft/vector.capacity#size",
          locator: "size complexity",
          excerpt: "Complexity: Constant time.",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["size-complexity"],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/sources/0/url",
          message:
            "Canonical URL maps to multiple Source Ledger records: vector-capacity-a, vector-capacity-b",
          keyword: "source-ledger-url-conflict",
        },
      ],
    });
  });

  it("preserves query ordering when deduplicating fragment-only URL variants", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({
      target: {
        entryId: "std-vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "ordered-a-b",
          kind: "secondary",
          title: "Ordered query A then B",
          url: "https://example.com/vector?section=a&view=b#one",
          locator: "first query order",
          excerpt: "Constant-time size query.",
        },
        {
          id: "ordered-b-a",
          kind: "secondary",
          title: "Ordered query B then A",
          url: "https://example.com/vector?view=b&section=a#two",
          locator: "second query order",
          excerpt: "A separate query resource.",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "size() 的复杂度为常数时间。",
          sourceIds: ["ordered-a-b", "ordered-b-a"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        sourceRecords: [
          {
            id: "ordered-a-b",
            url: "https://example.com/vector?section=a&view=b",
          },
          {
            id: "ordered-b-a",
            url: "https://example.com/vector?view=b&section=a",
          },
        ],
        factGroups: [{ sourceIds: ["ordered-a-b", "ordered-b-a"] }],
      },
    });
  });

  it("rejects source and fact text containing only whitespace", async () => {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    });

    const result = await authoring.proposeSourceFacts({
      schemaVersion: 1,
      draftId: "std-vector-size",
      sources: [
        {
          id: "blank-source",
          kind: "primary",
          title: "   ",
          url: "https://example.com/vector",
          locator: "\n\t",
          excerpt: "   ",
          standardSection: " ",
        },
      ],
      facts: [
        {
          id: "complexity",
          kind: "complexity",
          summary: "  ",
          sourceIds: ["blank-source"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/sources/0/title" }),
        expect.objectContaining({ path: "/sources/0/locator" }),
        expect.objectContaining({ path: "/sources/0/excerpt" }),
        expect.objectContaining({ path: "/sources/0/standardSection" }),
        expect.objectContaining({ path: "/facts/0/summary" }),
      ]),
    });
  });
});
