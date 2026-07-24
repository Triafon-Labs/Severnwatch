// Shared TypeScript types for Severnwatch.
// Feature-specific types are added here as each data source is built out.

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

export interface RainfallResponse {
  gauges: RainfallGaugeData[];
  asOf: string; // ISO timestamp - when this data was fetched from source
}
