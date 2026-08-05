// Shared TypeScript types for Severnwatch.
// Feature-specific types are added here as each data source is built out.

// CSO (Combined Sewer Overflow) spill status, from a water company's
// near-real-time Event Duration Monitoring (EDM) feed.
export type CsoState = "Ongoing" | "Recent" | "Not discharging" | "Offline";

export interface CsoOutfall {
  id: string;
  state: CsoState;
  watercourse: string;
  // Reverse-geocoded place name (e.g. "Hallow, Worcester") - the feed
  // itself has no human-readable site name, only an opaque id. Only
  // resolved for Ongoing/Recent outfalls (see route.ts); null otherwise.
  locationName: string | null;
  latitude: number;
  longitude: number;
  // Distance to the nearest in-scope catchment waypoint (see
  // CATCHMENT_WAYPOINTS), not to Worcester itself - the corridor follows
  // the river rather than a simple radius.
  distanceKm: number;
  startISO: string | null; // when the current status began
  endISO: string | null; // end of the most recent spill, if state is Recent
  durationMinutes: number | null; // time spent in the current status so far
}

export interface CsoResponse {
  outfalls: CsoOutfall[];
  asOf: string; // ISO timestamp - when this data was fetched from source
}

// Rainfall, from the Environment Agency's real-time rainfall network.
export interface RainfallReading {
  dateTime: string; // ISO
  valueMm: number; // rainfall total for this 15-min period
}

export interface RainfallGaugeData {
  id: string;
  label: string; // ours - EA publishes these stations without place names
  // Raw 15-min series for the requested history window, kept ungrouped
  // (not summed to daily totals) so trailing windows and peak intensity
  // can both be derived from it.
  readings: RainfallReading[];
  latestMm: number | null; // most recent 15-min reading, if any
  last24hTotalMm: number; // trailing 24h sum, not a calendar-day total
}

// Rainfall forecast, from Open-Meteo - a single point forecast for
// Worcester (see lib/config's LATITUDE/LONGITUDE), not per-gauge like the
// EA readings above.
export interface RainfallForecastPoint {
  dateTime: string; // ISO
  valueMm: number; // forecast rainfall for this hour (mm/hr)
}

export interface RainfallResponse {
  gauges: RainfallGaugeData[];
  forecast: RainfallForecastPoint[];
  asOf: string; // ISO timestamp - when this data was fetched from source
}
