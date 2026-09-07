import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createFilesystemAuthoringPublisher } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "cpp-learn-publisher-"));
  roots.push(parent);
  const root = join(parent, "reference");
  await mkdir(join(root, "entries", "existing"), { recursive: true });
  await writeFile(
    join(root, "catalog.json"),
    `${JSON.stringify({ schemaVersion: 1, version: 4, entries: ["entries/existing/entry.json"], categories: [], redirects: [] }, null, 2)}\n`,
  );
  await writeFile(
    join(root, "entries", "existing", "entry.json"),
    "existing\n",
  );
  return { parent, root };
}

const request = {
  draftId: "std-vector-insert",
  expectedRevision: 2,
  mode: "dry_run" as const,
  entryPath: "entries/std-vector-insert/entry.json",
  files: [
    {
      path: "entries/std-vector-insert/entry.json",
      content: '{"id":"std-vector-insert"}\n',
    },
    {
      path: "entries/std-vector-insert/content.md",
      content: "# insert\n",
    },
  ],
  confirmDraft: async () => true,
};

describe("[T-AUTH-006/007] atomic Reference publication Adapter", () => {
  it("returns exact create/update digests without changing canonical files in dry-run mode", async () => {
    const { root } = await fixture();
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging: async () => {},
    });
    const before = await readFile(join(root, "catalog.json"), "utf8");

    const plan = await publisher.publish(request);

    expect(plan).toMatchObject({
      schemaVersion: 1,
      draftId: request.draftId,
      expectedRevision: 2,
      mode: "dry_run",
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "entries/std-vector-insert/entry.json",
          operation: "create",
        }),
        expect.objectContaining({ path: "catalog.json", operation: "update" }),
      ]),
    });
    expect(
      plan.files.every(
        ({ digest }) => digest !== undefined && /^[a-f0-9]{64}$/u.test(digest),
      ),
    ).toBe(true);
    await expect(readFile(join(root, "catalog.json"), "utf8")).resolves.toBe(
      before,
    );
  });

  it("publishes the complete batch and catalog version in one apply", async () => {
    const { root } = await fixture();
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging: async () => {},
    });

    const plan = await publisher.publish({ ...request, mode: "apply" });

    expect(plan.mode).toBe("apply");
    await expect(
      readFile(join(root, "entries/std-vector-insert/content.md"), "utf8"),
    ).resolves.toBe("# insert\n");
    const catalog = JSON.parse(
      await readFile(join(root, "catalog.json"), "utf8"),
    ) as { version: number; entries: string[] };
    expect(catalog).toMatchObject({
      version: 5,
      entries: [
        "entries/existing/entry.json",
        "entries/std-vector-insert/entry.json",
      ],
    });
    await expect(
      readFile(join(root, "entries/existing/entry.json"), "utf8"),
    ).resolves.toBe("existing\n");
  });

  it("leaves canonical bytes unchanged when staging validation is interrupted", async () => {
    const { root } = await fixture();
    const beforeCatalog = await readFile(join(root, "catalog.json"), "utf8");
    const beforeEntry = await readFile(
      join(root, "entries/existing/entry.json"),
      "utf8",
    );
    const validateStaging = vi.fn().mockRejectedValue(new Error("gate failed"));
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging,
    });

    await expect(
      publisher.publish({ ...request, mode: "apply" }),
    ).rejects.toThrow("gate failed");
    await expect(readFile(join(root, "catalog.json"), "utf8")).resolves.toBe(
      beforeCatalog,
    );
    await expect(
      readFile(join(root, "entries/existing/entry.json"), "utf8"),
    ).resolves.toBe(beforeEntry);
    await expect(
      readFile(join(root, "entries/std-vector-insert/content.md"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rechecks the draft immediately before installation", async () => {
    const { root } = await fixture();
    const confirmDraft = vi.fn().mockResolvedValue(false);
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging: async () => {},
    });
    const before = await readFile(join(root, "catalog.json"), "utf8");

    await expect(
      publisher.publish({
        ...request,
        mode: "apply",
        confirmDraft,
      }),
    ).rejects.toThrow("Checked draft changed");
    expect(confirmDraft).toHaveBeenCalledOnce();
    await expect(readFile(join(root, "catalog.json"), "utf8")).resolves.toBe(
      before,
    );
  });

  it("removes obsolete example files and preserves a changed slug as a redirect", async () => {
    const { root } = await fixture();
    const entryRoot = join(root, "entries", "std-vector-insert");
    await mkdir(join(entryRoot, "examples"), { recursive: true });
    await writeFile(join(entryRoot, "examples", "old.cpp"), "int main() {}\n");
    await writeFile(
      join(entryRoot, "entry.json"),
      `${JSON.stringify(
        {
          id: "std-vector-insert",
          slug: "standard-library/vector/old-insert",
          examples: [{ path: "entries/std-vector-insert/examples/old.cpp" }],
        },
        null,
        2,
      )}\n`,
    );
    const catalogPath = join(root, "catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as {
      entries: string[];
      version: number;
    };
    catalog.entries.push("entries/std-vector-insert/entry.json");
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging: async () => {},
    });

    const plan = await publisher.publish({
      ...request,
      mode: "apply",
      files: [
        {
          path: request.entryPath,
          content: `${JSON.stringify({
            id: request.draftId,
            slug: "standard-library/containers/vector/insert",
            examples: [],
          })}\n`,
        },
        request.files[1]!,
      ],
    });

    expect(plan.files).toContainEqual(
      expect.objectContaining({
        path: "entries/std-vector-insert/examples/old.cpp",
        operation: "delete",
        previousDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
    await expect(
      readFile(join(entryRoot, "examples", "old.cpp"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(catalogPath, "utf8")).resolves.toContain(
      '"fromSlug": "standard-library/vector/old-insert"',
    );
  });

  it("recovers an interrupted tree swap before planning the next publication", async () => {
    const { root } = await fixture();
    const backup = join(dirname(root), `.${basename(root)}.crashed.backup`);
    await rename(root, backup);
    const publisher = createFilesystemAuthoringPublisher({
      root,
      validateStaging: async () => {},
    });

    await expect(publisher.publish(request)).resolves.toMatchObject({
      mode: "dry_run",
    });
    await expect(
      readFile(join(root, "catalog.json"), "utf8"),
    ).resolves.toContain('"version": 4');
  });
});
