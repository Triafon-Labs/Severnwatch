"use client";

import { useEffect, useState } from "react";
import { RiskHistoryDay, RiskHistoryResponse } from "@/types";

// The recorded risk, a day at a time (app/api/risk-history). Fetched once
// by the card that draws it rather than through useSevernData: it changes
// by the day and belongs to no freshness line, and until recording has
// begun there is nothing to show - an empty list, which is also what a
// failed fetch gives. `loading` is for the card's skeleton.
export const useRiskHistory = (): {
  days: RiskHistoryDay[];
  loading: boolean;
} => {
  const [days, setDays] = useState<RiskHistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/risk-history")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: RiskHistoryResponse | null) => {
        if (!cancelled && Array.isArray(body?.days)) setDays(body.days);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { days, loading };
};
