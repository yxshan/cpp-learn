import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveEditablePath, validateEditablePath } from "./index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("[T-SEC-001] Workspace editable path contract", () => {
  it.each([
    "../main.cpp",
    "/tmp/main.cpp",
    "src/../../main.cpp",
    "src\\main.cpp",
    "support/read-only.cpp",
    "",
  ])("rejects unsafe or undeclared path %j", (candidate) => {
    expect(
      validateEditablePath(candidate, ["main.cpp", "src/app.cpp"]),
    ).toEqual({
      ok: false,
      code: "invalid_path",
    });
  });

  it("accepts a normalized relative path declared by the workspace contract", () => {
    expect(
      validateEditablePath("src/app.cpp", ["main.cpp", "src/app.cpp"]),
    ).toEqual({
      ok: true,
      path: "src/app.cpp",
    });
  });

  it("rejects an editable path that escapes through a symbolic link", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "cpp-learn-workspace-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "cpp-learn-outside-"));
    temporaryRoots.push(workspaceRoot, outsideRoot);
    await mkdir(join(workspaceRoot, "src"));
    await symlink(outsideRoot, join(workspaceRoot, "src", "linked"));

    await expect(
      resolveEditablePath({
        workspaceRoot,
        candidate: "src/linked/main.cpp",
        editablePaths: ["src/linked/main.cpp"],
      }),
    ).resolves.toEqual({ ok: false, code: "invalid_path" });
  });
});
