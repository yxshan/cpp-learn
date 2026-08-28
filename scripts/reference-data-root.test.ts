import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveReferenceDataRoot } from "./reference-data-root.js";

describe("Reference script data root", () => {
  it("uses the local default and honors the supported environment override", () => {
    expect(resolveReferenceDataRoot({})).toBe(resolve(".cpp-learn", "data"));
    expect(
      resolveReferenceDataRoot({ CPP_LEARN_DATA_ROOT: "local-reference-data" }),
    ).toBe(resolve("local-reference-data"));
  });
});
