import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type ApplyGeneratedSectionRequest,
  type DraftWorkspace,
} from "./index.js";
import { replaceMarkdownSection } from "./generation.js";

async function generationFixture() {
  const drafts = createInMemoryReferenceDraftRepository();
  const authoring = createReferenceAuthoring({
    drafts,
    clock: () => new Date("2026-09-07T14:00:00.000Z"),
  });
  const prepared = await authoring.prepare({
    target: {
      entryId: "vector-insert",
      kind: "member",
      slug: "standard-library/containers/vector/insert",
      title: "std::vector::insert",
    },
  });
  if (!prepared.ok) throw new Error("fixture preparation failed");
  const source = {
    id: "working-draft-vector-modifiers",
    kind: "primary" as const,
    title: "C++ Working Draft [vector.modifiers]",
    url: "https://eel.is/c++draft/vector.modifiers",
    verifiedAt: "2026-09-07",
    standardSection: "[vector.modifiers]",
  };
  const facts = {
    ...prepared.workspace.facts,
    groups: prepared.workspace.facts.groups.map((group) =>
      group.id === "selection"
        ? {
            ...group,
            status: "verified" as const,
            summary: "Use insert when the insertion position is known.",
            sourceIds: [source.id],
          }
        : group,
    ),
  };
  const sources = { ...prepared.workspace.sources, sources: [source] };
  const files = {
    ...prepared.workspace.files,
    "facts.json": `${JSON.stringify(facts, null, 2)}\n`,
    "sources.json": `${JSON.stringify(sources, null, 2)}\n`,
  };
  const report = {
    ...prepared.workspace.report,
    inputDigest: authoringInputDigest(files),
  };
  const workspace: DraftWorkspace = {
    ...prepared.workspace,
    facts,
    sources,
    report,
    files: {
      ...files,
      "report.json": `${JSON.stringify(report, null, 2)}\n`,
    },
  };
  const repository = createInMemoryReferenceDraftRepository([workspace]);
  return {
    authoring: createReferenceAuthoring({
      drafts: repository,
      clock: () => new Date("2026-09-07T14:05:00.000Z"),
    }),
    repository,
  };
}

describe("[T-AUTH-A4-GENERATION-001] generated section ingestion", () => {
  it("atomically applies a generated section whose claims use the context allowlist", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    expect(context.pack).toMatchObject({
      target: {
        entryId: "vector-insert",
        kind: "member",
        title: "std::vector::insert",
      },
      profile: "callable",
      requiredHeadings: expect.arrayContaining([
        "什么时候使用",
        "声明与重载",
        "与 JavaScript 对照",
      ]),
    });

    const result = await authoring.applyGeneratedSection({
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        section: {
          heading: "什么时候使用",
          markdown: "当插入位置已知时使用 `insert`。",
          claims: [
            {
              id: "known-position",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      workspace: {
        draft: { revision: 2, state: "draft" },
        report: {
          draftRevision: 2,
          status: "not_checked",
          generatedSections: [
            {
              heading: "什么时候使用",
              receiptPath: "generation/revision-2.json",
              appliedRevision: 2,
              reviewStatus: "human-review-required",
            },
          ],
        },
      },
      review: {
        status: "accepted",
        acceptedClaimIds: ["known-position"],
      },
    });
    expect(result.ok && result.workspace.files["content.md"]).toContain(
      "## 什么时候使用\n\n当插入位置已知时使用 `insert`。\n\n## 声明与重载",
    );
    await expect(repository.get("vector-insert")).resolves.toMatchObject({
      draft: { revision: 2 },
    });
  });

  it("keeps the draft unchanged when generated claims leave the allowlist", async () => {
    const { authoring, repository } = await generationFixture();
    const before = await repository.get("vector-insert");
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");

    const result = await authoring.applyGeneratedSection({
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        section: {
          heading: "复杂度",
          markdown: "该操作始终是常数复杂度。",
          claims: [
            {
              id: "unsupported-complexity",
              text: "The operation always has constant complexity.",
              factGroupIds: ["complexity"],
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      code: "generation_blocked",
      review: {
        status: "requires-review",
        reviewQueue: [
          expect.objectContaining({
            claimId: "unsupported-complexity",
            status: "unverified",
          }),
        ],
      },
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("rejects an unvalidated context at the machine boundary without throwing", async () => {
    const { authoring, repository } = await generationFixture();
    const before = await repository.get("vector-insert");

    const result = await authoring.applyGeneratedSection({
      context: { draftId: "vector-insert" },
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: "a".repeat(64),
        section: {
          heading: "什么时候使用",
          markdown: "当插入位置已知时使用 `insert`。",
          claims: [
            {
              id: "known-position",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    } as unknown as ApplyGeneratedSectionRequest);

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/context/schemaVersion" }),
      ]),
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("rejects level-one or level-two headings anywhere in generated Markdown", () => {
    expect(
      replaceMarkdownSection(
        "# Entry\n\n## 什么时候使用\n\nTODO\n\n## 示例\n\nTODO\n",
        "什么时候使用",
        "正文。\n\n  ## 伪造的新章节\n\n不应写入。",
      ),
    ).toEqual({
      ok: false,
      message:
        "Generated section Markdown must not introduce level-one or level-two headings",
    });
    expect(
      replaceMarkdownSection(
        "# Entry\n\n## 什么时候使用\n\nTODO\n\n## 示例\n\nTODO\n",
        "什么时候使用",
        "伪造的新章节\n---\n\n不应写入。",
      ),
    ).toEqual({
      ok: false,
      message:
        "Generated section Markdown must not introduce level-one or level-two headings",
    });
  });

  it("rejects whitespace-only Markdown and headings outside the draft profile", async () => {
    const { authoring } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const baseGeneration = {
      schemaVersion: 1 as const,
      draftId: "vector-insert",
      contextDigest: context.pack.digest,
      section: {
        heading: "什么时候使用",
        markdown: "正文。",
        claims: [
          {
            id: "known-position",
            text: "Use insert when the insertion position is known.",
            factGroupIds: ["selection"],
          },
        ],
      },
    };

    await expect(
      authoring.applyGeneratedSection({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          ...baseGeneration,
          section: { ...baseGeneration.section, markdown: " \n\t " },
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    await expect(
      authoring.applyGeneratedSection({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          ...baseGeneration,
          section: { ...baseGeneration.section, heading: "未授权章节" },
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
  });

  it("rejects a stale revision and a same-revision input change", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const request = {
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1 as const,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        section: {
          heading: "什么时候使用",
          markdown: "正文。",
          claims: [
            {
              id: "known-position",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    };
    await expect(
      authoring.applyGeneratedSection({ ...request, expectedRevision: 2 }),
    ).resolves.toMatchObject({ ok: false, code: "revision_conflict" });

    let reads = 0;
    const racingAuthoring = createReferenceAuthoring({
      drafts: {
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: (input) => repository.commitWorkspace(input),
        async get(draftId) {
          const workspace = await repository.get(draftId);
          reads += 1;
          if (reads !== 3 || workspace === undefined) return workspace;
          return {
            ...workspace,
            files: {
              ...workspace.files,
              "content.md": `${workspace.files["content.md"]}\nchanged`,
            },
          };
        },
      },
    });
    await expect(
      racingAuthoring.applyGeneratedSection(request),
    ).resolves.toMatchObject({
      ok: false,
      code: "context_changed",
    });
  });

  it("returns a structured failure when the draft repository cannot commit", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const failingAuthoring = createReferenceAuthoring({
      drafts: {
        get: (draftId) => repository.get(draftId),
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: async () => {
          throw new Error("disk unavailable");
        },
      },
    });

    await expect(
      failingAuthoring.applyGeneratedSection({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          schemaVersion: 1,
          draftId: "vector-insert",
          contextDigest: context.pack.digest,
          section: {
            heading: "什么时候使用",
            markdown: "正文。",
            claims: [
              {
                id: "known-position",
                text: "Use insert when the insertion position is known.",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "write_failed",
      issues: [expect.objectContaining({ message: "disk unavailable" })],
    });
  });
});

describe("[T-AUTH-A4-SUMMARY-001] generated summary ingestion", () => {
  it("applies an allowlisted summary without changing article content", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const before = await repository.get("vector-insert");

    const result = await authoring.applyGeneratedSummary({
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        summary: {
          text: "在已知位置向 std::vector 插入元素。",
          claims: [
            {
              id: "known-position-summary",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      workspace: {
        draft: { revision: 2, state: "draft" },
        report: {
          status: "not_checked",
        },
      },
      review: { status: "accepted" },
      receiptPath: "generation/revision-2.json",
    });
    expect(
      JSON.parse(result.ok ? result.workspace.files["entry.json"]! : "null"),
    ).toMatchObject({ summary: "在已知位置向 std::vector 插入元素。" });
    expect(result.ok && result.workspace.files["content.md"]).toBe(
      before?.files["content.md"],
    );
    await expect(repository.get("vector-insert")).resolves.toMatchObject({
      draft: { revision: 2 },
    });
    const checked = await authoring.check({ draftId: "vector-insert" });
    expect(checked).toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "generated-content-review-required",
            path: "generation/revision-2.json/review/status",
          }),
        ]),
      },
    });
    expect(
      checked.ok &&
        checked.report.findings.some(
          ({ code }) => code === "generation-receipt-schema",
        ),
    ).toBe(false);
  });

  it("rejects multiline or unsupported summaries without changing the draft", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const before = await repository.get("vector-insert");
    const generation = {
      schemaVersion: 1 as const,
      draftId: "vector-insert",
      contextDigest: context.pack.digest,
      summary: {
        text: "第一行\n第二行",
        claims: [
          {
            id: "known-position-summary",
            text: "Use insert when the insertion position is known.",
            factGroupIds: ["selection"],
          },
        ],
      },
    };

    await expect(
      authoring.applyGeneratedSummary({
        context: context.pack,
        expectedRevision: 1,
        generation,
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    for (const separator of [
      "\u000b",
      "\u000c",
      "\u0085",
      "\u2028",
      "\u2029",
    ]) {
      await expect(
        authoring.applyGeneratedSummary({
          context: context.pack,
          expectedRevision: 1,
          generation: {
            ...generation,
            summary: {
              ...generation.summary,
              text: `第一行${separator}第二行`,
            },
          },
        }),
      ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    }
    await expect(
      authoring.applyGeneratedSummary({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          ...generation,
          summary: {
            text: "该操作始终是常数复杂度。",
            claims: [
              {
                id: "unsupported-summary",
                text: "The operation is always constant complexity.",
                factGroupIds: ["complexity"],
              },
            ],
          },
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "generation_blocked",
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("rejects stale revisions and repository write conflicts without mutation", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const request = {
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1 as const,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        summary: {
          text: "在已知位置插入元素。",
          claims: [
            {
              id: "known-position-summary",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    };

    await expect(
      authoring.applyGeneratedSummary({ ...request, expectedRevision: 2 }),
    ).resolves.toMatchObject({ ok: false, code: "revision_conflict" });
    const conflicting = createReferenceAuthoring({
      drafts: {
        get: (draftId) => repository.get(draftId),
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: async () => false,
      },
    });
    await expect(
      conflicting.applyGeneratedSummary(request),
    ).resolves.toMatchObject({ ok: false, code: "write_conflict" });
    const failing = createReferenceAuthoring({
      drafts: {
        get: (draftId) => repository.get(draftId),
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: async () => {
          throw new Error("disk unavailable");
        },
      },
    });
    await expect(failing.applyGeneratedSummary(request)).resolves.toMatchObject(
      {
        ok: false,
        code: "write_failed",
        issues: [expect.objectContaining({ message: "disk unavailable" })],
      },
    );
    await expect(repository.get("vector-insert")).resolves.toMatchObject({
      draft: { revision: 1 },
    });
  });

  it("keeps the review gate when report presentation metadata is absent", async () => {
    const { authoring, repository } = await generationFixture();
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
    });
    if (!context.ok) throw new Error("context build failed");
    const applied = await authoring.applyGeneratedSummary({
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        summary: {
          text: "在已知位置插入元素。",
          claims: [
            {
              id: "known-position-summary",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    });
    if (!applied.ok) throw new Error("summary apply failed");
    expect(applied.workspace.report).not.toHaveProperty("generatedSummaries");

    const resumed = createReferenceAuthoring({ drafts: repository });
    await expect(
      resumed.check({ draftId: "vector-insert" }),
    ).resolves.toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "generated-content-review-required",
            path: "generation/revision-2.json/review/status",
          }),
        ]),
      },
    });
  });
});
