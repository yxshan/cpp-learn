import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createJsonlRecordProbe } from "./index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("[T-MODULE-001] JSONL Learning Record readiness", () => {
  it("initializes an empty append-only event log in the configured data root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-record-"));
    temporaryRoots.push(root);
    const probe = createJsonlRecordProbe({ dataRoot: root });

    await expect(probe()).resolves.toEqual({ ready: true });
    await expect(readFile(join(root, "events.jsonl"), "utf8")).resolves.toBe("");
  });
});
