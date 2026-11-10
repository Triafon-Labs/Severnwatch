"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CsoResponse, RainfallResponse, WaterQualityResponse } from "@/types";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { DATA_REVALIDATE_SECONDS } from "@/lib/fetchCache";

// There is no background poll. Like Paddlecheck, data is fetched on load, on
// a manual refresh, and when the reader comes back to the app (tab shown,
// window focused, signal regained, page restored from the back/forward
// cache) with data older than this - the routes' own cache window, so a
// sooner refetch would only re-read the same response. A 5-minute poll used
// to run while the page was open, and since every fetch puts the cards back
// into their skeletons, the page blanked every five minutes under whoever was
// reading it.
//
// It is also the age past which a response from a route is thrown away for a
// live one (/api/*/live). Once the window is up the route cache hands its
// *expired* entry to whoever arrives first and rebuilds behind them, so after
// a quiet spell the first visitor would otherwise get hours-old data.
const REFETCH_AFTER_MS = DATA_REVALIDATE_SECONDS * 1000;

export const OFFLINE_NO_CACHE_ERROR =
  "You're offline and there's no saved data to show yet.";

// How old the data has to be before the nav bar says so out loud. Two cache
// windows: a successful fetch returns data up to one window old, so a banner
// set any closer to the window would come back a few minutes after a refresh
// that worked. At two, a good refresh keeps it away for a whole window, and
// the banner only means a fetch failed or the page has been left open.
export const DATA_STALE_THRESHOLD_MS = 2 * DATA_REVALIDATE_SECONDS * 1000;

export interface SevernData {
  cso: CsoResponse | null;
  rainfall: RainfallResponse | null;
  waterQuality: WaterQualityResponse | null;
  csoError: boolean;
  rainfallError: boolean;
  waterQualityError: boolean;
  // True until the first fetch (or the cache seeded ahead of it) has given the
  // cards something to render. The cards also show their skeletons while
  // isRefreshing - every fetch, as in Paddlecheck, so the skeletons clearing
  // means what's on screen just came from the network.
  loading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  // The last fetch couldn't get one of the sources from inside the cache
  // window - its request failed and fell back to the saved copy, or the live
  // fallback failed too. The nav bar's "Live update failed" banner.
  lastFetchFailed: boolean;
  // Oldest `asOf` across the live sources on screen (spills and rainfall),
  // which is what the freshness line and stale banner report - the newest
  // would let a fresh sewage response hide rainfall that is hours old. Null
  // until something loads. The water quality samples are left out: their
  // `asOf` is when the response was built - at deploy, or after an upload -
  // not when anything was sampled, so it would read as permanently stale.
  lastUpdated: string | null;
  error: string | null;
  refetch: () => void;
}

// localStorage is the offline shell's only store - the service worker caches
// the app itself, not these API responses. Both helpers swallow their own
// failures: Safari in private mode throws on write, and a corrupt entry
// should degrade to "no cache" rather than take the page down with it.
const readCache = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled - the app works without the cache.
  }
};

const oldest = (
  ...timestamps: (string | undefined | null)[]
): string | null => {
  const valid = timestamps.filter((t): t is string => Boolean(t));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (new Date(a) < new Date(b) ? a : b));
};

const ageMs = (iso: string) => Date.now() - new Date(iso).getTime();

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
};

// One source: its cached route, then - if that failed or handed back an entry
// already past the cache window - its live route, then the saved copy. Each
// source does this on its own, so one feed blipping doesn't discard data that
// arrived fine from the other. Never rejects.
const loadSource = async <T extends { asOf: string }>(
  path: string,
  storageKey: string
): Promise<{ body: T | null; fromCache: boolean }> => {
  let body = await fetchJson<T>(path).catch(() => null);
  if (!body || ageMs(body.asOf) > REFETCH_AFTER_MS) {
    // no-store: this call exists to get round caches, and a browser holding
    // on to an earlier response would hand back the staleness it's here for.
    const live = await fetchJson<T>(`${path}/live`, {
      cache: "no-store",
    }).catch(() => null);
    if (live) body = live;
  }
  if (body) {
    writeCache(storageKey, body);
    return { body, fromCache: false };
  }
  return { body: readCache<T>(storageKey), fromCache: true };
};

// The water quality samples: their route, then the saved copy. No `/live`
// step and no age check - the route is static, rebuilt at deploy and after
// each upload (app/api/water-quality), so its `asOf` is always "old" and
// there's no live twin to try. Never rejects.
const loadStaticSource = async <T>(
  path: string,
  storageKey: string
): Promise<{ body: T | null; fromCache: boolean }> => {
  const body = await fetchJson<T>(path).catch(() => null);
  if (body) {
    writeCache(storageKey, body);
    return { body, fromCache: false };
  }
  return { body: readCache<T>(storageKey), fromCache: true };
};

export const useSevernData = (): SevernData => {
  const [cso, setCso] = useState<CsoResponse | null>(null);
  const [rainfall, setRainfall] = useState<RainfallResponse | null>(null);
  const [csoError, setCsoError] = useState(false);
  const [rainfallError, setRainfallError] = useState(false);
  const [waterQuality, setWaterQuality] = useState<WaterQualityResponse | null>(
    null
  );
  const [waterQualityError, setWaterQualityError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the oldest source on screen was built - what "is it worth
  // refetching on return" is judged on.
  const dataAt = useRef<number | null>(null);
  const lastFetchTime = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const load = useCallback(async () => {
    // A tap on refresh while the load on open (or a return to the app) is
    // still running would otherwise race it, and whichever finished last -
    // not whichever started last - would decide what is on screen.
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const csoPromise = loadSource<CsoResponse>(
      "/api/sewage",
      STORAGE_KEYS.CSO_DATA
    );
    const rainfallPromise = loadSource<RainfallResponse>(
      "/api/rainfall",
      STORAGE_KEYS.RAINFALL_DATA
    );

    const waterQualityPromise = loadStaticSource<WaterQualityResponse>(
      "/api/water-quality",
      STORAGE_KEYS.WATER_QUALITY_DATA
    );

    const [csoResult, rainfallResult, waterQualityResult] = await Promise.all([
      csoPromise,
      rainfallPromise,
      waterQualityPromise,
    ]);

    if (csoResult.body) setCso(csoResult.body);
    setCsoError(csoResult.fromCache && !csoResult.body);

    if (rainfallResult.body) setRainfall(rainfallResult.body);
    setRainfallError(rainfallResult.fromCache && !rainfallResult.body);

    if (waterQualityResult.body) setWaterQuality(waterQualityResult.body);
    setWaterQualityError(
      waterQualityResult.fromCache && !waterQualityResult.body
    );

    const oldestResultTime = oldest(
      csoResult.body?.asOf,
      rainfallResult.body?.asOf
    );
    if (oldestResultTime) {
      dataAt.current = new Date(oldestResultTime).getTime();
    }

    // Failed means not getting a source from inside the cache window: its
    // request fell back to the saved copy, or the live fallback failed and
    // left an expired response. Data that only ages past the window later,
    // with nothing fetching (there is no poll), isn't a failure.
    setLastFetchFailed(
      csoResult.fromCache ||
        rainfallResult.fromCache ||
        waterQualityResult.fromCache ||
        (oldestResultTime !== null &&
          ageMs(oldestResultTime) > REFETCH_AFTER_MS)
    );

    const gotSomething =
      Boolean(csoResult.body) ||
      Boolean(rainfallResult.body) ||
      Boolean(waterQualityResult.body);
    setError(
      !gotSomething && !navigator.onLine ? OFFLINE_NO_CACHE_ERROR : null
    );

    lastFetchTime.current = Date.now();
    setLoading(false);
    setIsRefreshing(false);
    isRefreshingRef.current = false;
  }, []);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  // Auto-refresh when opening or returning to the app if data is stale.
  const checkAndRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    const isStale =
      dataAt.current === null ||
      Date.now() - dataAt.current >= REFETCH_AFTER_MS;
    const recentlyFetched =
      lastFetchTime.current !== null &&
      Date.now() - lastFetchTime.current < 10000;

    if (isStale && !recentlyFetched) {
      void load();
    }
  }, [load]);

  // Seed from cache before the first fetch resolves, so a returning reader
  // sees last-known numbers immediately instead of a screen of skeletons -
  // the nav bar's "Updating…" line is what tells them it isn't live yet.
  useEffect(() => {
    // queueMicrotask still runs before paint, so the cached numbers are in
    // the first frame either way - it just keeps the seeding, and the first
    // fetch's own `isRefreshing` flip, out of the effect body, which React
    // flags as a cascading render.
    queueMicrotask(() => {
      const cachedCso = readCache<CsoResponse>(STORAGE_KEYS.CSO_DATA);
      const cachedRainfall = readCache<RainfallResponse>(
        STORAGE_KEYS.RAINFALL_DATA
      );
      const cachedWaterQuality = readCache<WaterQualityResponse>(
        STORAGE_KEYS.WATER_QUALITY_DATA
      );
      if (cachedCso) setCso(cachedCso);
      if (cachedRainfall) setRainfall(cachedRainfall);
      if (cachedWaterQuality) setWaterQuality(cachedWaterQuality);
      const cachedDataTime = oldest(cachedCso?.asOf, cachedRainfall?.asOf);
      if (cachedDataTime) {
        dataAt.current = new Date(cachedDataTime).getTime();
      }
      if (cachedCso || cachedRainfall || cachedWaterQuality) setLoading(false);
      void load();
    });
  }, [load]);

  // Connectivity is read from the events rather than polled: `navigator.onLine`
  // is only meaningful at the moment it changes, and reading it on a timer
  // would report a captive portal as online.
  useEffect(() => {
    const sync = () => setIsOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Auto-refresh on focus/visibility change when app is opened or foregrounded.
  useEffect(() => {
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkAndRefresh();
      }
    };

    // A page restored from the back/forward cache never remounts, and one
    // that was already visible when it was frozen fires no visibilitychange
    // either; pageshow is the one event both paths share (as in Paddlecheck).
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onVisibilityOrFocus();
    };

    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [checkAndRefresh]);

  // Coming back from offline, refresh straight away if stale.
  useEffect(() => {
    if (!isOffline) return;
    const onReconnect = () => checkAndRefresh();
    window.addEventListener("online", onReconnect);
    return () => window.removeEventListener("online", onReconnect);
  }, [isOffline, checkAndRefresh]);

  return {
    cso,
    rainfall,
    waterQuality,
    csoError,
    rainfallError,
    waterQualityError,
    loading,
    isRefreshing,
    isOffline,
    lastFetchFailed,
    lastUpdated: oldest(cso?.asOf, rainfall?.asOf),
    error,
    refetch,
  };
};
