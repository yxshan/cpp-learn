import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  validateAuthoringGenerationBundleTemplate,
  type DraftWorkspace,
} from "./index.js";

async function templateFixture() {
  const initial = createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => new Date("2026-09-08T01:00:00.000Z"),
  });
  const prepared = await initial.prepare({
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
  return createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository([workspace]),
  });
}

describe("[T-AUTH-A4-TEMPLATE-001] structured generation bundle templates", () => {
  it("builds an intentionally incomplete, schema-valid section bundle bound to fresh context", async () => {
    const authoring = await templateFixture();

    const result = await authoring.buildGenerationTemplate({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
      kind: "section",
      heading: "什么时候使用",
    });

    expect(result).toMatchObject({
      ok: true,
      template: {
        template: {
          schemaVersion: 1,
          status: "incomplete",
          kind: "section",
          requiredActions: ["write-content", "declare-claims", "mark-ready"],
        },
        expectedRevision: 1,
        context: {
          draftId: "vector-insert",
          policy: { allowedFactGroupIds: ["selection"] },
        },
        generation: {
          schemaVersion: 1,
          draftId: "vector-insert",
          section: {
            heading: "什么时候使用",
            markdown: "",
            claims: [],
          },
        },
      },
    });
    if (!result.ok) throw new Error("template build failed");
    expect(result.template.generation.contextDigest).toBe(
      result.template.context.digest,
    );
    expect(validateAuthoringGenerationBundleTemplate(result.template)).toEqual(
      [],
    );
  });

  it("builds summary and run-example variants with kind-specific placeholders", async () => {
    const authoring = await templateFixture();
    const summary = await authoring.buildGenerationTemplate({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
      kind: "summary",
    });
    const example = await authoring.buildGenerationTemplate({
      draftId: "vector-insert",
      factGroupIds: ["selection"],
      kind: "example",
      exampleId: "basic-insert",
    });

    expect(summary.ok && summary.template.generation).toMatchObject({
      summary: { text: "", claims: [] },
    });
    expect(example.ok && example.template.generation).toMatchObject({
      example: {
        id: "basic-insert",
        kind: "run",
        standard: "c++20",
        expectedStdout: "",
        source: "",
        claims: [],
      },
    });
  });

  it("rejects a heading outside the draft profile before returning a template", async () => {
    const authoring = await templateFixture();

    await expect(
      authoring.buildGenerationTemplate({
        draftId: "vector-insert",
        factGroupIds: ["selection"],
        kind: "section",
        heading: "不存在的章节",
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ path: "/heading", keyword: "enum" })],
    });
  });
});
