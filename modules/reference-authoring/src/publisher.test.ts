import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(join(root, "entries", "existing"), { recursive: true }),
  );
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
};

describe("[T-AUTH-006/007] atomic Reference publication Adapter", () => {
  it("returns exact create/update digests without changing canonical files in dry-run mode", async () => {
    const { root } = await fixture();
    const publisher = createFilesystemAuthoringPublisher({ root });
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
      plan.files.every(({ digest }) => /^[a-f0-9]{64}$/u.test(digest)),
    ).toBe(true);
    await expect(readFile(join(root, "catalog.json"), "utf8")).resolves.toBe(
      before,
    );
  });

  it("publishes the complete batch and catalog version in one apply", async () => {
    const { root } = await fixture();
    const publisher = createFilesystemAuthoringPublisher({ root });

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
});
