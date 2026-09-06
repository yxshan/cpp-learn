import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFilesystemAuthoringValidationCache,
  createInMemoryAuthoringValidationCache,
} from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("[T-AUTH-004] content-addressed validation cache", () => {
  it("keeps in-memory values isolated from callers", async () => {
    const cache = createInMemoryAuthoringValidationCache();
    const key = "a".repeat(64);
    const value = {
      schemaVersion: 1 as const,
      issues: [{ path: "/", message: "failed", keyword: "compiler" }],
    };
    await cache.put(key, value);

    const first = await cache.get(key);
    expect(first).toEqual(value);
    (first!.issues as unknown as { message: string }[])[0]!.message = "mutated";
    await expect(cache.get(key)).resolves.toEqual(value);
  });

  it("persists exact keys atomically and treats corrupt data as a miss", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-learn-authoring-cache-"));
    roots.push(root);
    const cache = createFilesystemAuthoringValidationCache({ root });
    const key = "b".repeat(64);
    const value = { schemaVersion: 1 as const, issues: [] };

    await expect(cache.get(key)).resolves.toBeUndefined();
    await cache.put(key, value);
    await expect(cache.get(key)).resolves.toEqual(value);

    await writeFile(join(root, `${key}.json`), "not json", "utf8");
    await expect(cache.get(key)).resolves.toBeUndefined();
    await expect(cache.get("../../catalog.json")).resolves.toBeUndefined();
  });
});
