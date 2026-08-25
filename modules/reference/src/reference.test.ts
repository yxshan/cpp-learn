import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import {
  createFilesystemReferenceCatalog,
  createInMemoryReferenceCatalog,
  type ReferenceCatalogManifest,
  type ReferenceEntryManifest,
} from "./index.js";

const entry = (
  id: string,
  overrides: Partial<ReferenceEntryManifest> = {},
): ReferenceEntryManifest => ({
  schemaVersion: 1,
  id,
  version: 1,
  slug: `standard-library/${id}`,
  kind: "type",
  title: id,
  summary: `${id} summary`,
  symbol: id,
  header: "<vector>",
  namespace: "std",
  since: "c++98",
  aliases: [],
  categories: ["containers"],
  relatedEntryIds: [],
  content: { format: "markdown", path: `entries/${id}/content.md` },
  examples: [
    {
      id: "basic",
      path: `entries/${id}/basic.cpp`,
      kind: "run",
      standard: "c++20",
      expectedStdout: "ok\n",
    },
  ],
  sources: [
    {
      kind: "primary",
      title: "C++ working draft",
      url: "https://eel.is/c++draft/vector",
    },
  ],
  verifiedAt: "2026-08-25",
  ...overrides,
});

const catalog = (
  entries: readonly ReferenceEntryManifest[],
  overrides: Partial<ReferenceCatalogManifest> = {},
): ReferenceCatalogManifest => ({
  schemaVersion: 1,
  version: 1,
  entries: entries.map((candidate) => `entries/${candidate.id}/entry.json`),
  categories: [{ id: "containers", title: "容器", order: 10 }],
  redirects: [],
  ...overrides,
});

const filesFor = (entries: readonly ReferenceEntryManifest[]) =>
  Object.fromEntries(
    entries.flatMap((candidate) => [
      [candidate.content.path, `# ${candidate.title}\n\n容器正文。\n`],
      ...candidate.examples.map((example) => [
        example.path,
        '#include <iostream>\nint main() { std::cout << "ok\\n"; }\n',
      ]),
    ]),
  );

describe("[T-REF-001] Reference catalog activation", () => {
  it("atomically activates a valid catalog and returns a public Entry", async () => {
    const vector = entry("std-vector");
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector]),
      entries: [vector],
      files: filesFor([vector]),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: true,
      catalogVersion: 1,
      entryCount: 1,
    });
    await expect(reference.getEntry("std-vector")).resolves.toMatchObject({
      schemaVersion: 1,
      catalogVersion: 1,
      id: "std-vector",
      markdown: "# std-vector\n\n容器正文。\n",
      examples: [
        expect.objectContaining({
          id: "basic",
          source: expect.stringContaining("#include <iostream>"),
          verification: "not-checked",
        }),
      ],
      relatedActivityIds: [],
    });
  });

  it("rejects duplicate slugs without publishing a partial catalog", async () => {
    const vector = entry("std-vector");
    const other = entry("std-deque", { slug: vector.slug });
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector, other]),
      entries: [vector, other],
      files: filesFor([vector, other]),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: false,
      issueCodes: ["catalog_invalid"],
    });
    await expect(reference.getEntry("std-vector")).resolves.toBeUndefined();
  });
});

describe("[T-REF-002] Reference graph and navigation", () => {
  it("rejects unknown Entry relationships, invalid redirects, and category cycles", async () => {
    const vector = entry("std-vector", {
      relatedEntryIds: ["missing-entry"],
    });
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector], {
        categories: [
          { id: "containers", title: "容器", parentId: "sequences", order: 1 },
          { id: "sequences", title: "顺序容器", parentId: "containers", order: 2 },
        ],
        redirects: [
          { fromSlug: "old/vector", toEntryId: "missing-entry" },
        ],
      }),
      entries: [vector],
      files: filesFor([vector]),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: false,
      issueCodes: ["catalog_invalid"],
    });
  });

  it("builds ordered navigation and resolves active and historical slugs", async () => {
    const vector = entry("std-vector");
    const sort = entry("std-sort", {
      slug: "standard-library/algorithms/sort",
      kind: "function",
      symbol: "std::sort",
      header: "<algorithm>",
      categories: ["algorithms"],
    });
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector, sort], {
        categories: [
          { id: "algorithms", title: "算法", order: 20 },
          { id: "containers", title: "容器", order: 10 },
        ],
        redirects: [
          { fromSlug: "library/vector", toEntryId: "std-vector" },
        ],
      }),
      entries: [vector, sort],
      files: filesFor([vector, sort]),
    });

    await expect(reference.getNavigation()).resolves.toMatchObject({
      schemaVersion: 1,
      catalogVersion: 1,
      categories: [
        { id: "containers", entryIds: ["std-vector"] },
        { id: "algorithms", entryIds: ["std-sort"] },
      ],
    });
    await expect(
      reference.resolveSlug("standard-library/std-vector"),
    ).resolves.toEqual({
      schemaVersion: 1,
      entryId: "std-vector",
      canonicalSlug: "standard-library/std-vector",
      redirected: false,
    });
    await expect(reference.resolveSlug("library/vector")).resolves.toEqual({
      schemaVersion: 1,
      entryId: "std-vector",
      canonicalSlug: "standard-library/std-vector",
      redirected: true,
    });
    await expect(reference.resolveSlug("unknown")).resolves.toBeUndefined();
  });
});

describe("[T-REF-003] deterministic Reference search", () => {
  const searchableCatalog = () => {
    const vector = entry("std-vector", {
      title: "std::vector 动态数组",
      symbol: "std::vector",
      aliases: ["动态数组", "vector"],
    });
    const span = entry("std-span", {
      title: "std::span 连续视图",
      symbol: "std::span",
      header: "<span>",
      since: "c++20",
      aliases: ["连续视图"],
    });
    const autoPtr = entry("std-auto-ptr", {
      title: "std::auto_ptr",
      symbol: "std::auto_ptr",
      header: "<memory>",
      since: "c++98",
      deprecatedSince: "c++11",
      removedSince: "c++17",
    });
    const entries = [vector, span, autoPtr];
    return createInMemoryReferenceCatalog({
      catalog: catalog(entries),
      entries,
      files: {
        ...filesFor(entries),
        [vector.content.path]: "# std::vector\n\n## 迭代器失效\n",
      },
    });
  };

  it("ranks exact symbols and reports the matched field", async () => {
    const result = await searchableCatalog().search({ text: "std::vector" });

    expect(result.results[0]).toMatchObject({
      id: "std-vector",
      matchedBy: expect.arrayContaining(["symbol"]),
    });
  });

  it("searches Chinese aliases, headings, and normalized headers", async () => {
    const reference = searchableCatalog();

    await expect(reference.search({ text: "动态数组" })).resolves.toMatchObject({
      results: [expect.objectContaining({ id: "std-vector" })],
    });
    await expect(reference.search({ text: "迭代器失效" })).resolves.toMatchObject({
      results: [
        expect.objectContaining({ id: "std-vector", matchedBy: ["heading"] }),
      ],
    });
    await expect(reference.search({ text: "vector" })).resolves.toMatchObject({
      results: [expect.objectContaining({ id: "std-vector" })],
    });
  });

  it("treats the standard filter as an availability interval", async () => {
    const result = await searchableCatalog().search({
      text: "",
      standard: "c++20",
    });

    expect(result.results.map(({ id }) => id)).toEqual([
      "std-span",
      "std-vector",
    ]);
  });

  it("rejects an unknown category filter", async () => {
    await expect(
      searchableCatalog().search({ text: "", category: "missing-category" }),
    ).rejects.toThrow("Invalid Reference search");
  });
});

export { catalog, entry, filesFor };

describe("[T-REF-001] filesystem Reference Adapter", () => {
  it("loads the release catalog and its five tracer-bullet Entries", async () => {
    const reference = createFilesystemReferenceCatalog({
      catalogPath: resolve("reference/catalog.json"),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: true,
      catalogVersion: 1,
      entryCount: 5,
    });
    const result = await reference.search({ text: "std::sort" });
    expect(result.results[0]).toMatchObject({ id: "std-sort" });
  });
});
