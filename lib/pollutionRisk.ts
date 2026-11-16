import {
  CsoOutfall,
  CsoResponse,
  RainfallResponse,
  WaterQualityResponse,
} from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  WATER_QUALITY_RECENT_DAYS,
  WATER_QUALITY_RELEVANT_DAYS,
} from "@/lib/config";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import { plumeTravelRangeFor, recentCutoffHours } from "@/lib/catchment";
import {
  HOURLY_HEAVY_MM,
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
import { formatDaysAgo, formatLondonDate, londonDaysAgo } from "@/lib/time";

// A pollution risk for the reach, derived from:
//
// - Where each monitored spill's water is relative to it: on its way down,
//   passing through, or gone by but still inside the 48 h tail
//   (SEWAGE_RECENT_SPILL_BASE_HOURS).
// - Rain falling, or about to fall, on the catchment in enough quantity to
//   set overflows off - see rainFactor for the thresholds and why.
// - The newest citizen science sample, if it's recent and came back
//   elevated or high (see sampleFactor below). It can only raise the risk:
//   a clean sample from days ago says nothing about a spill since.
//
// A monitor in the Worcester reach that is offline changes no level - it's
// an absence of information, not evidence - but it is listed as a factor,
// so a Low reached with a blind spot in the reach doesn't read as a clean
// one (the same reasoning as CSO_STATE_ORDER putting Offline above "Not
// discharging").
//
// Even the samples are snapshots days old, so the bottom of the scale is
// "low", never "safe" - and the disclaimer says so.
//
// High is reserved for what was observed rather than estimated: an outfall
// in the Worcester reach (Bevere to Diglis) discharging right now - no
// travel time to guess, the water is already where people are - or a Poor
// sample in the last WATER_QUALITY_RECENT_DAYS. Anything that leans on the
// travel-time model - upstream water passing, arriving, or gone by - tops
// out at Raised, however many spills there are. That keeps red meaning
// "this is happening here" rather than "the model thinks so", so it doesn't
// sit on the card for most of a wet winter.
export type PollutionRiskLevel = "high" | "raised" | "low";

// Labels and colours for each level, shared by the card and the Conditions
// Key so the two can't drift - the same arrangement as CSO_STATE_UI.
export const RISK_LEVEL_UI: Record<
  PollutionRiskLevel,
  {
    label: string;
    // The saturated status hue - the Conditions Key's dots and the scale
    // strip under the hero.
    color: string;
    onColor: string;
    // The palette role whose M3 container pair paints the hero, so the
    // headline reads as a tonal panel rather than a slab of saturated red.
    tonal: "error" | "warning" | "success";
  }
> = {
  high: {
    label: "High Risk",
    color: STATUS_COLORS.red,
    onColor: ON_STATUS_COLORS.red,
    tonal: "error",
  },
  raised: {
    label: "Raised Risk",
    color: STATUS_COLORS.amber,
    onColor: ON_STATUS_COLORS.amber,
    tonal: "warning",
  },
  low: {
    label: "Low Risk",
    color: STATUS_COLORS.darkGreen,
    onColor: ON_STATUS_COLORS.darkGreen,
    tonal: "success",
  },
};

export type PollutionRiskFactorKey =
  "here" | "recent" | "rain" | "sample" | "offline";

// Split the way the card's tile reads, as Paddlecheck splits its reasons:
// what it's about, the reading, and a line on when or where - "Arriving",
// "1 spill", "Due in ~3h".
export interface PollutionRiskFactor {
  key: PollutionRiskFactorKey;
  level: PollutionRiskLevel;
  label: string;
  value: string;
  detail?: string;
  // Spill factors only: how long those overflows spilled for in total (so
  // far, for ones still going), where the feed gives the times. A count
  // alone puts a ten-minute spill level with a ten-hour one.
  spillMinutes?: number;
}

export interface PollutionRisk {
  level: PollutionRiskLevel;
  // Worst first. At "low" the only factor there can be is offline monitors.
  factors: PollutionRiskFactor[];
}

const WAYPOINTS_BY_NAME = new Map(CATCHMENT_WAYPOINTS.map((w) => [w.name, w]));

type PlumePhase = "arriving" | "passing" | "lingering";

// The spill's water starts arriving at the earliest travel time and has
// gone by at the latest, then lingers for the 48 h tail. Past that the
// spill is dropped - the same recentCutoffHours the sewage route
// retires Recent with, which also covers a cached payload being read long
// after it was fetched, where the route never got the chance to retire it.
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
  const dropAt =
    endMs + recentCutoffHours(waypoint, outfall.distanceKm) * HOUR_MS;
  if (now < arrivesAt) {
    return { phase: "arriving", hoursUntil: (arrivesAt - now) / HOUR_MS };
  }
  if (now <= goneBy) return { phase: "passing", hoursUntil: 0 };
  if (now <= dropAt) return { phase: "lingering", hoursUntil: 0 };
  return null;
};

// Where one outfall's spill is relative to the reach. Null when it isn't spilling and hasn't lately, or
// its water has gone by and the 48 h tail has run out.
export type SpillPhase = "here" | PlumePhase;

export const spillPhase = (
  outfall: CsoOutfall,
  now: number
): { phase: SpillPhase; hoursUntil: number } | null => {
  if (outfall.state !== "Ongoing" && outfall.state !== "Recent") return null;
  // Discharging inside the reach: observed, not estimated, so it's the one
  // spill case that makes the risk High (see the header comment).
  if (
    outfall.state === "Ongoing" &&
    WAYPOINTS_BY_NAME.get(outfall.waypointName)?.isReach
  ) {
    return { phase: "here", hoursUntil: 0 };
  }
  return plumeTiming(outfall, now);
};

// When rain counts towards the risk. Rain is only a leading indicator here:
// once overflows spill, the feed shows it directly. So the bar is rain that
// plausibly sets them off, not any rain at all.
//
// It used to be 0.5 mm/hr in a single hour - the bottom of the "moderate"
// band, i.e. steady drizzle - which fires on a large share of UK winter days
// and rarely means an overflow. There's no national figure for when CSOs
// spill (it depends on the sewer and how wet the ground already is), so the
// numbers below were checked against this catchment instead. On 15 Nov 2026
// the first wave of spills (Worcester, Droitwich, Holt Fleet, Hartlebury)
// started at 12:25-13:05, after 4-8 mm had fallen in the previous 2-3 hours
// at rates of 2-4.5 mm/hr; the Kidderminster ones followed at ~15:15 with
// 8-10 mm down. Replaying that day's gauges, these rules first fire at
// 11:30 (a 1.6 mm quarter-hour at Worcester/Droitwich - a heavy burst),
// about an hour before the first spill, then hold on the 6-hour total; the
// old rule had fired from 10:00 on 0.8 mm an hour.
//
// - A total of RAIN_RISK_TOTAL_MM or more over RAIN_RISK_WINDOW_HOURS,
//   measured at any gauge or forecast for the hours ahead.
// - Or a heavy burst: HOURLY_HEAVY_MM (the Met Office's 4 mm/hr) or more,
//   on the peak 15-minute rate for a gauge (a thunderstorm can overwhelm a
//   sewer in fifteen minutes and be averaged away over the hour) or in any
//   forecast hour.
export const RAIN_RISK_TOTAL_MM = 5;
export const RAIN_RISK_WINDOW_HOURS = 6;

const formatMm = (mm: number) => `${Math.round(mm * 10) / 10} mm`;

// Measured rain first, else the forecast. The EA's gauges report in
// batches, so the forecast is often the only sight of rain falling now.
const rainFactor = (
  rainfall: RainfallResponse,
  now: number
): PollutionRiskFactor | null => {
  const windowMs = RAIN_RISK_WINDOW_HOURS * HOUR_MS;
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
  const wettest = rainfall.gauges
    .map((gauge) => ({ gauge, mm: sumRecentMm(gauge, windowMs, 0, now) }))
    .sort((a, b) => b.mm - a.mm)[0];
  if (wettest && wettest.mm >= RAIN_RISK_TOTAL_MM) {
    return {
      key: "rain",
      level: "raised",
      label: "Rain",
      value: formatMm(wettest.mm),
      detail: `Last ${RAIN_RISK_WINDOW_HOURS}h at ${wettest.gauge.label}`,
    };
  }

  // Open-Meteo's hourly value is the total for the hour ending at its
  // timestamp.
  const ahead = rainfall.forecast
    .map((f) => ({ endsAt: Date.parse(f.dateTime), mm: f.valueMm }))
    .filter((f) => f.endsAt > now && f.endsAt <= now + windowMs);
  const heavyHour = ahead.find((f) => f.mm >= HOURLY_HEAVY_MM);
  if (heavyHour) {
    const startsIn = (heavyHour.endsAt - HOUR_MS - now) / HOUR_MS;
    return {
      key: "rain",
      level: "raised",
      label: "Rain",
      value: "Heavy",
      detail:
        startsIn < 0.5
          ? "Forecast now"
          : `Forecast in ~${Math.round(startsIn)}h`,
    };
  }
  const forecastMm = ahead.reduce((sum, f) => sum + f.mm, 0);
  if (forecastMm >= RAIN_RISK_TOTAL_MM) {
    return {
      key: "rain",
      level: "raised",
      label: "Rain",
      value: formatMm(forecastMm),
      detail: `Forecast next ${RAIN_RISK_WINDOW_HOURS}h`,
    };
  }
  return null;
};

// The newest sample, while it's recent enough to say something about the
// river now. A Poor sample (over the Good limit) counts as High Risk for
// WATER_QUALITY_RECENT_DAYS, then as Raised until WATER_QUALITY_RELEVANT_DAYS.
// Excellent and Good samples add nothing: a sample within the Good limit
// raising the risk would contradict its own chip. Days are London calendar
// days, so a sample "a week ago" drops out on the same day for everyone.
const sampleFactor = (
  waterQuality: WaterQualityResponse,
  now: number
): PollutionRiskFactor | null => {
  const latest = waterQuality.samples[waterQuality.samples.length - 1];
  if (!latest) return null;
  const band = bandForSample(latest);
  const days = londonDaysAgo(sampleTimeMs(latest), now);
  if (band !== "poor" || days < 0) return null;

  const level: PollutionRiskLevel | null =
    days <= WATER_QUALITY_RECENT_DAYS
      ? "high"
      : days <= WATER_QUALITY_RELEVANT_DAYS
        ? "raised"
        : null;
  if (!level) return null;

  // Every classified indicator over its Good limit, worst first - a sample
  // with both E. coli and Enterococci over says so, rather than naming
  // whichever one happened to be further over.
  const worst = worstIndicator(latest);
  const over = CLASSIFIED_INDICATORS.filter(
    (k) => bandForCount(latest[k], INDICATORS[k]) === "poor"
  ).sort((a, b) => (a === worst ? -1 : b === worst ? 1 : 0));
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
  low: 0,
};

const spills = (n: number) => (n === 1 ? "1 spill" : `${n} spills`);

// How long an outfall's spill has run: to now if it's still going, else to
// its end. Zero when the feed gives no start.
const spillMinutes = (outfall: CsoOutfall, now: number): number => {
  if (!outfall.startISO) return 0;
  const end =
    outfall.state === "Ongoing" || !outfall.endISO
      ? now
      : Date.parse(outfall.endISO);
  return Math.max(0, (end - Date.parse(outfall.startISO)) / 60000);
};

// "40 min" / "13h" - a total across several spills, so to the hour is as
// fine as it's worth reading.
export const formatSpillTime = (minutes: number): string =>
  minutes < 60
    ? `${Math.max(1, Math.round(minutes))} min`
    : `${Math.round(minutes / 60)}h`;

export const derivePollutionRisk = (
  cso: CsoResponse,
  rainfall: RainfallResponse | null,
  waterQuality: WaterQualityResponse | null = null,
  now: number = Date.now()
): PollutionRisk => {
  let here = 0;
  let passing = 0;
  let lingering = 0;
  let arriving = 0;
  let offline = 0;
  // Total spill time behind each count above, from the outfalls whose
  // times the feed gives.
  const minutes = { here: 0, passing: 0, lingering: 0, arriving: 0 };

  for (const outfall of cso.outfalls) {
    const waypoint = WAYPOINTS_BY_NAME.get(outfall.waypointName);
    if (outfall.state === "Offline" && waypoint?.isReach) offline++;
    const where = spillPhase(outfall, now);
    if (!where) continue;
    const spilled = spillMinutes(outfall, now);
    if (where.phase === "here") {
      here++;
      minutes.here += spilled;
    } else if (where.phase === "passing") {
      passing++;
      minutes.passing += spilled;
    } else if (where.phase === "lingering") {
      lingering++;
      minutes.lingering += spilled;
    } else {
      arriving++;
      minutes.arriving += spilled;
    }
  }

  const factors: PollutionRiskFactor[] = [];
  if (here > 0) {
    factors.push({
      key: "here",
      level: "high",
      label: "In Worcester",
      value: spills(here),
      detail: "Discharging now",
      spillMinutes: minutes.here || undefined,
    });
  }
  // One tile for every other spill still counted - upstream, or finished
  // in the reach - whichever way the
  // travel-time model places its water. The phases decide when a spill
  // starts and stops counting; shown as separate "arriving / passing /
  // passed" tiles they claimed to know which spill's water was where, which
  // is more than the model can say.
  const recent = passing + arriving + lingering;
  if (recent > 0) {
    factors.push({
      key: "recent",
      level: "raised",
      label: "Recent Spills",
      value: spills(recent),
      detail: "May still affect Worcester",
      spillMinutes:
        minutes.passing + minutes.arriving + minutes.lingering || undefined,
    });
  }

  const rain = rainfall ? rainFactor(rainfall, now) : null;
  if (rain) factors.push(rain);

  const sample = waterQuality ? sampleFactor(waterQuality, now) : null;
  if (sample) factors.push(sample);

  if (offline > 0) {
    factors.push({
      key: "offline",
      level: "low",
      label: "Offline",
      value: offline === 1 ? "1 monitor" : `${offline} monitors`,
      detail: "In Worcester, so spills there can't be seen",
    });
  }

  // Worst first. The spill factors above are pushed in severity order, but
  // a sample can be High after a Raised spill, so sort rather than rely on
  // push order. Array sort is stable, so equal levels keep their order.
  factors.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);

  return { level: factors[0]?.level ?? "low", factors };
};
