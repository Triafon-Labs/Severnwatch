import { RainfallForecastPoint, RainfallGaugeData } from "@/types";

// Rough intensity/accumulation bands - not a validated meteorological or
// hydrological standard, just a heuristic to make bursts and sustained rain
// visually legible and to ballpark spill likelihood. Broadly aligned with
// Met Office "moderate"/"heavy" rain intensity, and typical CSO trigger
// behaviour (short heavy bursts and prolonged moderate rain both fill sewer
// capacity).
export const HOURLY_MODERATE_MM = 2; // mm/hr - sustained rain, medium likelihood
export const HOURLY_HEAVY_MM = 8; // mm/hr - thunderstorm-level burst, high likelihood
export const DAILY_MODERATE_MM = 10; // mm/day - a wet day, medium likelihood
export const DAILY_HEAVY_MM = 25; // mm/day - a very wet day, high likelihood

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export interface Bucket {
  label: string;
  sortKey: number;
  [gaugeId: string]: number | string;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const dayStartMs = (iso: string) => {
  const londonDate = new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  });
  return new Date(`${londonDate}T00:00:00Z`).getTime();
};

export const buildDailyTotals = (gauges: RainfallGaugeData[]): Bucket[] => {
  const days = new Map<string, Bucket>();
  for (const gauge of gauges) {
    for (const r of gauge.readings) {
      const key = dayLabel(r.dateTime);
      if (!days.has(key)) {
        days.set(key, { label: key, sortKey: dayStartMs(r.dateTime) });
      }
      const bucket = days.get(key)!;
      const current =
        typeof bucket[gauge.id] === "number" ? (bucket[gauge.id] as number) : 0;
      bucket[gauge.id] = current + r.valueMm;
    }
  }
  return Array.from(days.values())
    .map((b) => {
      const rounded: Bucket = { label: b.label, sortKey: b.sortKey };
      for (const gauge of gauges) {
        if (typeof b[gauge.id] === "number") {
          rounded[gauge.id] = Math.round((b[gauge.id] as number) * 10) / 10;
        }
      }
      return rounded;
    })
    .sort((a, b) => a.sortKey - b.sortKey);
};

// Uses the raw 15-min readings directly rather than re-aggregating to
// daily totals, so a burst lasting even one 15-min tip shows up as a spike
// instead of being smoothed away. windowHours bounds how far back to look.
export const buildHourlyIntensity = (
  gauges: RainfallGaugeData[],
  windowHours: number
): Bucket[] => {
  const cutoff = Date.now() - windowHours * HOUR_MS;
  const points = new Map<string, Bucket>();
  for (const gauge of gauges) {
    for (const r of gauge.readings) {
      const ts = new Date(r.dateTime).getTime();
      if (ts < cutoff) continue;
      if (!points.has(r.dateTime)) {
        points.set(r.dateTime, { label: r.dateTime, sortKey: ts });
      }
      points.get(r.dateTime)![gauge.id] = Math.round(r.valueMm * 4 * 10) / 10; // mm/15min -> mm/hr
    }
  }
  return Array.from(points.values()).sort((a, b) => a.sortKey - b.sortKey);
};

// Catchment-wide average across all gauges' hourly intensity - a single
// series that lines up with the single-location Open-Meteo forecast, which
// has no per-gauge granularity to compare against.
export const buildCatchmentAverageIntensity = (
  gauges: RainfallGaugeData[],
  windowHours: number
): { sortKey: number; valueMm: number }[] => {
  const buckets = buildHourlyIntensity(gauges, windowHours);
  return buckets.map((b) => {
    const values = gauges
      .map((g) => b[g.id])
      .filter((v): v is number => typeof v === "number");
    const avg = values.length
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0;
    return { sortKey: b.sortKey, valueMm: Math.round(avg * 10) / 10 };
  });
};

export interface ForecastRow {
  sortKey: number;
  observedMm?: number;
  forecastMm?: number;
}

// Merges the recent observed (catchment-average) intensity with the
// Open-Meteo forecast into one series, so a single line can be drawn solid
// for the observed segment and dashed for the forecast segment. The last
// observed point is also seeded into forecastMm (if the forecast doesn't
// already have a point at that exact hour) so the dashed line starts
// exactly where the solid one ends, instead of leaving a visual gap.
export const buildForecastSeries = (
  observed: { sortKey: number; valueMm: number }[],
  forecast: RainfallForecastPoint[]
): ForecastRow[] => {
  const rows = new Map<number, ForecastRow>();
  for (const o of observed) {
    rows.set(o.sortKey, { sortKey: o.sortKey, observedMm: o.valueMm });
  }
  for (const f of forecast) {
    const key = new Date(f.dateTime).getTime();
    const row = rows.get(key) ?? { sortKey: key };
    row.forecastMm = f.valueMm;
    rows.set(key, row);
  }

  const sorted = Array.from(rows.values()).sort(
    (a, b) => a.sortKey - b.sortKey
  );
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].observedMm !== undefined) {
      if (sorted[i].forecastMm === undefined)
        sorted[i].forecastMm = sorted[i].observedMm;
      break;
    }
  }
  return sorted;
};

// Total mm a gauge recorded in a past window of `windowMs`, ending
// `offsetMs` ago - e.g. sumRecentMm(gauge, HOUR_MS) is "the last hour",
// sumRecentMm(gauge, HOUR_MS, HOUR_MS) is "the hour before that".
export const sumRecentMm = (
  gauge: RainfallGaugeData,
  windowMs: number,
  offsetMs = 0
): number => {
  const now = Date.now();
  const to = now - offsetMs;
  const from = to - windowMs;
  const total = gauge.readings
    .filter((r) => {
      const t = new Date(r.dateTime).getTime();
      return t > from && t <= to;
    })
    .reduce((sum, r) => sum + r.valueMm, 0);
  return Math.round(total * 10) / 10;
};

export type SpillLikelihood = "Low" | "Medium" | "High";

// Worst-case across the catchment's gauges: a burst at any one station, or
// sustained rain over the full 24h, is enough to raise the likelihood - it
// doesn't need to be all three gauges at once.
export const assessRainfallLikelihood = (
  gauges: RainfallGaugeData[]
): SpillLikelihood => {
  let worst: SpillLikelihood = "Low";
  for (const gauge of gauges) {
    const lastHourMm = sumRecentMm(gauge, HOUR_MS);
    if (lastHourMm >= HOURLY_HEAVY_MM || gauge.last24hTotalMm >= DAILY_HEAVY_MM)
      return "High";
    if (
      lastHourMm >= HOURLY_MODERATE_MM ||
      gauge.last24hTotalMm >= DAILY_MODERATE_MM
    )
      worst = "Medium";
  }
  return worst;
};
