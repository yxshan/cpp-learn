export interface ServerAddress {
  readonly host: "127.0.0.1" | "::1" | "localhost";
  readonly port: number;
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
