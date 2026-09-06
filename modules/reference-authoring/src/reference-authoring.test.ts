import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { REFERENCE_ENTRY_KINDS } from "@cpp-learn/contracts";

import {
  authoringDraftSchema,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
  validateAuthoringDraft,
  validateAuthoringFactSheet,
  validateAuthoringPublicationPlan,
  validateAuthoringReport,
  validateAuthoringSourceLedger,
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
