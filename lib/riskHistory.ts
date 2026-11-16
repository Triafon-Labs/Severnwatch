import {
  CsoResponse,
  RainfallResponse,
  RiskHistoryDay,
  RiskLevel,
  RiskSnapshot,
  WaterQualityResponse,
} from "@/types";
import {
  RAIN_RISK_WINDOW_HOURS,
  derivePollutionRisk,
} from "@/lib/pollutionRisk";
import { HOUR_MS, sumRecentMm } from "@/lib/rainfallAnalysis";
import { londonDayKey } from "@/lib/time";

// The record of what the app said, hour by hour, so it can be held against
// the water samples later. Pure: the store is lib/riskHistoryStore.ts and
// the routes are app/api/risk-history.

// One snapshot from the same three responses the cards are drawn from, so
// it records what a visitor saw at that moment, not a second opinion.
export const buildSnapshot = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
  waterQuality: WaterQualityResponse | null,
  flowBewdley: number | null,
  now: number
): RiskSnapshot => {
  const shown = derivePollutionRisk(cso, rainfall, waterQuality, now);
  const model = derivePollutionRisk(cso, rainfall, null, now);
  const factor = (key: string) => model.factors.find((f) => f.key === key);
  const here = factor("here");
  const recent = factor("recent");

  const wettest = rainfall
    ? Math.max(
        0,
        ...rainfall.gauges.map((gauge) =>
          sumRecentMm(gauge, RAIN_RISK_WINDOW_HOURS * HOUR_MS, 0, now)
        )
      )
    : null;

  return {
    at: new Date(now).toISOString(),
    level: shown.level,
    modelLevel: model.level,
    spillsInReach: here?.count ?? 0,
    recentSpills: recent?.count ?? 0,
    spillMinutes: Math.round(
      (here?.spillMinutes ?? 0) + (recent?.spillMinutes ?? 0)
    ),
    offlineInReach: factor("offline")?.count ?? 0,
    rainRisk: Boolean(factor("rain")),
    rainMm6h: wettest === null ? null : Math.round(wettest * 10) / 10,
    flowBewdley,
  };
};

// The hour a snapshot belongs to, "2026-11-16T15" - one is kept per hour.
export const hourKey = (iso: string): string => iso.slice(0, 13);

// A month's file back into snapshots. Anything unreadable is treated as
// empty rather than thrown: the recorder must be able to carry on.
export const parseSnapshots = (text: string | null): RiskSnapshot[] => {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as RiskSnapshot[]) : [];
  } catch {
    return [];
  }
};

const RANK: Record<RiskLevel, number> = { low: 0, raised: 1, high: 2 };

// Snapshots into London calendar days, oldest first, for the chart.
export const summariseDays = (snapshots: RiskSnapshot[]): RiskHistoryDay[] => {
  const days = new Map<string, RiskHistoryDay>();
  for (const s of snapshots) {
    const ms = Date.parse(s.at);
    if (!Number.isFinite(ms) || !(s.modelLevel in RANK)) continue;
    const date = londonDayKey(ms);
    const day = days.get(date) ?? {
      date,
      worst: "low" as RiskLevel,
      counts: { low: 0, raised: 0, high: 0 },
    };
    day.counts[s.modelLevel]++;
    if (RANK[s.modelLevel] > RANK[day.worst]) day.worst = s.modelLevel;
    days.set(date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
};
