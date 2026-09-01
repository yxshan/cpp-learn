import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  schemaVersion: 2,
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
      activationDurationMs: expect.any(Number),
    });
    await expect(reference.getEntry("std-vector")).resolves.toMatchObject({
      schemaVersion: 2,
      catalogVersion: 1,
      id: "std-vector",
      content: "# std-vector\n\n容器正文。\n",
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

  it("rejects duplicate Entry IDs without publishing a partial catalog", async () => {
    const vector = entry("std-vector");
    const duplicate = entry("std-vector", { slug: "standard-library/vector-2" });
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector, duplicate], {
        entries: [
          "entries/vector-primary/entry.json",
          "entries/vector-duplicate/entry.json",
        ],
      }),
      entries: [vector, duplicate],
      files: filesFor([vector, duplicate]),
    });

    await expect(reference.readiness()).resolves.toMatchObject({
      ready: false,
      issueCodes: ["catalog_invalid"],
    });
  });
});

describe("[T-REF-002] Reference graph and navigation", () => {
  it("rejects an unknown Entry relationship", async () => {
    const vector = entry("std-vector", {
      relatedEntryIds: ["missing-entry"],
    });
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector]),
      entries: [vector],
      files: filesFor([vector]),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: false,
      issueCodes: ["catalog_invalid"],
    });
  });

  it("rejects an invalid redirect independently", async () => {
    const vector = entry("std-vector");
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector], {
        redirects: [{ fromSlug: "old/vector", toEntryId: "missing-entry" }],
      }),
      entries: [vector],
      files: filesFor([vector]),
    });

    await expect(reference.readiness()).resolves.toMatchObject({
      ready: false,
      issueCodes: ["catalog_invalid"],
    });
  });

  it("rejects a category parent cycle independently", async () => {
    const vector = entry("std-vector");
    const reference = createInMemoryReferenceCatalog({
      catalog: catalog([vector], {
        categories: [
          { id: "containers", title: "容器", parentId: "sequences", order: 1 },
          { id: "sequences", title: "顺序容器", parentId: "containers", order: 2 },
        ],
      }),
      entries: [vector],
      files: filesFor([vector]),
    });

    await expect(reference.readiness()).resolves.toMatchObject({
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
      schemaVersion: 2,
      catalogVersion: 1,
      categories: [
        { id: "containers", entryIds: ["std-vector"] },
        { id: "algorithms", entryIds: ["std-sort"] },
      ],
    });
    await expect(
      reference.resolveSlug("standard-library/std-vector"),
    ).resolves.toEqual({
      schemaVersion: 2,
      entryId: "std-vector",
      canonicalSlug: "standard-library/std-vector",
      redirected: false,
    });
    await expect(reference.resolveSlug("library/vector")).resolves.toEqual({
      schemaVersion: 2,
      entryId: "std-vector",
      canonicalSlug: "standard-library/std-vector",
      redirected: true,
    });
    await expect(reference.resolveSlug("unknown")).resolves.toBeUndefined();
  });
});

describe("[T-REF-003] deterministic Reference search", () => {
  const searchableCatalog = (
    verificationByExampleKey: ReadonlyMap<
      string,
      "verified" | "unsupported" | "not-checked"
    > = new Map(),
  ) => {
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
      verificationByExampleKey,
      files: {
        ...filesFor(entries),
        [vector.content.path]:
          "# std::vector\n\n## 迭代器失效\n\n正文仅提及 std::ranges::sort。\n",
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

  it("ranks exact titles and headers before explicit symbol prefixes", async () => {
    const reference = searchableCatalog();
    const title = await reference.search({ text: "std::span 连续视图" });
    const header = await reference.search({ text: "<span>" });
    const prefix = await reference.search({ text: "std::vec" });
    const suffix = await reference.search({ text: "tor" });

    expect(title.results[0]).toMatchObject({
      id: "std-span",
      matchedBy: expect.arrayContaining(["title"]),
    });
    expect(header.results[0]).toMatchObject({
      id: "std-span",
      matchedBy: expect.arrayContaining(["header"]),
    });
    expect(prefix.results[0]).toMatchObject({
      id: "std-vector",
      matchedBy: expect.arrayContaining(["symbol"]),
    });
    expect(suffix.results).toEqual([]);
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
    await expect(
      reference.search({ text: "ranges::sort" }),
    ).resolves.toMatchObject({
      results: [
        expect.objectContaining({ id: "std-vector", matchedBy: ["body"] }),
      ],
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

  it("filters by kind, category, and aggregate local verification with stable ties", async () => {
    const reference = searchableCatalog(
      new Map([
        ["std-vector/basic", "verified"],
        ["std-span/basic", "verified"],
        ["std-auto-ptr/basic", "unsupported"],
      ]),
    );

    const result = await reference.search({
      text: "",
      kind: "type",
      category: "containers",
      verified: "verified",
    });

    expect(result.results).toMatchObject([
      { id: "std-span", verification: "verified" },
      { id: "std-vector", verification: "verified" },
    ]);
    await expect(reference.getEntry("std-vector")).resolves.toMatchObject({
      examples: [{ verification: "verified" }],
    });
  });
});

export { catalog, entry, filesFor };

describe("[T-REF-001] filesystem Reference Adapter", () => {
  it("publishes only current local toolchain verification from a persisted manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-reference-verified-"));
    const vector = entry("std-vector", {
      examples: [
        {
          id: "basic",
          path: "entries/std-vector/basic.cpp",
          kind: "compile",
          standard: "c++20",
        },
      ],
    });
    try {
      await mkdir(join(root, "entries", "std-vector"), { recursive: true });
      await writeFile(
        join(root, "catalog.json"),
        JSON.stringify(catalog([vector])),
        "utf8",
      );
      await writeFile(
        join(root, "entries", "std-vector", "entry.json"),
        JSON.stringify(vector),
        "utf8",
      );
      await writeFile(
        join(root, "entries", "std-vector", "content.md"),
        "# std::vector\n",
        "utf8",
      );
      await writeFile(
        join(root, "entries", "std-vector", "basic.cpp"),
        "int main() {}\n",
        "utf8",
      );
      const verificationPath = join(root, "verification.json");
      const matchingManifest = {
        schemaVersion: 1,
        catalogVersion: 1,
        compilerFingerprint: "Apple clang version 17.0.0",
        examples: [
          {
            entryId: "std-vector",
            exampleId: "basic",
            sourceDigest:
              "bc8bb8e433bf65214540115414c821c904b2a30d60a3ac0424bf9b77a00024b7",
            standard: "c++20",
            verification: "verified",
          },
        ],
      } as const;
      await writeFile(
        verificationPath,
        JSON.stringify(matchingManifest),
        "utf8",
      );

      const verifiedReference = (
        compilerFingerprint: string = matchingManifest.compilerFingerprint,
      ) =>
        createFilesystemReferenceCatalog({
          catalogPath: join(root, "catalog.json"),
          verification: { manifestPath: verificationPath, compilerFingerprint },
        });
      const expectNotChecked = async (candidate: unknown): Promise<void> => {
        await writeFile(
          verificationPath,
          typeof candidate === "string"
            ? candidate
            : JSON.stringify(candidate),
          "utf8",
        );
        await expect(
          verifiedReference().getEntry("std-vector"),
        ).resolves.toMatchObject({
          examples: [{ id: "basic", verification: "not-checked" }],
        });
      };

      const reference = verifiedReference();

      await expect(reference.getEntry("std-vector")).resolves.toMatchObject({
        examples: [{ id: "basic", verification: "verified" }],
      });
      await expect(
        reference.search({ text: "std::vector", verified: "verified" }),
      ).resolves.toMatchObject({ total: 1 });

      const staleReference = verifiedReference(
        "Apple clang version 18.0.0",
      );
      await expect(
        staleReference.getEntry("std-vector"),
      ).resolves.toMatchObject({
        examples: [{ id: "basic", verification: "not-checked" }],
      });

      await expectNotChecked({
        ...matchingManifest,
        examples: [
          { ...matchingManifest.examples[0], sourceDigest: "0".repeat(64) },
        ],
      });
      await expectNotChecked("{");
      await expectNotChecked({ ...matchingManifest, catalogVersion: 2 });
      await expectNotChecked({ ...matchingManifest, examples: [] });
      await expectNotChecked({
        ...matchingManifest,
        examples: [
          matchingManifest.examples[0],
          matchingManifest.examples[0],
        ],
      });
      await expectNotChecked({
        ...matchingManifest,
        examples: [
          { ...matchingManifest.examples[0], entryId: "unknown-entry" },
        ],
      });
      await expectNotChecked({
        ...matchingManifest,
        examples: [
          { ...matchingManifest.examples[0], standard: "c++17" },
        ],
      });
      await rm(verificationPath);
      await expect(
        verifiedReference().getEntry("std-vector"),
      ).resolves.toMatchObject({
        examples: [{ id: "basic", verification: "not-checked" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads the expanded Phase 3 Reference catalog", async () => {
    const reference = createFilesystemReferenceCatalog({
      catalogPath: resolve("reference/catalog.json"),
    });

    await expect(reference.readiness()).resolves.toEqual({
      ready: true,
      catalogVersion: 11,
      entryCount: 90,
      activationDurationMs: expect.any(Number),
    });
    const navigation = await reference.getNavigation();
    expect(
      navigation.categories.flatMap((category) => category.entryIds).sort(),
    ).toEqual(
      [
        "standard-library",
        "containers",
        "algorithms",
        "header-vector",
        "header-algorithm",
        "std-vector",
        "std-string",
        "std-string-view",
        "std-unique-ptr",
        "std-optional",
        "std-sort",
        "std-find",
        "std-make-unique",
        "std-vector-push-back",
        "header-iostream",
        "std-cout",
        "std-cin",
        "header-array",
        "std-array",
        "header-deque",
        "std-deque",
        "header-unordered-map",
        "std-unordered-map",
        "std-vector-reserve",
        "guide-choosing-sequence-container",
        "std-map",
        "std-set",
        "std-unordered-set",
        "std-queue",
        "std-priority-queue",
        "std-stack",
        "std-transform",
        "std-count-if",
        "std-all-of",
        "std-lower-bound",
        "std-remove-if",
        "std-accumulate",
        "header-map",
        "header-set",
        "header-unordered-set",
        "header-queue",
        "header-stack",
        "header-numeric",
        "std-binary-search",
        "std-any-of",
        "std-copy",
        "std-reverse",
        "std-unique",
        "std-for-each",
        "header-string",
        "header-string-view",
        "header-charconv",
        "std-string-substr",
        "std-string-find",
        "std-string-append",
        "std-from-chars",
        "std-to-chars",
        "header-memory",
        "std-shared-ptr",
        "std-weak-ptr",
        "std-make-shared",
        "header-utility",
        "std-move",
        "std-forward",
        "std-swap",
        "std-pair",
        "std-tuple",
        "std-variant",
        "std-any",
        "std-expected",
        "std-function",
        "std-cerr",
        "std-getline",
        "std-getline",
        "header-fstream",
        "std-ifstream",
        "std-ofstream",
        "header-sstream",
        "std-stringstream",
        "header-filesystem",
        "std-filesystem-path",
        "std-filesystem-directory-entry",
        "std-filesystem-directory-iterator",
        "std-filesystem-exists",
        "std-filesystem-create-directories",
        "std-filesystem-remove",
        "header-chrono",
        "std-chrono-duration",
        "std-chrono-time-point",
        "std-chrono-steady-clock",
        "std-chrono-system-clock",
      ].sort(),
    );
    expect(navigation.categories).toContainEqual(
      expect.objectContaining({
        id: "filesystem",
        title: "文件系统",
      }),
    );
    expect(navigation.categories).toContainEqual(
      expect.objectContaining({
        id: "time",
        title: "日期与时间",
      }),
    );
    const result = await reference.search({ text: "std::sort" });
    expect(result.results[0]).toMatchObject({ id: "std-sort" });
  });

  it("rejects a content symlink that escapes the Reference root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-reference-root-"));
    const outside = await mkdtemp(join(tmpdir(), "cpp-reference-outside-"));
    const vector = entry("std-vector");
    try {
      await mkdir(join(root, "entries", "std-vector"), { recursive: true });
      await writeFile(join(outside, "secret.md"), "secret\n", "utf8");
      await symlink(
        join(outside, "secret.md"),
        join(root, vector.content.path),
      );
      await writeFile(
        join(root, vector.examples[0]?.path ?? "missing.cpp"),
        "int main() { return 0; }\n",
        "utf8",
      );
      await writeFile(
        join(root, "entries", "std-vector", "entry.json"),
        JSON.stringify(vector),
        "utf8",
      );
      await writeFile(
        join(root, "catalog.json"),
        JSON.stringify(catalog([vector])),
        "utf8",
      );

      const reference = createFilesystemReferenceCatalog({
        catalogPath: join(root, "catalog.json"),
      });
      await expect(reference.readiness()).resolves.toEqual({
        ready: false,
        issueCodes: ["catalog_invalid"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects a catalog symlink that escapes the configured Reference root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-reference-root-"));
    const outside = await mkdtemp(join(tmpdir(), "cpp-reference-outside-"));
    const vector = entry("std-vector");
    try {
      await mkdir(join(outside, "entries", "std-vector"), { recursive: true });
      await writeFile(
        join(outside, "entries", "std-vector", "content.md"),
        "# std::vector\n",
        "utf8",
      );
      await writeFile(
        join(outside, "entries", "std-vector", "basic.cpp"),
        "int main() { return 0; }\n",
        "utf8",
      );
      await writeFile(
        join(outside, "entries", "std-vector", "entry.json"),
        JSON.stringify(vector),
        "utf8",
      );
      await writeFile(
        join(outside, "catalog.json"),
        JSON.stringify(catalog([vector])),
        "utf8",
      );
      await symlink(join(outside, "catalog.json"), join(root, "catalog.json"));

      const reference = createFilesystemReferenceCatalog({
        catalogPath: join(root, "catalog.json"),
      });
      await expect(reference.readiness()).resolves.toMatchObject({
        ready: false,
        issueCodes: ["catalog_invalid"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("distinguishes a missing catalog from invalid missing Entry files", async () => {
    const root = await mkdtemp(join(tmpdir(), "cpp-reference-missing-"));
    const vector = entry("std-vector");
    try {
      const missingCatalog = createFilesystemReferenceCatalog({
        catalogPath: join(root, "missing-catalog.json"),
      });
      await expect(missingCatalog.readiness()).resolves.toEqual({
        ready: false,
        issueCodes: ["catalog_missing"],
      });

      await mkdir(join(root, "entries", "std-vector"), { recursive: true });
      await writeFile(
        join(root, "entries", "std-vector", "entry.json"),
        JSON.stringify(vector),
        "utf8",
      );
      await writeFile(
        join(root, "catalog.json"),
        JSON.stringify(catalog([vector])),
        "utf8",
      );
      const invalidContent = createFilesystemReferenceCatalog({
        catalogPath: join(root, "catalog.json"),
      });
      await expect(invalidContent.readiness()).resolves.toEqual({
        ready: false,
        issueCodes: ["catalog_invalid"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
