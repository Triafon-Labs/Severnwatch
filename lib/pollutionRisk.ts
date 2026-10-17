import { CsoOutfall, CsoResponse } from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  SEWAGE_RECENT_SPILL_BASE_HOURS,
} from "@/lib/config";
import { plumeTravelHoursFor } from "@/lib/catchment";
import { HOUR_MS } from "@/lib/rainfallAnalysis";

// A pollution risk for the reach, derived from where each monitored spill's
// water is relative to it: on its way down, passing through, or gone by but
// still inside the 48 h tail (SEWAGE_RECENT_SPILL_BASE_HOURS).
//
// Built only from the spill feed and the travel times in lib/config.ts.
// Rainfall is deliberately left out: there is no published UK threshold for
// how much rain fouls a river (the EA's pollution risk forecasts are
// calibrated per bathing water), so any cut-off here would be invented.
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

const spills = (n: number) => (n === 1 ? "Spill" : `${n} spills`);

export const derivePollutionRisk = (
  cso: CsoResponse,
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

  return { level: factors[0]?.level ?? "lower", factors };
};
