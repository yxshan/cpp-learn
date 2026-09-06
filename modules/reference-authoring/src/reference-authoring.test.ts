import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { REFERENCE_ENTRY_KINDS } from "@cpp-learn/contracts";

import {
  authoringDraftSchema,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  validateAuthoringCatalogProposal,
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringPublicationPlan,
  validateAuthoringReport,
  validateAuthoringSourceLedger,
  type AuthoringCatalogContext,
  type DraftWorkspace,
  type PrepareDraftRequest,
} from "./index.js";

interface GoldenProfile {
  readonly name: string;
  readonly target: PrepareDraftRequest["target"];
  readonly profile: string;
  readonly factKinds: readonly string[];
  readonly requiredHeadings: readonly string[];
  readonly examplePaths: readonly string[];
}

const fixtures = JSON.parse(
  await readFile(
    fileURLToPath(new URL("./fixtures/golden-profiles.json", import.meta.url)),
    "utf8",
  ),
) as readonly GoldenProfile[];
const fixedNow = new Date("2026-09-06T09:30:00.000Z");

describe("[T-AUTH-001] Reference authoring golden profiles", () => {
  it.each(fixtures)(
    "prepares the $name profile without touching canonical Reference files",
    async (fixture) => {
      const drafts = createInMemoryReferenceDraftRepository();
      const authoring = createReferenceAuthoring({
        drafts,
        clock: () => fixedNow,
      });

      const result = await authoring.prepare({ target: fixture.target });

      expect(result).toMatchObject({ ok: true, created: true });
      if (!result.ok) return;
      expect(result.workspace.draft).toMatchObject({
        schemaVersion: 1,
        draftId: fixture.target.entryId,
        revision: 1,
        state: "draft",
        profile: fixture.profile,
        target: fixture.target,
        targetPaths: {
          entry: `entries/${fixture.target.entryId}/entry.json`,
          content: `entries/${fixture.target.entryId}/content.md`,
          examples: `entries/${fixture.target.entryId}/examples`,
          catalog: "catalog.json",
        },
        affectedEntryIds: [fixture.target.entryId],
        createdAt: fixedNow.toISOString(),
        updatedAt: fixedNow.toISOString(),
      });
      expect(result.workspace.facts.groups.map((group) => group.kind)).toEqual(
        fixture.factKinds,
      );
      expect(
        Object.keys(result.workspace.files)
          .filter((path) => path.startsWith("examples/"))
          .sort(),
      ).toEqual([...fixture.examplePaths].sort());
      for (const heading of fixture.requiredHeadings) {
        expect(result.workspace.files["content.md"]).toContain(heading);
      }
      expect(Object.keys(result.workspace.files)).not.toEqual(
        expect.arrayContaining(["reference/catalog.json"]),
      );
      expect(await drafts.get(fixture.target.entryId)).toEqual(
        result.workspace,
      );
      expect(result.workspace.files).toMatchSnapshot();
    },
  );

  it("resumes an existing draft without replacing its revision or files", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts,
      clock: () => fixedNow,
    });
    const request = { target: fixtures[0]!.target };

    const first = await authoring.prepare(request);
    const resumed = await authoring.prepare(request);

    expect(first).toMatchObject({ ok: true, created: true });
    expect(resumed).toEqual(
      first.ok
        ? { ok: true, created: false, workspace: first.workspace }
        : first,
    );
  });

  it("rejects a conflicting target without replacing the reserved draft", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts,
      clock: () => fixedNow,
    });
    const target = fixtures[0]!.target;
    const first = await authoring.prepare({ target });

    const conflict = await authoring.prepare({
      target: { ...target, slug: "standard-library/containers/vector/append" },
    });

    expect(conflict).toMatchObject({
      ok: false,
      code: "draft_conflict",
      issues: [expect.objectContaining({ path: "/target" })],
    });
    expect(await drafts.get(target.entryId)).toEqual(
      first.ok ? first.workspace : undefined,
    );
  });

  it("atomically reserves an Entry ID across concurrent prepare calls", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts,
      clock: () => fixedNow,
    });
    const target = fixtures[0]!.target;

    const [first, second] = await Promise.all([
      authoring.prepare({ target }),
      authoring.prepare({
        target: {
          ...target,
          slug: "standard-library/containers/vector/append",
        },
      }),
    ]);

    expect(first).toMatchObject({ ok: true, created: true });
    expect(second).toMatchObject({ ok: false, code: "draft_conflict" });
    expect((await drafts.get(target.entryId))?.draft.target).toEqual(target);
  });

  it("keeps stored drafts isolated from mutable caller copies", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts,
      clock: () => fixedNow,
    });
    const result = await authoring.prepare({ target: fixtures[0]!.target });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const callerFiles = result.workspace.files as Record<string, string>;
    callerFiles["content.md"] = "caller mutation";

    const stored = await drafts.get(result.workspace.draft.draftId);
    expect(stored?.files["content.md"]).not.toBe("caller mutation");
  });

  it("rejects unsafe identity fields before storing a draft", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });

    const result = await authoring.prepare({
      target: {
        entryId: "../std-vector",
        kind: "member",
        slug: "/outside/vector",
        title: "std::vector::insert",
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_request",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/target/entryId" }),
        expect.objectContaining({ path: "/target/slug" }),
      ]),
    });
    expect(await drafts.get("../std-vector")).toBeUndefined();
  });

  it("returns a validation issue for an unknown runtime Entry kind", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    const request = {
      target: {
        entryId: "std-vector",
        kind: "class",
        slug: "standard-library/containers/vector",
        title: "std::vector",
      },
    } as unknown as PrepareDraftRequest;

    const result = await authoring.prepare(request);
    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/target/kind" }),
      ]),
    );
    expect(await drafts.get("std-vector")).toBeUndefined();
  });
});

describe("[T-AUTH-SCHEMA-001] Reference authoring artifact schemas", () => {
  it("keeps the draft kind vocabulary aligned with Reference contracts", () => {
    expect(authoringDraftSchema.$defs.entryKind.enum).toEqual([
      ...REFERENCE_ENTRY_KINDS,
    ]);
  });

  it("accepts every artifact produced by prepare", async () => {
    const result = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
      clock: () => fixedNow,
    }).prepare({ target: fixtures[0]!.target });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validateAuthoringDraft(result.workspace.draft)).toEqual([]);
    expect(validateAuthoringCatalogProposal(result.workspace.proposal)).toEqual(
      [],
    );
    expect(validateAuthoringFactSheet(result.workspace.facts)).toEqual([]);
    expect(validateAuthoringSourceLedger(result.workspace.sources)).toEqual([]);
    expect(validateAuthoringReport(result.workspace.report)).toEqual([]);
  });

  it("rejects stale revisions, unknown fact kinds, invalid sources, and unsafe publication paths", () => {
    expect(
      validateAuthoringDraft({
        schemaVersion: 1,
        draftId: "std-vector",
        revision: 0,
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "/revision" })]),
    );
    expect(
      validateAuthoringFactSheet({
        schemaVersion: 1,
        draftId: "std-vector",
        groups: [
          {
            id: "mystery",
            kind: "copied_prose",
            status: "verified",
            summary: "unchecked",
            sourceIds: [],
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/groups/0/kind" }),
      ]),
    );
    expect(
      validateAuthoringSourceLedger({
        schemaVersion: 1,
        draftId: "std-vector",
        sources: [
          {
            id: "source-1",
            kind: "primary",
            title: "Broken source",
            url: "not-a-url",
            verifiedAt: "yesterday",
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/sources/0/url" }),
        expect.objectContaining({ path: "/sources/0/verifiedAt" }),
      ]),
    );
    expect(
      validateAuthoringPublicationPlan({
        schemaVersion: 1,
        draftId: "std-vector",
        expectedRevision: 1,
        mode: "dry_run",
        files: [{ path: "../catalog.json", digest: "bad" }],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/files/0/path" }),
        expect.objectContaining({ path: "/files/0/digest" }),
      ]),
    );
  });

  it("accepts a safe dry-run publication plan without performing publication", () => {
    expect(
      validateAuthoringPublicationPlan({
        schemaVersion: 1,
        draftId: "std-vector",
        expectedRevision: 1,
        mode: "dry_run",
        files: [
          {
            path: "entries/std-vector/content.md",
            digest: "a".repeat(64),
          },
        ],
      }),
    ).toEqual([]);
  });

  it("does not treat unsourced facts or unexplained omissions as reviewed", () => {
    const baseGroup = {
      id: "complexity",
      kind: "complexity",
      summary: "Constant time",
      sourceIds: [],
    } as const;

    expect(
      validateAuthoringFactSheet({
        schemaVersion: 1,
        draftId: "std-vector",
        groups: [{ ...baseGroup, status: "verified" }],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/groups/0/sourceIds" }),
      ]),
    );
    expect(
      validateAuthoringFactSheet({
        schemaVersion: 1,
        draftId: "std-vector",
        groups: [{ ...baseGroup, status: "not_applicable" }],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/groups/0/decision" }),
      ]),
    );
  });
});

describe("[T-AUTH-A1-CHECK-001] Reference authoring draft checks", () => {
  const catalog: AuthoringCatalogContext = {
    entries: [
      {
        id: "std-vector",
        slug: "standard-library/containers/vector",
        kind: "type",
        title: "std::vector",
        symbol: "std::vector",
        header: "<vector>",
        categories: ["containers"],
        relatedEntryIds: ["header-vector"],
      },
      {
        id: "header-vector",
        slug: "standard-library/headers/vector",
        kind: "header",
        title: "<vector>",
        symbol: "<vector>",
        categories: ["containers"],
        relatedEntryIds: ["std-vector"],
      },
      {
        id: "containers",
        slug: "standard-library/containers",
        kind: "landing",
        title: "容器库",
        categories: ["containers"],
        relatedEntryIds: [],
      },
    ],
    entryIds: ["std-vector", "header-vector", "containers"],
    categoryIds: ["containers"],
    slugsByEntryId: {
      "std-vector": "standard-library/containers/vector",
      "header-vector": "standard-library/headers/vector",
      containers: "standard-library/containers",
    },
    redirects: [],
  };

  it("blocks an untouched prepared draft with actionable findings", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts,
      catalog: { load: async () => catalog },
      examples: { validate: async () => [] },
      quality: { validate: async () => [] },
      clock: () => fixedNow,
    });
    const prepared = await authoring.prepare({ target: fixtures[0]!.target });
    expect(prepared.ok).toBe(true);

    const checked = await authoring.check({ draftId: "std-vector-insert" });

    expect(checked).toMatchObject({ ok: true });
    if (!checked.ok) return;
    expect(checked.report.status).toBe("blocked");
    expect(checked.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "entry-schema" }),
        expect.objectContaining({ code: "fact-unverified" }),
        expect.objectContaining({ code: "content-placeholder" }),
      ]),
    );
  });

  it("prepares catalog-backed related context and a reviewable catalog proposal", async () => {
    const result = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
      catalog: { load: async () => catalog },
      clock: () => fixedNow,
    }).prepare({ target: fixtures[0]!.target });

    expect(result).toMatchObject({
      ok: true,
      workspace: {
        draft: {
          affectedEntryIds: [
            "std-vector-insert",
            "std-vector",
            "header-vector",
          ],
        },
      },
    });
    if (!result.ok) return;
    expect(JSON.parse(result.workspace.files["entry.json"]!)).toMatchObject({
      categories: ["containers"],
      relatedEntryIds: ["std-vector", "header-vector"],
    });
    expect(
      JSON.parse(result.workspace.files["catalog-proposal.json"]!),
    ).toMatchObject({
      schemaVersion: 1,
      draftId: "std-vector-insert",
      entryPath: "entries/std-vector-insert/entry.json",
      categories: ["containers"],
      relatedEntryIds: ["std-vector", "header-vector"],
    });
  });

  it("checks and persists a complete draft through the Module Interface", async () => {
    const prepared = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
      catalog: { load: async () => catalog },
      clock: () => fixedNow,
    }).prepare({ target: fixtures[0]!.target });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const source = {
      id: "working-draft-vector-modifiers",
      kind: "primary" as const,
      title: "C++ Working Draft [vector.modifiers]",
      url: "https://eel.is/c++draft/vector.modifiers",
      verifiedAt: "2026-09-06",
      standardSection: "[vector.modifiers]",
    };
    const secondarySource = {
      id: "cppreference-vector-insert",
      kind: "secondary" as const,
      title: "std::vector::insert",
      url: "https://en.cppreference.com/w/cpp/container/vector/insert",
      verifiedAt: "2026-09-06",
    };
    const content = prepared.workspace.files["content.md"]!.replaceAll(
      "TODO",
      "已由作者依据来源完成。",
    );
    const entry = {
      schemaVersion: 2,
      id: "std-vector-insert",
      version: 1,
      slug: "standard-library/containers/vector/insert",
      kind: "member",
      title: "std::vector::insert",
      summary: "在指定位置插入元素。",
      symbol: "std::vector::insert",
      header: "<vector>",
      namespace: "std",
      since: "c++98",
      aliases: [],
      categories: ["containers"],
      relatedEntryIds: ["std-vector", "header-vector"],
      content: {
        format: "markdown",
        path: "entries/std-vector-insert/content.md",
      },
      examples: [
        {
          id: "minimal",
          path: "entries/std-vector-insert/examples/minimal.cpp",
          kind: "compile",
          standard: "c++20",
        },
        {
          id: "realistic",
          path: "entries/std-vector-insert/examples/realistic.cpp",
          kind: "compile",
          standard: "c++20",
        },
      ],
      sources: [
        {
          kind: "primary",
          title: source.title,
          url: source.url,
          standardSection: source.standardSection,
        },
        {
          kind: "secondary",
          title: secondarySource.title,
          url: secondarySource.url,
        },
      ],
      verifiedAt: "2026-09-06",
    };
    const complete: DraftWorkspace = {
      ...prepared.workspace,
      facts: {
        ...prepared.workspace.facts,
        groups: prepared.workspace.facts.groups.map((group) => ({
          ...group,
          status: "verified" as const,
          summary: `${group.kind} verified`,
          sourceIds: [source.id],
        })),
      },
      sources: {
        ...prepared.workspace.sources,
        sources: [source, secondarySource],
      },
      files: {
        ...prepared.workspace.files,
        "facts.json": `${JSON.stringify(
          {
            ...prepared.workspace.facts,
            groups: prepared.workspace.facts.groups.map((group) => ({
              ...group,
              status: "verified",
              summary: `${group.kind} verified`,
              sourceIds: [source.id],
            })),
          },
          null,
          2,
        )}\n`,
        "sources.json": `${JSON.stringify(
          {
            ...prepared.workspace.sources,
            sources: [source, secondarySource],
          },
          null,
          2,
        )}\n`,
        "entry.json": `${JSON.stringify(entry, null, 2)}\n`,
        "content.md": content,
      },
    };
    const drafts = createInMemoryReferenceDraftRepository([complete]);
    const validateExample = vi.fn().mockResolvedValue([]);
    const authoring = createReferenceAuthoring({
      drafts,
      catalog: { load: async () => catalog },
      examples: { validate: validateExample },
      quality: { validate: async () => [] },
      clock: () => new Date("2026-09-06T10:00:00.000Z"),
    });

    const checked = await authoring.check({ draftId: "std-vector-insert" });

    expect(checked).toMatchObject({
      ok: true,
      report: { status: "ready", findings: [] },
      workspace: {
        draft: {
          state: "checked",
          revision: 2,
          affectedEntryIds: [
            "std-vector-insert",
            "std-vector",
            "header-vector",
          ],
        },
      },
    });
    expect(validateExample).toHaveBeenCalledTimes(2);
    expect((await drafts.get("std-vector-insert"))?.report.status).toBe(
      "ready",
    );

    const warningAuthoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([complete]),
      catalog: { load: async () => catalog },
      examples: { validate: async () => [] },
      quality: {
        validate: async () => [
          {
            path: "/quick-info",
            message: "Tighten the quick information summary",
            keyword: "quality",
          },
          {
            path: "/javascript",
            message: "Explain where the JavaScript analogy stops",
            keyword: "quality",
          },
          {
            path: "/complexity",
            message: "Clarify the complexity explanation",
            keyword: "quality",
          },
        ],
      },
      clock: () => new Date("2026-09-06T10:00:00.000Z"),
    });
    const warningCheck = await warningAuthoring.check({
      draftId: "std-vector-insert",
    });
    expect(warningCheck).toMatchObject({
      ok: true,
      report: {
        status: "ready",
        reviewQueue: [
          {
            severity: "warning",
            risk: "high",
            code: "content-quality",
          },
          {
            severity: "warning",
            risk: "medium",
            code: "content-quality",
          },
          {
            severity: "warning",
            risk: "low",
            code: "content-quality",
          },
        ],
      },
    });

    const duplicateFacts: DraftWorkspace = {
      ...complete,
      facts: {
        ...complete.facts,
        groups: [
          ...complete.facts.groups,
          { ...complete.facts.groups[0]!, id: "selection-duplicate" },
        ],
      },
    };
    const duplicateCheck = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([duplicateFacts]),
      catalog: { load: async () => catalog },
      examples: { validate: async () => [] },
      quality: { validate: async () => [] },
      clock: () => new Date("2026-09-06T10:00:00.000Z"),
    }).check({ draftId: "std-vector-insert" });
    expect(duplicateCheck).toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "fact-kind-duplicate" }),
        ]),
      },
    });

    const redirectCheck = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([complete]),
      catalog: {
        load: async () => ({
          ...catalog,
          redirects: [
            {
              fromSlug: "standard-library/containers/vector/insert",
              toEntryId: "std-vector",
            },
          ],
        }),
      },
      examples: { validate: async () => [] },
      quality: { validate: async () => [] },
      clock: () => new Date("2026-09-06T10:00:00.000Z"),
    }).check({ draftId: "std-vector-insert" });
    expect(redirectCheck).toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "redirect-slug-conflict" }),
        ]),
      },
    });

    const misclassifiedSecondary = {
      ...secondarySource,
      kind: "primary" as const,
    };
    const misclassifiedEntry = {
      ...entry,
      sources: entry.sources.map((candidate) =>
        candidate.url === secondarySource.url
          ? { ...candidate, kind: "primary" as const }
          : candidate,
      ),
    };
    const sourcePolicyDraft: DraftWorkspace = {
      ...complete,
      sources: {
        ...complete.sources,
        sources: [source, misclassifiedSecondary],
      },
      files: {
        ...complete.files,
        "entry.json": `${JSON.stringify(misclassifiedEntry, null, 2)}\n`,
      },
    };
    const sourcePolicyCheck = await createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository([sourcePolicyDraft]),
      catalog: { load: async () => catalog },
      examples: { validate: async () => [] },
      quality: { validate: async () => [] },
      clock: () => new Date("2026-09-06T10:00:00.000Z"),
    }).check({ draftId: "std-vector-insert" });
    expect(sourcePolicyCheck).toMatchObject({
      ok: true,
      report: {
        status: "blocked",
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "source-classification" }),
        ]),
      },
    });
  });

  it("returns not found without creating a draft", async () => {
    const authoring = createReferenceAuthoring({
      drafts: createInMemoryReferenceDraftRepository(),
    });

    await expect(
      authoring.check({ draftId: "missing-entry" }),
    ).resolves.toEqual({
      ok: false,
      code: "draft_not_found",
      issues: [],
    });
  });

  it("does not report success when the draft revision changes during check", async () => {
    const stored = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({
      drafts: {
        get: (draftId) => stored.get(draftId),
        reserve: (workspace) => stored.reserve(workspace),
        commitCheck: async () => false,
      },
    });
    await authoring.prepare({ target: fixtures[0]!.target });

    await expect(
      authoring.check({ draftId: "std-vector-insert" }),
    ).resolves.toEqual({
      ok: false,
      code: "revision_conflict",
      issues: [],
    });
    expect((await stored.get("std-vector-insert"))?.draft.revision).toBe(1);
  });
});
