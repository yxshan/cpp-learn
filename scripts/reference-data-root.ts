import { join, resolve } from "node:path";

export function resolveReferenceDataRoot(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return resolve(
    environment["CPP_LEARN_DATA_ROOT"] ?? join(".cpp-learn", "data"),
  );
}
