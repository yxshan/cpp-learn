import { describe, expect, it } from "vitest";

import { readSessionToken } from "./session-token.ts";

describe("[SEC-F05] session token discovery", () => {
  it("reads the token the server published", () => {
    expect(readSessionToken("cpp_learn_session=abc123")).toBe("abc123");
  });

  it("finds it among unrelated cookies", () => {
    expect(
      readSessionToken("theme=dark; cpp_learn_session=tok_value; other=1"),
    ).toBe("tok_value");
  });

  it("stops at the first matching cookie", () => {
    expect(
      readSessionToken("cpp_learn_session=first; cpp_learn_session=second"),
    ).toBe("first");
  });

  it("ignores lookalike names and empty values", () => {
    expect(readSessionToken("cpp_learn_session_extra=nope")).toBeUndefined();
    expect(readSessionToken("not_cpp_learn_session=nope")).toBeUndefined();
    expect(readSessionToken("cpp_learn_session=")).toBeUndefined();
    expect(readSessionToken("")).toBeUndefined();
  });
});
