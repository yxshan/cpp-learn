export {
  buildReferenceActivityIndex,
  createProductionApplication,
  createProductionDataArchive,
  createProductionHttpServer,
  createProductionPlatform,
  type ProductionPlatformOptions,
  type ReferenceActivityIndexResult,
} from "./application.ts";

export { createServer, type ServerDependencies } from "./server.ts";

export {
  resolveServerAddress,
  resolveServerStoragePaths,
  type ServerAddress,
  type ServerStoragePaths,
} from "./config.ts";
