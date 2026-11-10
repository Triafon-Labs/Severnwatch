"use client";

import { useEffect, useState } from "react";

// Ticks once a minute so anything displaying data age stays accurate for as
// long as the component stays mounted, even without a refetch. Also catches
// up the moment the page is shown again: a backgrounded phone freezes the
// interval, and without this the clock would resume from wherever it stopped.
//
// Kept out of lib/time.ts (as in Paddlecheck) so that module stays free of
// React and the water quality route can import it on the server.
export const useNowTicking = (intervalMs: number = 60 * 1000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);
  return now;
};
