"use client";

import { DATA_STALE_THRESHOLD_MS } from "@/lib/hooks";
import { getLondonHHMM, getRelativeTimeString } from "@/lib/time";
import { useNowTicking } from "@/lib/useNowTicking";

// How fresh the data on screen is: "10:33 · just now", and whether it's past
// DATA_STALE_THRESHOLD_MS. Shared by the status card's "Updated" line and the
// stale-data banners above the app bar (Paddlecheck's hook).
//
// Worked out during render from lastUpdated and a ticking clock, not kept in
// state of its own. State set from an effect lags a render behind: the render
// where a refresh landed carried the new data with the old "stale" flag, so
// the banner began to open just as the fetch that should have cleared it
// finished.
export const useFreshness = (lastUpdated: string | null) => {
  const now = useNowTicking(30 * 1000);
  const relative = getRelativeTimeString(lastUpdated, now);
  const isStale = lastUpdated
    ? now.getTime() - new Date(lastUpdated).getTime() > DATA_STALE_THRESHOLD_MS
    : false;

  // "Updated just now" alone reads as if this instant triggered a live fetch,
  // when it may just be a fast cache hit on data fetched slightly earlier -
  // pairing it with the clock time it was actually fetched keeps that honest.
  const clockTime = lastUpdated ? getLondonHHMM(new Date(lastUpdated)) : null;
  const freshnessText =
    clockTime && relative ? `${clockTime} · ${relative}` : relative;

  return { freshnessText, isStale };
};
