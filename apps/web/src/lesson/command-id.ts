/**
 * Idempotency key for a lesson command.
 *
 * The Learning Platform deduplicates by command ID, so a retry after a
 * dropped response must reuse the same ID. Each user action therefore mints
 * one ID up front and passes it through.
 */
export function commandId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
