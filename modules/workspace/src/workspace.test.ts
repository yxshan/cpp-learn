import { describe, expect, it } from "vitest";

import { validateEditablePath } from "./index.js";

describe("[T-SEC-001] Workspace editable path contract", () => {
  it.each([
    "../main.cpp",
    "/tmp/main.cpp",
    "src/../../main.cpp",
    "src\\main.cpp",
    "support/read-only.cpp",
    ""
  ])("rejects unsafe or undeclared path %j", (candidate) => {
    expect(validateEditablePath(candidate, ["main.cpp", "src/app.cpp"])).toEqual({
      ok: false,
      code: "invalid_path"
    });
  });

  it("accepts a normalized relative path declared by the workspace contract", () => {
    expect(validateEditablePath("src/app.cpp", ["main.cpp", "src/app.cpp"])).toEqual({
      ok: true,
      path: "src/app.cpp"
    });
  });
});
