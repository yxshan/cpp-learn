import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFilesystemReferenceDraftRepository,
  createFilesystemAuthoringCatalogContext,
  createInMemoryReferenceDraftRepository,
  createReferenceAuthoring,
} from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "cpp-learn-authoring-"));
  roots.push(root);
  return root;
}

const target = {
  entryId: "std-vector-insert",
  kind: "member" as const,
  slug: "standard-library/containers/vector/insert",
  title: "std::vector::insert",
};

describe("[T-AUTH-A1-FS-001] filesystem draft Adapter", () => {
  it("persists a prepared draft and resumes it through a fresh Adapter", async () => {
    const root = await temporaryRoot();
    const first = createReferenceAuthoring({
      drafts: createFilesystemReferenceDraftRepository({ root }),
      clock: () => new Date("2026-09-06T09:30:00.000Z"),
    });

    const prepared = await first.prepare({ target });

    expect(prepared).toMatchObject({ ok: true, created: true });
    expect(
      JSON.parse(
        await readFile(join(root, target.entryId, "draft.json"), "utf8"),
      ),
    ).toMatchObject({ draftId: target.entryId, revision: 1 });

    const second = createReferenceAuthoring({
      drafts: createFilesystemReferenceDraftRepository({ root }),
    });
    await expect(second.prepare({ target })).resolves.toMatchObject({
      ok: true,
      created: false,
      workspace: { draft: { createdAt: "2026-09-06T09:30:00.000Z" } },
    });
  });

  it("atomically preserves the first of two conflicting filesystem reservations", async () => {
    const root = await temporaryRoot();
    const authoring = createReferenceAuthoring({
      drafts: createFilesystemReferenceDraftRepository({ root }),
    });

    const [first, second] = await Promise.all([
      authoring.prepare({ target }),
      authoring.prepare({ target: { ...target, slug: "different/slug" } }),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    expect([first, second].filter((result) => !result.ok)).toEqual([
      expect.objectContaining({ code: "draft_conflict" }),
    ]);
    const stored = await createFilesystemReferenceDraftRepository({ root }).get(
      target.entryId,
    );
    expect(stored?.draft.target).toEqual(
      first.ok ? target : { ...target, slug: "different/slug" },
    );
  });

  it("writes the latest check report and revision without touching canonical content", async () => {
    const root = await temporaryRoot();
    const drafts = createFilesystemReferenceDraftRepository({ root });
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({ target });

    const checked = await authoring.check({ draftId: target.entryId });

    expect(checked).toMatchObject({
      ok: true,
      report: { status: "blocked" },
      workspace: { draft: { revision: 2 } },
    });
    expect(
      JSON.parse(
        await readFile(join(root, target.entryId, "report.json"), "utf8"),
      ),
    ).toMatchObject({ status: "blocked", draftRevision: 2 });
    expect(
      JSON.parse(
        await readFile(join(root, target.entryId, "draft.json"), "utf8"),
      ),
    ).toMatchObject({ revision: 2, state: "draft" });
  });

  it("returns a structured read error when an author corrupts draft JSON", async () => {
    const root = await temporaryRoot();
    const drafts = createFilesystemReferenceDraftRepository({ root });
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({ target });
    await writeFile(join(root, target.entryId, "draft.json"), "{", "utf8");

    await expect(authoring.check({ draftId: target.entryId })).resolves.toEqual(
      {
        ok: false,
        code: "draft_unreadable",
        issues: [expect.objectContaining({ path: "/draft" })],
      },
    );
  });

  it("fails closed when draft JSON parses but no longer matches its schema", async () => {
    const root = await temporaryRoot();
    const drafts = createFilesystemReferenceDraftRepository({ root });
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({ target });
    await writeFile(
      join(root, target.entryId, "draft.json"),
      `${JSON.stringify({ schemaVersion: 1, draftId: target.entryId })}\n`,
      "utf8",
    );

    await expect(authoring.check({ draftId: target.entryId })).resolves.toEqual(
      {
        ok: false,
        code: "draft_unreadable",
        issues: expect.arrayContaining([
          expect.objectContaining({ path: "/draft/revision" }),
          expect.objectContaining({ path: "/draft/profile" }),
        ]),
      },
    );
  });

  it("rejects direct and symbolic-link draft roots that overlap protected content", async () => {
    const root = await temporaryRoot();
    const protectedRoot = join(root, "reference");
    const linkedRoot = join(root, "authoring-link");
    await mkdir(protectedRoot);
    await symlink(protectedRoot, linkedRoot);

    expect(() =>
      createFilesystemReferenceDraftRepository({
        root: protectedRoot,
        forbiddenRoots: [protectedRoot],
      }),
    ).toThrow("Draft root must be separate from protected content");
    expect(() =>
      createFilesystemReferenceDraftRepository({
        root: linkedRoot,
        forbiddenRoots: [protectedRoot],
      }),
    ).toThrow("Draft root must be separate from protected content");
  });

  it("rejects a check commit when editable files changed after validation", async () => {
    const root = await temporaryRoot();
    const persisted = createFilesystemReferenceDraftRepository({ root });
    const authoring = createReferenceAuthoring({
      drafts: {
        get: (draftId) => persisted.get(draftId),
        reserve: (workspace) => persisted.reserve(workspace),
        async commitCheck(input) {
          await writeFile(
            join(root, target.entryId, "content.md"),
            "# changed during check\n",
            "utf8",
          );
          return persisted.commitCheck(input);
        },
      },
    });
    await authoring.prepare({ target });

    await expect(authoring.check({ draftId: target.entryId })).resolves.toEqual(
      {
        ok: false,
        code: "revision_conflict",
        issues: [],
      },
    );
    expect(
      JSON.parse(
        await readFile(join(root, target.entryId, "draft.json"), "utf8"),
      ),
    ).toMatchObject({ revision: 1, state: "draft" });
  });

  it("keeps the in-memory Adapter compatible with the same repository Interface", async () => {
    const drafts = createInMemoryReferenceDraftRepository();
    const authoring = createReferenceAuthoring({ drafts });
    await authoring.prepare({ target });

    await expect(
      authoring.check({ draftId: target.entryId }),
    ).resolves.toMatchObject({
      ok: true,
      workspace: { draft: { revision: 2 } },
    });
  });
});

describe("[T-AUTH-A1-CATALOG-001] filesystem catalog-context Adapter", () => {
  it("loads validated Entry, category, and slug context", async () => {
    const root = await temporaryRoot();
    const entryRoot = join(root, "entries", "std-vector");
    const activityRoot = join(root, "activities", "vector-basics");
    await mkdir(entryRoot, { recursive: true });
    await mkdir(activityRoot, { recursive: true });
    await writeFile(
      join(root, "catalog.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        version: 1,
        entries: ["entries/std-vector/entry.json"],
        categories: [{ id: "containers", title: "Containers", order: 1 }],
        redirects: [],
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(entryRoot, "entry.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        id: "std-vector",
        version: 1,
        slug: "standard-library/containers/vector",
        kind: "type",
        title: "std::vector",
        summary: "Dynamic array",
        aliases: [],
        categories: ["containers"],
        relatedEntryIds: [],
        content: {
          format: "markdown",
          path: "entries/std-vector/content.md",
        },
        examples: [],
        sources: [
          {
            kind: "primary",
            title: "C++ draft",
            url: "https://eel.is/c++draft/vector",
          },
        ],
        verifiedAt: "2026-09-06",
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(activityRoot, "activity.json"),
      `${JSON.stringify({ id: "vector-basics", referenceIds: ["std-vector"] })}\n`,
      "utf8",
    );

    await expect(
      createFilesystemAuthoringCatalogContext({
        catalogPath: join(root, "catalog.json"),
        activityRoot: join(root, "activities"),
      }).load(),
    ).resolves.toEqual({
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
      activityIdsByEntryId: { "std-vector": ["vector-basics"] },
    });
  });
});
