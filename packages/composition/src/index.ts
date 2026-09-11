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
  DEFAULT_JUDGE_MAX_CONCURRENT,
  DEFAULT_JUDGE_MAX_QUEUED,
  JudgeAdmissionRejected,
  createBoundedJudge,
  createJudgeAdmission,
  type JudgeAdmission,
  type JudgeAdmissionOptions,
} from "./admission.ts";

export {
  resolveJudgeAdmissionOptions,
  resolveServerAddress,
  resolveServerStoragePaths,
  type ServerAddress,
  type ServerStoragePaths,
} from "./config.ts";
