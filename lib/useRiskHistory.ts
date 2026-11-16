"use client";

import { useEffect, useState } from "react";
import { RiskHistoryDay, RiskHistoryResponse } from "@/types";

// The recorded risk, a day at a time (app/api/risk-history). Fetched once
// by the card that draws it rather than through useSevernData: it changes
// by the day, belongs to no skeleton or freshness line, and until recording
// has begun there is nothing to show - an empty list, which is also what a
// failed fetch gives.
export const useRiskHistory = (): RiskHistoryDay[] => {
  const [days, setDays] = useState<RiskHistoryDay[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/risk-history")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: RiskHistoryResponse | null) => {
        if (!cancelled && Array.isArray(body?.days)) setDays(body.days);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return days;
};
