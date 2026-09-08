import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type DraftWorkspace,
} from "./index.js";

async function exampleFixture(options: {
  readonly validate: () => Promise<
    readonly {
      readonly path: string;
      readonly message: string;
      readonly keyword: string;
    }[]
  >;
}) {
  const seed = createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => new Date("2026-09-07T20:00:00.000Z"),
  });
  const prepared = await seed.prepare({
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
      group.id === "examples"
        ? {
            ...group,
            status: "verified" as const,
            summary: "A deterministic insertion example prints 1 2 3.",
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
      examples: { validate: options.validate },
      clock: () => new Date("2026-09-07T20:05:00.000Z"),
    }),
    repository,
    workspace,
  };
}

const exampleSource = [
  "#include <iostream>",
  "#include <vector>",
  "",
  "int main() {",
  "  std::vector<int> values{1, 3};",
  "  values.insert(values.begin() + 1, 2);",
  "  for (const int value : values) {",
  '    std::cout << value << " ";',
  "  }",
  '  std::cout << "\\n";',
  "}",
  "",
].join("\n");

function generatedExample(
  contextDigest: string,
  overrides: Partial<{
    id: string;
    kind: "compile" | "run" | "expected-compile-failure";
    standard: "c++20";
    expectedStdout: string;
    source: string;
  }> = {},
) {
  return {
    schemaVersion: 1 as const,
    draftId: "vector-insert",
    contextDigest,
    example: {
      id: "minimal",
      kind: "run" as const,
      standard: "c++20" as const,
      expectedStdout: "1 2 3 \n",
      source: exampleSource,
      claims: [
        {
          id: "deterministic-insert-example",
          text: "A deterministic insertion example prints 1 2 3.",
          factGroupIds: ["examples"],
        },
      ],
      ...overrides,
    },
  };
}

describe("[T-AUTH-A4-EXAMPLE-001] generated Reference Example ingestion", () => {
  it("atomically installs a validated source, manifest, receipt, and review gate", async () => {
    const { authoring, repository } = await exampleFixture({
      validate: async () => [],
    });
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");

    const applied = await authoring.applyGeneratedExample({
      context: context.pack,
      expectedRevision: 1,
      generation: {
        schemaVersion: 1,
        draftId: "vector-insert",
        contextDigest: context.pack.digest,
        example: {
          id: "minimal",
          kind: "run",
          standard: "c++20",
          expectedStdout: "1 2 3 \n",
          source: exampleSource,
          claims: [
            {
              id: "deterministic-insert-example",
              text: "A deterministic insertion example prints 1 2 3.",
              factGroupIds: ["examples"],
            },
          ],
        },
      },
    });

    expect(applied).toMatchObject({
      ok: true,
      workspace: { draft: { revision: 2, state: "draft" } },
      receiptPath: "generation/revision-2.json",
    });
    if (!applied.ok) throw new Error("example apply failed");
    expect(applied.workspace.files["examples/minimal.cpp"]).toBe(exampleSource);
    expect(JSON.parse(applied.workspace.files["entry.json"]!)).toMatchObject({
      examples: [
        {
          id: "minimal",
          path: "entries/vector-insert/examples/minimal.cpp",
          kind: "run",
          standard: "c++20",
          expectedStdout: "1 2 3 \n",
        },
      ],
    });
    expect(
      JSON.parse(applied.workspace.files["generation/revision-2.json"]!),
    ).toMatchObject({ generation: { example: { id: "minimal" } } });
    await expect(repository.get("vector-insert")).resolves.toMatchObject({
      draft: { revision: 2 },
    });
    await expect(
      authoring.check({ draftId: "vector-insert" }),
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

  it("keeps the complete draft unchanged when bounded validation rejects the source", async () => {
    const { authoring, repository } = await exampleFixture({
      validate: async () => [
        { path: "/", message: "compile failed", keyword: "compiler" },
      ],
    });
    const before = await repository.get("vector-insert");
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");

    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          schemaVersion: 1,
          draftId: "vector-insert",
          contextDigest: context.pack.digest,
          example: {
            id: "minimal",
            kind: "run",
            standard: "c++20",
            expectedStdout: "1 2 3 \n",
            source: exampleSource,
            claims: [
              {
                id: "deterministic-insert-example",
                text: "A deterministic insertion example prints 1 2 3.",
                factGroupIds: ["examples"],
              },
            ],
          },
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "example_invalid",
      issues: [expect.objectContaining({ message: "compile failed" })],
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("rejects unsafe file input and claims outside the verified context", async () => {
    const { authoring, repository } = await exampleFixture({
      validate: async () => [],
    });
    const before = await repository.get("vector-insert");
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");

    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          ...generatedExample(context.pack.digest),
          example: {
            ...generatedExample(context.pack.digest).example,
            path: "../../outside.cpp",
          },
        } as never,
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: generatedExample(context.pack.digest, {
          source: `${"中".repeat(50_000)}\n`,
        }),
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: generatedExample(context.pack.digest, {
          source: exampleSource.trimEnd(),
        }),
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_request" });
    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: {
          ...generatedExample(context.pack.digest),
          example: {
            ...generatedExample(context.pack.digest).example,
            claims: [
              {
                id: "unsupported-complexity",
                text: "Insertion is always constant time.",
                factGroupIds: ["complexity"],
              },
            ],
          },
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: "generation_blocked" });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("reports unavailable, failed, and conflicting validation without mutation", async () => {
    const { authoring, repository } = await exampleFixture({
      validate: async () => [],
    });
    const before = await repository.get("vector-insert");
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");
    const request = {
      context: context.pack,
      expectedRevision: 1,
      generation: generatedExample(context.pack.digest),
    };

    await expect(
      createReferenceAuthoring({ drafts: repository }).applyGeneratedExample(
        request,
      ),
    ).resolves.toMatchObject({
      ok: false,
      code: "example_validator_unavailable",
    });
    await expect(
      authoring.applyGeneratedExample({ ...request, expectedRevision: 2 }),
    ).resolves.toMatchObject({ ok: false, code: "revision_conflict" });
    const failing = createReferenceAuthoring({
      drafts: repository,
      examples: {
        validate: async () => {
          throw new Error("compiler unavailable");
        },
      },
    });
    await expect(failing.applyGeneratedExample(request)).resolves.toMatchObject(
      {
        ok: false,
        code: "example_validation_failed",
        issues: [expect.objectContaining({ message: "compiler unavailable" })],
      },
    );
    const conflicting = createReferenceAuthoring({
      drafts: {
        get: (draftId) => repository.get(draftId),
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: async () => false,
      },
      examples: { validate: async () => [] },
    });
    await expect(
      conflicting.applyGeneratedExample(request),
    ).resolves.toMatchObject({ ok: false, code: "write_conflict" });
    const unwritable = createReferenceAuthoring({
      drafts: {
        get: (draftId) => repository.get(draftId),
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: async () => {
          throw new Error("disk unavailable");
        },
      },
      examples: { validate: async () => [] },
    });
    await expect(
      unwritable.applyGeneratedExample(request),
    ).resolves.toMatchObject({
      ok: false,
      code: "write_failed",
      issues: [expect.objectContaining({ message: "disk unavailable" })],
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(before);
  });

  it("rejects a same-revision author-input change before validation", async () => {
    const { authoring, repository } = await exampleFixture({
      validate: async () => [],
    });
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");
    let reads = 0;
    const changed = createReferenceAuthoring({
      drafts: {
        reserve: (workspace) => repository.reserve(workspace),
        commitWorkspace: (input) => repository.commitWorkspace(input),
        async get(draftId) {
          const workspace = await repository.get(draftId);
          reads += 1;
          if (reads !== 2 || workspace === undefined) return workspace;
          return {
            ...workspace,
            files: {
              ...workspace.files,
              "content.md": `${workspace.files["content.md"]}\nchanged`,
            },
          };
        },
      },
      examples: { validate: async () => [] },
    });

    await expect(
      changed.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: generatedExample(context.pack.digest),
      }),
    ).resolves.toMatchObject({ ok: false, code: "context_changed" });
  });

  it("updates an existing example id without duplicating its manifest", async () => {
    const { authoring } = await exampleFixture({ validate: async () => [] });
    const firstContext = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!firstContext.ok) throw new Error("first context build failed");
    const first = await authoring.applyGeneratedExample({
      context: firstContext.pack,
      expectedRevision: 1,
      generation: generatedExample(firstContext.pack.digest),
    });
    if (!first.ok) throw new Error("first example apply failed");
    const nextContext = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!nextContext.ok) throw new Error("next context build failed");
    const updatedSource = exampleSource.replace('" "', '" | "');

    const updated = await authoring.applyGeneratedExample({
      context: nextContext.pack,
      expectedRevision: 2,
      generation: generatedExample(nextContext.pack.digest, {
        source: updatedSource,
        expectedStdout: "1 | 2 | 3 | \n",
      }),
    });

    expect(updated).toMatchObject({
      ok: true,
      workspace: { draft: { revision: 3 } },
    });
    if (!updated.ok) throw new Error("updated example apply failed");
    expect(JSON.parse(updated.workspace.files["entry.json"]!).examples).toEqual(
      [
        expect.objectContaining({
          id: "minimal",
          expectedStdout: "1 | 2 | 3 | \n",
        }),
      ],
    );
    expect(updated.workspace.files["examples/minimal.cpp"]).toBe(updatedSource);
  });

  it("never overwrites an unregistered author-created source file", async () => {
    const fixture = await exampleFixture({ validate: async () => [] });
    const authorSource = "int main() { return 7; }\n";
    const files = {
      ...fixture.workspace.files,
      "examples/minimal.cpp": authorSource,
    };
    const report = {
      ...fixture.workspace.report,
      inputDigest: authoringInputDigest(files),
    };
    const workspace: DraftWorkspace = {
      ...fixture.workspace,
      report,
      files: {
        ...files,
        "report.json": `${JSON.stringify(report, null, 2)}\n`,
      },
    };
    const repository = createInMemoryReferenceDraftRepository([workspace]);
    const authoring = createReferenceAuthoring({
      drafts: repository,
      examples: { validate: async () => [] },
    });
    const context = await authoring.buildContext({
      draftId: "vector-insert",
      factGroupIds: ["examples"],
    });
    if (!context.ok) throw new Error("context build failed");

    await expect(
      authoring.applyGeneratedExample({
        context: context.pack,
        expectedRevision: 1,
        generation: generatedExample(context.pack.digest),
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ keyword: "file-conflict" })],
    });
    await expect(repository.get("vector-insert")).resolves.toEqual(workspace);
  });
});
