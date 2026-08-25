import { fileURLToPath } from "node:url";

import {
  createProductionDataArchive,
  createProductionApplication,
} from "./composition.js";
import { resolveServerAddress, resolveServerStoragePaths } from "./config.js";
import { createServer } from "./server.js";

const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

const { host, port } = resolveServerAddress(process.env);
const storagePaths = resolveServerStoragePaths(process.env);
const application = await createProductionApplication(storagePaths);

const server = createServer({
  platform: application.platform,
  reference: application.reference,
  archive: createProductionDataArchive(storagePaths),
  logger: true,
  webRoot,
});

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "C++ Learn server is ready");
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
