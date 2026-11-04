"use client";

import { useEffect, useState } from "react";

// Ticks once a minute so anything displaying data age stays accurate for as
// long as the component stays mounted, even without a refetch.
export const useNowTicking = (intervalMs: number = 60 * 1000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
};
