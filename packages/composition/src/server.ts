import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";

import type { ReferencePlayground } from "@cpp-learn/judge";

import type { LearningPlatform } from "@cpp-learn/contracts";
import type { ReferenceCatalog } from "@cpp-learn/reference";

import { registerReferenceRoutes } from "./routes/reference.ts";
import { registerLearningRoutes } from "./routes/learning.ts";
import { registerLocalDataRoutes } from "./routes/local-data.ts";
import { registerJobRoutes } from "./routes/jobs.ts";

export interface ServerDependencies {
  readonly platform: LearningPlatform;
  readonly reference?: ReferenceCatalog;
  readonly referencePlayground?: ReferencePlayground;
  readonly referencePlaygroundMaxConcurrentRuns?: number;
  readonly logger?: boolean;
  readonly webRoot?: string;
  readonly archive?: {
    exportTo(outputPath: string): Promise<unknown>;
    restoreFrom(inputPath: string): Promise<{
      readonly schemaVersion: 1;
      readonly restoredFiles: number;
    }>;
  };
}

export function createServer(
  dependencies: ServerDependencies,
): FastifyInstance {
  const server = Fastify({ logger: dependencies.logger ?? false });
  const configuredPlaygroundConcurrency =
    dependencies.referencePlaygroundMaxConcurrentRuns ?? 1;
  const referencePlaygroundMaxConcurrentRuns =
    Number.isInteger(configuredPlaygroundConcurrency) &&
    configuredPlaygroundConcurrency > 0
      ? configuredPlaygroundConcurrency
      : 1;

  if (dependencies.webRoot) {
    void server.register(fastifyStatic, {
      root: dependencies.webRoot,
      prefix: "/",
      wildcard: false,
    });
    const sendWebEntry = (_request: unknown, reply: FastifyReply) =>
      reply.sendFile("index.html");
    server.get("/reference", sendWebEntry);
    server.get("/reference/*", sendWebEntry);
  }

  const referenceReadiness = () =>
    dependencies.reference
      ? dependencies.reference.readiness()
      : Promise.resolve({
          ready: false as const,
          issueCodes: ["catalog_missing" as const],
        });

  const readyReference = async (
    reply: FastifyReply,
  ): Promise<ReferenceCatalog | undefined> => {
    const readiness = await referenceReadiness();
    if (!readiness.ready) {
      await reply.code(503).send({
        schemaVersion: 1,
        error: { code: "reference_unavailable" },
        readiness,
      });
      return undefined;
    }
    return dependencies.reference;
  };

  registerLearningRoutes(server, {
    platform: dependencies.platform,
    referenceReadiness,
  });

  registerJobRoutes(server, { platform: dependencies.platform });

  registerLocalDataRoutes(server, {
    platform: dependencies.platform,
    archive: dependencies.archive,
  });

  registerReferenceRoutes(server, {
    reference: dependencies.reference,
    referencePlayground: dependencies.referencePlayground,
    referencePlaygroundMaxConcurrentRuns,
    readyReference,
  });

  return server;
}
