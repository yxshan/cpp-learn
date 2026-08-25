import { fileURLToPath } from "node:url";

import {
  createProductionDataArchive,
  createProductionPlatform,
} from "./composition.js";
import { resolveServerAddress, resolveServerStoragePaths } from "./config.js";
import { createServer } from "./server.js";

const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

const { host, port } = resolveServerAddress(process.env);
const storagePaths = resolveServerStoragePaths(process.env);

const server = createServer({
  platform: await createProductionPlatform(storagePaths),
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
