"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CsoResponse, RainfallResponse } from "@/types";
import { STORAGE_KEYS } from "@/lib/storageKeys";

// The CSO feed is near-real-time and its route caches for 5 minutes; the EA
// rainfall gauges only report every 15, so polling them faster just spends
// requests to re-read the same numbers. One refresh drives both, but the
// background poll runs on the slower of the two and only re-pulls rainfall
// every third tick.
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const RAINFALL_EVERY_N_POLLS = 3;

export const OFFLINE_NO_CACHE_ERROR =
  "You're offline and there's no saved data to show yet.";

// How old the data has to be before the nav bar says so out loud. Both feeds
// update well inside this, so passing it means a fetch has been quietly
// failing rather than that the sources are slow.
export const DATA_STALE_THRESHOLD_MS = 45 * 60 * 1000;

export interface SevernData {
  cso: CsoResponse | null;
  rainfall: RainfallResponse | null;
  csoError: boolean;
  rainfallError: boolean;
  // True while there is no usable data to render. Automatic polling waits for
  // stale data, while an explicit refresh may set this again to let the cards
  // show their loading skeletons.
  loading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  usingCachedData: boolean;
  // Newest `asOf` across whichever sources came back, which is what the nav
  // bar's freshness line reports. Null until something loads.
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

const newest = (
  ...timestamps: (string | undefined | null)[]
): string | null => {
  const valid = timestamps.filter((t): t is string => Boolean(t));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
};

export const useSevernData = (): SevernData => {
  const [cso, setCso] = useState<CsoResponse | null>(null);
  const [rainfall, setRainfall] = useState<RainfallResponse | null>(null);
  const [csoError, setCsoError] = useState(false);
  const [rainfallError, setRainfallError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts background polls so rainfall can run at a third of the CSO rate.
  // A ref rather than state: nothing renders off it, and making it state
  // would re-render every component on the page on each tick.
  const pollCount = useRef(0);
  const newestDataAt = useRef<number | null>(null);
  const lastFetchTime = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const load = useCallback(async (includeRainfall: boolean) => {
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    // Each source is fetched independently and falls back to its own cached
    // copy, so one feed blipping doesn't discard data that arrived fine from
    // the other. `Promise.all` over already-caught promises never rejects.
    const csoPromise = fetch("/api/sewage")
      .then((res) => {
        if (!res.ok) throw new Error(`sewage: ${res.status}`);
        return res.json() as Promise<CsoResponse>;
      })
      .then((body) => {
        writeCache(STORAGE_KEYS.CSO_DATA, body);
        return { body, fromCache: false };
      })
      .catch(() => ({
        body: readCache<CsoResponse>(STORAGE_KEYS.CSO_DATA),
        fromCache: true,
      }));

    const rainfallPromise = includeRainfall
      ? fetch("/api/rainfall")
          .then((res) => {
            if (!res.ok) throw new Error(`rainfall: ${res.status}`);
            return res.json() as Promise<RainfallResponse>;
          })
          .then((body) => {
            writeCache(STORAGE_KEYS.RAINFALL_DATA, body);
            return { body, fromCache: false };
          })
          .catch(() => ({
            body: readCache<RainfallResponse>(STORAGE_KEYS.RAINFALL_DATA),
            fromCache: true,
          }))
      : Promise.resolve(null);

    const [csoResult, rainfallResult] = await Promise.all([
      csoPromise,
      rainfallPromise,
    ]);

    if (csoResult.body) setCso(csoResult.body);
    setCsoError(csoResult.fromCache && !csoResult.body);

    if (rainfallResult) {
      if (rainfallResult.body) setRainfall(rainfallResult.body);
      setRainfallError(rainfallResult.fromCache && !rainfallResult.body);
    }

    const newestResultTime = newest(
      csoResult.body?.asOf,
      rainfallResult?.body?.asOf
    );
    if (newestResultTime) {
      newestDataAt.current = new Date(newestResultTime).getTime();
    }

    const servedFromCache =
      csoResult.fromCache || Boolean(rainfallResult?.fromCache);
    setUsingCachedData(servedFromCache);

    const gotSomething =
      Boolean(csoResult.body) || Boolean(rainfallResult?.body);
    setError(
      !gotSomething && !navigator.onLine ? OFFLINE_NO_CACHE_ERROR : null
    );

    lastFetchTime.current = Date.now();
    setLoading(false);
    setIsRefreshing(false);
    isRefreshingRef.current = false;
  }, []);

  const refetch = useCallback(() => {
    void load(true);
  }, [load]);

  // Auto-refresh when opening or returning to the app if data is stale.
  const checkAndRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    const isStale =
      newestDataAt.current === null ||
      Date.now() - newestDataAt.current >= POLL_INTERVAL_MS;
    const recentlyFetched =
      lastFetchTime.current !== null &&
      Date.now() - lastFetchTime.current < 10000;

    if (isStale && !recentlyFetched) {
      void load(true);
    }
  }, [load]);

  // Seed from cache before the first fetch resolves, so a returning reader
  // sees last-known numbers immediately instead of a screen of skeletons -
  // the banner in TopNavBar is what tells them it isn't live yet.
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
      if (cachedCso) setCso(cachedCso);
      if (cachedRainfall) setRainfall(cachedRainfall);
      const cachedDataTime = newest(cachedCso?.asOf, cachedRainfall?.asOf);
      if (cachedDataTime) {
        newestDataAt.current = new Date(cachedDataTime).getTime();
      }
      if (cachedCso || cachedRainfall) {
        setUsingCachedData(true);
        setLoading(false);
      }
      void load(true);
    });

    const interval = setInterval(() => {
      pollCount.current += 1;
      void load(pollCount.current % RAINFALL_EVERY_N_POLLS === 0);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
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

    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
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
    csoError,
    rainfallError,
    loading,
    isRefreshing,
    isOffline,
    usingCachedData,
    lastUpdated: newest(cso?.asOf, rainfall?.asOf),
    error,
    refetch,
  };
};
