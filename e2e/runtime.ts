import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectKey = createHash("sha256")
  .update(resolve("."))
  .digest("hex")
  .slice(0, 12);
const apiPort = 4273;
const webPort = 5273;

export const e2eRuntimeRoot = resolve(tmpdir(), `cpp-learn-e2e-${projectKey}`);
export const e2eDataRoot = resolve(e2eRuntimeRoot, "data");
export const e2eWorkspaceRoot = resolve(e2eRuntimeRoot, "workspaces");
export const e2eApiOrigin = `http://127.0.0.1:${apiPort}`;
export const e2eWebOrigin = `http://127.0.0.1:${webPort}`;
export const e2eApiPort = String(apiPort);
export const e2eWebPort = String(webPort);
