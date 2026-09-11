import type { FastifyInstance, FastifyReply } from "fastify";

import {
  CPP_STANDARDS,
  REFERENCE_ENTRY_KINDS,
  REFERENCE_VERIFICATIONS,
  type CppStandard,
  type ReferenceEntryKind,
  type ReferenceVerification,
} from "@cpp-learn/contracts";
import type { ReferencePlayground } from "@cpp-learn/judge";
import {
  ReferenceQueryValidationError,
  type ReferenceCatalog,
} from "@cpp-learn/reference";

import {
  MAX_REFERENCE_PLAYGROUND_SOURCE_BYTES,
  REFERENCE_PLAYGROUND_RUN_ID,
  createReferencePlaygroundSnapshot,
  isAllowedMutationOrigin,
  isReferencePlaygroundCancellationBody,
  isReferencePlaygroundRunBody,
} from "../transport.ts";
import type { JudgeAdmission } from "../admission.ts";

export interface ReferenceRouteContext {
  readonly reference: ReferenceCatalog | undefined;
  readonly referencePlayground: ReferencePlayground | undefined;
  readonly judgeAdmission: JudgeAdmission;
  readonly readyReference: (
    reply: FastifyReply,
  ) => Promise<ReferenceCatalog | undefined>;
}

/**
 * Reference browsing and the Playground.
 *
 * Playground admission draws on the same host Judge budget as Activity
 * Run/Grade, but never queues: an interactive editor reports busy immediately
 * instead of holding the request open. The active-run registry stays
 * module-local so a second route group cannot double-register a run identity.
 */
export function registerReferenceRoutes(
  server: FastifyInstance,
  context: ReferenceRouteContext,
): void {
  const { referencePlayground, judgeAdmission, readyReference } = context;
  const activeReferencePlaygroundRuns = new Map<string, AbortController>();

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
      if (!referencePlayground) {
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
      const releaseJudgeSlot = judgeAdmission.tryAcquire();
      if (!releaseJudgeSlot) {
        return reply
          .header("Retry-After", "1")
          .code(429)
          .send({
            schemaVersion: 1,
            error: { code: "playground_busy" },
          });
      }
      const controller = new AbortController();
      try {
        const snapshot = createReferencePlaygroundSnapshot(request.body.source);
        activeReferencePlaygroundRuns.set(request.body.runId, controller);
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
        return await referencePlayground.run({
          runId: request.body.runId,
          entryId: entry.id,
          exampleId: example.id,
          standard: example.standard,
          snapshot,
          stdin: example.stdin ?? "",
          signal: controller.signal,
        });
      } finally {
        if (
          activeReferencePlaygroundRuns.get(request.body.runId) === controller
        ) {
          activeReferencePlaygroundRuns.delete(request.body.runId);
        }
        releaseJudgeSlot();
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
}
