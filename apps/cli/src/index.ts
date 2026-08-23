#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { createProductionPlatform } from "@cpp-learn/server/composition";
import { createServer } from "@cpp-learn/server";

import { runCli } from "./cli.js";

const platform = await createProductionPlatform();
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  platform,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  serve: async () => {
    const server = createServer({ platform, logger: true, webRoot });
    const address = await server.listen({ host: "127.0.0.1", port: 4173 });
    process.stdout.write(`C++ Learn server listening at ${address}\n`);
  },
});
