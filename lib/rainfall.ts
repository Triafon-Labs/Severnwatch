import { RainfallForecastPoint, RainfallGaugeData, RainfallReading } from "@/types";
import {
  API_ENDPOINTS,
  LATITUDE,
  LONGITUDE,
  OPEN_METEO_FORECAST_URL,
  RAINFALL_FORECAST_HOURS,
  RAINFALL_HISTORY_DAYS,
  RainfallGauge,
} from "@/lib/config";

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
  gauge: RainfallGauge
): Promise<RainfallGaugeData> => {
  const sinceISO = new Date(
    Date.now() - RAINFALL_HISTORY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const url = `${API_ENDPOINTS.RAINFALL_READINGS(
    `${gauge.id}-rainfall-tipping_bucket_raingauge-t-15_min-mm`
  )}?since=${sinceISO}&_limit=${READINGS_LIMIT}`;

  const response = await fetch(url, {
    next: { revalidate: 900 }, // matches the gauge's own 15-min reporting cadence
  });
  if (!response.ok) {
    throw new Error(`Rainfall API fetch failed for gauge ${gauge.id}: ${response.status}`);
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

  const latestMm = readings.length > 0 ? readings[readings.length - 1].valueMm : null;

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

export const fetchRainfallForecast = async (): Promise<RainfallForecastPoint[]> => {
  const url =
    `${OPEN_METEO_FORECAST_URL}?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=precipitation&timezone=UTC&forecast_hours=${RAINFALL_FORECAST_HOURS}`;

  const response = await fetch(url, {
    next: { revalidate: 900 }, // forecasts don't change fast enough to warrant polling harder
  });
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
