import {
  LATITUDE,
  LONGITUDE,
  OPEN_METEO_ARCHIVE_URL,
  RAIN_HISTORY_DAYS,
} from "@/lib/config";
import { londonDayKey } from "@/lib/time";

// Daily rain for Worcester over the last RAIN_HISTORY_DAYS, by London date,
// from Open-Meteo's archive (see OPEN_METEO_ARCHIVE_URL for why not the
// gauges). Server-only. Throws when the fetch fails; the route carries on
// without rain.

interface OpenMeteoArchiveResponse {
  daily?: {
    time: string[]; // "2026-11-16", in the timezone asked for
    precipitation_sum: (number | null)[]; // mm
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const fetchRainHistory = async (
  now: number = Date.now()
): Promise<Record<string, number>> => {
  const url =
    `${OPEN_METEO_ARCHIVE_URL}?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&start_date=${londonDayKey(now - RAIN_HISTORY_DAYS * DAY_MS)}` +
    `&end_date=${londonDayKey(now)}` +
    // Days cut at London midnight, to match the samples' own dates.
    `&daily=precipitation_sum&timezone=Europe%2FLondon`;

  // The same three hours as the route that calls this (app/api/risk-history)
  // - a shorter window here would drag that route's cache down to it.
  const response = await fetch(url, { next: { revalidate: 10800 } });
  if (!response.ok) {
    throw new Error(`Open-Meteo archive fetch failed: ${response.status}`);
  }

  const data: OpenMeteoArchiveResponse = await response.json();
  const rain: Record<string, number> = {};
  const values = data.daily?.precipitation_sum ?? [];
  (data.daily?.time ?? []).forEach((date, i) => {
    const mm = values[i];
    // The newest day or two can come back null until the model has run.
    if (typeof mm === "number" && Number.isFinite(mm)) rain[date] = mm;
  });
  return rain;
};
