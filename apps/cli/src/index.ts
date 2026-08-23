#!/usr/bin/env node
import { createProductionPlatform } from "@cpp-learn/server/composition";

import { runCli } from "./cli.js";

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  platform: await createProductionPlatform(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
