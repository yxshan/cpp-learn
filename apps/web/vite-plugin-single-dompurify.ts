import type { Plugin } from "vite";

/**
 * Monaco ships a private copy of DOMPurify inside its ESM bundle at
 * `monaco-editor/esm/vs/base/browser/dompurify/dompurify.js`.
 *
 * That file is byte-identical to `dompurify`'s published ESM build, but Monaco
 * pins the version it vendors, so a security release of the package never
 * reaches the sanitizer we actually ship. The package copy used to be a second,
 * unused duplicate in the tree: it was only referenced by Monaco's `dev/` AMD
 * bundle, which this application never loads.
 *
 * Redirecting that single import to the package collapses the two copies into
 * one, so the lockfile, `npm audit` and the production bundle all describe the
 * same audited code.
 */
const VENDORED_MONACO_DOMPURIFY =
  /[\\/]node_modules[\\/]monaco-editor[\\/]esm[\\/].*[\\/]dompurify[\\/]dompurify\.js$/;

/** Repository path of Monaco's private sanitizer copy, if `id` is that module. */
export function vendoredMonacoDompurifyId(id: string): string | undefined {
  const path = id.split("?")[0] ?? "";
  return VENDORED_MONACO_DOMPURIFY.test(path) ? path : undefined;
}

/**
 * Replacement source for Monaco's private copy, or `undefined` when `id` is not
 * that module. A re-export is the whole fix: both files have the same default
 * export, so no caller observes a difference.
 */
export function singleDompurifySource(id: string): string | undefined {
  return vendoredMonacoDompurifyId(id) === undefined
    ? undefined
    : 'export { default } from "dompurify";\n';
}

export function singleDompurifyPlugin(): Plugin {
  return {
    name: "cpp-learn:single-dompurify",
    enforce: "pre",
    load(id) {
      return singleDompurifySource(id) ?? null;
    },
  };
}
