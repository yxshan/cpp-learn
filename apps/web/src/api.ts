import {
  parseBootstrapResult,
  type ActivityExecutionCommandResult,
  type ActivityResult,
  type BootstrapResult,
  type DashboardResult,
  type JobCancelCommandResult,
  type WorkspaceResult,
  type WorkspaceSaveCommandResult,
} from "@cpp-learn/contracts";

export type Request = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

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

async function requestJson<T>(
  url: string,
  init: RequestInit,
  request: Request,
): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }
  const value = (await response.json()) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1
  ) {
    throw new Error("Response violates the versioned transport contract");
  }
  return value as T;
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
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ schemaVersion: 1, ...input }),
    },
    request,
  );
}

export async function executeActivity(
  activityId: string,
  mode: "run" | "grade",
  commandId: string,
  request: Request = fetch,
): Promise<ActivityExecutionCommandResult> {
  return requestJson(
    `/api/v1/activities/${encodeURIComponent(activityId)}/${mode === "run" ? "runs" : "grades"}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ schemaVersion: 1, commandId }),
    },
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
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
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
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
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
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
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
