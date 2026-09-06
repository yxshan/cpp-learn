import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";

import type { ReferencePlayground } from "@cpp-learn/judge";

import {
  CPP_STANDARDS,
  REFERENCE_ENTRY_KINDS,
  REFERENCE_VERIFICATIONS,
  type CppStandard,
  type LearningPlatform,
  type ReferenceEntryKind,
  type ReferencePlaygroundCancellationRequestDto,
  type ReferencePlaygroundRunRequestDto,
  type ReferenceVerification,
} from "@cpp-learn/contracts";
import {
  ReferenceQueryValidationError,
  type ReferenceCatalog,
} from "@cpp-learn/reference";

const MAX_ARCHIVE_REQUEST_BYTES = 64 * 1024 * 1024;
const MAX_REFERENCE_PLAYGROUND_SOURCE_BYTES = 64 * 1024;
const REFERENCE_PLAYGROUND_RUN_ID =
  /^ref_run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
  readonly attemptId?: string;
}

function isReferencePlaygroundRunBody(
  value: unknown,
): value is ReferencePlaygroundRunRequestDto {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    Object.keys(body).length === 3 &&
    body["schemaVersion"] === 1 &&
    typeof body["runId"] === "string" &&
    REFERENCE_PLAYGROUND_RUN_ID.test(body["runId"]) &&
    typeof body["source"] === "string" &&
    body["source"].length > 0
  );
}

function isReferencePlaygroundCancellationBody(
  value: unknown,
): value is ReferencePlaygroundCancellationRequestDto {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body["schemaVersion"] === 1;
}

function isExecuteActivityBody(value: unknown): value is ExecuteActivityBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body["schemaVersion"] === 1 &&
    typeof body["commandId"] === "string" &&
    (body["attemptId"] === undefined || typeof body["attemptId"] === "string")
  );
}

function recordBody(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
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
  const configuredPlaygroundConcurrency =
    dependencies.referencePlaygroundMaxConcurrentRuns ?? 1;
  const referencePlaygroundMaxConcurrentRuns =
    Number.isInteger(configuredPlaygroundConcurrency) &&
    configuredPlaygroundConcurrency > 0
      ? configuredPlaygroundConcurrency
      : 1;
  let referencePlaygroundInFlight = 0;
  const activeReferencePlaygroundRuns = new Map<string, AbortController>();

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

  server.get("/api/v1/health", async () => ({
    schemaVersion: 1,
    status: "ok",
  }));

  const referenceReadiness = () =>
    dependencies.reference
      ? dependencies.reference.readiness()
      : Promise.resolve({
          ready: false as const,
          issueCodes: ["catalog_missing" as const],
        });

  server.get("/api/v1/bootstrap", async () => {
    const result = await dependencies.platform.query({ type: "bootstrap.get" });
    return {
      ...result,
      services: {
        ...result.services,
        reference: await referenceReadiness(),
      },
    };
  });

  server.get("/api/v1/dashboard", async () =>
    dependencies.platform.query({ type: "dashboard.get" }),
  );

  server.get("/api/v1/activities", async () =>
    dependencies.platform.query({ type: "activities.list" }),
  );

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

  server.get("/api/v1/reference", async (_request, reply) => {
    const reference = await readyReference(reply);
    return reference?.getNavigation();
  });

  const referenceKinds = new Set<ReferenceEntryKind>(REFERENCE_ENTRY_KINDS);
  const cppStandards = new Set<CppStandard>(CPP_STANDARDS);
  const referenceVerification = new Set<ReferenceVerification>(
    REFERENCE_VERIFICATIONS,
  );

  const invalidReferenceQuery = (reply: FastifyReply) =>
    reply.code(400).send({
      schemaVersion: 1,
      error: { code: "validation_error", message: "Invalid search query" },
    });

  server.get<{
    Querystring: Record<string, unknown>;
  }>("/api/v1/reference/search", async (request, reply) => {
    const reference = await readyReference(reply);
    if (!reference) return;
    const { q, kind, category, standard, verified, limit } = request.query;
    const scalarValues = [q, kind, category, standard, verified, limit];
    if (
      scalarValues.some(
        (value) => value !== undefined && typeof value !== "string",
      )
    ) {
      return invalidReferenceQuery(reply);
    }
    const searchText = (q as string | undefined) ?? "";
    const searchKind = kind as string | undefined;
    const searchCategory = category as string | undefined;
    const searchStandard = standard as string | undefined;
    const searchVerification = verified as string | undefined;
    const searchLimit = limit as string | undefined;
    const parsedLimit =
      searchLimit === undefined ? undefined : Number(searchLimit);
    if (
      (searchKind !== undefined &&
        !referenceKinds.has(searchKind as ReferenceEntryKind)) ||
      (searchStandard !== undefined &&
        !cppStandards.has(searchStandard as CppStandard)) ||
      (searchVerification !== undefined &&
        !referenceVerification.has(
          searchVerification as ReferenceVerification,
        )) ||
      (searchLimit !== undefined && !Number.isInteger(parsedLimit))
    ) {
      return invalidReferenceQuery(reply);
    }
    try {
      return await reference.search({
        text: searchText,
        ...(searchKind === undefined
          ? {}
          : { kind: searchKind as ReferenceEntryKind }),
        ...(searchCategory === undefined ? {} : { category: searchCategory }),
        ...(searchStandard === undefined
          ? {}
          : { standard: searchStandard as CppStandard }),
        ...(searchVerification === undefined
          ? {}
          : {
              verified: searchVerification as ReferenceVerification,
            }),
        ...(parsedLimit === undefined ? {} : { limit: parsedLimit }),
      });
    } catch (error) {
      if (error instanceof ReferenceQueryValidationError) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid search query",
          },
        });
      }
      throw error;
    }
  });

  server.get<{ Querystring: Record<string, unknown> }>(
    "/api/v1/reference/resolve",
    async (request, reply) => {
      const reference = await readyReference(reply);
      if (!reference) return;
      const slug = request.query["slug"];
      if (typeof slug !== "string" || slug.length === 0) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: { code: "validation_error", message: "Slug is required" },
        });
      }
      const result = await reference.resolveSlug(slug);
      if (!result) {
        return reply.code(404).send({
          schemaVersion: 1,
          error: { code: "reference_not_found" },
        });
      }
      return result;
    },
  );

  server.get<{ Params: { entryId: string } }>(
    "/api/v1/reference/entries/:entryId",
    async (request, reply) => {
      const reference = await readyReference(reply);
      if (!reference) return;
      const result = await reference.getEntry(request.params.entryId);
      if (!result) {
        return reply.code(404).send({
          schemaVersion: 1,
          error: { code: "reference_not_found" },
        });
      }
      return result;
    },
  );

  server.post<{
    Params: { entryId: string; exampleId: string };
    Body: unknown;
  }>(
    "/api/v1/reference/entries/:entryId/examples/:exampleId/runs",
    async (request, reply) => {
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
      if (!isReferencePlaygroundRunBody(request.body)) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: { code: "validation_error", message: "Invalid run request" },
        });
      }
      if (
        Buffer.byteLength(request.body.source, "utf8") >
        MAX_REFERENCE_PLAYGROUND_SOURCE_BYTES
      ) {
        return reply.code(413).send({
          schemaVersion: 1,
          error: { code: "source_too_large" },
        });
      }
      const reference = await readyReference(reply);
      if (!reference) return;
      const entry = await reference.getEntry(request.params.entryId);
      const example = entry?.examples.find(
        (candidate) => candidate.id === request.params.exampleId,
      );
      if (!entry || !example || example.kind !== "run") {
        return reply.code(404).send({
          schemaVersion: 1,
          error: { code: "reference_example_not_found" },
        });
      }
      if (!dependencies.referencePlayground) {
        return reply.code(503).send({
          schemaVersion: 1,
          error: { code: "playground_unavailable" },
        });
      }
      if (activeReferencePlaygroundRuns.has(request.body.runId)) {
        return reply.code(409).send({
          schemaVersion: 1,
          error: { code: "playground_run_id_conflict" },
        });
      }
      if (referencePlaygroundInFlight >= referencePlaygroundMaxConcurrentRuns) {
        return reply
          .header("Retry-After", "1")
          .code(429)
          .send({
            schemaVersion: 1,
            error: { code: "playground_busy" },
          });
      }
      const controller = new AbortController();
      referencePlaygroundInFlight += 1;
      activeReferencePlaygroundRuns.set(request.body.runId, controller);
      try {
        return await dependencies.referencePlayground.run({
          runId: request.body.runId,
          entryId: entry.id,
          exampleId: example.id,
          standard: example.standard,
          source: request.body.source,
          stdin: example.stdin ?? "",
          signal: controller.signal,
        });
      } finally {
        if (
          activeReferencePlaygroundRuns.get(request.body.runId) === controller
        ) {
          activeReferencePlaygroundRuns.delete(request.body.runId);
        }
        referencePlaygroundInFlight -= 1;
      }
    },
  );

  server.post<{ Params: { runId: string }; Body: unknown }>(
    "/api/v1/reference/runs/:runId/cancellations",
    async (request, reply) => {
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
      if (
        !REFERENCE_PLAYGROUND_RUN_ID.test(request.params.runId) ||
        !isReferencePlaygroundCancellationBody(request.body)
      ) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid Playground cancellation request",
          },
        });
      }
      const controller = activeReferencePlaygroundRuns.get(
        request.params.runId,
      );
      controller?.abort();
      return {
        schemaVersion: 1,
        runId: request.params.runId,
        cancelled: controller !== undefined,
      };
    },
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
          ...(request.body.attemptId
            ? { attemptId: request.body.attemptId }
            : {}),
        });
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
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
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
      return dependencies.platform.dispatch({
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
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
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
      return dependencies.platform.dispatch({
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
      dependencies.platform.query({
        type: "reviews.get",
        dueOnly: request.query.all !== "true",
      }),
  );
  server.get("/api/v1/progress", async () =>
    dependencies.platform.query({ type: "progress.get" }),
  );
  server.get<{ Params: { conceptId: string } }>(
    "/api/v1/concepts/:conceptId",
    async (request) =>
      dependencies.platform.query({
        type: "concept.get",
        conceptId: request.params.conceptId,
      }),
  );
  server.get<{ Params: { attemptId: string } }>(
    "/api/v1/attempts/:attemptId",
    async (request, reply) => {
      const result = await dependencies.platform.query({
        type: "attempt.get",
        attemptId: request.params.attemptId,
      });
      if (!result.attempt) return reply.code(404).send(result);
      return result;
    },
  );

  server.post<{ Body: unknown }>(
    "/api/v1/teacher-packs",
    async (request, reply) => {
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
      const body = recordBody(request.body);
      if (
        !body ||
        body["schemaVersion"] !== 1 ||
        typeof body["commandId"] !== "string" ||
        typeof body["activityId"] !== "string" ||
        (body["attemptId"] !== undefined &&
          typeof body["attemptId"] !== "string")
      ) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid Teacher Pack request",
          },
        });
      }
      return dependencies.platform.dispatch({
        type: "teacher-pack.create",
        commandId: body["commandId"],
        activityId: body["activityId"],
        ...(typeof body["attemptId"] === "string"
          ? { attemptId: body["attemptId"] }
          : {}),
      });
    },
  );

  server.post<{ Body: unknown }>(
    "/api/v1/teacher-observations",
    async (request, reply) => {
      if (!isAllowedMutationOrigin(request.headers.origin)) {
        return reply.code(403).send({
          schemaVersion: 1,
          error: { code: "origin_rejected", message: "Origin is not loopback" },
        });
      }
      const body = recordBody(request.body);
      if (
        !body ||
        body["schemaVersion"] !== 1 ||
        typeof body["commandId"] !== "string" ||
        typeof body["observationId"] !== "string" ||
        typeof body["activityId"] !== "string" ||
        typeof body["attemptId"] !== "string" ||
        typeof body["rubricId"] !== "string" ||
        (body["outcome"] !== "pass" && body["outcome"] !== "revise") ||
        typeof body["summary"] !== "string"
      ) {
        return reply.code(400).send({
          schemaVersion: 1,
          error: {
            code: "validation_error",
            message: "Invalid Teacher Observation",
          },
        });
      }
      return dependencies.platform.dispatch({
        type: "teacher-observation.submit",
        commandId: body["commandId"],
        observationId: body["observationId"],
        activityId: body["activityId"],
        attemptId: body["attemptId"],
        rubricId: body["rubricId"],
        outcome: body["outcome"],
        summary: body["summary"],
      });
    },
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
