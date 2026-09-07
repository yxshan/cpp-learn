#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  createFilesystemAuthoringCatalogContext,
  createFilesystemAuthoringPublisher,
  createFilesystemAuthoringValidationCache,
  createFilesystemReferenceDraftRepository,
  createNativeAuthoringExampleValidator,
  createReferenceAuthoring,
} from "@cpp-learn/reference-authoring";
import { createFilesystemReferenceCatalog } from "@cpp-learn/reference";

import { auditReferenceContent } from "../../../scripts/reference-content-quality.js";

import { runReferenceAuthorCli } from "./reference-author-cli.js";
import { createFilesystemReferenceAuthorPreview } from "./reference-author-preview.js";

const authoringRoot = resolve(
  process.env["CPP_LEARN_AUTHORING_ROOT"] ?? join(".cpp-learn", "authoring"),
);
const catalogPath = resolve(
  process.env["CPP_LEARN_REFERENCE_CATALOG"] ??
    join("reference", "catalog.json"),
);
const referenceRoot = dirname(catalogPath);
const authoring = createReferenceAuthoring({
  drafts: createFilesystemReferenceDraftRepository({
    root: authoringRoot,
    forbiddenRoots: [dirname(catalogPath)],
  }),
  catalog: createFilesystemAuthoringCatalogContext({
    catalogPath,
    activityRoot: resolve("curriculum", "activities"),
  }),
  examples: createNativeAuthoringExampleValidator(),
  cache: createFilesystemAuthoringValidationCache({
    root: resolve(
      process.env["CPP_LEARN_AUTHORING_CACHE_ROOT"] ??
        join(".cpp-learn", "authoring-cache"),
    ),
    forbiddenRoots: [dirname(catalogPath)],
  }),
  publisher: createFilesystemAuthoringPublisher({
    root: referenceRoot,
    async validateStaging(root) {
      const readiness = await createFilesystemReferenceCatalog({
        catalogPath: join(root, "catalog.json"),
      }).readiness();
      if (!readiness.ready) {
        throw new Error(
          `Staged Reference gate failed: ${readiness.issueCodes.join(", ")}`,
        );
      }
    },
  }),
  quality: {
    async validate({ entry, content }) {
      return auditReferenceContent({
        id: entry.id,
        kind: entry.kind,
        ...(entry.header === undefined ? {} : { header: entry.header }),
        content,
        exampleCount: entry.examples.length,
        primarySourceCount: entry.sources.filter(
          ({ kind }) => kind === "primary",
        ).length,
        relatedEntryCount: entry.relatedEntryIds.length,
      }).map((area) => ({
        path: `/${area}`,
        message: `Canonical Reference quality area ${area} is incomplete`,
        keyword: "quality",
      }));
    },
  },
});

process.exitCode = await runReferenceAuthorCli({
  argv: process.argv.slice(2),
  authoring,
  preview: createFilesystemReferenceAuthorPreview({ root: authoringRoot }),
  readTextFile: (path) => readFile(resolve(path), "utf8"),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
