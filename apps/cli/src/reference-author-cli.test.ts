import { describe, expect, it, vi } from "vitest";

import type { ReferenceAuthoring } from "@cpp-learn/reference-authoring";

import { runReferenceAuthorCli } from "./reference-author-cli.js";

describe("[T-AUTH-A1-CLI-001] Reference authoring CLI Adapter", () => {
  it("prepares a draft with explicit stable identity", async () => {
    const prepare = vi.fn().mockResolvedValue({
      ok: true,
      created: true,
      workspace: { draft: { draftId: "std-vector-insert", revision: 1 } },
    });
    const stdout = vi.fn();
    const authoring = {
      prepare,
      check: vi.fn(),
    } as unknown as ReferenceAuthoring;

    const exitCode = await runReferenceAuthorCli({
      argv: [
        "prepare",
        "--id",
        "std-vector-insert",
        "--kind",
        "member",
        "--slug",
        "standard-library/containers/vector/insert",
        "--title",
        "std::vector::insert",
      ],
      authoring,
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(prepare).toHaveBeenCalledWith({
      target: {
        entryId: "std-vector-insert",
        kind: "member",
        slug: "standard-library/containers/vector/insert",
        title: "std::vector::insert",
      },
    });
    expect(stdout).toHaveBeenCalledWith(
      "Created draft std-vector-insert at revision 1\n",
    );
  });

  it("emits the unmodified prepare result as JSON", async () => {
    const result = {
      ok: true as const,
      created: false,
      workspace: {
        draft: { draftId: "std-vector-insert", revision: 3 },
        files: { "content.md": "# draft\n" },
      },
    };
    const stdout = vi.fn();
    const authoring = {
      prepare: vi.fn().mockResolvedValue(result),
      check: vi.fn(),
    } as unknown as ReferenceAuthoring;

    const exitCode = await runReferenceAuthorCli({
      argv: [
        "prepare",
        "--id",
        "std-vector-insert",
        "--kind",
        "member",
        "--slug",
        "standard-library/containers/vector/insert",
        "--title",
        "std::vector::insert",
        "--json",
      ],
      authoring,
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it("emits the unmodified blocked check result with command-success exit", async () => {
    const result = {
      ok: true as const,
      report: {
        schemaVersion: 1 as const,
        draftId: "std-vector-insert",
        draftRevision: 2,
        status: "blocked" as const,
        affectedEntryIds: ["std-vector-insert"],
        findings: [],
        reviewQueue: [],
        cacheEvidence: [],
      },
      workspace: {},
    };
    const stdout = vi.fn();
    const authoring = {
      prepare: vi.fn(),
      check: vi.fn().mockResolvedValue(result),
    } as unknown as ReferenceAuthoring;

    const exitCode = await runReferenceAuthorCli({
      argv: ["check", "--draft", "std-vector-insert", "--json"],
      authoring,
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(authoring.check).toHaveBeenCalledWith({
      draftId: "std-vector-insert",
    });
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it("rejects incomplete prepare flags without calling the Module", async () => {
    const authoring = {
      prepare: vi.fn(),
      check: vi.fn(),
    } as unknown as ReferenceAuthoring;
    const stderr = vi.fn();

    await expect(
      runReferenceAuthorCli({
        argv: ["prepare", "--id", "std-vector"],
        authoring,
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(2);
    expect(authoring.prepare).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });
});
