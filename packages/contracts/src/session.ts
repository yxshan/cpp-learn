/**
 * Local transport session contract.
 *
 * The server publishes a per-start token as a readable, strict same-site cookie
 * and requires every state-changing request to echo it in a custom header. Both
 * names are part of the transport contract because the browser application and
 * the server must agree on them exactly; a typo on either side would silently
 * disable the check.
 */

export const SESSION_COOKIE_NAME = "cpp_learn_session";
export const SESSION_TOKEN_HEADER = "x-cpp-learn-token";
