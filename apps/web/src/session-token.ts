import {
  SESSION_COOKIE_NAME,
  SESSION_TOKEN_HEADER,
} from "@cpp-learn/contracts";

export { SESSION_TOKEN_HEADER };

/**
 * Read the per-start session token the server published as a cookie.
 *
 * The server requires this value in `SESSION_TOKEN_HEADER` on every
 * state-changing request. Because the cookie is only readable by the origin
 * that received it, and a custom header forces a preflight that fails without
 * CORS, another page cannot obtain or attach the token — which is the point.
 */
export function readSessionToken(cookie: string): string | undefined {
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    return value === "" ? undefined : value;
  }
  return undefined;
}

/** The token for the current page, or `undefined` outside a browser. */
export function sessionToken(): string | undefined {
  return typeof document === "undefined"
    ? undefined
    : readSessionToken(document.cookie);
}
