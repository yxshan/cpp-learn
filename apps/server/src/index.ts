import { fileURLToPath } from "node:url";

import {
  createProductionApplication,
  createProductionDataArchive,
  createProductionHttpServer,
  resolveJudgeAdmissionOptions,
  resolveServerAddress,
  resolveServerStoragePaths,
} from "@cpp-learn/composition";

const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

const { host, port } = resolveServerAddress(process.env);
const storagePaths = resolveServerStoragePaths(process.env);
const application = await createProductionApplication({
  ...storagePaths,
  judgeAdmission: resolveJudgeAdmissionOptions(process.env),
});

const server = createProductionHttpServer(application, {
  archive: createProductionDataArchive(storagePaths),
  logger: true,
  webRoot,
});

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "C++ Learn server is ready");
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
