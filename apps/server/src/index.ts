import { fileURLToPath } from "node:url";

import { createProductionPlatform } from "./composition.js";
import { resolveServerAddress } from "./config.js";
import { createServer } from "./server.js";

const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

const { host, port } = resolveServerAddress(process.env);

const server = createServer({
  platform: await createProductionPlatform(),
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
