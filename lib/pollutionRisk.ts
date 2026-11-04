import {
  CsoOutfall,
  CsoResponse,
  RainfallResponse,
  WaterQualityResponse,
} from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  SEWAGE_RECENT_SPILL_BASE_HOURS,
  WATER_QUALITY_RECENT_DAYS,
  WATER_QUALITY_RELEVANT_DAYS,
} from "@/lib/config";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import { plumeTravelRangeFor } from "@/lib/catchment";
import {
  HOURLY_HEAVY_MM,
  HOURLY_MODERATE_MM,
  HOUR_MS,
  peakRateMmPerHour,
  sumRecentMm,
} from "@/lib/rainfallAnalysis";
import {
  CLASSIFIED_INDICATORS,
  INDICATORS,
  bandForCount,
  bandForSample,
  formatCount,
  sampleTimeMs,
  worstIndicator,
} from "@/lib/waterQuality";
import {
  formatDaysAgo,
  formatLondonDate,
  londonDaysAgo,
} from "@/lib/londonDate";

// A pollution risk for the reach, derived from two things:
//
// - Where each monitored spill's water is relative to it: on its way down,
//   passing through, or gone by but still inside the 48 h tail
//   (SEWAGE_RECENT_SPILL_BASE_HOURS).
// - Rain falling, or about to fall, on the catchment at the rainfall chart's
//   moderate or heavy intensity. Combined sewers start to overflow within
//   hours of rain like that, usually before the spill feed shows it.
// - The newest citizen science sample, if it's recent and came back
//   elevated or high (see sampleFactor below). It can only raise the risk:
//   a clean sample from days ago says nothing about a spill since.
//
// Even the samples are snapshots days old, so the bottom of the scale is
// "lower", never "safe".
export type PollutionRiskLevel = "high" | "raised" | "lower";

// Labels and colours for each level, shared by the card and the Conditions
// Key so the two can't drift - the same arrangement as CSO_STATE_UI.
export const RISK_LEVEL_UI: Record<
  PollutionRiskLevel,
  { label: string; color: string; onColor: string }
> = {
  high: {
    label: "High Risk",
    color: STATUS_COLORS.red,
    onColor: ON_STATUS_COLORS.red,
  },
  raised: {
    label: "Raised Risk",
    color: STATUS_COLORS.amber,
    onColor: ON_STATUS_COLORS.amber,
  },
  lower: {
    label: "Lower Risk",
    color: STATUS_COLORS.darkGreen,
    onColor: ON_STATUS_COLORS.darkGreen,
  },
};

export type PollutionRiskFactorKey =
  "passing" | "arriving" | "lingering" | "rain" | "sample";

// Split the way the card's tile reads, as Paddlecheck splits its reasons:
// what it's about, the reading, and a line on when or where - "Arriving",
// "1 spill", "Due in ~3h".
export interface PollutionRiskFactor {
  key: PollutionRiskFactorKey;
  level: PollutionRiskLevel;
  label: string;
  value: string;
  detail?: string;
}

export interface PollutionRisk {
  level: PollutionRiskLevel;
  // Worst first; empty when the level is "lower".
  factors: PollutionRiskFactor[];
}

const WAYPOINTS_BY_NAME = new Map(CATCHMENT_WAYPOINTS.map((w) => [w.name, w]));

type PlumePhase = "arriving" | "passing" | "lingering";

// The spill's water starts arriving at the earliest travel time and has
// gone by at the latest, then lingers for the tail. Past that the spill is
// dropped, which matches the sewage route's Recent cutoff - and also covers
// a cached payload being read long after it was fetched, where the route
// never got the chance to retire it.
const plumeTiming = (
  outfall: CsoOutfall,
  now: number
): { phase: PlumePhase; hoursUntil: number } | null => {
  const waypoint = WAYPOINTS_BY_NAME.get(outfall.waypointName);
  if (!waypoint) return null;
  const travel = plumeTravelRangeFor(waypoint, outfall.distanceKm);

  // No start time is treated as already arrived - assuming the water is
  // still upstream is the error that reassures.
  const startMs = outfall.startISO ? Date.parse(outfall.startISO) : -Infinity;
  const endMs =
    outfall.state === "Ongoing" || !outfall.endISO
      ? now
      : Date.parse(outfall.endISO);

  const arrivesAt = startMs + travel.earliest * HOUR_MS;
  const goneBy = endMs + travel.latest * HOUR_MS;
  if (now < arrivesAt) {
    return { phase: "arriving", hoursUntil: (arrivesAt - now) / HOUR_MS };
  }
  if (now <= goneBy) return { phase: "passing", hoursUntil: 0 };
  if (now <= goneBy + SEWAGE_RECENT_SPILL_BASE_HOURS * HOUR_MS) {
    return { phase: "lingering", hoursUntil: 0 };
  }
  return null;
};

// How far ahead the forecast counts as rain "about to fall". Open-Meteo's
// hourly value is the total for the hour ending at its timestamp.
const RAIN_LOOKAHEAD_HOURS = 3;

const intensityLabel = (mmPerHour: number) =>
  mmPerHour >= HOURLY_HEAVY_MM ? "Heavy" : "Moderate";

// Measured rain at any gauge in the last hour, else forecast rain in the
// next few hours, read against the chart's mm/hr bands. The EA's gauges
// report in batches, so the forecast is often the only sight of rain that
// is falling right now.
//
// Heavy goes on the peak 15-minute rate, because a thunderstorm burst that
// overwhelms a sewer in fifteen minutes is diluted to "moderate" once it's
// averaged over the hour. Moderate goes on the hour's total: the gauges
// count in 0.2 mm tips, so a single tip in fifteen minutes is already
// 0.8 mm/hr and the 15-minute rate would call any drizzle moderate.
const rainFactor = (
  rainfall: RainfallResponse,
  now: number
): PollutionRiskFactor | null => {
  for (const gauge of rainfall.gauges) {
    if (peakRateMmPerHour(gauge, HOUR_MS, now) >= HOURLY_HEAVY_MM) {
      return {
        key: "rain",
        level: "raised",
        label: "Rain",
        value: "Heavy",
        detail: `At ${gauge.label}`,
      };
    }
  }
  for (const gauge of rainfall.gauges) {
    if (sumRecentMm(gauge, HOUR_MS, 0, now) >= HOURLY_MODERATE_MM) {
      return {
        key: "rain",
        level: "raised",
        label: "Rain",
        value: "Moderate",
        detail: `At ${gauge.label}`,
      };
    }
  }

  const upcoming = rainfall.forecast
    .map((f) => ({ endsAt: Date.parse(f.dateTime), mm: f.valueMm }))
    .filter(
      (f) =>
        f.endsAt > now &&
        f.endsAt <= now + RAIN_LOOKAHEAD_HOURS * HOUR_MS &&
        f.mm >= HOURLY_MODERATE_MM
    );
  if (upcoming.length === 0) return null;
  const peak = Math.max(...upcoming.map((f) => f.mm));
  const startsIn = (upcoming[0].endsAt - HOUR_MS - now) / HOUR_MS;
  return {
    key: "rain",
    level: "raised",
    label: "Rain",
    value: intensityLabel(peak),
    detail:
      startsIn < 0.5 ? "Forecast now" : `Forecast in ~${Math.round(startsIn)}h`,
  };
};

// The newest sample, while it's recent enough to say something about the
// river now. High counts as High Risk for WATER_QUALITY_RECENT_DAYS, then as
// Raised until WATER_QUALITY_RELEVANT_DAYS; elevated counts as Raised for
// the recent window only. Days are London calendar days, so a sample "a
// week ago" drops out on the same day for everyone.
const sampleFactor = (
  waterQuality: WaterQualityResponse,
  now: number
): PollutionRiskFactor | null => {
  const latest = waterQuality.samples[waterQuality.samples.length - 1];
  if (!latest) return null;
  const band = bandForSample(latest);
  const days = londonDaysAgo(sampleTimeMs(latest), now);
  if (!band || band === "low" || days < 0) return null;

  let level: PollutionRiskLevel | null = null;
  if (band === "high") {
    if (days <= WATER_QUALITY_RECENT_DAYS) level = "high";
    else if (days <= WATER_QUALITY_RELEVANT_DAYS) level = "raised";
  } else if (days <= WATER_QUALITY_RECENT_DAYS) {
    level = "raised";
  }
  if (!level) return null;

  // Every classified indicator over its Excellent limit, worst first - a
  // sample with both E. coli and Enterococci up says so, rather than naming
  // whichever one happened to be further over.
  const worst = worstIndicator(latest);
  const over = CLASSIFIED_INDICATORS.filter((k) => {
    const b = bandForCount(latest[k], INDICATORS[k]);
    return b === "elevated" || b === "high";
  }).sort((a, b) => (a === worst ? -1 : b === worst ? 1 : 0));
  return {
    key: "sample",
    level,
    label: "Latest Sample",
    value: over
      .map((k) => `${INDICATORS[k].shortLabel} ${formatCount(latest[k])}`)
      .join(" · "),
    detail: `${formatLondonDate(sampleTimeMs(latest))} · ${formatDaysAgo(days)}`,
  };
};

const LEVEL_RANK: Record<PollutionRiskLevel, number> = {
  high: 2,
  raised: 1,
  lower: 0,
};

const spills = (n: number) => (n === 1 ? "1 spill" : `${n} spills`);

export const derivePollutionRisk = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
  waterQuality: WaterQualityResponse | null = null,
  now: number = Date.now()
): PollutionRisk => {
  let passing = 0;
  let lingering = 0;
  let arriving = 0;
  let soonest = Infinity;

  for (const outfall of cso.outfalls) {
    if (outfall.state !== "Ongoing" && outfall.state !== "Recent") continue;
    const timing = plumeTiming(outfall, now);
    if (!timing) continue;
    if (timing.phase === "passing") passing++;
    else if (timing.phase === "lingering") lingering++;
    else {
      arriving++;
      soonest = Math.min(soonest, timing.hoursUntil);
    }
  }

  const factors: PollutionRiskFactor[] = [];
  if (passing > 0) {
    factors.push({
      key: "passing",
      level: "high",
      label: "Passing Worcester",
      value: spills(passing),
    });
  }
  if (arriving > 0) {
    factors.push({
      key: "arriving",
      level: "raised",
      label: "Arriving",
      value: spills(arriving),
      detail: `Due in ~${Math.max(1, Math.round(soonest))}h`,
    });
  }
  if (lingering > 0) {
    factors.push({
      key: "lingering",
      level: "raised",
      label: "Passed By",
      value: spills(lingering),
      detail: `In the last ${SEWAGE_RECENT_SPILL_BASE_HOURS}h`,
    });
  }

  const rain = rainfall ? rainFactor(rainfall, now) : null;
  if (rain) factors.push(rain);

  const sample = waterQuality ? sampleFactor(waterQuality, now) : null;
  if (sample) factors.push(sample);

  // Worst first. The spill factors above are pushed in severity order, but
  // a sample can be High after a Raised spill, so sort rather than rely on
  // push order. Array sort is stable, so equal levels keep their order.
  factors.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);

  return { level: factors[0]?.level ?? "lower", factors };
};
