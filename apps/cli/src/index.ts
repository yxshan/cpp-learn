#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import type { LearningPlatform } from "@cpp-learn/contracts";

import {
  createProductionDataArchive,
  createProductionPlatform,
} from "@cpp-learn/server/composition";
import { createServer } from "@cpp-learn/server";

import { runCli } from "./cli.js";

const archive = createProductionDataArchive();
const command = process.argv[2];
const platform =
  command === "export" || command === "restore"
    ? ({
        async dispatch() {
          throw new Error("Learning Platform is unavailable in data-only mode");
        },
        async query() {
          throw new Error("Learning Platform is unavailable in data-only mode");
        },
        async *events() {},
      } as LearningPlatform)
    : await createProductionPlatform();
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  platform,
  archive,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  serve: async () => {
    const server = createServer({ platform, archive, logger: true, webRoot });
    const address = await server.listen({ host: "127.0.0.1", port: 4173 });
    process.stdout.write(`C++ Learn server listening at ${address}\n`);
  },
});
