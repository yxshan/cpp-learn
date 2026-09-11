import {
  REFERENCE_SCHEMA_VERSION,
  parseBootstrapResult,
  type ActivityExecutionCommandResult,
  type ActivityResult,
  type ActivitiesResult,
  type BootstrapResult,
  type DashboardResult,
  type HintRevealCommandResult,
  type JobCancelCommandResult,
  type ProgressResult,
  type ReferenceEntryDetail,
  type ReferenceNavigation,
  type ReferencePlaygroundCancellationRequestDto,
  type ReferencePlaygroundCancellationResult,
  type ReferencePlaygroundRunRequestDto,
  type ReferencePlaygroundRunResult,
  type ReferenceSearchQuery,
  type ReferenceSearchResult,
  type ReferenceSlugResolution,
  type ReflectionSubmitCommandResult,
  type ReviewsResult,
  type WorkspaceResult,
  type WorkspaceSaveCommandResult,
} from "@cpp-learn/contracts";

import { SESSION_TOKEN_HEADER, sessionToken } from "./session-token.js";

export type Request = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    message = `Request failed with HTTP ${status}`,
  ) {
    super(message);
  }
}

export async function getBootstrap(
  request: Request = fetch,
): Promise<BootstrapResult> {
  const response = await request("/api/v1/bootstrap", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Bootstrap request failed with HTTP ${response.status}`);
  }
  return parseBootstrapResult(await response.json());
}

/**
 * Headers every state-changing request must carry. The token is read at call
 * time, after the server has published it with an earlier response.
 */
function mutationHeaders(): Record<string, string> {
  const token = sessionToken();
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(token === undefined ? {} : { [SESSION_TOKEN_HEADER]: token }),
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  request: Request,
  expectedSchemaVersion = 1,
): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    throw new HttpRequestError(response.status);
  }
  const value = (await response.json()) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== expectedSchemaVersion
  ) {
    throw new Error("Response violates the versioned transport contract");
  }
  return value as T;
}

export async function getReferenceNavigation(
  request: Request = fetch,
): Promise<ReferenceNavigation> {
  return requestJson(
    "/api/v1/reference",
    { headers: { accept: "application/json" } },
    request,
    REFERENCE_SCHEMA_VERSION,
  );
}

export async function searchReference(
  query: ReferenceSearchQuery,
  request: Request = fetch,
): Promise<ReferenceSearchResult> {
  const parameters = new URLSearchParams({ q: query.text });
  if (query.kind !== undefined) parameters.set("kind", query.kind);
  if (query.category !== undefined) parameters.set("category", query.category);
  if (query.standard !== undefined) parameters.set("standard", query.standard);
  if (query.verified !== undefined) parameters.set("verified", query.verified);
  if (query.limit !== undefined) parameters.set("limit", String(query.limit));
  return requestJson(
    `/api/v1/reference/search?${parameters.toString()}`,
    { headers: { accept: "application/json" } },
    request,
    REFERENCE_SCHEMA_VERSION,
  );
}

export async function resolveReferenceSlug(
  slug: string,
  request: Request = fetch,
): Promise<ReferenceSlugResolution> {
  return requestJson(
    `/api/v1/reference/resolve?slug=${encodeURIComponent(slug)}`,
    { headers: { accept: "application/json" } },
    request,
    REFERENCE_SCHEMA_VERSION,
  );
}

export async function getReferenceEntry(
  entryId: string,
  request: Request = fetch,
): Promise<ReferenceEntryDetail> {
  return requestJson(
    `/api/v1/reference/entries/${encodeURIComponent(entryId)}`,
    { headers: { accept: "application/json" } },
    request,
    REFERENCE_SCHEMA_VERSION,
  );
}

export async function runReferenceExample(
  entryId: string,
  exampleId: string,
  runId: string,
  source: string,
  request: Request = fetch,
): Promise<ReferencePlaygroundRunResult> {
  const body: ReferencePlaygroundRunRequestDto = {
    schemaVersion: 1,
    runId,
    source,
  };
  return requestJson(
    `/api/v1/reference/entries/${encodeURIComponent(entryId)}/examples/${encodeURIComponent(exampleId)}/runs`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify(body),
    },
    request,
  );
}

export async function cancelReferenceRun(
  runId: string,
  request: Request = fetch,
): Promise<ReferencePlaygroundCancellationResult> {
  const body: ReferencePlaygroundCancellationRequestDto = {
    schemaVersion: 1,
  };
  return requestJson(
    `/api/v1/reference/runs/${encodeURIComponent(runId)}/cancellations`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify(body),
    },
    request,
  );
}

export async function getActivity(
  activityId: string,
  request: Request = fetch,
): Promise<ActivityResult> {
  return requestJson(
    `/api/v1/activities/${encodeURIComponent(activityId)}`,
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function getActivities(
  request: Request = fetch,
): Promise<ActivitiesResult> {
  return requestJson(
    "/api/v1/activities",
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function getWorkspace(
  activityId: string,
  request: Request = fetch,
): Promise<WorkspaceResult> {
  return requestJson(
    `/api/v1/workspaces/${encodeURIComponent(activityId)}`,
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function saveWorkspace(
  activityId: string,
  input: {
    readonly commandId: string;
    readonly baseRevision: number;
    readonly changes: readonly {
      readonly path: string;
      readonly content: string;
    }[];
  },
  request: Request = fetch,
): Promise<WorkspaceSaveCommandResult> {
  return requestJson(
    `/api/v1/workspaces/${encodeURIComponent(activityId)}`,
    {
      method: "PATCH",
      headers: mutationHeaders(),
      body: JSON.stringify({ schemaVersion: 1, ...input }),
    },
    request,
  );
}

export async function executeActivity(
  activityId: string,
  mode: "run" | "grade",
  commandId: string,
  attemptIdOrRequest?: string | Request,
  request: Request = fetch,
): Promise<ActivityExecutionCommandResult> {
  const attemptId =
    typeof attemptIdOrRequest === "string" ? attemptIdOrRequest : undefined;
  const selectedRequest =
    typeof attemptIdOrRequest === "function" ? attemptIdOrRequest : request;
  return requestJson(
    `/api/v1/activities/${encodeURIComponent(activityId)}/${mode === "run" ? "runs" : "grades"}`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({
        schemaVersion: 1,
        commandId,
        ...(attemptId ? { attemptId } : {}),
      }),
    },
    selectedRequest,
  );
}

export async function revealHint(
  activityId: string,
  input: {
    readonly commandId: string;
    readonly attemptId: string;
    readonly hintId: string;
    readonly confirmFullSolution: boolean;
  },
  request: Request = fetch,
): Promise<HintRevealCommandResult> {
  return requestJson(
    `/api/v1/activities/${encodeURIComponent(activityId)}/hints`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ schemaVersion: 1, ...input }),
    },
    request,
  );
}

export async function submitReflection(
  activityId: string,
  input: {
    readonly commandId: string;
    readonly attemptId: string;
    readonly answers: readonly {
      readonly promptId: string;
      readonly answer: string;
    }[];
  },
  request: Request = fetch,
): Promise<ReflectionSubmitCommandResult> {
  return requestJson(
    `/api/v1/activities/${encodeURIComponent(activityId)}/reflections`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ schemaVersion: 1, ...input }),
    },
    request,
  );
}

export async function getProgress(
  request: Request = fetch,
): Promise<ProgressResult> {
  return requestJson(
    "/api/v1/progress",
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function getReviews(
  dueOnly = true,
  request: Request = fetch,
): Promise<ReviewsResult> {
  return requestJson(
    dueOnly ? "/api/v1/reviews/due" : "/api/v1/reviews/due?all=true",
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function cancelJob(
  jobId: string,
  commandId: string,
  request: Request = fetch,
): Promise<JobCancelCommandResult> {
  return requestJson(
    `/api/v1/jobs/${encodeURIComponent(jobId)}/cancellations`,
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ schemaVersion: 1, commandId }),
    },
    request,
  );
}

export async function getDashboard(
  request: Request = fetch,
): Promise<DashboardResult> {
  return requestJson(
    "/api/v1/dashboard",
    { headers: { accept: "application/json" } },
    request,
  );
}

export async function exportBackup(
  commandId: string,
  request: Request = fetch,
): Promise<unknown> {
  return requestJson(
    "/api/v1/exports",
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ schemaVersion: 1, commandId }),
    },
    request,
  );
}

export async function restoreBackup(
  archive: unknown,
  commandId: string,
  request: Request = fetch,
): Promise<{ readonly schemaVersion: 1; readonly restoredFiles: number }> {
  return requestJson(
    "/api/v1/restores",
    {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({
        schemaVersion: 1,
        commandId,
        confirm: true,
        archive,
      }),
    },
    request,
  );
}
