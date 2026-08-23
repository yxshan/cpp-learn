import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFilesystemWorkspace,
  createInMemoryWorkspace,
  resolveEditablePath,
  validateEditablePath,
  type Workspace,
} from "./index.js";

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

describe("[T-MODULE-001] Workspace Interface", () => {
  it("saves through an optimistic revision without overwriting a conflict", async () => {
    const workspace: Workspace = createInMemoryWorkspace([
      {
        activityId: "first-program",
        editablePaths: ["main.cpp"],
        starterFiles: { "main.cpp": "int main() {}\n" },
      },
    ]);

    await expect(workspace.open("first-program")).resolves.toMatchObject({
      revision: 0,
      files: { "main.cpp": "int main() {}\n" },
    });
    const starterSnapshot = await workspace.snapshot("first-program");
    await expect(
      workspace.save({
        activityId: "first-program",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "int main() { return 0; }\n" }],
      }),
    ).resolves.toEqual({ ok: true, revision: 1 });
    await expect(
      workspace.save({
        activityId: "first-program",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "stale\n" }],
      }),
    ).resolves.toEqual({ ok: false, code: "revision_conflict" });
    await expect(workspace.open("first-program")).resolves.toMatchObject({
      revision: 1,
      files: { "main.cpp": "int main() { return 0; }\n" },
    });
    const savedSnapshot = await workspace.snapshot("first-program");
    await expect(
      workspace.diff(starterSnapshot.id, savedSnapshot.id),
    ).resolves.toEqual({
      from: starterSnapshot.id,
      to: savedSnapshot.id,
      changedPaths: ["main.cpp"],
    });
  });
});

describe("[T-WORK-001] filesystem Workspace", () => {
  it("preserves learner files and immutable snapshots across Adapter restart", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "cpp-learn-files-"));
    temporaryRoots.push(workspaceRoot);
    const activities = [
      {
        activityId: "first-program",
        editablePaths: ["main.cpp"],
        starterFiles: { "main.cpp": "int main() {}\n" },
      },
    ];
    const workspace = createFilesystemWorkspace({ workspaceRoot, activities });

    await expect(workspace.open("first-program")).resolves.toMatchObject({
      revision: 0,
      files: { "main.cpp": "int main() {}\n" },
    });
    await expect(
      workspace.save({
        activityId: "first-program",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "int main() { return 0; }\n" }],
      }),
    ).resolves.toEqual({ ok: true, revision: 1 });
    const snapshot = await workspace.snapshot("first-program");

    const restarted = createFilesystemWorkspace({ workspaceRoot, activities });
    await expect(restarted.open("first-program")).resolves.toMatchObject({
      revision: 1,
      files: { "main.cpp": "int main() { return 0; }\n" },
    });
    await expect(restarted.readSnapshot(snapshot.id)).resolves.toMatchObject({
      id: snapshot.id,
      files: { "main.cpp": "int main() { return 0; }\n" },
    });
    await expect(
      restarted.save({
        activityId: "first-program",
        baseRevision: 0,
        changes: [{ path: "main.cpp", content: "stale\n" }],
      }),
    ).resolves.toEqual({ ok: false, code: "revision_conflict" });
  });

  it("adds files from a newer Activity version without overwriting learner work", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "cpp-learn-upgrade-"));
    temporaryRoots.push(workspaceRoot);
    const firstVersion = createFilesystemWorkspace({
      workspaceRoot,
      activities: [
        {
          activityId: "project-m1",
          version: 1,
          persistenceId: "project-workspace",
          editablePaths: ["main.cpp"],
          starterFiles: { "main.cpp": "int main() {}\n" },
        },
      ],
    });
    await firstVersion.open("project-m1");
    await firstVersion.save({
      activityId: "project-m1",
      baseRevision: 0,
      changes: [{ path: "main.cpp", content: "int main() { return 42; }\n" }],
    });

    const upgraded = createFilesystemWorkspace({
      workspaceRoot,
      activities: [
        {
          activityId: "project-m2",
          version: 2,
          persistenceId: "project-workspace",
          editablePaths: ["main.cpp", "support.cpp"],
          starterFiles: {
            "main.cpp": "int main() { return 0; }\n",
            "support.cpp": "int answer() { return 42; }\n",
          },
        },
      ],
    });

    await expect(upgraded.open("project-m2")).resolves.toMatchObject({
      activityId: "project-m2",
      revision: 2,
      files: {
        "main.cpp": "int main() { return 42; }\n",
        "support.cpp": "int answer() { return 42; }\n",
      },
    });
  });

  it("serializes migration with concurrent saves so Learner files cannot be lost", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "cpp-learn-upgrade-"));
    temporaryRoots.push(workspaceRoot);
    const original = createFilesystemWorkspace({
      workspaceRoot,
      activities: [
        {
          activityId: "concurrent-upgrade",
          version: 1,
          editablePaths: ["main.cpp"],
          starterFiles: { "main.cpp": "starter\n" },
        },
      ],
    });
    await original.open("concurrent-upgrade");
    await original.save({
      activityId: "concurrent-upgrade",
      baseRevision: 0,
      changes: [{ path: "main.cpp", content: "learner-v1\n" }],
    });
    const upgraded = createFilesystemWorkspace({
      workspaceRoot,
      activities: [
        {
          activityId: "concurrent-upgrade",
          version: 2,
          editablePaths: ["main.cpp", "support.cpp"],
          starterFiles: {
            "main.cpp": "new-starter\n",
            "support.cpp": "support\n",
          },
        },
      ],
    });

    await Promise.all([
      upgraded.open("concurrent-upgrade"),
      upgraded.save({
        activityId: "concurrent-upgrade",
        baseRevision: 1,
        changes: [{ path: "main.cpp", content: "learner-v2\n" }],
      }),
    ]);

    await expect(upgraded.open("concurrent-upgrade")).resolves.toMatchObject({
      files: {
        "main.cpp": expect.stringMatching(/^learner-v[12]\n$/),
        "support.cpp": "support\n",
      },
    });
  });

  it("rejects a snapshot store redirected through a symbolic link", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "cpp-learn-files-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "cpp-learn-outside-"));
    temporaryRoots.push(workspaceRoot, outsideRoot);
    await symlink(outsideRoot, join(workspaceRoot, ".snapshots"));
    const workspace = createFilesystemWorkspace({
      workspaceRoot,
      activities: [
        {
          activityId: "first-program",
          editablePaths: ["main.cpp"],
          starterFiles: { "main.cpp": "int main() {}\n" },
        },
      ],
    });

    await expect(workspace.snapshot("first-program")).rejects.toThrow(
      "not a regular directory",
    );
  });
});
