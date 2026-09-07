import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { DraftWorkspace } from "@cpp-learn/reference-authoring";

import { createFilesystemReferenceAuthorPreview } from "./reference-author-preview.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("[T-AUTH-A2-PREVIEW-003] preview path confinement", () => {
  it("rejects a draft-directory symlink before writing preview bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-preview-root-"));
    const outside = await mkdtemp(join(tmpdir(), "cpp-learn-preview-outside-"));
    roots.push(root, outside);
    await mkdir(root, { recursive: true });
    await symlink(outside, join(root, "std-vector-insert"));
    const preview = createFilesystemReferenceAuthorPreview({ root });

    await expect(
      preview.render({
        draft: { draftId: "std-vector-insert" },
      } as DraftWorkspace),
    ).rejects.toThrow("must not be a symbolic link");
  });
});
