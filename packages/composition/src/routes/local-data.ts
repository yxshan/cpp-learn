import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import type { LearningPlatform } from "@cpp-learn/contracts";

import {
  MAX_ARCHIVE_REQUEST_BYTES,
  isAllowedMutationOrigin,
  isExecuteActivityBody,
  isRestoreBody,
  recordBody,
} from "../transport.ts";

export interface LocalDataArchive {
  exportTo(outputPath: string): Promise<unknown>;
  restoreFrom(inputPath: string): Promise<{
    readonly schemaVersion: 1;
    readonly restoredFiles: number;
  }>;
}

export interface LocalDataRouteContext {
  readonly platform: LearningPlatform;
  readonly archive: LocalDataArchive | undefined;
}

/**
 * Local data: Teacher Packs, Teacher Observations, and learner backup.
 *
 * These routes touch private Judge data and learner history, so they keep the
 * loopback-origin guard and the archive byte budget the transport module owns.
 */
export function registerLocalDataRoutes(
  server: FastifyInstance,
  context: LocalDataRouteContext,
): void {
  const { platform, archive } = context;

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
      return platform.dispatch({
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
      return platform.dispatch({
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
  if (archive) {
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
          await archive?.exportTo(outputPath);
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
          const result = await archive?.restoreFrom(inputPath);
          return { ...result, restartRequired: true };
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    );
  }
}
