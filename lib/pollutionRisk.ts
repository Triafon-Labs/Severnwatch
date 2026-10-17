import { CsoOutfall, CsoResponse, RainfallResponse } from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  SEWAGE_RECENT_SPILL_BASE_HOURS,
} from "@/lib/config";
import { plumeTravelHoursFor } from "@/lib/catchment";
import {
  HOURLY_HEAVY_MM,
  HOURLY_MODERATE_MM,
  HOUR_MS,
  peakRateMmPerHour,
} from "@/lib/rainfallAnalysis";

// A pollution risk for the reach, derived from two things:
//
// - Where each monitored spill's water is relative to it: on its way down,
//   passing through, or gone by but still inside the 48 h tail
//   (SEWAGE_RECENT_SPILL_BASE_HOURS).
// - Rain falling, or about to fall, on the catchment at the rainfall chart's
//   moderate or heavy intensity. Combined sewers start to overflow within
//   hours of rain like that, usually before the spill feed shows it.
//
// Nothing here measures bacteria, so the bottom of the scale is "lower",
// never "safe".
export type PollutionRiskLevel = "high" | "raised" | "lower";

export interface PollutionRiskFactor {
  key: string;
  level: PollutionRiskLevel;
  label: string;
}

export interface PollutionRisk {
  level: PollutionRiskLevel;
  // Worst first; empty when the level is "lower".
  factors: PollutionRiskFactor[];
}

const WAYPOINTS_BY_NAME = new Map(CATCHMENT_WAYPOINTS.map((w) => [w.name, w]));

type PlumePhase = "arriving" | "passing" | "lingering";

// Mirrors the sewage route's Recent window, so a spill drops out of here at
// the same moment it stops being Recent.
const plumeTiming = (
  outfall: CsoOutfall,
  now: number
): { phase: PlumePhase; hoursUntil: number } | null => {
  const waypoint = WAYPOINTS_BY_NAME.get(outfall.waypointName);
  if (!waypoint) return null;
  const travelMs = plumeTravelHoursFor(waypoint, outfall.distanceKm) * HOUR_MS;

  // No start time is treated as already arrived - assuming the water is
  // still upstream is the error that reassures.
  const startMs = outfall.startISO ? Date.parse(outfall.startISO) : -Infinity;
  const endMs =
    outfall.state === "Ongoing" || !outfall.endISO
      ? now
      : Date.parse(outfall.endISO);

  const arrivesAt = startMs + travelMs;
  if (now < arrivesAt) {
    return { phase: "arriving", hoursUntil: (arrivesAt - now) / HOUR_MS };
  }
  if (now <= endMs + travelMs) return { phase: "passing", hoursUntil: 0 };
  return { phase: "lingering", hoursUntil: 0 };
};

// How far ahead the forecast counts as rain "about to fall". Open-Meteo's
// hourly value is the total for the hour ending at its timestamp.
const RAIN_LOOKAHEAD_HOURS = 3;

const intensityLabel = (mmPerHour: number) =>
  mmPerHour >= HOURLY_HEAVY_MM ? "Heavy rain" : "Moderate rain";

// The peak 15-minute rate any gauge measured in the last hour, else forecast
// rain in the next few hours - both read against the chart's mm/hr bands.
// The peak rather than the hour's total, because a thunderstorm burst that
// overwhelms a sewer in fifteen minutes is diluted to "moderate" or less
// once it's averaged over the hour. The EA's
// gauges report in batches, so the forecast is often the only sight of rain
// that is falling right now.
const rainFactor = (
  rainfall: RainfallResponse,
  now: number
): PollutionRiskFactor | null => {
  const measured = rainfall.gauges
    .map((gauge) => ({ gauge, mm: peakRateMmPerHour(gauge, HOUR_MS, now) }))
    .reduce<{ gauge: { label: string }; mm: number } | null>(
      (a, b) => (a === null || b.mm > a.mm ? b : a),
      null
    );
  if (measured && measured.mm >= HOURLY_MODERATE_MM) {
    return {
      key: "rain",
      level: "raised",
      label: `${intensityLabel(measured.mm)} at ${measured.gauge.label}`,
    };
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
    label:
      startsIn < 0.5
        ? `${intensityLabel(peak)} forecast now`
        : `${intensityLabel(peak)} due in ~${Math.round(startsIn)}h`,
  };
};

const spills = (n: number) => (n === 1 ? "Spill" : `${n} spills`);

export const derivePollutionRisk = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
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
      label: `${spills(passing)} passing Worcester`,
    });
  }
  if (arriving > 0) {
    factors.push({
      key: "arriving",
      level: "raised",
      label: `${spills(arriving)} due in ~${Math.max(1, Math.round(soonest))}h`,
    });
  }
  if (lingering > 0) {
    factors.push({
      key: "lingering",
      level: "raised",
      label: `${spills(lingering)} passed in last ${SEWAGE_RECENT_SPILL_BASE_HOURS}h`,
    });
  }

  const rain = rainfall ? rainFactor(rainfall, now) : null;
  if (rain) factors.push(rain);

  return { level: factors[0]?.level ?? "lower", factors };
};
