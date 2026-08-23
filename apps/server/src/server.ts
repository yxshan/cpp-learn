import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

import type { LearningPlatform } from "@cpp-learn/contracts";

const MAX_ARCHIVE_REQUEST_BYTES = 64 * 1024 * 1024;

export interface ServerDependencies {
  readonly platform: LearningPlatform;
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

interface SaveWorkspaceBody {
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly changes: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

interface ExecuteActivityBody {
  readonly schemaVersion: 1;
  readonly commandId: string;
}

function isExecuteActivityBody(value: unknown): value is ExecuteActivityBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return body["schemaVersion"] === 1 && typeof body["commandId"] === "string";
}

function isRestoreBody(value: unknown): value is ExecuteActivityBody & {
  readonly confirm: true;
  readonly archive: unknown;
} {
  return (
    isExecuteActivityBody(value) &&
    "confirm" in value &&
    value.confirm === true &&
    "archive" in value
  );
}

function isAllowedMutationOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function isSaveWorkspaceBody(value: unknown): value is SaveWorkspaceBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body["schemaVersion"] === 1 &&
    typeof body["commandId"] === "string" &&
    Number.isInteger(body["baseRevision"]) &&
    Array.isArray(body["changes"]) &&
    body["changes"].every((change) => {
      if (typeof change !== "object" || change === null) return false;
      const candidate = change as Record<string, unknown>;
      return (
        typeof candidate["path"] === "string" &&
        typeof candidate["content"] === "string"
      );
    })
  );
}

export function createServer(
  dependencies: ServerDependencies,
): FastifyInstance {
  const server = Fastify({ logger: dependencies.logger ?? false });

  if (dependencies.webRoot) {
    void server.register(fastifyStatic, {
      root: dependencies.webRoot,
      prefix: "/",
      wildcard: false,
    });
  }

  server.get("/api/v1/health", async () => ({
    schemaVersion: 1,
    status: "ok",
  }));

  server.get("/api/v1/bootstrap", async () =>
    dependencies.platform.query({ type: "bootstrap.get" }),
  );

  server.get("/api/v1/dashboard", async () =>
    dependencies.platform.query({ type: "dashboard.get" }),
  );

  server.get<{ Params: { activityId: string } }>(
    "/api/v1/activities/:activityId",
    async (request, reply) => {
      const result = await dependencies.platform.query({
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
      dependencies.platform.query({
        type: "workspace.get",
        activityId: request.params.activityId,
      }),
  );

  server.patch<{
    Params: { activityId: string };
    Body: unknown;
  }>("/api/v1/workspaces/:activityId", async (request, reply) => {
    if (!isAllowedMutationOrigin(request.headers.origin)) {
      return reply.code(403).send({
        schemaVersion: 1,
        error: { code: "origin_rejected", message: "Origin is not loopback" },
      });
    }
    if (!isSaveWorkspaceBody(request.body)) {
      return reply.code(400).send({
        schemaVersion: 1,
        error: { code: "validation_error", message: "Invalid save request" },
      });
    }
    const result = await dependencies.platform.dispatch({
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
        if (!isAllowedMutationOrigin(request.headers.origin)) {
          return reply.code(403).send({
            schemaVersion: 1,
            error: {
              code: "origin_rejected",
              message: "Origin is not loopback",
            },
          });
        }
        if (!isExecuteActivityBody(request.body)) {
          return reply.code(400).send({
            schemaVersion: 1,
            error: {
              code: "validation_error",
              message: "Invalid execution request",
            },
          });
        }
        return dependencies.platform.dispatch({
          type,
          commandId: request.body.commandId,
          activityId: request.params.activityId,
        });
      },
    );
  };
  registerExecutionRoute("/api/v1/activities/:activityId/runs", "activity.run");
  registerExecutionRoute(
    "/api/v1/activities/:activityId/grades",
    "activity.grade",
  );

  server.post<{ Params: { jobId: string }; Body: unknown }>(
    "/api/v1/jobs/:jobId/cancellations",
    async (request, reply) => {
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
      if (!isExecuteActivityBody(request.body)) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid cancellation request",
          },
        });
      }
      return dependencies.platform.dispatch({
        type: "job.cancel",
        commandId: request.body.commandId,
        jobId: request.params.jobId,
      });
    },
  );

  server.get<{ Params: { jobId: string } }>(
    "/api/v1/jobs/:jobId",
    async (request, reply) => {
      const result = await dependencies.platform.query({
        type: "job.get",
        jobId: request.params.jobId,
      });
      if (!result.report) return reply.code(404).send(result);
      return result;
    },
  );

  if (dependencies.archive) {
    server.post<{ Body: unknown }>(
      "/api/v1/exports",
      async (request, reply) => {
        if (!isAllowedMutationOrigin(request.headers.origin)) {
          return reply.code(403).send({
            schemaVersion: 1,
            error: {
              code: "origin_rejected",
              message: "Origin is not loopback",
            },
          });
        }
        if (!isExecuteActivityBody(request.body)) {
          return reply.code(400).send({
            schemaVersion: 1,
            error: {
              code: "validation_error",
              message: "Invalid export request",
            },
          });
        }
        const temporaryRoot = await mkdtemp(
          join(tmpdir(), "cpp-learn-export-"),
        );
        try {
          const outputPath = join(temporaryRoot, "cpp-learn-backup.json");
          await dependencies.archive?.exportTo(outputPath);
          const document = JSON.parse(
            await readFile(outputPath, "utf8"),
          ) as unknown;
          return reply
            .header(
              "content-disposition",
              'attachment; filename="cpp-learn-backup.json"',
            )
            .send(document);
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );

    server.post<{ Body: unknown }>(
      "/api/v1/restores",
      { bodyLimit: MAX_ARCHIVE_REQUEST_BYTES },
      async (request, reply) => {
        if (!isAllowedMutationOrigin(request.headers.origin)) {
          return reply.code(403).send({
            schemaVersion: 1,
            error: {
              code: "origin_rejected",
              message: "Origin is not loopback",
            },
          });
        }
        if (!isRestoreBody(request.body)) {
          return reply.code(400).send({
            schemaVersion: 1,
            error: {
              code: "validation_error",
              message: "Restore requires an archive and explicit confirmation",
            },
          });
        }
        const temporaryRoot = await mkdtemp(
          join(tmpdir(), "cpp-learn-restore-"),
        );
        try {
          const inputPath = join(temporaryRoot, "cpp-learn-backup.json");
          await writeFile(
            inputPath,
            `${JSON.stringify(request.body.archive)}\n`,
            "utf8",
          );
          const result = await dependencies.archive?.restoreFrom(inputPath);
          return { ...result, restartRequired: true };
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );
  }

  server.get<{ Params: { jobId: string } }>(
    "/api/v1/jobs/:jobId/events",
    async (request, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      for await (const event of dependencies.platform.events(
        request.params.jobId,
      )) {
        reply.raw.write(`id: ${event.sequence}\n`);
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      reply.raw.end();
    },
  );

  return server;
}
