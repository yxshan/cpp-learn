import { describe, expect, it, vi } from "vitest";

import type { ReferenceAuthoring } from "@cpp-learn/reference-authoring";

import { runReferenceAuthorCli } from "./reference-author-cli.js";

describe("[T-AUTH-A1-CLI-001] Reference authoring CLI Adapter", () => {
  it("[T-AUTH-A3-CONTEXT-002] returns a constrained context pack as JSON", async () => {
    const result = {
      ok: true as const,
      pack: {
        schemaVersion: 1 as const,
        draftId: "std-vector-insert",
        draftRevision: 2,
        inputDigest: "a".repeat(64),
        factGroups: [],
        sources: [],
        policy: {
          mode: "verified-facts-only" as const,
          allowedFactGroupIds: ["selection"],
          requirements: [],
        },
        digest: "b".repeat(64),
      },
    };
    const buildContext = vi.fn().mockResolvedValue(result);
    const stdout = vi.fn();
    const authoring = { buildContext } as unknown as ReferenceAuthoring;

    const exitCode = await runReferenceAuthorCli({
      argv: [
        "context",
        "--draft",
        "std-vector-insert",
        "--facts",
        "selection,complexity",
        "--json",
      ],
      authoring,
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(buildContext).toHaveBeenCalledWith({
      draftId: "std-vector-insert",
      factGroupIds: ["selection", "complexity"],
    });
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it("[T-AUTH-A3-BATCH-001] records batch timing and correction observations", async () => {
    const result = {
      ok: true as const,
      report: { batchId: "vector-batch-1", status: "meets-target" },
    };
    const measureBatch = vi.fn().mockResolvedValue(result);
    const stdout = vi.fn();
    const authoring = { measureBatch } as unknown as ReferenceAuthoring;

    const exitCode = await runReferenceAuthorCli({
      argv: [
        "measure",
        "--batch",
        "vector-batch-1",
        "--drafts",
        "one,two,three,four,five",
        "--active-minutes",
        "75",
        "--machine-minutes",
        "12",
        "--gate-minutes",
        "4",
        "--baseline-active-minutes",
        "360",
        "--baseline-entries",
        "5",
        "--pre-factual-corrections",
        "2",
        "--pre-example-corrections",
        "1",
        "--post-factual-corrections",
        "0",
        "--post-example-corrections",
        "0",
        "--baseline-factual-corrections",
        "1",
        "--baseline-example-corrections",
        "1",
        "--high-risk-reviewed",
        "1",
        "--flaky-reruns",
        "0",
        "--json",
      ],
      authoring,
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(measureBatch).toHaveBeenCalledWith({
      batchId: "vector-batch-1",
      draftIds: ["one", "two", "three", "four", "five"],
      timing: {
        authorActiveMinutes: 75,
        machineMinutes: 12,
        fullGateMinutes: 4,
        baselineAuthorActiveMinutes: 360,
        baselineEntries: 5,
      },
      quality: {
        prePublicationCorrections: { factual: 2, example: 1 },
        postPublicationCorrections: { factual: 0, example: 0 },
        baselinePostPublicationCorrections: { factual: 1, example: 1 },
        highRiskClaimsReviewed: 1,
        flakyReruns: 0,
      },
    });
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
  });

  it("rejects fractional counters and a zero-entry baseline as CLI usage errors", async () => {
    const measureBatch = vi.fn();
    const authoring = { measureBatch } as unknown as ReferenceAuthoring;
    const stderr = vi.fn();
    const baseFlags = [
      "measure",
      "--batch",
      "vector-batch-1",
      "--drafts",
      "one,two,three,four,five",
      "--active-minutes",
      "75",
      "--machine-minutes",
      "12",
      "--gate-minutes",
      "4",
      "--baseline-active-minutes",
      "360",
      "--baseline-entries",
      "5",
      "--pre-factual-corrections",
      "0.5",
      "--pre-example-corrections",
      "0",
      "--post-factual-corrections",
      "0",
      "--post-example-corrections",
      "0",
      "--baseline-factual-corrections",
      "0",
      "--baseline-example-corrections",
      "0",
      "--high-risk-reviewed",
      "0",
    ];

    await expect(
      runReferenceAuthorCli({
        argv: baseFlags,
        authoring,
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(2);
    await expect(
      runReferenceAuthorCli({
        argv: baseFlags.map((value, index) =>
          baseFlags[index - 1] === "--pre-factual-corrections"
            ? "0"
            : baseFlags[index - 1] === "--baseline-entries"
              ? "0"
              : value,
        ),
        authoring,
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(2);
    expect(measureBatch).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("[T-AUTH-A2-PREVIEW-001] checks then renders a draft with the configured preview Adapter", async () => {
    const workspace = {
      draft: { draftId: "std-vector-insert", revision: 2 },
    };
    const authoring = {
      prepare: vi.fn(),
      check: vi.fn().mockResolvedValue({
        ok: true,
        report: { status: "ready" },
        workspace,
      }),
    } as unknown as ReferenceAuthoring;
    const render = vi
      .fn()
      .mockResolvedValue(".cpp-learn/authoring/std-vector-insert/preview.html");
    const stdout = vi.fn();

    const exitCode = await runReferenceAuthorCli({
      argv: ["preview", "--draft", "std-vector-insert"],
      authoring,
      preview: { render },
      stdout,
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(authoring.check).toHaveBeenCalledWith({
      draftId: "std-vector-insert",
    });
    expect(render).toHaveBeenCalledWith(workspace);
    expect(stdout).toHaveBeenCalledWith(
      "Preview written to .cpp-learn/authoring/std-vector-insert/preview.html\n",
    );
  });

  it("[T-AUTH-A2-PUBLISH-001] defaults publication to dry-run and requires an explicit apply flag", async () => {
    const publish = vi.fn().mockImplementation(async (request) => ({
      ok: true,
      applied: request.mode === "apply",
      plan: {
        schemaVersion: 1,
        draftId: request.draftId,
        expectedRevision: request.expectedRevision,
        mode: request.mode,
        files: [],
      },
    }));
    const authoring = {
      prepare: vi.fn(),
      check: vi.fn().mockResolvedValue({
        ok: true,
        report: { status: "ready", draftRevision: 3 },
      }),
      publish,
    } as unknown as ReferenceAuthoring;
    const stdout = vi.fn();

    await expect(
      runReferenceAuthorCli({
        argv: ["publish", "--draft", "std-vector-insert", "--dry-run"],
        authoring,
        stdout,
        stderr: vi.fn(),
      }),
    ).resolves.toBe(0);
    expect(authoring.check).toHaveBeenCalledWith({
      draftId: "std-vector-insert",
    });
    expect(publish).toHaveBeenLastCalledWith({
      draftId: "std-vector-insert",
      expectedRevision: 3,
      mode: "dry_run",
    });

    await runReferenceAuthorCli({
      argv: [
        "publish",
        "--draft",
        "std-vector-insert",
        "--revision",
        "3",
        "--apply",
      ],
      authoring,
      stdout,
      stderr: vi.fn(),
    });
    expect(publish).toHaveBeenLastCalledWith({
      draftId: "std-vector-insert",
      expectedRevision: 3,
      mode: "apply",
    });
  });

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

  it("prepares a draft with explicit fact reuse options", async () => {
    const prepare = vi.fn().mockResolvedValue({
      ok: true,
      created: true,
      workspace: { draft: { draftId: "std-vector-insert", revision: 1 } },
    });
    const authoring = { prepare } as unknown as ReferenceAuthoring;

    await runReferenceAuthorCli({
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
        "--reuse-from",
        "std-vector",
        "--reuse-facts",
        "selection,complexity",
      ],
      authoring,
      stdout: vi.fn(),
      stderr: vi.fn(),
    });

    expect(prepare).toHaveBeenCalledWith({
      target: {
        entryId: "std-vector-insert",
        kind: "member",
        slug: "standard-library/containers/vector/insert",
        title: "std::vector::insert",
      },
      reuse: {
        draftId: "std-vector",
        factGroupIds: ["selection", "complexity"],
      },
    });
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
