import {
  CsoResponse,
  DayRecord,
  RainfallResponse,
  RiskHistoryDay,
  RiskHistoryMonth,
  RiskSnapshot,
  WaterQualityResponse,
} from "@/types";
import {
  RAIN_RISK_WINDOW_HOURS,
  derivePollutionRisk,
} from "@/lib/pollutionRisk";
import { HOUR_MS, sumRecentMm } from "@/lib/rainfallAnalysis";
import { londonDayKey } from "@/lib/time";

// The app's own history: what it said hour by hour (snapshots), and each
// day's measured rain and spills (day records), so both can be held against
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

// How many days back each recording rewrites. Rain: the gauges' readings
// can arrive most of a day late. Spills: a finished spill stays in the feed
// as Recent, with its start and end, for at least 48 hours.
const DAY_RECORD_LOOKBACK = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;

// Rain and spills for each of the last few London days, as far as the
// responses in hand can say.
export const buildDayRecords = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
  now: number
): Record<string, DayRecord> => {
  const records: Record<string, DayRecord> = {};
  // Noon UTC is the same London calendar day all year, so stepping back a
  // day at a time from it never skips or repeats one over a clock change.
  const todayNoon = Date.parse(`${londonDayKey(now)}T12:00:00Z`);
  for (let i = 0; i < DAY_RECORD_LOOKBACK; i++) {
    const date = londonDayKey(todayNoon - i * 24 * HOUR_MS);
    records[date] = { rainMm: null, spillHours: 0, spillOutfalls: 0 };
  }

  // Each gauge's total for the day, then the mean of the gauges that
  // reported - one figure for the catchment.
  if (rainfall) {
    const totals: Record<string, number[]> = {};
    for (const gauge of rainfall.gauges) {
      const byDay: Record<string, number> = {};
      for (const reading of gauge.readings) {
        const date = londonDayKey(Date.parse(reading.dateTime));
        if (date in records) {
          byDay[date] = (byDay[date] ?? 0) + reading.valueMm;
        }
      }
      for (const [date, mm] of Object.entries(byDay)) {
        (totals[date] ??= []).push(mm);
      }
    }
    for (const [date, perGauge] of Object.entries(totals)) {
      records[date].rainMm = round1(
        perGauge.reduce((sum, mm) => sum + mm, 0) / perGauge.length
      );
    }
  }

  // Every spill the feed still gives times for, split across the days it
  // ran over (15-minute steps: the monitors' own resolution).
  const STEP_MS = 15 * 60 * 1000;
  for (const outfall of cso.outfalls) {
    if (outfall.state !== "Ongoing" && outfall.state !== "Recent") continue;
    if (!outfall.startISO) continue;
    const start = Date.parse(outfall.startISO);
    const end =
      outfall.state === "Ongoing" || !outfall.endISO
        ? now
        : Date.parse(outfall.endISO);
    const touched = new Set<string>();
    for (let t = start; t < end; t += STEP_MS) {
      const date = londonDayKey(t);
      if (!(date in records)) continue;
      records[date].spillHours += Math.min(STEP_MS, end - t) / HOUR_MS;
      touched.add(date);
    }
    for (const date of touched) records[date].spillOutfalls++;
  }
  for (const record of Object.values(records)) {
    record.spillHours = round1(record.spillHours);
  }
  return records;
};

// A day only ever fills in: late rain readings raise its total, and a
// spill's hours grow until it ends. A later recording can also see less -
// an overflow that spills again shows only its newest event - so each
// figure keeps the most that has been seen.
export const mergeDayRecords = (
  existing: Record<string, DayRecord>,
  incoming: Record<string, DayRecord>
): Record<string, DayRecord> => {
  const merged = { ...existing };
  for (const [date, next] of Object.entries(incoming)) {
    const prev = merged[date];
    merged[date] = prev
      ? {
          rainMm:
            prev.rainMm === null || next.rainMm === null
              ? (prev.rainMm ?? next.rainMm)
              : Math.max(prev.rainMm, next.rainMm),
          spillHours: Math.max(prev.spillHours, next.spillHours),
          spillOutfalls: Math.max(prev.spillOutfalls, next.spillOutfalls),
        }
      : next;
  }
  return merged;
};

// A month's file back into its parts. Anything unreadable is treated as
// empty rather than thrown: the recorder must be able to carry on.
export const parseMonth = (text: string | null): RiskHistoryMonth => {
  const empty: RiskHistoryMonth = { snapshots: [], days: {} };
  if (!text) return empty;
  try {
    const parsed = JSON.parse(text) as Partial<RiskHistoryMonth> | null;
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
    };
  } catch {
    return empty;
  }
};

// Months of day records (oldest month first) into the chart's days, oldest
// first. A day can sit in two files - the first days of a month are still
// being filled in when the next begins - and merges the same way.
export const collectDays = (
  months: Record<string, DayRecord>[]
): RiskHistoryDay[] => {
  const all = months.reduce(mergeDayRecords, {});
  return Object.entries(all)
    .map(([date, record]) => ({ date, ...record }))
    .sort((a, b) => a.date.localeCompare(b.date));
};
