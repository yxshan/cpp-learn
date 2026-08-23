import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createJsonlRecordProbe, initializeJsonlRecord } from "./index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("[T-MODULE-001] JSONL Learning Record lifecycle", () => {
  it("initializes an empty append-only event log during composition", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);

    await initializeJsonlRecord({ dataRoot: root });
    await expect(readFile(join(root, "events.jsonl"), "utf8")).resolves.toBe(
      "",
    );
  });

  it("does not create persistent state when a readiness query probes a missing root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(parent);
    const missingRoot = join(parent, "missing");
    const probe = createJsonlRecordProbe({ dataRoot: missingRoot });

    await expect(probe()).resolves.toEqual({
      ready: false,
      issues: ["Learning record is not initialized or writable"],
    });
    await expect(stat(missingRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
