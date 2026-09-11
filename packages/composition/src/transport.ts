import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  SESSION_COOKIE_NAME,
  SESSION_TOKEN_HEADER,
  type ReferencePlaygroundCancellationRequestDto,
  type ReferencePlaygroundRunRequestDto,
} from "@cpp-learn/contracts";

/**
 * Shared transport policy for the local HTTP Adapter.
 *
 * Origin handling, mutation authorization, request-body guards, and byte
 * budgets live here so that every route group enforces the same rules instead
 * of each re-implementing them. `server.ts` only installs route groups.
 */

export const MAX_ARCHIVE_REQUEST_BYTES = 64 * 1024 * 1024;
export const MAX_REFERENCE_PLAYGROUND_SOURCE_BYTES = 64 * 1024;
export const REFERENCE_PLAYGROUND_RUN_ID =
  /^ref_run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export { SESSION_COOKIE_NAME, SESSION_TOKEN_HEADER };

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

export function isReferencePlaygroundRunBody(
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

export function isReferencePlaygroundCancellationBody(
  value: unknown,
): value is ReferencePlaygroundCancellationRequestDto {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body["schemaVersion"] === 1;
}

export function isExecuteActivityBody(
  value: unknown,
): value is ExecuteActivityBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body["schemaVersion"] === 1 &&
    typeof body["commandId"] === "string" &&
    (body["attemptId"] === undefined || typeof body["attemptId"] === "string")
  );
}

export function recordBody(
  value: unknown,
): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function isRestoreBody(value: unknown): value is ExecuteActivityBody & {
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

/**
 * A fresh, unguessable token per server process.
 *
 * The token is not an authentication boundary against another process running
 * as the same user — such a process can already read the Workspace directly. It
 * exists to stop the browser from being used as a confused deputy: a page on any
 * other origin can neither read the token (responses are unreadable without
 * CORS) nor attach it to a request (a custom header forces a preflight, which
 * fails without CORS), so a state-changing request it cannot author proves the
 * request came from the served application.
 */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface MutationAuthorization {
  readonly sessionToken: string;
}

export type MutationRejectionReason =
  | "origin_rejected"
  | "host_rejected"
  | "cross_site_rejected"
  | "token_rejected";

export interface MutationRejectionBody {
  readonly schemaVersion: 1;
  readonly error: {
    readonly code: MutationRejectionReason;
    readonly message: string;
  };
}

type TransportHeaders = Readonly<Record<string, string | string[] | undefined>>;

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A `Host` that is not a loopback address is a DNS-rebinding attempt or a
 * misconfigured proxy: the browser believes it is talking to an attacker domain
 * that resolves to this machine.
 */
export function isLoopbackHostHeader(host: string | undefined): boolean {
  if (!host) return false;
  const withoutPort = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? "");
  return (
    withoutPort === "127.0.0.1" ||
    withoutPort === "localhost" ||
    withoutPort === "[::1]"
  );
}

function tokensMatch(candidate: string | undefined, expected: string): boolean {
  if (candidate === undefined || candidate === "") return false;
  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (candidateBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(candidateBytes, expectedBytes);
}

/**
 * Why a state-changing request may not proceed, or `undefined` when it may.
 *
 * The checks are ordered cheapest and least secret first, but every one of them
 * must pass. Same-origin is derived from the request's own `Host`, so a browser
 * talking to the served application needs no configuration while any other
 * origin — including a different loopback port — is refused.
 */
export function mutationRejectionReason(
  headers: TransportHeaders,
  authorization: MutationAuthorization,
): MutationRejectionReason | undefined {
  const host = firstHeader(headers["host"]);
  if (!isLoopbackHostHeader(host)) return "host_rejected";

  const origin = firstHeader(headers["origin"]);
  if (!origin || origin === "null" || origin !== `http://${host}`) {
    return "origin_rejected";
  }

  // Defence in depth: browsers label the initiator, and a cross-site initiator
  // can never be the served application.
  if (firstHeader(headers["sec-fetch-site"]) === "cross-site") {
    return "cross_site_rejected";
  }

  if (
    !tokensMatch(
      firstHeader(headers[SESSION_TOKEN_HEADER]),
      authorization.sessionToken,
    )
  ) {
    return "token_rejected";
  }
  return undefined;
}

const REJECTION_MESSAGES: Readonly<Record<MutationRejectionReason, string>> = {
  host_rejected: "Host is not a loopback address",
  origin_rejected: "Origin is not the served application",
  cross_site_rejected: "Request is cross-site",
  token_rejected: "Missing or invalid session token",
};

/**
 * The response body for a refused mutation, or `undefined` when it may proceed.
 * Routes send the returned body with status `403` and stay free of policy.
 */
export function unauthorizedMutationBody(
  headers: TransportHeaders,
  authorization: MutationAuthorization,
): MutationRejectionBody | undefined {
  const reason = mutationRejectionReason(headers, authorization);
  if (!reason) return undefined;
  return {
    schemaVersion: 1,
    error: { code: reason, message: REJECTION_MESSAGES[reason] },
  };
}

/**
 * Response headers applied to every reply.
 *
 * `X-Frame-Options` enforces clickjacking protection today; the CSP cannot yet,
 * because `frame-ancestors` is ignored in a report-only policy. The CSP is
 * therefore shipped as `Content-Security-Policy-Report-Only`: it records what a
 * real policy would block — Monaco workers and Vite's asset graph are the parts
 * most likely to need a directive — without breaking the application while that
 * is verified. No HSTS: this server is plain HTTP on loopback.
 */
export const HARDENING_HEADERS: Readonly<Record<string, string>> =
  Object.freeze({
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy-report-only": [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "worker-src 'self' blob:",
      "connect-src 'self'",
    ].join("; "),
  });

export type MutationGuard = (
  headers: TransportHeaders,
) => MutationRejectionBody | undefined;

/**
 * Bind the policy once, at server assembly, so every route group applies the
 * identical rule and no route can accidentally skip a check.
 */
export function createMutationGuard(
  authorization: MutationAuthorization,
): MutationGuard {
  return (headers) => unauthorizedMutationBody(headers, authorization);
}

/**
 * `Set-Cookie` value that publishes the token to the same-origin application.
 *
 * `HttpOnly` is deliberately absent rather than set to `false`: it is a flag
 * attribute, so a browser that sees the name marks the cookie HttpOnly and
 * `document.cookie` stops returning it, which silently disables every mutation.
 * The cookie is not a bearer credential on its own — the server compares the
 * echoed header against its in-memory token, not against the cookie — so
 * readability by the served application is the intended design.
 */
export function sessionCookie(token: string): string {
  return [`${SESSION_COOKIE_NAME}=${token}`, "Path=/", "SameSite=Strict"].join(
    "; ",
  );
}

/**
 * Whether a response should carry the session cookie.
 *
 * Every API response and every HTML entry needs it, so the application always
 * holds the token before its first mutation; fingerprinted asset requests do
 * not, and re-sending the cookie for each one is noise.
 */
export function shouldPublishSessionCookie(url: string): boolean {
  const path = url.split("?")[0] ?? "";
  return path.startsWith("/api/") || !/\.[a-z0-9]+$/iu.test(path);
}

export function isSaveWorkspaceBody(
  value: unknown,
): value is SaveWorkspaceBody {
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

export function createReferencePlaygroundSnapshot(source: string) {
  const digest = createHash("sha256").update(source).digest("hex");
  return Object.freeze({
    id: `ref_snapshot_${digest.slice(0, 24)}`,
    digest,
    source,
  });
}
