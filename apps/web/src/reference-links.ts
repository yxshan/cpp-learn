import { useEffect, useState } from "react";

import { getReferenceEntry } from "./api.js";

export interface ReferenceLinkTarget {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export function useReferenceLinks(
  entryIds: readonly string[] | undefined,
): Readonly<Record<string, ReferenceLinkTarget>> {
  const [links, setLinks] = useState<
    Readonly<Record<string, ReferenceLinkTarget>>
  >({});

  useEffect(() => {
    let active = true;
    setLinks({});
    if (!entryIds || entryIds.length === 0) return;

    void Promise.all(
      entryIds.map(async (entryId) => {
        try {
          const entry = await getReferenceEntry(entryId);
          return { id: entry.id, slug: entry.slug, title: entry.title };
        } catch {
          return undefined;
        }
      }),
    ).then((resolved) => {
      if (!active) return;
      setLinks(
        Object.fromEntries(
          resolved
            .filter((link): link is ReferenceLinkTarget => link !== undefined)
            .map((link) => [link.id, link]),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [entryIds]);

  return links;
}
