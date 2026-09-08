import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type AdvanceAuthoringBatchResult,
  type AuthoringGenerationBundleTemplate,
  type DraftWorkspace,
  type PrepareDraftTarget,
  type ReferenceAuthoring,
} from "./index.js";

async function preparedWorkspace(
  target: PrepareDraftTarget,
): Promise<DraftWorkspace> {
  const authoring = createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => new Date("2026-09-08T08:00:00.000Z"),
  });
  const prepared = await authoring.prepare({ target });
  if (!prepared.ok) throw new Error("fixture preparation failed");
  const source = {
    id: `working-draft-${target.entryId}`,
    kind: "primary" as const,
    title: "C++ Working Draft",
    url: "https://eel.is/c++draft/vector.modifiers",
    verifiedAt: "2026-09-08",
    standardSection: "[vector.modifiers]",
  };
  const facts = {
    ...prepared.workspace.facts,
    groups: prepared.workspace.facts.groups.map((group) =>
      group.id === "selection"
        ? {
            ...group,
            status: "verified" as const,
            summary: "Use this facility for the selected operation.",
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
  return {
    ...prepared.workspace,
    facts,
    sources,
    report,
    files: {
      ...files,
      "report.json": `${JSON.stringify(report, null, 2)}\n`,
    },
  };
}

async function batchFixture(): Promise<ReferenceAuthoring> {
  const base = await preparedWorkspace({
    entryId: "vector",
    kind: "type",
    slug: "standard-library/containers/vector",
    title: "std::vector",
  });
  const insert = await preparedWorkspace({
    entryId: "vector-insert",
    kind: "member",
    slug: "standard-library/containers/vector/insert",
    title: "std::vector::insert",
  });
  return createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository([base, insert]),
    clock: (() => {
      let minute = 1;
      return () =>
        new Date(`2026-09-08T08:${String(minute++).padStart(2, "0")}:00.000Z`);
    })(),
  });
}

function nextTemplate(
  result: AdvanceAuthoringBatchResult,
  memberId: string,
): AuthoringGenerationBundleTemplate {
  if (!result.ok) throw new Error("batch failed");
  const member = result.progress.members.find(({ id }) => id === memberId);
  if (member?.status !== "awaiting_generation") {
    throw new Error(`member ${memberId} is not ready`);
  }
  return member.run.next.template;
}

async function applySummary(
  authoring: ReferenceAuthoring,
  template: AuthoringGenerationBundleTemplate,
  text: string,
): Promise<void> {
  const applied = await authoring.applyGenerationBundle({
    ...template,
    template: { ...template.template, status: "ready" },
    generation: {
      schemaVersion: 1,
      draftId: template.context.draftId,
      contextDigest: template.context.digest,
      summary: {
        text,
        claims: [
          {
            id: "selection-summary",
            text: "Use this facility for the selected operation.",
            factGroupIds: ["selection"],
          },
        ],
      },
    },
  });
  expect(applied.ok).toBe(true);
}

describe("[T-AUTH-A5-BATCH-001] coherent authoring batch", () => {
  it("opens dependent runs in order and resumes to an idempotent completion", async () => {
    const authoring = await batchFixture();
    const plan = {
      schemaVersion: 1 as const,
      batchId: "vector-core",
      members: [
        {
          id: "insert",
          dependsOn: ["vector"],
          run: {
            schemaVersion: 1 as const,
            runId: "vector-core-insert",
            draftId: "vector-insert",
            steps: [
              {
                id: "summary",
                kind: "summary" as const,
                factGroupIds: ["selection"],
              },
            ],
          },
        },
        {
          id: "vector",
          dependsOn: [],
          run: {
            schemaVersion: 1 as const,
            runId: "vector-core-type",
            draftId: "vector",
            steps: [
              {
                id: "summary",
                kind: "summary" as const,
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      ],
    };

    const first = await authoring.advanceBatch(plan);
    expect(first).toMatchObject({
      ok: true,
      progress: {
        schemaVersion: 1,
        batchId: "vector-core",
        planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
        status: "awaiting_generation",
        members: [
          {
            id: "insert",
            status: "awaiting_dependency",
            dependencyIds: ["vector"],
          },
          { id: "vector", status: "awaiting_generation" },
        ],
      },
    });
    await applySummary(
      authoring,
      nextTemplate(first, "vector"),
      "动态连续序列容器。",
    );

    const second = await authoring.advanceBatch(plan);
    expect(second).toMatchObject({
      ok: true,
      progress: {
        status: "awaiting_generation",
        members: [
          { id: "insert", status: "awaiting_generation" },
          { id: "vector", status: "complete" },
        ],
      },
    });
    await applySummary(
      authoring,
      nextTemplate(second, "insert"),
      "在指定位置插入元素。",
    );

    const complete = await authoring.advanceBatch(plan);
    expect(complete).toMatchObject({
      ok: true,
      progress: {
        status: "complete",
        members: [
          { id: "insert", status: "complete" },
          { id: "vector", status: "complete" },
        ],
      },
    });
    await expect(authoring.advanceBatch(plan)).resolves.toEqual(complete);
  });

  it("reports every blocked member without hiding independent ready work", async () => {
    const authoring = await batchFixture();

    const result = await authoring.advanceBatch({
      schemaVersion: 1,
      batchId: "partially-blocked",
      members: [
        {
          id: "vector",
          dependsOn: [],
          run: {
            schemaVersion: 1,
            runId: "available-vector",
            draftId: "vector",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
        {
          id: "missing",
          dependsOn: [],
          run: {
            schemaVersion: 1,
            runId: "missing-vector-member",
            draftId: "vector-missing",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      progress: {
        status: "blocked",
        members: [
          { id: "vector", status: "awaiting_generation" },
          {
            id: "missing",
            status: "blocked",
            code: "draft_not_found",
            issues: [],
          },
        ],
      },
    });
  });

  it("advances five independent Entries in one batch call", async () => {
    const targets: PrepareDraftTarget[] = [
      {
        entryId: "vector",
        kind: "type",
        slug: "standard-library/containers/vector",
        title: "std::vector",
      },
      {
        entryId: "vector-begin",
        kind: "member",
        slug: "standard-library/containers/vector/begin",
        title: "std::vector::begin",
      },
      {
        entryId: "vector-end",
        kind: "member",
        slug: "standard-library/containers/vector/end",
        title: "std::vector::end",
      },
      {
        entryId: "vector-size",
        kind: "member",
        slug: "standard-library/containers/vector/size",
        title: "std::vector::size",
      },
      {
        entryId: "vector-insert",
        kind: "member",
        slug: "standard-library/containers/vector/insert",
        title: "std::vector::insert",
      },
    ];
    const workspaces = await Promise.all(targets.map(preparedWorkspace));
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(workspaces),
    });

    const result = await authoring.advanceBatch({
      schemaVersion: 1,
      batchId: "five-vector-entries",
      members: targets.map(({ entryId }) => ({
        id: entryId,
        dependsOn: [],
        run: {
          schemaVersion: 1,
          runId: `batch-${entryId}`,
          draftId: entryId,
          steps: [
            {
              id: "summary",
              kind: "summary",
              factGroupIds: ["selection"],
            },
          ],
        },
      })),
    });

    expect(result).toMatchObject({
      ok: true,
      progress: {
        status: "awaiting_generation",
        members: targets.map(({ entryId }) => ({
          id: entryId,
          status: "awaiting_generation",
        })),
      },
    });
  });

  it("rejects duplicate draft targets before advancing any member", async () => {
    const authoring = await batchFixture();

    await expect(
      authoring.advanceBatch({
        schemaVersion: 1,
        batchId: "duplicate-draft",
        members: [
          {
            id: "first",
            dependsOn: [],
            run: {
              schemaVersion: 1,
              runId: "first-vector-run",
              draftId: "vector",
              steps: [
                {
                  id: "summary",
                  kind: "summary",
                  factGroupIds: ["selection"],
                },
              ],
            },
          },
          {
            id: "second",
            dependsOn: ["first"],
            run: {
              schemaVersion: 1,
              runId: "second-vector-run",
              draftId: "vector",
              steps: [
                {
                  id: "usage",
                  kind: "section",
                  heading: "什么时候使用",
                  factGroupIds: ["selection"],
                },
              ],
            },
          },
        ],
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ keyword: "unique-draft" })],
    });
  });

  it.each([
    {
      name: "missing dependency",
      keyword: "dependency-not-found",
      members: [
        {
          id: "vector",
          dependsOn: ["missing"],
          run: {
            schemaVersion: 1,
            runId: "missing-dependency",
            draftId: "vector",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      ],
    },
    {
      name: "dependency cycle",
      keyword: "cycle",
      members: [
        {
          id: "vector",
          dependsOn: ["insert"],
          run: {
            schemaVersion: 1,
            runId: "cyclic-vector",
            draftId: "vector",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
        {
          id: "insert",
          dependsOn: ["vector"],
          run: {
            schemaVersion: 1,
            runId: "cyclic-insert",
            draftId: "vector-insert",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      ],
    },
    {
      name: "duplicate run ID",
      keyword: "unique-run",
      members: [
        {
          id: "vector",
          dependsOn: [],
          run: {
            schemaVersion: 1,
            runId: "duplicate-run",
            draftId: "vector",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
        {
          id: "insert",
          dependsOn: [],
          run: {
            schemaVersion: 1,
            runId: "duplicate-run",
            draftId: "vector-insert",
            steps: [
              {
                id: "summary",
                kind: "summary",
                factGroupIds: ["selection"],
              },
            ],
          },
        },
      ],
    },
  ])(
    "rejects $name before advancing the batch",
    async ({ keyword, members }) => {
      const authoring = await batchFixture();

      await expect(
        authoring.advanceBatch({
          schemaVersion: 1,
          batchId: "invalid-graph",
          members,
        }),
      ).resolves.toMatchObject({
        ok: false,
        code: "invalid_request",
        issues: [expect.objectContaining({ keyword })],
      });
    },
  );

  it("rejects an invalid child run before returning batch progress", async () => {
    const authoring = await batchFixture();

    await expect(
      authoring.advanceBatch({
        schemaVersion: 1,
        batchId: "invalid-child-run",
        members: [
          {
            id: "vector",
            dependsOn: [],
            run: {
              schemaVersion: 1,
              runId: "invalid-vector-run",
              draftId: "vector",
              steps: [
                {
                  id: "first-summary",
                  kind: "summary",
                  factGroupIds: ["selection"],
                },
                {
                  id: "second-summary",
                  kind: "summary",
                  factGroupIds: ["selection"],
                },
              ],
            },
          },
        ],
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [
        expect.objectContaining({
          path: "/members/0/run/steps/1",
          keyword: "unique-target",
        }),
      ],
    });
  });
});
