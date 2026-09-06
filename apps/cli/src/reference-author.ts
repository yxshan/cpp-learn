#!/usr/bin/env node
import { join, resolve } from "node:path";

import {
  createFilesystemAuthoringCatalogContext,
  createFilesystemReferenceDraftRepository,
  createNativeAuthoringExampleValidator,
  createReferenceAuthoring,
} from "@cpp-learn/reference-authoring";

import { auditReferenceContent } from "../../../scripts/reference-content-quality.js";

import { runReferenceAuthorCli } from "./reference-author-cli.js";

const authoringRoot = resolve(
  process.env["CPP_LEARN_AUTHORING_ROOT"] ?? join(".cpp-learn", "authoring"),
);
const catalogPath = resolve(
  process.env["CPP_LEARN_REFERENCE_CATALOG"] ??
    join("reference", "catalog.json"),
);
const authoring = createReferenceAuthoring({
  drafts: createFilesystemReferenceDraftRepository({
    root: authoringRoot,
    forbiddenRoots: [resolve("reference")],
  }),
  catalog: createFilesystemAuthoringCatalogContext({ catalogPath }),
  examples: createNativeAuthoringExampleValidator(),
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
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
