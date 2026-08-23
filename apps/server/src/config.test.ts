import { describe, expect, it } from "vitest";

import { resolveServerAddress } from "./config.js";

describe("[T-SEC-001] local server address", () => {
  it("rejects a non-loopback binding", () => {
    expect(() =>
      resolveServerAddress({
        CPP_LEARN_HOST: "0.0.0.0",
        CPP_LEARN_PORT: "4173",
      }),
    ).toThrow("Server host must be a loopback address");
  });

  it("uses a loopback safe default", () => {
    expect(resolveServerAddress({})).toEqual({ host: "127.0.0.1", port: 4173 });
  });
});
