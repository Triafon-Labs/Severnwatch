import { RAINFALL_GAUGES } from "@/lib/config";
import { WaterQualitySample } from "@/types";
import { sampleTimeMs } from "@/lib/waterQuality";

// The conditions in the hours before each sample, for the chart that holds
// them against the samples (components/RiskHistoryCard.tsx). Server-only.
//
// - Rain: the same three EA gauges as the Rainfall card, the mean of their
//   totals.
// - River flow: the River Severn at Bewdley, the highest it ran. Bewdley is
//   above every overflow the app tracks, so its flow carries what happened
//   upstream - rain in Shropshire and Wales, the overflows the app leaves
//   out - with the travel time already in it.
//
// From the EA's Hydrology service rather than the flood-monitoring feed:
// the same stations, but with their 15-minute readings kept for years
// rather than weeks. Rain there is current to within hours; flow runs a few
// days behind, so a sample uploaded straight away may get null for it until
// the route's weekly rebuild. The daily totals aren't used - rain's run
// 09:00 to 09:00, and both lag weeks.
//
// Best-effort throughout: a station that fails, or has too many readings
// missing, is left out, and a sample with nothing usable gets null rather
// than a figure that reads as dry or low.

const HYDROLOGY_URL = "https://environment.data.gov.uk/hydrology/id";

// How far back from the sample the rain and flow are looked at.
export const SAMPLE_RAIN_HOURS = 72;

// The River Severn at Bewdley (the flood-monitoring and Hydrology ID).
const FLOW_STATION = "2001";

const QUARTER_HOUR_MS = 15 * 60 * 1000;
const READINGS_EXPECTED = (SAMPLE_RAIN_HOURS * 60) / 15;
// A gauge needs at least this share of its readings in the window to count.
const MIN_COVERAGE = 0.9;

// Past readings don't change, so a window once fetched is kept for a week;
// a rebuild (deploy or upload) then only fetches the newest sample's.
const FETCH_CACHE = { next: { revalidate: 604800 } } as const;

interface HydrologyList<T> {
  items?: T[];
}

// A station's 15-minute measure of rain or flow, found by its station
// reference (the same ID the flood-monitoring feed uses).
const quarterHourMeasure = async (
  stationReference: string,
  observedProperty: "rainfall" | "waterFlow" = "rainfall"
): Promise<string | null> => {
  const response = await fetch(
    `${HYDROLOGY_URL}/measures?station.stationReference=${stationReference}&observedProperty=${observedProperty}`,
    FETCH_CACHE
  );
  if (!response.ok) return null;
  const data: HydrologyList<{ notation: string; period?: number }> =
    await response.json();
  return data.items?.find((m) => m.period === 900)?.notation ?? null;
};

// "2026-11-16" for a UTC instant - the Hydrology service's own date field.
const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// One station's readings over the window ending at `endMs`, combined by
// `combine`, or null if they couldn't be got or too many are missing.
const windowValue = async (
  measure: string,
  endMs: number,
  combine: (values: number[]) => number
): Promise<number | null> => {
  const startMs = endMs - SAMPLE_RAIN_HOURS * 60 * 60 * 1000;
  const response = await fetch(
    `${HYDROLOGY_URL}/measures/${measure}/readings` +
      `?mineq-date=${utcDate(startMs)}&maxeq-date=${utcDate(endMs)}&_limit=2000`,
    FETCH_CACHE
  );
  if (!response.ok) return null;
  const data: HydrologyList<{ dateTime: string; value: number | null }> =
    await response.json();

  const values: number[] = [];
  for (const reading of data.items ?? []) {
    // Times are GMT and carry no zone, so read them as UTC. Each is the
    // start of its 15 minutes; only quarters wholly before the sample count.
    const at = Date.parse(`${reading.dateTime}Z`);
    if (at < startMs || at + QUARTER_HOUR_MS > endMs) continue;
    if (typeof reading.value !== "number" || !Number.isFinite(reading.value))
      continue;
    values.push(reading.value);
  }
  return values.length >= READINGS_EXPECTED * MIN_COVERAGE
    ? combine(values)
    : null;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface SampleConditions {
  rainBeforeMm: Record<string, number | null>;
  flowBeforeM3s: Record<string, number | null>;
}

// For each sample, by ID: the gauges' mean rain, and the highest flow at
// Bewdley, over the SAMPLE_RAIN_HOURS before it. Never throws.
export const loadSampleConditions = async (
  samples: WaterQualitySample[]
): Promise<SampleConditions> => {
  const result: SampleConditions = { rainBeforeMm: {}, flowBeforeM3s: {} };
  try {
    const [gauges, flow] = await Promise.all([
      Promise.all(
        RAINFALL_GAUGES.map((g) => quarterHourMeasure(g.id).catch(() => null))
      ),
      quarterHourMeasure(FLOW_STATION, "waterFlow").catch(() => null),
    ]);
    const rainMeasures = gauges.filter((m): m is string => m !== null);

    // A sample at a time, its stations together: a handful of requests in
    // flight rather than every sample's at once.
    for (const sample of samples) {
      const end = sampleTimeMs(sample);
      const [totals, peak] = await Promise.all([
        Promise.all(
          rainMeasures.map((m) => windowValue(m, end, sum).catch(() => null))
        ),
        flow
          ? windowValue(flow, end, (v) => Math.max(...v)).catch(() => null)
          : null,
      ]);
      const rain = totals.filter((t): t is number => t !== null);
      result.rainBeforeMm[sample.id] =
        rain.length > 0 ? round1(sum(rain) / rain.length) : null;
      result.flowBeforeM3s[sample.id] = peak === null ? null : round1(peak);
    }
  } catch (error) {
    console.error("Error loading conditions before samples:", error);
  }
  return result;
};
