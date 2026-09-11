import type { FastifyInstance } from "fastify";

import type {
  LearningPlatform,
  ReferenceReadiness,
} from "@cpp-learn/contracts";

import {
  isExecuteActivityBody,
  isSaveWorkspaceBody,
  recordBody,
  type MutationGuard,
} from "../transport.ts";
import { JudgeAdmissionRejected } from "../admission.ts";

export interface LearningRouteContext {
  readonly platform: LearningPlatform;
  readonly referenceReadiness: () => Promise<ReferenceReadiness>;
  readonly authorizeMutation: MutationGuard;
}

/**
 * Learning transport: catalogue queries, the Activity workspace, execution
 * (Run/Grade), hints, reflections, and the learning-record read models.
 *
 * Transport only. Every learning rule lives in the Learning Platform; these
 * handlers parse input, call one command or query, and map the result to a
 * status code.
 */
export function registerLearningRoutes(
  server: FastifyInstance,
  context: LearningRouteContext,
): void {
  const { platform, referenceReadiness, authorizeMutation } = context;

  server.get("/api/v1/health", async () => ({
    schemaVersion: 1,
    status: "ok",
  }));
  server.get("/api/v1/bootstrap", async () => {
    const result = await platform.query({ type: "bootstrap.get" });
    return {
      ...result,
      services: {
        ...result.services,
        reference: await referenceReadiness(),
      },
    };
  });

  server.get("/api/v1/dashboard", async () =>
    platform.query({ type: "dashboard.get" }),
  );

  server.get("/api/v1/activities", async () =>
    platform.query({ type: "activities.list" }),
  );
  server.get<{ Params: { activityId: string } }>(
    "/api/v1/activities/:activityId",
    async (request, reply) => {
      const result = await platform.query({
        type: "activity.get",
        activityId: request.params.activityId,
      });
      if (!result.activity) return reply.code(404).send(result);
      return result;
    },
  );

  server.get<{ Params: { activityId: string } }>(
    "/api/v1/workspaces/:activityId",
    async (request) =>
      platform.query({
        type: "workspace.get",
        activityId: request.params.activityId,
      }),
  );

  server.patch<{
    Params: { activityId: string };
    Body: unknown;
  }>("/api/v1/workspaces/:activityId", async (request, reply) => {
    const refusal = authorizeMutation(request.headers);
    if (refusal) return reply.code(403).send(refusal);
    if (!isSaveWorkspaceBody(request.body)) {
      return reply.code(400).send({
        schemaVersion: 1,
        error: { code: "validation_error", message: "Invalid save request" },
      });
    }
    const result = await platform.dispatch({
      type: "workspace.save",
      commandId: request.body.commandId,
      activityId: request.params.activityId,
      baseRevision: request.body.baseRevision,
      changes: request.body.changes,
    });
    if (!result.result.ok && result.result.code === "revision_conflict") {
      return reply.code(409).send(result);
    }
    if (!result.result.ok) return reply.code(400).send(result);
    return result;
  });

  const registerExecutionRoute = (
    path:
      | "/api/v1/activities/:activityId/runs"
      | "/api/v1/activities/:activityId/grades",
    type: "activity.run" | "activity.grade",
  ): void => {
    server.post<{ Params: { activityId: string }; Body: unknown }>(
      path,
      async (request, reply) => {
        const refusal = authorizeMutation(request.headers);
        if (refusal) return reply.code(403).send(refusal);
        if (!isExecuteActivityBody(request.body)) {
          return reply.code(400).send({
            schemaVersion: 1,
            error: {
              code: "validation_error",
              message: "Invalid execution request",
            },
          });
        }
        try {
          return await platform.dispatch({
            type,
            commandId: request.body.commandId,
            activityId: request.params.activityId,
            ...(request.body.attemptId
              ? { attemptId: request.body.attemptId }
              : {}),
          });
        } catch (error) {
          // The host Judge budget is shared with the Reference Playground, so
          // saturation is a normal, retryable condition rather than a failure.
          if (error instanceof JudgeAdmissionRejected) {
            return reply
              .header("Retry-After", "1")
              .code(429)
              .send({
                schemaVersion: 1,
                error: {
                  code: "judge_busy",
                  message: "Judge concurrency budget is saturated",
                },
              });
          }
          throw error;
        }
      },
    );
  };
  registerExecutionRoute("/api/v1/activities/:activityId/runs", "activity.run");
  registerExecutionRoute(
    "/api/v1/activities/:activityId/grades",
    "activity.grade",
  );

  server.post<{ Params: { activityId: string }; Body: unknown }>(
    "/api/v1/activities/:activityId/hints",
    async (request, reply) => {
      const refusal = authorizeMutation(request.headers);
      if (refusal) return reply.code(403).send(refusal);
      const body = recordBody(request.body);
      if (
        !body ||
        body["schemaVersion"] !== 1 ||
        typeof body["commandId"] !== "string" ||
        typeof body["attemptId"] !== "string" ||
        typeof body["hintId"] !== "string" ||
        typeof body["confirmFullSolution"] !== "boolean"
      ) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: { code: "validation_error", message: "Invalid hint request" },
        });
      }
      return platform.dispatch({
        type: "hint.reveal",
        commandId: body["commandId"],
        attemptId: body["attemptId"],
        activityId: request.params.activityId,
        hintId: body["hintId"],
        confirmFullSolution: body["confirmFullSolution"],
      });
    },
  );

  server.post<{ Params: { activityId: string }; Body: unknown }>(
    "/api/v1/activities/:activityId/reflections",
    async (request, reply) => {
      const refusal = authorizeMutation(request.headers);
      if (refusal) return reply.code(403).send(refusal);
      const body = recordBody(request.body);
      const answers = body?.["answers"];
      if (
        !body ||
        body["schemaVersion"] !== 1 ||
        typeof body["commandId"] !== "string" ||
        typeof body["attemptId"] !== "string" ||
        !Array.isArray(answers) ||
        !answers.every((answer) => {
          const candidate = recordBody(answer);
          return (
            candidate &&
            typeof candidate["promptId"] === "string" &&
            typeof candidate["answer"] === "string"
          );
        })
      ) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid reflection request",
          },
        });
      }
      return platform.dispatch({
        type: "reflection.submit",
        commandId: body["commandId"],
        attemptId: body["attemptId"],
        activityId: request.params.activityId,
        answers: answers.map((answer) => {
          const candidate = recordBody(answer);
          return {
            promptId: String(candidate?.["promptId"]),
            answer: String(candidate?.["answer"]),
          };
        }),
      });
    },
  );

  server.get<{ Querystring: { all?: string } }>(
    "/api/v1/reviews/due",
    async (request) =>
      platform.query({
        type: "reviews.get",
        dueOnly: request.query.all !== "true",
      }),
  );
  server.get("/api/v1/progress", async () =>
    platform.query({ type: "progress.get" }),
  );
  server.get<{ Params: { conceptId: string } }>(
    "/api/v1/concepts/:conceptId",
    async (request) =>
      platform.query({
        type: "concept.get",
        conceptId: request.params.conceptId,
      }),
  );
  server.get<{ Params: { attemptId: string } }>(
    "/api/v1/attempts/:attemptId",
    async (request, reply) => {
      const result = await platform.query({
        type: "attempt.get",
        attemptId: request.params.attemptId,
      });
      if (!result.attempt) return reply.code(404).send(result);
      return result;
    },
  );
}
