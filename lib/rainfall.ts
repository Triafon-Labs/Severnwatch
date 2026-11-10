import {
  RainfallForecastPoint,
  RainfallGaugeData,
  RainfallReading,
  RainfallResponse,
} from "@/types";
import {
  API_ENDPOINTS,
  LATITUDE,
  LONGITUDE,
  OPEN_METEO_FORECAST_URL,
  RAINFALL_FORECAST_HOURS,
  RAINFALL_GAUGES,
  RAINFALL_HISTORY_DAYS,
  RainfallGauge,
} from "@/lib/config";
import { FetchLiveness, fetchCacheOptions } from "@/lib/fetchCache";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface EaReading {
  dateTime: string;
  value: number;
}

// The EA API defaults to 500 readings per request; 7 days of 15-min
// readings is ~672, so _limit is raised to comfortably cover that in one
// call rather than paginating.
const READINGS_LIMIT = 1000;

export const fetchGaugeData = async (
  gauge: RainfallGauge,
  liveness: FetchLiveness = {}
): Promise<RainfallGaugeData> => {
  const sinceISO = new Date(
    Date.now() - RAINFALL_HISTORY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const url = `${API_ENDPOINTS.RAINFALL_READINGS(
    `${gauge.id}-rainfall-tipping_bucket_raingauge-t-15_min-mm`
  )}?since=${sinceISO}&_limit=${READINGS_LIMIT}`;

  // The window matches the gauge's own 15-min reporting cadence.
  const response = await fetch(url, fetchCacheOptions(liveness));
  if (!response.ok) {
    throw new Error(
      `Rainfall API fetch failed for gauge ${gauge.id}: ${response.status}`
    );
  }

  const data = await response.json();
  const items: EaReading[] = data?.items || [];

  const readings: RainfallReading[] = items
    .map((item) => ({ dateTime: item.dateTime, valueMm: item.value }))
    .sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );

  const now = Date.now();
  const last24hTotalMm = readings
    .filter((r) => now - new Date(r.dateTime).getTime() <= TWENTY_FOUR_HOURS_MS)
    .reduce((sum, r) => sum + r.valueMm, 0);

  const latestMm =
    readings.length > 0 ? readings[readings.length - 1].valueMm : null;

  return {
    id: gauge.id,
    label: gauge.label,
    readings,
    latestMm,
    last24hTotalMm: Math.round(last24hTotalMm * 10) / 10,
  };
};

interface OpenMeteoResponse {
  hourly?: {
    time: string[]; // local wall-clock, no offset - requested in UTC below so "Z" can be appended safely
    precipitation: number[]; // mm for that hour
  };
}

export const fetchRainfallForecast = async (
  liveness: FetchLiveness = {}
): Promise<RainfallForecastPoint[]> => {
  const url =
    `${OPEN_METEO_FORECAST_URL}?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=precipitation&timezone=UTC&forecast_hours=${RAINFALL_FORECAST_HOURS}`;

  // Forecasts don't change fast enough to warrant polling harder.
  const response = await fetch(url, fetchCacheOptions(liveness));
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast fetch failed: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  const times = data.hourly?.time ?? [];
  const values = data.hourly?.precipitation ?? [];

  return times.map((t, i) => ({
    dateTime: new Date(`${t}Z`).toISOString(),
    valueMm: values[i] ?? 0,
  }));
};

// Shared by /api/rainfall (cached) and /api/rainfall/live (liveness.live:
// true, bypasses the cache) so both build the response identically. Throws
// when a gauge fails; the routes turn that into a 500.
export const getRainfallPayload = async (
  liveness: FetchLiveness = {}
): Promise<RainfallResponse> => {
  const gauges = await Promise.all(
    RAINFALL_GAUGES.map((gauge) => fetchGaugeData(gauge, liveness))
  );

  // Best-effort: Open-Meteo is a "nice to have" forecast layer on top of
  // the EA gauge readings above, not the core data - a failure here
  // shouldn't take down the rest of the rainfall card.
  let forecast: RainfallForecastPoint[] = [];
  try {
    forecast = await fetchRainfallForecast(liveness);
  } catch (error) {
    console.error("Error fetching rainfall forecast:", error);
  }

  return { gauges, forecast, asOf: new Date().toISOString() };
};
