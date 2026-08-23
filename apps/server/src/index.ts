import { createProductionPlatform } from "./composition.js";
import { createServer } from "./server.js";

const host = process.env["CPP_LEARN_HOST"] ?? "127.0.0.1";
const requestedPort = Number(process.env["CPP_LEARN_PORT"] ?? "4173");
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;

const server = createServer({ platform: createProductionPlatform(), logger: true });

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "C++ Learn server is ready");
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}

