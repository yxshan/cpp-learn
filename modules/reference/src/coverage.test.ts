import { describe, expect, it } from "vitest";

import {
  createInMemoryReferenceCatalog,
  createReferenceCoverageReport,
  type ReferenceCatalogManifest,
  type ReferenceEntryManifest,
} from "./index.js";

function entry(
  id: string,
  overrides: Partial<ReferenceEntryManifest> = {},
): ReferenceEntryManifest {
  return {
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
  };
}

describe("Reference coverage reporting", () => {
  it("reports entries, categories, kinds, standards, sources, and example status", async () => {
    const vector = entry("std-vector");
    const sort = entry("std-sort", {
      slug: "standard-library/algorithms/sort",
      kind: "function",
      since: "c++98",
      categories: ["algorithms"],
      sources: [
        {
          kind: "primary",
          title: "C++ working draft",
          url: "https://eel.is/c++draft/alg.sort",
        },
        {
          kind: "vendor",
          title: "Compiler support",
          url: "https://clang.llvm.org/cxx_status.html",
        },
      ],
      examples: [
        {
          id: "compile-only",
          path: "entries/std-sort/compile-only.cpp",
          kind: "compile",
          standard: "c++17",
        },
      ],
    });
    const landing: ReferenceEntryManifest = {
      schemaVersion: 2,
      id: "standard-library",
      version: 1,
      slug: "standard-library",
      kind: "landing",
      title: "标准库",
      summary: "标准库首页",
      aliases: [],
      categories: ["standard-library"],
      relatedEntryIds: [],
      content: {
        format: "markdown",
        path: "entries/standard-library/content.md",
      },
      examples: [],
      sources: [
        {
          kind: "primary",
          title: "C++ working draft",
          url: "https://eel.is/c++draft/library",
        },
      ],
      verifiedAt: "2026-08-25",
    };
    const entries = [vector, sort, landing];
    const catalog: ReferenceCatalogManifest = {
      schemaVersion: 1,
      version: 7,
      entries: entries.map((candidate) => candidate.content.path.replace("content.md", "entry.json")),
      categories: [
        { id: "standard-library", title: "标准库", order: 10 },
        {
          id: "containers",
          title: "容器",
          parentId: "standard-library",
          order: 20,
        },
        {
          id: "algorithms",
          title: "算法",
          parentId: "standard-library",
          order: 30,
        },
      ],
      redirects: [],
    };
    const files = Object.fromEntries(
      entries.flatMap((candidate) => [
        [candidate.content.path, `# ${candidate.title}\n`],
        ...candidate.examples.map((example) => [example.path, "int main() {}\n"]),
      ]),
    );
    const reference = createInMemoryReferenceCatalog({
      catalog,
      entries,
      files,
      verificationByExampleKey: new Map([
        ["std-vector/basic", "verified"],
        ["std-sort/compile-only", "unsupported"],
      ]),
    });

    await expect(createReferenceCoverageReport(reference)).resolves.toEqual({
      catalogVersion: 7,
      entries: {
        total: 3,
        withExamples: 2,
        withPrimarySource: 3,
        byCategory: [
          { id: "standard-library", title: "标准库", count: 1 },
          { id: "containers", title: "容器", count: 1 },
          { id: "algorithms", title: "算法", count: 1 },
        ],
        byKind: {
          landing: 1,
          header: 0,
          type: 1,
          object: 0,
          function: 1,
          member: 0,
          concept: 0,
          guide: 0,
        },
        byIntroducedStandard: {
          "c++98": 2,
          "c++03": 0,
          "c++11": 0,
          "c++14": 0,
          "c++17": 0,
          "c++20": 0,
          "c++23": 0,
          "c++26-draft": 0,
          unspecified: 1,
        },
        bySourceKind: {
          primary: { entries: 3, sources: 3 },
          secondary: { entries: 0, sources: 0 },
          vendor: { entries: 1, sources: 1 },
        },
      },
      examples: {
        total: 2,
        byKind: { compile: 1, run: 1, "expected-compile-failure": 0 },
        byStandard: {
          "c++98": 0,
          "c++03": 0,
          "c++11": 0,
          "c++14": 0,
          "c++17": 1,
          "c++20": 1,
          "c++23": 0,
          "c++26-draft": 0,
        },
        byVerification: { verified: 1, unsupported: 1, "not-checked": 0 },
      },
    });
  });

  it("rejects a report for an unavailable catalog", async () => {
    const reference = createInMemoryReferenceCatalog({
      catalog: {
        schemaVersion: 1,
        version: 1,
        entries: ["entries/missing/entry.json"],
        categories: [],
        redirects: [],
      },
      entries: [],
      files: {},
    });

    await expect(createReferenceCoverageReport(reference)).rejects.toThrow(
      "Reference catalog is unavailable: catalog_invalid",
    );
  });
});
