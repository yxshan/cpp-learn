import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function markdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  }));
  return nested.flat();
}

const errors = [];
const files = await markdownFiles(resolve("docs"));
for (const file of files) {
  const text = await readFile(file, "utf8");
  if ((text.match(/^```/gm) ?? []).length % 2 !== 0) {
    errors.push(`Unbalanced code fence: ${file}`);
  }
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (!target || /^(https?:\/\/|mailto:|#)/.test(target)) continue;
    const path = target.split("#", 1)[0];
    if (!path) continue;
    try {
      await stat(resolve(dirname(file), path));
    } catch {
      errors.push(`Broken local link: ${file} -> ${target}`);
    }
  }
}

const requirementPattern = /\b(?:FR|NFR|BR)-\d{3}\b/g;
const specification = await readFile(resolve("docs/02-SOFTWARE_REQUIREMENTS_SPECIFICATION.md"), "utf8");
const traceability = await readFile(resolve("docs/12-REQUIREMENTS_TRACEABILITY_MATRIX.md"), "utf8");
const requirementIds = new Set(specification.match(requirementPattern) ?? []);
const tracedIds = new Set(traceability.match(requirementPattern) ?? []);
for (const requirementId of requirementIds) {
  if (!tracedIds.has(requirementId)) errors.push(`Untraced requirement: ${requirementId}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed (${files.length} Markdown files).`);
}

