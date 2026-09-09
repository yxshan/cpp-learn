import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  authoringInputDigest,
  createFilesystemReferenceDraftRepository,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  type AuthoringFinding,
  type DraftWorkspace,
} from "./index.js";

async function repairFixture(findings: readonly AuthoringFinding[]) {
  const seed = createReferenceAuthoring({
    drafts: createInMemoryReferenceDraftRepository(),
    clock: () => new Date("2026-09-08T08:00:00.000Z"),
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
    verifiedAt: "2026-09-08",
    standardSection: "[vector.modifiers]",
  };
  const facts = {
    ...prepared.workspace.facts,
    groups: prepared.workspace.facts.groups.map((group) =>
      group.kind === "complexity" || group.kind === "examples"
        ? {
            ...group,
            status: "verified" as const,
            summary: `${group.kind} verified fact.`,
            sourceIds: [source.id],
          }
        : group,
    ),
  };
  const sources = { ...prepared.workspace.sources, sources: [source] };
  const blocked = findings.some(({ severity }) => severity === "hard");
  const draft = {
    ...prepared.workspace.draft,
    state: blocked ? ("draft" as const) : ("checked" as const),
  };
  const files = {
    ...prepared.workspace.files,
    "draft.json": `${JSON.stringify(draft, null, 2)}\n`,
    "facts.json": `${JSON.stringify(facts, null, 2)}\n`,
    "sources.json": `${JSON.stringify(sources, null, 2)}\n`,
  };
  const report = {
    ...prepared.workspace.report,
    draftRevision: draft.revision,
    inputDigest: authoringInputDigest(files),
    status: blocked ? ("blocked" as const) : ("ready" as const),
    findings,
    reviewQueue: findings.filter(
      (
        finding,
      ): finding is AuthoringFinding & { readonly severity: "warning" } =>
        finding.severity === "warning",
    ),
  };
  const workspace: DraftWorkspace = {
    ...prepared.workspace,
    draft,
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
    repository,
    authoring: createReferenceAuthoring({
      drafts: repository,
      examples: { validate: async () => [] },
      clock: () => new Date("2026-09-08T08:01:00.000Z"),
    }),
  };
}

const qualityFinding: AuthoringFinding = {
  severity: "warning",
  risk: "high",
  code: "content-quality",
  path: "content.md/complexity",
  message: "Canonical Reference quality area complexity is incomplete",
};

const exampleFinding: AuthoringFinding = {
  severity: "hard",
  risk: "high",
  code: "example-invalid",
  path: "examples/minimal.cpp/compile",
  message: "example does not compile",
};

describe("[T-AUTH-014] bounded quality repair loop", () => {
  it("translates only repairable findings into section and example targets", async () => {
    const unrelated: AuthoringFinding = {
      severity: "hard",
      risk: "high",
      code: "fact-unverified",
      path: "facts.json/groups/signature",
      message: "Fact group signature has not been reviewed",
    };
    const { authoring } = await repairFixture([
      qualityFinding,
      exampleFinding,
      unrelated,
    ]);

    const result = await authoring.buildRepairPlan({
      draftId: "vector-insert",
      repairId: "vector-insert-quality",
    });

    expect(result).toMatchObject({
      ok: true,
      status: "repairable",
      plan: {
        schemaVersion: 1,
        repairId: "vector-insert-quality",
        draftId: "vector-insert",
        maxAttempts: 3,
        attempts: [],
        targets: [
          {
            id: "section-complexity",
            kind: "section",
            heading: "复杂度",
            factGroupIds: ["complexity"],
          },
          {
            id: "example-minimal",
            kind: "example",
            exampleId: "minimal",
            factGroupIds: ["examples"],
          },
        ],
        ignoredFindingDigests: [expect.stringMatching(/^[a-f0-9]{64}$/u)],
        planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
  });

  it("returns a revision-bound template and exhausts a target after three rejected attempts", async () => {
    const { authoring, repository } = await repairFixture([qualityFinding]);
    const planned = await authoring.buildRepairPlan({
      draftId: "vector-insert",
      repairId: "vector-insert-quality",
    });
    if (!planned.ok || planned.status !== "repairable") {
      throw new Error("repair plan missing");
    }

    const first = await authoring.advanceRepair(planned.plan);
    expect(first).toMatchObject({
      ok: true,
      progress: {
        status: "awaiting_generation",
        exhaustedTargetIds: [],
        next: {
          targetId: "section-complexity",
          attempt: 1,
          maxAttempts: 3,
          template: {
            expectedRevision: 1,
            context: {
              draftRevision: 1,
              profile: "callable",
              policy: { allowedFactGroupIds: ["complexity"] },
            },
            generation: { section: { heading: "复杂度" } },
          },
        },
      },
    });

    await expect(authoring.advanceRepair(planned.plan)).resolves.toMatchObject({
      ok: true,
      progress: { next: { attempt: 2 } },
    });
    await expect(authoring.advanceRepair(planned.plan)).resolves.toMatchObject({
      ok: true,
      progress: { next: { attempt: 3 } },
    });
    const exhausted = await authoring.advanceRepair(planned.plan);
    expect(exhausted).toMatchObject({
      ok: true,
      progress: {
        status: "exhausted",
        exhaustedTargetIds: ["section-complexity"],
      },
    });
    expect(exhausted.ok && exhausted.progress).not.toHaveProperty("next");
    const persisted = await repository.get("vector-insert");
    const statePath = Object.keys(persisted?.files ?? {}).find((path) =>
      path.startsWith("repair/vector-insert-quality-"),
    );
    expect(statePath).toBeDefined();
    expect(JSON.parse(persisted!.files[statePath!]!)).toMatchObject({
      attempts: [{ attempt: 1 }, { attempt: 2 }, { attempt: 3 }],
    });
  });

  it("creates one repair target for every missing profile example", async () => {
    const missingExamples: AuthoringFinding = {
      severity: "hard",
      risk: "medium",
      code: "examples-missing",
      path: "entry.json/examples",
      message: "Profile requires at least 2 example(s)",
    };
    const { authoring } = await repairFixture([missingExamples]);

    const result = await authoring.buildRepairPlan({
      draftId: "vector-insert",
      repairId: "vector-insert-examples",
    });

    expect(result).toMatchObject({
      ok: true,
      status: "repairable",
      plan: {
        targets: [
          { id: "example-minimal", exampleId: "minimal" },
          { id: "example-realistic", exampleId: "realistic" },
        ],
      },
    });
  });

  it("refuses a changed baseline and keeps successful repairs behind a fresh full check", async () => {
    const { authoring, repository } = await repairFixture([qualityFinding]);
    const planned = await authoring.buildRepairPlan({
      draftId: "vector-insert",
      repairId: "vector-insert-quality",
    });
    if (!planned.ok || planned.status !== "repairable") {
      throw new Error("repair plan missing");
    }
    const advanced = await authoring.advanceRepair(planned.plan);
    if (!advanced.ok || advanced.progress.next === undefined) {
      throw new Error("repair template missing");
    }
    const template = advanced.progress.next.template;
    const applied = await authoring.applyGenerationBundle({
      ...template,
      template: { ...template.template, status: "ready" },
      generation: {
        ...template.generation,
        section: {
          heading: "复杂度",
          markdown: "在插入点之后元素数量上线性复杂度。",
          claims: [
            {
              id: "linear-after-position",
              text: "Complexity is linear in elements after the insertion point.",
              factGroupIds: ["complexity"],
            },
          ],
        },
      },
    });
    expect(applied).toMatchObject({
      ok: true,
      workspace: {
        draft: { revision: 2, state: "draft" },
        report: { status: "not_checked" },
      },
    });
    await expect(authoring.advanceRepair(planned.plan)).resolves.toMatchObject({
      ok: false,
      code: "repair_blocked",
      issues: [expect.objectContaining({ keyword: "baseline-changed" })],
    });
    await expect(repository.get("vector-insert")).resolves.toMatchObject({
      report: { status: "not_checked" },
    });
  });

  it("persists the attempt bound across fresh filesystem adapters", async () => {
    const fixture = await repairFixture([qualityFinding]);
    const workspace = await fixture.repository.get("vector-insert");
    if (workspace === undefined) throw new Error("fixture workspace missing");
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-repair-"));
    try {
      const drafts = createFilesystemReferenceDraftRepository({ root });
      await drafts.reserve(workspace);
      const first = createReferenceAuthoring({ drafts });
      const planned = await first.buildRepairPlan({
        draftId: "vector-insert",
        repairId: "vector-insert-quality",
      });
      if (!planned.ok || planned.status !== "repairable") {
        throw new Error("repair plan missing");
      }
      await first.advanceRepair(planned.plan);
      await first.advanceRepair(planned.plan);
      await first.advanceRepair(planned.plan);

      const resumed = createReferenceAuthoring({
        drafts: createFilesystemReferenceDraftRepository({ root }),
      });
      await expect(resumed.advanceRepair(planned.plan)).resolves.toMatchObject({
        ok: true,
        progress: {
          status: "exhausted",
          exhaustedTargetIds: ["section-complexity"],
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
