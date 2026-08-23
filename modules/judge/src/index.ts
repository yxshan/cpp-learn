import { spawn } from "node:child_process";

import type { ToolchainReadiness } from "@cpp-learn/contracts";

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessExecutor = (
  executable: string,
  args: readonly string[]
) => Promise<ProcessResult>;

export interface NativeToolchainProbeDependencies {
  readonly execute: ProcessExecutor;
}

export const executeProcess: ProcessExecutor = async (executable, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });

export function createNativeToolchainProbe(
  dependencies: NativeToolchainProbeDependencies
): () => Promise<ToolchainReadiness> {
  return async () => {
    try {
      const result = await dependencies.execute("clang++", ["--version"]);
      const compiler = result.stdout.split(/\r?\n/, 1)[0]?.trim();
      if (result.exitCode !== 0 || !compiler) {
        return {
          ready: false,
          issues: ["clang++ did not return a usable version"]
        };
      }
      return { ready: true, compiler };
    } catch {
      return { ready: false, issues: ["clang++ is unavailable"] };
    }
  };
}
