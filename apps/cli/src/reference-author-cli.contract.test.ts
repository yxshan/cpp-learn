import { describe, expect, it, vi } from "vitest";

import type { ReferenceAuthoring } from "@cpp-learn/reference-authoring";

import { runReferenceAuthorCli } from "./reference-author-cli.js";

/**
 * The CLI Adapter is the documented authoring surface. `docs/04` and
 * `docs/05` enumerate these subcommands, and the authoring tests drive them by
 * name, so the set is part of the published contract.
 */
const SUBCOMMANDS = [
  "prepare",
  "context",
  "template",
  "research",
  "repair-plan",
  "repair",
  "batch",
  "run",
  "apply-generation",
  "measure",
  "check",
  "preview",
  "publish",
] as const;

describe("[T-AUTH-018] Reference authoring CLI contract snapshot", () => {
  it("publishes exactly the thirteen documented subcommands", async () => {
    const stderr = vi.fn();
    const exitCode = await runReferenceAuthorCli({
      argv: ["no-such-command"],
      authoring: {} as unknown as ReferenceAuthoring,
      stdout: vi.fn(),
      stderr,
    });

    expect(exitCode).toBe(2);
    const text = String(stderr.mock.calls[0]?.[0] ?? "");
    const published = [
      ...text.matchAll(/^Usage: npm run reference:author -- (\S+)/gmu),
    ]
      .map((match) => match[1])
      .sort();
    expect(published).toEqual([...SUBCOMMANDS].sort());
  });

  it("rejects unknown subcommands instead of guessing", async () => {
    const stderr = vi.fn();
    const exitCode = await runReferenceAuthorCli({
      argv: ["publish-all"],
      authoring: {} as unknown as ReferenceAuthoring,
      stdout: vi.fn(),
      stderr,
    });
    expect(exitCode).toBe(2);
    expect(stderr).toHaveBeenCalledTimes(1);
  });
});
