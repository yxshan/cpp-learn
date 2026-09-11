import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";

import type { ReferencePlayground } from "@cpp-learn/judge";

import type { LearningPlatform } from "@cpp-learn/contracts";
import type { ReferenceCatalog } from "@cpp-learn/reference";

import { registerReferenceRoutes } from "./routes/reference.ts";
import { registerLearningRoutes } from "./routes/learning.ts";
import { registerLocalDataRoutes } from "./routes/local-data.ts";
import { registerJobRoutes } from "./routes/jobs.ts";
import {
  DEFAULT_JUDGE_MAX_CONCURRENT,
  DEFAULT_JUDGE_MAX_QUEUED,
  createJudgeAdmission,
  type JudgeAdmission,
} from "./admission.ts";

export interface ServerDependencies {
  readonly platform: LearningPlatform;
  readonly reference?: ReferenceCatalog;
  readonly referencePlayground?: ReferencePlayground;
  /**
   * Host Judge budget shared with Activity Run/Grade. Production assemblies
   * always supply the instance that wraps the Judge; a server created without
   * one gets a private budget, which bounds the Playground but not the platform.
   */
  readonly judgeAdmission?: JudgeAdmission;
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
  const judgeAdmission =
    dependencies.judgeAdmission ??
    createJudgeAdmission({
      maxConcurrent: DEFAULT_JUDGE_MAX_CONCURRENT,
      maxQueued: DEFAULT_JUDGE_MAX_QUEUED,
    });

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
    judgeAdmission,
    readyReference,
  });

  return server;
}
