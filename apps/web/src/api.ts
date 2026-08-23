import {
  parseBootstrapResult,
  type BootstrapResult,
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
