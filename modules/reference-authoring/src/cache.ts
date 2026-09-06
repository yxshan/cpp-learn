import { randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type { AuthoringValidationIssue } from "./index.js";

export interface AuthoringValidationCacheValue {
  readonly schemaVersion: 1;
  readonly issues: readonly AuthoringValidationIssue[];
}

export interface AuthoringValidationCache {
  get(key: string): Promise<AuthoringValidationCacheValue | undefined>;
  put(key: string, value: AuthoringValidationCacheValue): Promise<void>;
}

function cloneValue(
  value: AuthoringValidationCacheValue,
): AuthoringValidationCacheValue {
  return structuredClone(value);
}

export function createInMemoryAuthoringValidationCache(): AuthoringValidationCache {
  const values = new Map<string, AuthoringValidationCacheValue>();
  return {
    async get(key) {
      const value = values.get(key);
      return value === undefined ? undefined : cloneValue(value);
    },
    async put(key, value) {
      values.set(key, cloneValue(value));
    },
  };
}

function isSafeCacheKey(key: string): boolean {
  return /^[a-f0-9]{64}$/u.test(key);
}

function physicalPath(path: string): string {
  let existing = resolve(path);
  const missing: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    missing.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...missing);
}

export interface FilesystemAuthoringValidationCacheOptions {
  readonly root: string;
  readonly forbiddenRoots?: readonly string[];
}

export function createFilesystemAuthoringValidationCache({
  root,
  forbiddenRoots = [],
}: FilesystemAuthoringValidationCacheOptions): AuthoringValidationCache {
  const cacheRoot = physicalPath(root);
  for (const forbiddenRoot of forbiddenRoots.map(physicalPath)) {
    if (
      cacheRoot === forbiddenRoot ||
      cacheRoot.startsWith(`${forbiddenRoot}/`) ||
      forbiddenRoot.startsWith(`${cacheRoot}/`)
    ) {
      throw new Error(
        `Cache root must be separate from protected content: ${root}`,
      );
    }
  }

  return {
    async get(key) {
      if (!isSafeCacheKey(key)) return undefined;
      try {
        const parsed = JSON.parse(
          await readFile(join(cacheRoot, `${key}.json`), "utf8"),
        ) as unknown;
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("schemaVersion" in parsed) ||
          parsed.schemaVersion !== 1 ||
          !("issues" in parsed) ||
          !Array.isArray(parsed.issues) ||
          !parsed.issues.every(
            (issue) =>
              typeof issue === "object" &&
              issue !== null &&
              "path" in issue &&
              typeof issue.path === "string" &&
              "message" in issue &&
              typeof issue.message === "string" &&
              "keyword" in issue &&
              typeof issue.keyword === "string",
          )
        ) {
          return undefined;
        }
        return cloneValue(parsed as AuthoringValidationCacheValue);
      } catch {
        return undefined;
      }
    },
    async put(key, value) {
      if (!isSafeCacheKey(key)) {
        throw new Error(`Invalid authoring cache key: ${key}`);
      }
      await mkdir(cacheRoot, { recursive: true });
      const target = join(cacheRoot, `${key}.json`);
      const temporary = join(
        cacheRoot,
        `.${key}.${process.pid}.${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, `${JSON.stringify(value)}\n`, {
          encoding: "utf8",
          flag: "wx",
        });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
