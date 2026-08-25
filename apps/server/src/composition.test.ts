import { describe, expect, it } from "vitest";

import { createInMemoryReferenceCatalog } from "@cpp-learn/reference";

import { buildReferenceActivityIndex } from "./composition.js";

function referenceFixture() {
  return createInMemoryReferenceCatalog({
    catalog: {
      schemaVersion: 1,
      version: 1,
      entries: ["entries/std-vector/entry.json"],
      categories: [{ id: "containers", title: "容器", order: 1 }],
      redirects: [],
    },
    entries: [
      {
        schemaVersion: 1,
        id: "std-vector",
        version: 1,
        slug: "standard-library/containers/vector",
        kind: "type",
        title: "std::vector",
        summary: "动态数组。",
        symbol: "std::vector",
        since: "c++98",
        aliases: [],
        categories: ["containers"],
        relatedEntryIds: [],
        content: { format: "markdown", path: "entries/std-vector/content.md" },
        examples: [],
        sources: [
          {
            kind: "primary",
            title: "C++ working draft",
            url: "https://eel.is/c++draft/vector",
          },
        ],
        verifiedAt: "2026-08-25",
      },
    ],
    files: { "entries/std-vector/content.md": "# std::vector\n" },
  });
}

describe("[T-REF-002] Reference and Curriculum composition", () => {
  it("builds the immutable reverse Activity index", async () => {
    const result = await buildReferenceActivityIndex(
      [
        { id: "containers", referenceIds: ["std-vector"] },
        { id: "review", referenceIds: ["std-vector"] },
      ],
      referenceFixture(),
    );

    expect(result).toEqual({
      ok: true,
      relatedActivityIdsByEntryId: new Map([
        ["std-vector", ["containers", "review"]],
      ]),
    });
  });

  it("rejects an unknown Activity-to-Reference link", async () => {
    await expect(
      buildReferenceActivityIndex(
        [{ id: "containers", referenceIds: ["missing-reference"] }],
        referenceFixture(),
      ),
    ).resolves.toEqual({
      ok: false,
      unknownLinks: [
        { activityId: "containers", referenceId: "missing-reference" },
      ],
    });
  });
});
