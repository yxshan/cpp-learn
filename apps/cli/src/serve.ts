import type { createProductionApplication } from "@cpp-learn/server/composition";
import { createServer, type ServerDependencies } from "@cpp-learn/server";

type ProductionApplication = Awaited<
  ReturnType<typeof createProductionApplication>
>;

type CliHttpServerOptions = Omit<ServerDependencies, "platform" | "reference">;

export function createCliHttpServer(
  application: ProductionApplication,
  options: CliHttpServerOptions,
) {
  return createServer({
    ...options,
    platform: application.platform,
    reference: application.reference,
  });
}
