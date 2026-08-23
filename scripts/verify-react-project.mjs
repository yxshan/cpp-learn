import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build, createServer, version as viteVersion } from "vite";

const harnessPath = fileURLToPath(import.meta.url);
const toolRoot = resolve(dirname(harnessPath), "..", "node_modules");
if (process.argv[2] === "--fingerprint") {
  const [harnessSource, reactPackage, reactDomPackage] = await Promise.all([
    readFile(harnessPath),
    readFile(join(toolRoot, "react", "package.json"), "utf8"),
    readFile(join(toolRoot, "react-dom", "package.json"), "utf8"),
  ]);
  const reactVersion = JSON.parse(reactPackage).version;
  const reactDomVersion = JSON.parse(reactDomPackage).version;
  const digest = createHash("sha256").update(harnessSource).digest("hex");
  process.stdout.write(
    `web-frontend sha256=${digest} vite=${viteVersion} react=${reactVersion} react-dom=${reactDomVersion}\n`,
  );
  process.exit(0);
}

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const outputRoot = await mkdtemp(join(tmpdir(), "cpp-learn-react-build-"));
const nodeModulesLink = join(projectRoot, "node_modules");
const packageDocument = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8"),
);

if (
  packageDocument.scripts?.build !== "vite build" ||
  packageDocument.scripts?.test !== "tsx component.test.tsx" ||
  packageDocument.dependencies?.react !== "19.2.8" ||
  packageDocument.dependencies?.["react-dom"] !== "19.2.8"
) {
  throw new Error(
    "package.json must pin the reproducible React build and component-test contract",
  );
}

let server;
try {
  await mkdir(nodeModulesLink);
  for (const packageName of ["react", "react-dom", "scheduler"]) {
    await symlink(
      join(toolRoot, packageName),
      join(nodeModulesLink, packageName),
      "dir",
    );
  }
  await build({
    root: projectRoot,
    logLevel: "silent",
    build: { outDir: outputRoot, emptyOutDir: true },
  });
  server = await createServer({
    root: projectRoot,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
  });
  const componentTest = await server.ssrLoadModule("/component.test.tsx");
  if (componentTest.componentTestPassed !== true) {
    throw new Error("component.test.tsx did not export passing mount evidence");
  }
  process.stdout.write("react-build=pass component-mount=pass\n");
} finally {
  await server?.close();
  await rm(nodeModulesLink, { recursive: true, force: true });
  await rm(outputRoot, { recursive: true, force: true });
}
