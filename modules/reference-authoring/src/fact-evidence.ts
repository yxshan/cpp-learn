import { createHash } from "node:crypto";

import type { AuthoringFactGroup, AuthoringSourceRecord } from "./index.js";

export function authoringFactEvidenceDigest(
  group: AuthoringFactGroup,
  sources: readonly AuthoringSourceRecord[],
): string {
  const selectedSources = group.sourceIds
    .map((sourceId) => sources.find(({ id }) => id === sourceId))
    .filter((source): source is AuthoringSourceRecord => source !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: group.kind,
        summary: group.summary,
        sourceIds: [...group.sourceIds].sort(),
        ...(group.decision === undefined ? {} : { decision: group.decision }),
        sources: selectedSources,
      }),
    )
    .digest("hex");
}
