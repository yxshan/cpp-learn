export const REFERENCE_PATH_PREFIX = "/reference/";

export function encodedReferencePath(slug: string): string {
  return `${REFERENCE_PATH_PREFIX}${slug
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * Preserves the Reference search context (`q`) so that following a link keeps
 * the reader inside their current filtered result set.
 */
export function referenceContext(url: URL): URLSearchParams {
  const parameters = new URLSearchParams();
  const query = url.searchParams.get("q");
  if (query) parameters.set("q", query);
  return parameters;
}

export function referenceEntryUrl(url: URL, slug: string): string {
  const query = referenceContext(url).toString();
  return `${encodedReferencePath(slug)}${query ? `?${query}` : ""}`;
}

export function referenceSearchUrl(url: URL, query: string): string {
  const location = new URL("/reference", url);
  const parameters = new URLSearchParams();
  if (query.trim()) parameters.set("q", query.trim());
  location.search = parameters.toString();
  return `${location.pathname}${location.search}`;
}
