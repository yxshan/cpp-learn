import { describe, expect, it, vi } from "vitest";

import { createNativeAuthoringExampleValidator } from "./index.js";

const request = {
  entryId: "std-vector-insert",
  example: {
    id: "minimal",
    path: "entries/std-vector-insert/examples/minimal.cpp",
    kind: "run" as const,
    standard: "c++20" as const,
    expectedStdout: "ok\n",
  },
  source: "int main() {}\n",
};

describe("[T-AUTH-A1-NATIVE-001] native example validation Adapter", () => {
  it("validates a real deterministic C++20 program", async () => {
    const validator = createNativeAuthoringExampleValidator();

    await expect(
      validator.validate({
        entryId: "smoke",
        example: {
          id: "run",
          path: "entries/smoke/examples/run.cpp",
          kind: "run",
          standard: "c++20",
          expectedStdout: "42\n",
        },
        source:
          '#include <iostream>\n\nint main() {\n  std::cout << 42 << "\\n";\n}\n',
      }),
    ).resolves.toEqual([]);
  });

  it("compiles and runs a declared example under bounded execution", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "ok\n",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    const validator = createNativeAuthoringExampleValidator({
      compiler: "/compiler",
      run,
      standardFlag: async () => "c++20",
    });

    await expect(validator.validate(request)).resolves.toEqual([]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      executable: "/compiler",
      args: expect.arrayContaining(["-std=c++20", "-Werror"]),
    });
    expect(run.mock.calls[1]?.[0]).toMatchObject({ timeoutMs: 2_000 });
    expect(run.mock.calls[1]?.[0]).not.toHaveProperty("stdin");
  });

  it("returns a structured issue for compiler or runtime failure", async () => {
    const validator = createNativeAuthoringExampleValidator({
      compiler: "/compiler",
      run: vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "compile error",
        timedOut: false,
        outputLimitExceeded: false,
      }),
      standardFlag: async () => "c++20",
    });

    await expect(validator.validate(request)).resolves.toEqual([
      expect.objectContaining({ keyword: "compiler" }),
    ]);
  });
});
