#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import type { LearningPlatform } from "@cpp-learn/contracts";

import {
  createProductionApplication,
  createProductionDataArchive,
} from "@cpp-learn/server/composition";

import { runCli } from "./cli.js";
import { createCliHttpServer } from "./serve.js";

const archive = createProductionDataArchive();
const command = process.argv[2];
const dataOnly = command === "export" || command === "restore";
const application = dataOnly ? undefined : await createProductionApplication();
const platform = application
  ? application.platform
  : ({
      async dispatch() {
        throw new Error("Learning Platform is unavailable in data-only mode");
      },
      async query() {
        throw new Error("Learning Platform is unavailable in data-only mode");
      },
      async *events() {},
    } as LearningPlatform);
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  platform,
  archive,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  serve: async () => {
    if (!application) {
      throw new Error("HTTP server is unavailable in data-only mode");
    }
    const server = createCliHttpServer(application, {
      archive,
      logger: true,
      webRoot,
    });
    const address = await server.listen({ host: "127.0.0.1", port: 4173 });
    process.stdout.write(`C++ Learn server listening at ${address}\n`);
  },
});
