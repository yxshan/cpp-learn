import { createProductionPlatform } from "./composition.js";
import { resolveServerAddress } from "./config.js";
import { createServer } from "./server.js";

const { host, port } = resolveServerAddress(process.env);

const server = createServer({
  platform: await createProductionPlatform(),
  logger: true,
});

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "C++ Learn server is ready");
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
