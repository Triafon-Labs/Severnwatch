"use client";

import { useEffect, useState } from "react";
import { DATA_STALE_THRESHOLD_MS } from "@/lib/hooks";
import { getLondonHHMM, getRelativeTimeString } from "@/lib/time";

const isDataStale = (lastUpdated: string | null): boolean => {
  if (!lastUpdated) return false;
  return Date.now() - new Date(lastUpdated).getTime() > DATA_STALE_THRESHOLD_MS;
};

// How fresh the data on screen is: "10:33 · just now", and whether it's past
// DATA_STALE_THRESHOLD_MS. Re-read every 30 seconds so both stay right while
// the page is left open. Shared by the status card's "Updated" line and the
// stale-data banners above the app bar - Paddlecheck's hook, ported.
export const useFreshness = (lastUpdated: string | null) => {
  const [relative, setRelative] = useState<string>(() =>
    getRelativeTimeString(lastUpdated)
  );
  const [isStale, setIsStale] = useState<boolean>(() =>
    isDataStale(lastUpdated)
  );

  useEffect(() => {
    // queueMicrotask breaks the synchronous set-state-in-an-effect the lint
    // rules flag, while still running before paint.
    queueMicrotask(() => {
      setRelative(getRelativeTimeString(lastUpdated));
      setIsStale(isDataStale(lastUpdated));
    });

    const interval = setInterval(() => {
      setRelative(getRelativeTimeString(lastUpdated));
      setIsStale(isDataStale(lastUpdated));
    }, 30000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // "Updated just now" alone reads as if this instant triggered a live fetch,
  // when it may just be a fast cache hit on data fetched slightly earlier -
  // pairing it with the clock time it was actually fetched keeps that honest.
  const clockTime = lastUpdated ? getLondonHHMM(new Date(lastUpdated)) : null;
  const freshnessText =
    clockTime && relative ? `${clockTime} · ${relative}` : relative;

  return { freshnessText, isStale };
};
