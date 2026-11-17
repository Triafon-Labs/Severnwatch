import { RAINFALL_GAUGES } from "@/lib/config";
import { WaterQualitySample } from "@/types";
import { sampleTimeMs } from "@/lib/waterQuality";

// The rain that fell in the hours before each sample, from the same three
// EA gauges as the Rainfall card, for the Rain vs Water Quality chart.
// Server-only.
//
// From the EA's Hydrology service rather than the flood-monitoring feed the
// Rainfall card uses: the same gauges, but with their 15-minute readings
// kept for years rather than weeks, and current to within hours. Its daily
// totals run 09:00 to 09:00 and lag weeks behind, so they aren't used.
//
// Best-effort throughout: a gauge that fails, or has too many readings
// missing, is left out of that sample's mean, and a sample with no usable
// gauge gets null rather than a figure that reads as dry.

const HYDROLOGY_URL = "https://environment.data.gov.uk/hydrology/id";

// How far back from the sample the rain is counted.
export const SAMPLE_RAIN_HOURS = 72;

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

// A gauge's 15-minute rainfall measure, found by its station reference
// (the same ID the flood-monitoring feed uses).
const quarterHourMeasure = async (
  stationReference: string
): Promise<string | null> => {
  const response = await fetch(
    `${HYDROLOGY_URL}/measures?station.stationReference=${stationReference}&observedProperty=rainfall`,
    FETCH_CACHE
  );
  if (!response.ok) return null;
  const data: HydrologyList<{ notation: string; period?: number }> =
    await response.json();
  return data.items?.find((m) => m.period === 900)?.notation ?? null;
};

// "2026-11-16" for a UTC instant - the Hydrology service's own date field.
const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// One gauge's total over the window ending at `endMs`, or null if it
// couldn't be got or too many readings are missing.
const gaugeTotal = async (
  measure: string,
  endMs: number
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

  let total = 0;
  let count = 0;
  for (const reading of data.items ?? []) {
    // Times are GMT and carry no zone, so read them as UTC. Each is the
    // start of its 15 minutes; only quarters wholly before the sample count.
    const at = Date.parse(`${reading.dateTime}Z`);
    if (at < startMs || at + QUARTER_HOUR_MS > endMs) continue;
    if (typeof reading.value !== "number" || !Number.isFinite(reading.value))
      continue;
    total += reading.value;
    count++;
  }
  return count >= READINGS_EXPECTED * MIN_COVERAGE ? total : null;
};

// Rain over the SAMPLE_RAIN_HOURS before each sample, as the mean of the
// gauges that reported, by sample ID. Never throws.
export const loadSampleRain = async (
  samples: WaterQualitySample[]
): Promise<Record<string, number | null>> => {
  const result: Record<string, number | null> = {};
  try {
    const measures = (
      await Promise.all(
        RAINFALL_GAUGES.map((g) => quarterHourMeasure(g.id).catch(() => null))
      )
    ).filter((m): m is string => m !== null);

    // A sample at a time, its gauges together: a handful of requests in
    // flight rather than every sample's at once.
    for (const sample of samples) {
      const end = sampleTimeMs(sample);
      const totals = (
        await Promise.all(
          measures.map((m) => gaugeTotal(m, end).catch(() => null))
        )
      ).filter((t): t is number => t !== null);
      result[sample.id] =
        totals.length > 0
          ? Math.round(
              (totals.reduce((sum, t) => sum + t, 0) / totals.length) * 10
            ) / 10
          : null;
    }
  } catch (error) {
    console.error("Error loading rain before samples:", error);
  }
  return result;
};
