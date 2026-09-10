export interface ServerAddress {
  readonly host: "127.0.0.1" | "::1" | "localhost";
  readonly port: number;
}

export interface ServerStoragePaths {
  readonly dataRoot?: string;
  readonly workspaceRoot?: string;
}

type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveServerAddress(
  environment: ServerEnvironment,
): ServerAddress {
  const host = environment["CPP_LEARN_HOST"] ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("Server host must be a loopback address");
  }

  const port = Number(environment["CPP_LEARN_PORT"] ?? "4173");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Server port must be an integer between 1 and 65535");
  }

  return { host, port };
}

export function resolveServerStoragePaths(
  environment: ServerEnvironment,
): ServerStoragePaths {
  const dataRoot = environment["CPP_LEARN_DATA_ROOT"];
  const workspaceRoot = environment["CPP_LEARN_WORKSPACE_ROOT"];
  return {
    ...(dataRoot ? { dataRoot } : {}),
    ...(workspaceRoot ? { workspaceRoot } : {}),
  };
}
