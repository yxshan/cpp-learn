import type { FastifyInstance } from "fastify";

import type { LearningPlatform } from "@cpp-learn/contracts";

import { isExecuteActivityBody, type MutationGuard } from "../transport.ts";

export interface JobRouteContext {
  readonly platform: LearningPlatform;
  readonly authorizeMutation: MutationGuard;
}

/**
 * Job status, cancellation, and the event stream.
 *
 * Cancellation is a separate state-changing request so it can be sent while the
 * original synchronous run request is still in flight; the event handler
 * hijacks the reply and streams the retained tail.
 */
export function registerJobRoutes(
  server: FastifyInstance,
  context: JobRouteContext,
): void {
  const { platform, authorizeMutation } = context;

  server.post<{ Params: { jobId: string }; Body: unknown }>(
    "/api/v1/jobs/:jobId/cancellations",
    async (request, reply) => {
      const refusal = authorizeMutation(request.headers);
      if (refusal) return reply.code(403).send(refusal);
      if (!isExecuteActivityBody(request.body)) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid cancellation request",
          },
        });
      }
      return platform.dispatch({
        type: "job.cancel",
        commandId: request.body.commandId,
        jobId: request.params.jobId,
      });
    },
  );

  server.get<{ Params: { jobId: string } }>(
    "/api/v1/jobs/:jobId",
    async (request, reply) => {
      const result = await platform.query({
        type: "job.get",
        jobId: request.params.jobId,
      });
      if (!result.report) return reply.code(404).send(result);
      return result;
    },
  );
  server.get<{ Params: { jobId: string } }>(
    "/api/v1/jobs/:jobId/events",
    async (request, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      for await (const event of platform.events(request.params.jobId)) {
        reply.raw.write(`id: ${event.sequence}\n`);
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      reply.raw.end();
    },
  );
}
