// One cache window for every upstream feed and both API routes. A shorter
// window on any one fetch would silently drag its route's whole cache down to
// it, and the client's thresholds (lib/hooks.ts) are derived from this too.
//
// The routes' own `export const revalidate` has to be a literal Next can read
// at build time, so it can't import this - keep those in step by hand.
export const DATA_REVALIDATE_SECONDS = 900;

export interface FetchLiveness {
  // Bypass the cache for a genuinely live upstream fetch - used by the
  // /api/*/live routes the client falls back to when a cached response has
  // already expired.
  live?: boolean;
}

export const fetchCacheOptions = ({ live }: FetchLiveness = {}): RequestInit =>
  live
    ? { cache: "no-store" }
    : { next: { revalidate: DATA_REVALIDATE_SECONDS } };
