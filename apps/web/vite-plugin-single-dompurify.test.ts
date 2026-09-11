import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  singleDompurifySource,
  vendoredMonacoDompurifyId,
} from "./vite-plugin-single-dompurify.ts";

const vendored =
  "/repo/node_modules/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js";
const vendoredWindows =
  "C:\\repo\\node_modules\\monaco-editor\\esm\\vs\\base\\browser\\dompurify\\dompurify.js";

describe("Monaco's private DOMPurify copy", () => {
  it("is recognised in both path styles and through a query suffix", () => {
    expect(vendoredMonacoDompurifyId(vendored)).toBe(vendored);
    expect(vendoredMonacoDompurifyId(vendoredWindows)).toBe(vendoredWindows);
    expect(vendoredMonacoDompurifyId(`${vendored}?v=7f3a1b`)).toBe(vendored);
  });

  it("is redirected to the audited package copy", () => {
    expect(singleDompurifySource(vendored)).toBe(
      'export { default } from "dompurify";\n',
    );
  });

  it("leaves every other module alone", () => {
    for (const id of [
      "/repo/node_modules/dompurify/dist/purify.es.mjs",
      "/repo/node_modules/monaco-editor/esm/vs/base/browser/domSanitize.js",
      "/repo/node_modules/monaco-editor/dev/vs/editor/editor.main.js",
      "/repo/node_modules/monaco-editor/esm/vs/base/browser/dompurify/other.js",
      "/repo/apps/web/src/lesson/dompurify.js",
    ]) {
      expect(vendoredMonacoDompurifyId(id)).toBeUndefined();
      expect(singleDompurifySource(id)).toBeUndefined();
    }
  });
});

async function purifyCandidates(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return purifyCandidates(path);
      return /purif/i.test(entry.name) && entry.name.endsWith(".js")
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

describe("the shipped sanitizer is the audited one", () => {
  it("finds Monaco's vendored copy and redirects it to the package", async () => {
    // Reading the exact path is deliberate: if Monaco renames or removes the
    // vendored sanitizer, this test fails and the redirect gets re-derived
    // instead of silently shipping an unreviewed copy again.
    const vendored = resolve(
      "node_modules/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js",
    );
    const source = await readFile(vendored, "utf8");

    expect(source).toContain("@license DOMPurify");
    expect(singleDompurifySource(vendored)).toBeTypeOf("string");
  });

  it("redirects every other DOMPurify copy Monaco ships", async () => {
    const candidates = await purifyCandidates(
      resolve("node_modules/monaco-editor/esm"),
    );
    const copies: string[] = [];
    for (const candidate of candidates) {
      const source = await readFile(candidate, "utf8");
      if (!source.includes("@license DOMPurify")) continue;
      copies.push(candidate);
      expect(
        singleDompurifySource(candidate),
        `${candidate} must be redirected to the audited package`,
      ).toBeTypeOf("string");
    }

    expect(copies.length).toBeGreaterThan(0);
  });
});
