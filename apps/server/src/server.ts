import Fastify, { type FastifyInstance } from "fastify";

import type { LearningPlatform } from "@cpp-learn/contracts";

export interface ServerDependencies {
  readonly platform: LearningPlatform;
  readonly logger?: boolean;
}

export function createServer(dependencies: ServerDependencies): FastifyInstance {
  const server = Fastify({ logger: dependencies.logger ?? false });

  server.get("/api/v1/health", async () => ({
    schemaVersion: 1,
    status: "ok"
  }));

  server.get("/api/v1/bootstrap", async () =>
    dependencies.platform.query({ type: "bootstrap.get" })
  );

  return server;
}
