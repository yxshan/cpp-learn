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
import {
  HARDENING_HEADERS,
  SESSION_COOKIE_NAME,
  createMutationGuard,
  createSessionToken,
  sessionCookie,
  shouldPublishSessionCookie,
} from "./transport.ts";

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
  /**
   * Session token required by every state-changing request. Generated per
   * server when absent; supplied explicitly only by tests and embedders that
   * must know it in advance.
   */
  readonly sessionToken?: string;
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
  const sessionToken = dependencies.sessionToken ?? createSessionToken();
  const authorizeMutation = createMutationGuard({ sessionToken });

  // One hook owns every response header: the hardening set on all replies, and
  // the session token on the API and HTML entries, so the application holds the
  // value before its first mutation.
  server.addHook("onSend", (request, reply, payload) => {
    for (const [name, value] of Object.entries(HARDENING_HEADERS)) {
      void reply.header(name, value);
    }
    const cookie = request.headers.cookie ?? "";
    if (
      shouldPublishSessionCookie(request.url) &&
      !cookie.includes(`${SESSION_COOKIE_NAME}=`)
    ) {
      void reply.header("set-cookie", sessionCookie(sessionToken));
    }
    return Promise.resolve(payload);
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
    authorizeMutation,
  });

  registerJobRoutes(server, {
    platform: dependencies.platform,
    authorizeMutation,
  });

  registerLocalDataRoutes(server, {
    platform: dependencies.platform,
    archive: dependencies.archive,
    authorizeMutation,
  });

  registerReferenceRoutes(server, {
    reference: dependencies.reference,
    referencePlayground: dependencies.referencePlayground,
    judgeAdmission,
    authorizeMutation,
    readyReference,
  });

  return server;
}
