import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type DraftWorkspace,
} from "./index.js";
import { generationCompletesAuthoringRunStep } from "./run.js";

async function runFixture() {
  const initial = createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => new Date("2026-09-08T05:00:00.000Z"),
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
    clock: (() => {
      let minute = 5;
      return () =>
        new Date(`2026-09-08T05:${String(minute++).padStart(2, "0")}:00.000Z`);
    })(),
  });
}

describe("[T-AUTH-A4-RUN-001] provider-neutral authoring run", () => {
  it("resumes from Generation Receipts and returns the next fresh template", async () => {
    const authoring = await runFixture();
    const plan = {
      schemaVersion: 1 as const,
      runId: "vector-insert-core",
      draftId: "vector-insert",
      steps: [
        {
          id: "summary",
          kind: "summary" as const,
          factGroupIds: ["selection"],
        },
        {
          id: "usage",
          kind: "section" as const,
          heading: "什么时候使用",
          factGroupIds: ["selection"],
        },
      ],
    };

    const first = await authoring.advanceRun(plan);
    expect(first).toMatchObject({
      ok: true,
      progress: {
        schemaVersion: 1,
        runId: "vector-insert-core",
        draftId: "vector-insert",
        planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
        status: "awaiting_generation",
        currentRevision: 1,
        completedStepIds: [],
        pendingStepIds: ["summary", "usage"],
        next: {
          stepId: "summary",
          template: {
            orchestration: {
              schemaVersion: 1,
              runId: "vector-insert-core",
              stepId: "summary",
              planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
              factGroupIds: ["selection"],
            },
            template: { status: "incomplete", kind: "summary" },
            expectedRevision: 1,
            generation: { summary: { text: "", claims: [] } },
          },
        },
      },
    });
    await expect(authoring.advanceRun(plan)).resolves.toEqual(first);
    if (!first.ok || first.progress.next === undefined) {
      throw new Error("first run step missing");
    }
    const summaryTemplate = first.progress.next.template;
    const summaryBundle = {
      ...summaryTemplate,
      template: { ...summaryTemplate.template, status: "ready" },
      generation: {
        schemaVersion: 1,
        draftId: summaryTemplate.context.draftId,
        contextDigest: summaryTemplate.context.digest,
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
    } as const;
    await expect(
      authoring.applyGenerationBundle({
        ...summaryBundle,
        orchestration: {
          ...summaryTemplate.orchestration!,
          factGroupIds: ["selection", "complexity"],
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ keyword: "fact-context-mismatch" })],
    });
    const summaryApplied = await authoring.applyGenerationBundle(summaryBundle);
    expect(summaryApplied.ok).toBe(true);

    await expect(
      authoring.advanceRun({
        ...plan,
        steps: [
          ...plan.steps,
          {
            id: "extra-example",
            kind: "example",
            exampleId: "extra",
            factGroupIds: ["selection"],
          },
        ],
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "run_blocked",
      issues: [expect.objectContaining({ keyword: "plan-changed" })],
    });

    const second = await authoring.advanceRun(plan);
    expect(second).toMatchObject({
      ok: true,
      progress: {
        status: "awaiting_generation",
        currentRevision: 2,
        completedStepIds: ["summary"],
        pendingStepIds: ["usage"],
        next: {
          stepId: "usage",
          template: {
            orchestration: {
              schemaVersion: 1,
              runId: "vector-insert-core",
              stepId: "usage",
              planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
              factGroupIds: ["selection"],
            },
            template: { kind: "section", status: "incomplete" },
            expectedRevision: 2,
            generation: {
              section: { heading: "什么时候使用", markdown: "", claims: [] },
            },
          },
        },
      },
    });
    if (!second.ok || second.progress.next === undefined) {
      throw new Error("second run step missing");
    }
    const sectionTemplate = second.progress.next.template;
    const sectionApplied = await authoring.applyGenerationBundle({
      ...sectionTemplate,
      template: { ...sectionTemplate.template, status: "ready" },
      generation: {
        schemaVersion: 1,
        draftId: sectionTemplate.context.draftId,
        contextDigest: sectionTemplate.context.digest,
        section: {
          heading: "什么时候使用",
          markdown: "当插入位置已知时使用 `insert`。",
          claims: [
            {
              id: "known-position-section",
              text: "Use insert when the insertion position is known.",
              factGroupIds: ["selection"],
            },
          ],
        },
      },
    });
    expect(sectionApplied.ok).toBe(true);

    await expect(authoring.advanceRun(plan)).resolves.toMatchObject({
      ok: true,
      progress: {
        status: "complete",
        currentRevision: 3,
        completedStepIds: ["summary", "usage"],
        pendingStepIds: [],
      },
    });
  });

  it("matches an example receipt to the planned execution contract", () => {
    const generation = {
      schemaVersion: 1 as const,
      draftId: "vector-insert",
      contextDigest: "a".repeat(64),
      example: {
        id: "basic-insert",
        kind: "compile" as const,
        standard: "c++23" as const,
        source: "int main() {}\n",
        claims: [],
      },
    };

    expect(
      generationCompletesAuthoringRunStep(
        {
          id: "example",
          kind: "example",
          exampleId: "basic-insert",
          factGroupIds: [],
        },
        generation,
        {
          schemaVersion: 1,
          runId: "example-run",
          planDigest: "b".repeat(64),
          stepId: "example",
          factGroupIds: [],
        },
      ),
    ).toBe(false);
    expect(
      generationCompletesAuthoringRunStep(
        {
          id: "example",
          kind: "example",
          exampleId: "basic-insert",
          exampleKind: "compile",
          standard: "c++23",
          factGroupIds: [],
        },
        generation,
        {
          schemaVersion: 1,
          runId: "example-run",
          planDigest: "b".repeat(64),
          stepId: "example",
          factGroupIds: [],
        },
      ),
    ).toBe(true);
  });

  it("rejects duplicate targets so receipt matching remains unambiguous", async () => {
    const authoring = await runFixture();

    await expect(
      authoring.advanceRun({
        schemaVersion: 1,
        runId: "duplicate-summary",
        draftId: "vector-insert",
        steps: [
          { id: "first", kind: "summary", factGroupIds: ["selection"] },
          { id: "second", kind: "summary", factGroupIds: ["selection"] },
        ],
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
      issues: [expect.objectContaining({ keyword: "unique-target" })],
    });
  });

  it("allows plan editing until the first receipt establishes run identity", async () => {
    const authoring = await runFixture();
    const initial = await authoring.advanceRun({
      schemaVersion: 1,
      runId: "editable-before-start",
      draftId: "vector-insert",
      steps: [{ id: "summary", kind: "summary", factGroupIds: ["selection"] }],
    });
    const revised = await authoring.advanceRun({
      schemaVersion: 1,
      runId: "editable-before-start",
      draftId: "vector-insert",
      steps: [
        { id: "summary", kind: "summary", factGroupIds: ["selection"] },
        {
          id: "usage",
          kind: "section",
          heading: "什么时候使用",
          factGroupIds: ["selection"],
        },
      ],
    });

    expect(initial).toMatchObject({ ok: true });
    expect(revised).toMatchObject({ ok: true });
    if (!initial.ok || !revised.ok) throw new Error("run planning failed");
    expect(revised.progress.planDigest).not.toBe(initial.progress.planDigest);
  });
});
