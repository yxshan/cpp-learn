import { describe, expect, it } from "vitest";

import {
  canonicalReferenceUrl,
  parseReferenceLocation,
  referenceEntryUrl,
  referenceCategoryUrl,
  referenceSearchUrl,
} from "./reference-location.js";

describe("[T-REF-006] stable Reference URL state", () => {
  it("parses landing, search, Entry, and heading state from a URL", () => {
    expect(parseReferenceLocation(new URL("http://local/reference"))).toEqual({
      query: "",
      hash: "",
    });
    expect(
      parseReferenceLocation(
        new URL(
          "http://local/reference/standard-library/containers/vector?q=%E5%8A%A8%E6%80%81%E6%95%B0%E7%BB%84#iterator-invalidation",
        ),
      ),
    ).toEqual({
      slug: "standard-library/containers/vector",
      query: "动态数组",
      hash: "#iterator-invalidation",
    });
    expect(
      parseReferenceLocation(
        new URL("http://local/reference?category=algorithms"),
      ),
    ).toMatchObject({ category: "algorithms" });
    expect(() =>
      parseReferenceLocation(new URL("http://local/reference/bad%EFslug")),
    ).not.toThrow();
  });

  it("canonicalizes a historical slug without losing search or anchor context", () => {
    const current = new URL(
      "http://local/reference/containers/vector?q=vector#complexity",
    );

    expect(
      canonicalReferenceUrl(
        current,
        "standard-library/containers/vector",
      ).toString(),
    ).toBe(
      "http://local/reference/standard-library/containers/vector?q=vector#complexity",
    );
  });

  it("builds Entry and search URLs without carrying unrelated parameters", () => {
    const current = new URL(
      "http://local/reference/standard-library/containers/vector?q=vector&activity=old#complexity",
    );

    expect(referenceEntryUrl(current, "standard-library/algorithms/sort")).toBe(
      "/reference/standard-library/algorithms/sort?q=vector",
    );
    expect(referenceSearchUrl(current, "排序")).toBe(
      "/reference?q=%E6%8E%92%E5%BA%8F",
    );
    expect(referenceCategoryUrl(current, "algorithms")).toBe(
      "/reference?q=vector&category=algorithms",
    );
    expect(referenceCategoryUrl(current, undefined)).toBe(
      "/reference?q=vector",
    );
  });
});
