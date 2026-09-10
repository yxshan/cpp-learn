import {
  encodedReferencePath,
  referenceContext,
  referenceEntryUrl,
  referenceSearchUrl,
} from "@cpp-learn/reference-presentation";

export { referenceEntryUrl, referenceSearchUrl };

export interface ReferenceLocation {
  readonly slug?: string;
  readonly query: string;
  readonly category?: string;
  readonly hash: string;
}

const REFERENCE_PREFIX = "/reference/";

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseReferenceLocation(url: URL): ReferenceLocation {
  const encodedSlug = url.pathname.startsWith(REFERENCE_PREFIX)
    ? url.pathname.slice(REFERENCE_PREFIX.length)
    : "";
  const slug = encodedSlug
    ? encodedSlug.split("/").map(decodePathSegment).join("/")
    : undefined;
  const category = url.searchParams.get("category");
  return {
    ...(slug === undefined ? {} : { slug }),
    query: url.searchParams.get("q") ?? "",
    ...(category ? { category } : {}),
    hash: url.hash,
  };
}

export function canonicalReferenceUrl(url: URL, slug: string): URL {
  const canonical = new URL(url);
  canonical.pathname = encodedReferencePath(slug);
  return canonical;
}

export function referenceCategoryUrl(
  url: URL,
  category: string | undefined,
): string {
  const location = new URL("/reference", url);
  const parameters = referenceContext(url);
  if (category !== undefined) parameters.set("category", category);
  location.search = parameters.toString();
  return `${location.pathname}${location.search}`;
}
