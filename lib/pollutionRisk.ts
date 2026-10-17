import { CsoOutfall, CsoResponse, RainfallResponse } from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  SEWAGE_RECENT_SPILL_BASE_HOURS,
} from "@/lib/config";
import { plumeTravelHoursFor } from "@/lib/catchment";
import {
  DAILY_MODERATE_MM,
  HOUR_MS,
  calculateForecast24hTotal,
  sumRecentMm,
} from "@/lib/rainfallAnalysis";

// A derived pollution risk for the reach, worked out from what the app
// already ingests: which overflows have spilled, when their water is due
// past Worcester, and how much rain has fallen on the catchment.
//
// This is a stand-in for a water test, not a reading of one. Nothing here
// measures bacteria - the citizen science results live in the SAS map, and
// there is no feed for them. It is the same shape of reasoning the EA's own
// bathing water pollution risk forecasts use (rainfall plus overflow
// activity), but done crudely and uncalibrated, so the lowest level is
// "lower", never "safe": the designated Severn bathing waters upstream at
// Shrewsbury and Ironbridge are both classed Poor on their tested samples,
// and a quiet day here is no evidence of anything better.
export type PollutionRiskLevel = "high" | "raised" | "lower";

export interface PollutionRiskReason {
  level: PollutionRiskLevel;
  text: string;
}

export interface PollutionRisk {
  level: PollutionRiskLevel;
  // Why the level is what it is, worst first. Each one carries the level it
  // would put the reach at on its own.
  reasons: PollutionRiskReason[];
  // Context that doesn't move the level - offline monitors, rain on the way,
  // gauges that have gone quiet - but would change how far to trust it.
  caveats: string[];
}

const LEVEL_ORDER: PollutionRiskLevel[] = ["high", "raised", "lower"];

// Rain over this in the trailing window lifts the risk on its own, spills or
// no spills: runoff off fields and roads carries faecal bacteria too, and
// not every overflow in the corridor is monitored. The 48 h window matches
// the spill tail and the usual "48 hours after heavy rain" swimming advice;
// the threshold is the Met Office's wet-day line.
export const RISK_RAIN_WINDOW_HOURS = 48;
export const RISK_RAIN_THRESHOLD_MM = DAILY_MODERATE_MM;

// Forecast rain worth warning about before it falls.
const FORECAST_RAIN_THRESHOLD_MM = DAILY_MODERATE_MM;

// The EA's gauges report in batches, often only once or twice a day (see the
// rainfall card's "As of" caption), so the trailing sum can be missing the
// last few hours of rain. Past this, say so.
const GAUGE_QUIET_HOURS = 6;

const WAYPOINTS_BY_NAME = new Map(CATCHMENT_WAYPOINTS.map((w) => [w.name, w]));

const hoursText = (hours: number) => {
  const rounded = Math.max(1, Math.round(hours));
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
};

const countText = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

type PlumePhase = "arriving" | "passing" | "lingering";

interface PlumeTiming {
  phase: PlumePhase;
  // Hours until the water arrives, for the "arriving" phase.
  hoursUntil: number;
}

// Where a spill's water is relative to the reach right now: still on its way
// down, flowing past, or gone by but inside the tail where bacteria from it
// can still be in the water. Mirrors the sewage route's Recent window, so a
// spill drops out of here at the same moment it stops being Recent.
const plumeTiming = (outfall: CsoOutfall, now: number): PlumeTiming | null => {
  const waypoint = WAYPOINTS_BY_NAME.get(outfall.waypointName);
  if (!waypoint) return null;
  const travelMs = plumeTravelHoursFor(waypoint, outfall.distanceKm) * HOUR_MS;

  // A spill with no start time is treated as having started long enough ago
  // to have arrived - assuming its water is still upstream is the error
  // that reassures.
  const startMs = outfall.startISO ? Date.parse(outfall.startISO) : -Infinity;
  const endMs =
    outfall.state === "Ongoing" || !outfall.endISO
      ? now
      : Date.parse(outfall.endISO);

  const arrivesAt = startMs + travelMs;
  const passedBy = endMs + travelMs;

  if (now < arrivesAt) {
    return { phase: "arriving", hoursUntil: (arrivesAt - now) / HOUR_MS };
  }
  if (now <= passedBy) return { phase: "passing", hoursUntil: 0 };
  return { phase: "lingering", hoursUntil: 0 };
};

const spillReasons = (
  outfalls: CsoOutfall[],
  now: number
): PollutionRiskReason[] => {
  const passing: CsoOutfall[] = [];
  const lingering: CsoOutfall[] = [];
  let arriving = 0;
  let soonestArrival = Infinity;

  for (const outfall of outfalls) {
    if (outfall.state !== "Ongoing" && outfall.state !== "Recent") continue;
    const timing = plumeTiming(outfall, now);
    if (!timing) continue;
    if (timing.phase === "passing") passing.push(outfall);
    else if (timing.phase === "lingering") lingering.push(outfall);
    else {
      arriving++;
      soonestArrival = Math.min(soonestArrival, timing.hoursUntil);
    }
  }

  const reasons: PollutionRiskReason[] = [];
  if (passing.length > 0) {
    const live = passing.filter((o) => o.state === "Ongoing").length;
    reasons.push({
      level: "high",
      text:
        live > 0
          ? `Sewage from ${countText(passing.length, "overflow")} is likely in the water at Worcester now${
              passing.length === 1
                ? ", and it's still discharging"
                : ` - ${live} still discharging`
            }.`
          : `Sewage from ${countText(passing.length, "overflow")} that spilled recently is likely still passing through Worcester.`,
    });
  }
  if (arriving > 0) {
    reasons.push({
      level: "raised",
      text:
        arriving === 1
          ? `A spill upstream is on its way down - due at Worcester in about ${hoursText(soonestArrival)}.`
          : `Spills from ${arriving} overflows upstream are on their way down - the first due in about ${hoursText(soonestArrival)}.`,
    });
  }
  if (lingering.length > 0) {
    reasons.push({
      level: "raised",
      text: `Spill water from ${countText(lingering.length, "overflow")} went past within the last ${SEWAGE_RECENT_SPILL_BASE_HOURS} hours - bacteria from it can linger.`,
    });
  }
  return reasons;
};

export const derivePollutionRisk = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
  now: number = Date.now()
): PollutionRisk => {
  const reasons = spillReasons(cso.outfalls, now);
  const caveats: string[] = [];
  const haveRainfall = rainfall !== null && rainfall.gauges.length > 0;

  if (haveRainfall) {
    const wettest = rainfall.gauges
      .map((gauge) => ({
        gauge,
        mm: sumRecentMm(gauge, RISK_RAIN_WINDOW_HOURS * HOUR_MS, 0, now),
      }))
      .reduce((a, b) => (b.mm > a.mm ? b : a));

    if (wettest.mm >= RISK_RAIN_THRESHOLD_MM) {
      reasons.push({
        level: "raised",
        text: `${wettest.mm} mm of rain at ${wettest.gauge.label} in the last ${RISK_RAIN_WINDOW_HOURS} hours - runoff and unmonitored outfalls carry pollution too.`,
      });
    }

    const newestReadingMs = Math.max(
      ...rainfall.gauges.flatMap((g) =>
        g.readings.map((r) => Date.parse(r.dateTime))
      )
    );
    if (
      Number.isFinite(newestReadingMs) &&
      now - newestReadingMs > GAUGE_QUIET_HOURS * HOUR_MS
    ) {
      caveats.push(
        `The rain gauges last reported ${hoursText((now - newestReadingMs) / HOUR_MS)} ago, so any rain since then isn't counted yet.`
      );
    }

    const forecastMm = calculateForecast24hTotal(rainfall.forecast);
    if (forecastMm !== null && forecastMm >= FORECAST_RAIN_THRESHOLD_MM) {
      caveats.push(
        `${forecastMm} mm of rain is forecast in the next 24 hours, which is likely to raise the risk.`
      );
    }
  } else {
    caveats.push(
      "Rainfall data didn't load, so this is based on sewage spills alone."
    );
  }

  const offline = cso.outfalls.filter((o) => o.state === "Offline").length;
  if (offline > 0) {
    caveats.push(
      `${countText(offline, "monitor")} offline - a spill there wouldn't show up here.`
    );
  }

  reasons.sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  );
  const level = reasons[0]?.level ?? "lower";

  if (reasons.length === 0) {
    reasons.push({
      level: "lower",
      text: haveRainfall
        ? `No monitored spills affecting Worcester, and under ${RISK_RAIN_THRESHOLD_MM} mm of rain in the last ${RISK_RAIN_WINDOW_HOURS} hours.`
        : "No monitored spills affecting Worcester.",
    });
  }

  return { level, reasons, caveats };
};
