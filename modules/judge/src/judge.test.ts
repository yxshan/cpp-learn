import { describe, expect, it, vi } from "vitest";

import { createNativeToolchainProbe } from "./index.js";

describe("[T-COMPAT-001] Native Judge toolchain probe", () => {
  it("reports the compiler identity from an argument-array process call", async () => {
    const execute = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "Apple clang version 15.0.0\nTarget: arm64-apple-darwin\n",
      stderr: ""
    });
    const probe = createNativeToolchainProbe({ execute });

    await expect(probe()).resolves.toEqual({
      ready: true,
      compiler: "Apple clang version 15.0.0"
    });
    expect(execute).toHaveBeenCalledWith("clang++", ["--version"]);
  });
});
