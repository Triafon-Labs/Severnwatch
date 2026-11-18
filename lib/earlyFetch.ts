// Starts the home page's data requests from an inline <head> script, so they
// download alongside the JavaScript instead of waiting for it. Without this
// they can't begin until every chunk has downloaded, run and hydrated
// - about 3 s on a slow phone signal.
//
// <link rel="preload" as="fetch"> would be the usual tool, but Chrome didn't
// hand the preloaded response to the hook's own fetch() when tested - it
// fetched twice - and Safari's support is patchy. A promise the hook picks up
// itself can't be missed.
//
// The hook takes each early request once, for its first attempt on load.
// The /live fallback, refreshes and refetch-on-return all make
// their own requests as before, so nothing can be served from it twice.

export const SEWAGE_PATH = "/api/sewage";
export const RAINFALL_PATH = "/api/rainfall";
export const WATER_QUALITY_PATH = "/api/water-quality";

// Only the home page shows this data. On /upload the provider in the layout
// still loads it, with its own requests as before.
const EARLY_FETCH_PAGE = "/";
// Risk history is left to load when its card does: it is further down the
// page, and fetching it early would only compete with these for bandwidth.
const EARLY_FETCH_PATHS = [SEWAGE_PATH, RAINFALL_PATH, WATER_QUALITY_PATH];

declare global {
  interface Window {
    __earlyFetches?: Record<string, Promise<Response> | undefined>;
  }
}

// The inline script. The empty catch on each request stops an offline load
// logging an unhandled rejection before the app has even started; the hook
// still sees the failure, because it awaits the original promise.
export const EARLY_FETCH_SCRIPT = `try{if(location.pathname===${JSON.stringify(EARLY_FETCH_PAGE)}){var e={};${JSON.stringify(EARLY_FETCH_PATHS)}.forEach(function(p){var f=fetch(p);f.catch(function(){});e[p]=f});window.__earlyFetches=e}}catch(_){}`;

// The request the inline script started for `path`, or a new one if there
// was none or it has already been taken. A response body can only be read
// once, so it is handed out once.
export const fetchPreferringEarly = (path: string): Promise<Response> => {
  const early =
    typeof window !== "undefined" ? window.__earlyFetches?.[path] : undefined;
  if (early) {
    delete window.__earlyFetches![path];
    return early;
  }
  return fetch(path);
};
