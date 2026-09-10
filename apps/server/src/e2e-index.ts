import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  createProductionApplication,
  createProductionDataArchive,
  createServer,
  resolveServerAddress,
  resolveServerStoragePaths,
} from "@cpp-learn/composition";

const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
const { host, port } = resolveServerAddress(process.env);
const storagePaths = resolveServerStoragePaths(process.env);
const configuredRuntimeRoot = process.env["CPP_LEARN_E2E_RUNTIME_ROOT"];
if (!configuredRuntimeRoot) {
  throw new Error("CPP_LEARN_E2E_RUNTIME_ROOT is required");
}
const e2eRuntimeRoot: string = configuredRuntimeRoot;

await rm(e2eRuntimeRoot, { recursive: true, force: true });
await mkdir(e2eRuntimeRoot, { recursive: true });
const application = await createProductionApplication(storagePaths);

const server = createServer({
  platform: application.platform,
  reference: application.reference,
  referencePlayground: application.referencePlayground,
  archive: createProductionDataArchive(storagePaths),
  logger: true,
  webRoot,
});

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await server.close();
    await rm(e2eRuntimeRoot, { recursive: true, force: true });
    process.exit(0);
  } catch (error) {
    server.log.error(error, "Failed to stop the C++ Learn E2E server");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "C++ Learn E2E server is ready");
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
