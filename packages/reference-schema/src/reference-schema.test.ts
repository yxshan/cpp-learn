import { describe, expect, it } from "vitest";

import { CPP_STANDARDS, REFERENCE_ENTRY_KINDS } from "@cpp-learn/contracts";

import {
  referenceEntrySchema,
  validateReferenceCatalogManifest,
  validateReferenceEntryManifest,
} from "./index.js";

const validEntry = {
  schemaVersion: 2,
  id: "std-vector",
  version: 1,
  slug: "standard-library/containers/vector",
  kind: "type",
  title: "std::vector",
  summary: "连续存储的动态数组容器。",
  symbol: "std::vector",
  header: "<vector>",
  namespace: "std",
  since: "c++98",
  aliases: ["动态数组"],
  categories: ["containers"],
  relatedEntryIds: [],
  content: { format: "markdown", path: "entries/std-vector/content.md" },
  examples: [
    {
      id: "basic",
      path: "entries/std-vector/examples/basic.cpp",
      kind: "run",
      standard: "c++20",
      expectedStdout: "3\n",
    },
  ],
  sources: [
    {
      kind: "primary",
      title: "C++ working draft",
      url: "https://eel.is/c++draft/vector",
      standardSection: "[vector]",
    },
  ],
  verifiedAt: "2026-08-25",
} as const;

describe("[T-REF-001] Reference manifest schemas", () => {
  it("accepts a complete Entry and catalog", () => {
    expect(validateReferenceEntryManifest(validEntry)).toEqual([]);
    expect(
      validateReferenceCatalogManifest({
        schemaVersion: 1,
        version: 1,
        entries: ["entries/std-vector/entry.json"],
        categories: [{ id: "containers", title: "容器", order: 10 }],
        redirects: [],
      }),
    ).toEqual([]);
  });

  it("rejects unknown fields, unsafe paths, missing primary sources, and incomplete Run examples", () => {
    const issues = validateReferenceEntryManifest({
      ...validEntry,
      unexpected: true,
      content: { format: "markdown", path: "../secret.md" },
      examples: [
        {
          id: "basic",
          path: "examples/basic.cpp",
          kind: "run",
          standard: "c++20",
        },
      ],
      sources: [
        {
          kind: "secondary",
          title: "Secondary source",
          url: "https://example.com/vector",
          reusedMaterial: { license: "CC-BY-SA-4.0" },
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "additionalProperties" }),
        expect.objectContaining({ path: "/content/path" }),
        expect.objectContaining({ path: "/examples/0/expectedStdout" }),
        expect.objectContaining({ path: "/sources" }),
        expect.objectContaining({
          path: "/sources/0/reusedMaterial/attribution",
        }),
      ]),
    );
  });

  it("rejects unsupported language standards", () => {
    const issues = validateReferenceEntryManifest({
      ...validEntry,
      since: "c++27",
      examples: [{ ...validEntry.examples[0], standard: "c++27" }],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/since", keyword: "enum" }),
        expect.objectContaining({
          path: "/examples/0/standard",
          keyword: "enum",
        }),
      ]),
    );
  });

  it("keeps schema vocabularies aligned with the shared runtime contract", () => {
    const properties = referenceEntrySchema.properties;
    expect(properties.kind.enum).toEqual([...REFERENCE_ENTRY_KINDS]);
    expect(REFERENCE_ENTRY_KINDS).toContain("object");
    expect(referenceEntrySchema.$defs.standard.enum).toEqual([
      ...CPP_STANDARDS,
    ]);
  });

  it("rejects the superseded Entry schema version", () => {
    expect(
      validateReferenceEntryManifest({ ...validEntry, schemaVersion: 1 }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/schemaVersion", keyword: "const" }),
      ]),
    );
  });
});
