// ============================================================================
// CONFIGURATION
// ============================================================================
// This file contains all the location- and source-specific configuration for
// Severnwatch. It is currently set up for the River Severn at Worcester, UK.
// ============================================================================

export const LOCATION_NAME = "Worcester";
export const LATITUDE = 52.2;
export const LONGITUDE = -2.2;

// --- CSO (Combined Sewer Overflow) Spill Data ---
// Severn Trent's near-real-time storm overflow status feed (part of the
// Water UK National Storm Overflow Hub), queried directly as a public,
// unauthenticated ArcGIS FeatureServer. Same source Paddlecheck uses.
export const SEWAGE_API_URL =
  "https://services1.arcgis.com/NO7lTIlnxRMMG9Gw/arcgis/rest/services/Severn_Trent_Water_Storm_Overflow_Activity/FeatureServer/0/query";

// How long after a spill ends it's still surfaced as "recent" before
// dropping off entirely.
export const SEWAGE_RECENT_SPILL_HOURS = 24;

// Catchment corridor relevant to the Worcester paddling reach: outfalls
// whose spills could plausibly affect water quality there in a meaningful
// timeframe, without diluting the signal with distant/marginal catchments.
// Each waypoint is a named place along the Severn (and lower Stour/Salwarpe)
// corridor between Worcester and Bewdley; an outfall is in-scope if it falls
// within `radiusKm` of any waypoint. Anything past Bewdley is too diluted
// and too slow (25+ km, hours of travel time, heavy baseflow dilution) to
// be a useful water-quality signal for paddlers at Worcester.
export interface CatchmentWaypoint {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

export const CATCHMENT_WAYPOINTS: CatchmentWaypoint[] = [
  {
    name: "Worcester (Barbourne/Claines)",
    lat: 52.213,
    lon: -2.208,
    radiusKm: 5,
  },
  {
    name: "Worcester (Henwick/Bromwich Road)",
    lat: 52.192,
    lon: -2.234,
    radiusKm: 5,
  },
  {
    name: "Droitwich/Salwarpe (Hawford)",
    lat: 52.238,
    lon: -2.198,
    radiusKm: 5,
  },
  { name: "Ombersley/Hawford", lat: 52.253, lon: -2.212, radiusKm: 5 },
  { name: "Stourport-on-Severn", lat: 52.348, lon: -2.281, radiusKm: 5 },
  { name: "Kidderminster (Stour)", lat: 52.389, lon: -2.249, radiusKm: 6 },
  { name: "Bewdley", lat: 52.375, lon: -2.313, radiusKm: 5 },
  { name: "Hartlebury/Wilden", lat: 52.335, lon: -2.229, radiusKm: 5 },
];

// Explicitly excluded even if geographically close to a waypoint above -
// deliberately left out as too marginal a signal for the Worcester reach
// (small/unmonitored catchments or too far up a tributary).
export const CATCHMENT_EXCLUDED_LOCALITIES = [
  "holt heath",
  "holt",
  "bromsgrove",
];

// Every in-scope CSO is returned regardless of status, but only the
// actionable ones (Ongoing/Recent) are reverse-geocoded, up to this many -
// bounds Nominatim usage and this route's runtime regardless of how many
// monitors sit in the corridor. Outfalls beyond this cap still appear in
// the list, just without a resolved location name.
export const SEWAGE_MAX_RESULTS = 15;

// --- Rainfall Data (Environment Agency real-time network) ---
// EA's flood-monitoring API publishes rainfall stations without human
// place names (only a grid reference), so these labels are ours - assigned
// by reverse-geocoding each station's coordinates. Chosen to span the
// catchment immediately north of Worcester up to Bewdley, matching the CSO
// catchment corridor above so the two data layers line up on the same page.
export interface RainfallGauge {
  id: string;
  label: string;
}

export const RAINFALL_GAUGES: RainfallGauge[] = [
  { id: "1773", label: "Worcester/Droitwich" },
  { id: "1413", label: "Hartlebury/Stourport" },
  { id: "1548", label: "Bewdley" },
];

export const RAINFALL_HISTORY_DAYS = 7;

export const API_ENDPOINTS = {
  RAINFALL_READINGS: (measureId: string) =>
    `https://environment.data.gov.uk/flood-monitoring/id/measures/${measureId}/readings`,
};

// --- Rainfall forecast (Open-Meteo) ---
// Open-Meteo has no per-gauge granularity like the EA network above - it's
// one free-tier forecast for the Worcester point (LATITUDE/LONGITUDE), used
// only to extend the rainfall chart a little way into the future.
export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const RAINFALL_FORECAST_HOURS = 48;

// --- Severn Trent public storm overflow map (attribution link) ---
export const SEVERN_TRENT_MAP_URL =
  "https://www.stwater.co.uk/in-my-area/storm-overflow-map/";

// --- SAS (Surfers Against Sewage) citizen science water quality map ---
export const SAS_MAP_EMBED_URL =
  "https://app.cartographer.io/embed/map?map=SasWaterQuality&workspace=sas&project=wq";

// --- Environment Agency rainfall API documentation ---
export const EA_RAINFALL_DOCS_URL =
  "https://environment.data.gov.uk/flood-monitoring/doc/rainfall";

// Every outbound link the Info tab offers, in one list, so adding a source
// means adding it here rather than hand-writing another row in the settings
// sheet. Order is the order they render in.
export interface UsefulLink {
  name: string;
  url: string;
}

export const USEFUL_LINKS: UsefulLink[] = [
  { name: "Severn Trent Storm Overflow Map", url: SEVERN_TRENT_MAP_URL },
  { name: "Surfers Against Sewage Water Quality Map", url: SAS_MAP_EMBED_URL },
  { name: "Environment Agency Rainfall Data", url: EA_RAINFALL_DOCS_URL },
];
