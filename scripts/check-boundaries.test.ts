import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Package boundaries are enforced, not assumed.
 *
 * Scoped verification (`docs/74`) is only sound while the declared dependency
 * graph matches the real one. This test makes that checkable: every import that
 * crosses a workspace package boundary must resolve to a package the importing
 * package declares, and no file may reach into another package through a
 * relative path. Both failures would silently invalidate any decision to skip
 * a gate because "this change cannot affect another module".
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
  readonly declared: ReadonlySet<string>;
}

function listPackageDirs(area: string): string[] {
  const areaPath = join(ROOT, area);
  return readdirSync(areaPath)
    .map((name) => join(areaPath, name))
    .filter((path) => {
      try {
        return statSync(join(path, "package.json")).isFile();
      } catch {
        return false;
      }
    });
}

function readWorkspacePackages(): WorkspacePackage[] {
  const dirs = [
    ...listPackageDirs("apps"),
    ...listPackageDirs("modules"),
    ...listPackageDirs("packages"),
  ];
  return dirs.map((dir) => {
    const manifest = JSON.parse(
      readFileSync(join(dir, "package.json"), "utf8"),
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      name: manifest.name,
      dir,
      declared: new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ]),
    };
  });
}

function listSourceFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        found.push(path);
      }
    }
  };
  walk(dir);
  return found;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+"([^"]+)"/gu,
    /\bimport\s*\(\s*"([^"]+)"\s*\)/gu,
    /^\s*import\s+"([^"]+)"/gmu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function owningPackage(
  packages: readonly WorkspacePackage[],
  path: string,
): WorkspacePackage | undefined {
  return packages.find(
    (candidate) =>
      path === candidate.dir || path.startsWith(`${candidate.dir}/`),
  );
}

describe("[T-ARCH-001] workspace package boundaries", () => {
  const packages = readWorkspacePackages();
  const findings: string[] = [];

  for (const owner of packages) {
    const sourceDir = join(owner.dir, "src");
    let files: string[];
    try {
      files = listSourceFiles(sourceDir);
    } catch {
      continue;
    }

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const from = relative(ROOT, file);
      for (const specifier of importSpecifiers(source)) {
        if (specifier.startsWith("@cpp-learn/")) {
          const target = specifier.split("/").slice(0, 2).join("/");
          if (target === owner.name) continue;
          if (!packages.some((candidate) => candidate.name === target)) {
            findings.push(`${from}: unknown workspace package "${target}"`);
            continue;
          }
          if (!owner.declared.has(target)) {
            findings.push(
              `${from}: imports ${target} but ${owner.name} does not declare it`,
            );
          }
          continue;
        }

        if (!specifier.startsWith(".")) continue;
        const resolved = resolve(dirname(file), specifier);
        if (resolved === owner.dir || resolved.startsWith(`${owner.dir}/`)) {
          continue;
        }
        const target = owningPackage(packages, resolved);
        findings.push(
          target === undefined
            ? `${from}: relative import escapes the package: ${specifier}`
            : `${from}: relative import reaches into ${target.name} (${specifier}); use the package name`,
        );
      }
    }
  }

  it("resolves every cross-package import to a declared dependency", () => {
    expect([...new Set(findings)].sort()).toEqual([]);
  });

  it("covers every workspace package", () => {
    expect(packages.length).toBeGreaterThanOrEqual(14);
  });
});
