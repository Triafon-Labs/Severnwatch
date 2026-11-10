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
  // `name` of that nearest waypoint. The river schematic groups outfalls by
  // it to place them as stops along the right branch; the waypoint's own
  // branch is used rather than `watercourse` above, so an outfall always
  // draws where the catchment filter actually put it.
  waypointName: string;
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

// Citizen science water quality samples, from Surfers Against Sewage's
// Cartographer export. There is no public API: the export is downloaded by
// hand and dropped into data/water-quality/ (see the README there), and
// /api/water-quality parses whatever is in that folder.

// A lab count can sit outside what the test can measure. "below" is the
// detection limit ("<10": none found in the volume tested), "above" is the
// top of the dilution range (">1000": at least that many, possibly far more).
// Neither is the number itself, so neither should be averaged or shown as
// if it were.
export type CountQualifier = "below" | "exact" | "above";

export interface BacteriaCount {
  value: number; // colony-forming units per 100 ml
  qualifier: CountQualifier;
}

export interface WaterQualitySample {
  id: string; // the export's Feature ID - stable across exports
  sampledAt: string; // ISO, converted from the export's London wall-clock time
  eColi: BacteriaCount | null;
  enterococci: BacteriaCount | null;
  // Total thermotolerant coliforms - a broader count than E. coli, which is
  // one of them. Not part of the bathing water classification.
  coliforms: BacteriaCount | null;
  airTemperatureC: number | null;
  weather: string | null; // human-readable, e.g. "Light rain"
  weatherDayBefore: string | null;
  rainfallMm: number | null;
  rainfallDayBeforeMm: number | null;
  swimmers: number | null;
  otherWaterUsers: number | null;
  notes: string | null; // free text written by the tester
}

export interface WaterQualitySite {
  name: string;
  river: string;
  gridRef: string;
}

export interface WaterQualityResponse {
  site: WaterQualitySite;
  samples: WaterQualitySample[]; // oldest first
  // When the response was built. For the file-based source this is the
  // build, not the sampling, so it deliberately doesn't feed the app bar's
  // "Updated" line - the cards date each sample themselves.
  asOf: string;
}

// /api/water-quality/upload's reply, which the /upload page shows.
export type UploadResponse =
  | {
      ok: true;
      samples: number; // Grandstand Road samples in the file
      added: number; // not in the data before
      updated: number; // already there, with a different result
      latestSampledAt: string | null;
    }
  | { ok: false; error: string }; // written for the tester, shown as-is
