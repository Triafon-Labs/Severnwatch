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

// How long a spill stays "recent" *after its water has reached the reach* -
// the tail on top of each waypoint's plumeTravelHours (see below), not the
// whole window. A spill at Bewdley is therefore surfaced far longer than one
// at Diglis, because its water arrives far later.
export const SEWAGE_RECENT_SPILL_BASE_HOURS = 24;

// Catchment corridor relevant to the Worcester paddling reach: outfalls
// whose spills could plausibly affect water quality there in a meaningful
// timeframe, without diluting the signal with distant/marginal catchments.
// Each waypoint is a named place along the Severn (and lower Stour/Salwarpe)
// corridor between Bewdley and Diglis, the downstream end of the Worcester
// reach; an outfall is in-scope if it falls within `radiusKm` of any
// waypoint. Radii are sized so consecutive circles overlap along the river
// itself - a stretch that falls outside every circle is dropped silently,
// which is how the Shrawley/Astley reach went missing until the corridor was
// checked against the river's actual course rather than waypoint to
// waypoint. Anything past Bewdley is too diluted and too slow to be a useful
// signal here: it is already 18.6 km of river above the reach, better than a
// day's travel for the water itself, and accreting tributary flow dilutes it
// the whole way down.
export interface CatchmentWaypoint {
  name: string;
  // Short form for the river schematic, where a row is too narrow for the
  // full disambiguating name above.
  label: string;
  lat: number;
  lon: number;
  radiusKm: number;
  branch: RiverBranchId;
  // Position along `branch`, furthest upstream first. This is a sequence,
  // not a distance - we have outfall coordinates but no river-network
  // topology, so the schematic can honestly say "this stop is upstream of
  // that one" and nothing more. Hence a diagram that is deliberately not to
  // scale, in the tube-map idiom, rather than a map implying precision the
  // data doesn't carry.
  downstreamOrder: number;
  // Part of the paddled reach itself - the water between Bevere and Diglis
  // weirs. Everything upstream of it drains past it, which is the whole
  // question the schematic exists to answer.
  isReach?: boolean;
  // Rough hours for a spill's water to travel from here down to the top of
  // the reach at Bevere. Zero inside the reach.
  //
  // ESTIMATE, not a measurement. Derived from river distance along the
  // Severn/Stour/Salwarpe at a nominal 0.7 km/h. That speed is the
  // conservative (slow) end of what the reach's hydraulics imply: flood
  // warnings put the *flood peak* Bewdley to Worcester at 12-24 h, but a
  // spill is a parcel of water moving at mean flow velocity, which is
  // roughly celerity / 1.3-1.7 - and slower still here because the reach is
  // impounded by weirs at Lincomb, Holt and Bevere, so at low flow a plume
  // steps through a chain of slow pools. No published dye-tracing or
  // time-of-travel study for the middle Severn was found to calibrate
  // against, so these are deliberately generous: retiring a spill before its
  // water has arrived is the dangerous error, showing it slightly too long
  // is not.
  plumeTravelHours: number;
}

// The river network the schematic draws: the Severn trunk, plus the
// tributaries that join it inside the corridor. `joinsAt` names the trunk
// waypoint a tributary flows into, which is where its line merges on the
// diagram.
export type RiverBranchId = "severn" | "stour" | "salwarpe";

export interface RiverBranch {
  id: RiverBranchId;
  label: string;
  joinsAt: string | null; // null for the trunk itself
}

export const RIVER_BRANCHES: RiverBranch[] = [
  { id: "severn", label: "River Severn", joinsAt: null },
  { id: "stour", label: "River Stour", joinsAt: "Stourport-on-Severn" },
  {
    id: "salwarpe",
    label: "River Salwarpe",
    joinsAt: "Ombersley/Hawford",
  },
];

// Grouped by branch and ordered upstream-first, which is the order the
// schematic renders them in. Catchment filtering itself is order-independent
// (it takes the nearest waypoint within radius), so this grouping is purely
// so the file reads as the river it describes.
export const CATCHMENT_WAYPOINTS: CatchmentWaypoint[] = [
  // --- River Severn (trunk), upstream to downstream ---
  {
    name: "Bewdley",
    label: "Bewdley",
    lat: 52.375,
    lon: -2.313,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 0,
    plumeTravelHours: 28,
  },
  {
    name: "Stourport-on-Severn",
    label: "Stourport-on-Severn",
    lat: 52.348,
    lon: -2.281,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 1,
    plumeTravelHours: 22,
  },
  // Covers the Astley Burf -> Shrawley -> Holt Fleet reach, which sat outside
  // every other circle: Stourport and Ombersley are 11.6 km apart but carry
  // 5 km radii, leaving ~1.8 km of river uncovered. Spills there flow past
  // Holt Fleet and down to Worcester like any other, so dropping them was an
  // artefact of placing circles on settlements rather than on the river.
  {
    name: "Shrawley/Astley",
    label: "Shrawley & Astley",
    lat: 52.288,
    lon: -2.262,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 2,
    plumeTravelHours: 12,
  },
  {
    name: "Ombersley/Hawford",
    label: "Ombersley & Hawford",
    lat: 52.253,
    lon: -2.212,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 3,
    plumeTravelHours: 4,
  },
  // Top of the paddled reach. Its weir is one of the three impoundments that
  // slow a plume on the way down, and it is the point every upstream
  // plumeTravelHours above is measured to.
  {
    name: "Bevere",
    label: "Bevere",
    lat: 52.224,
    lon: -2.235,
    radiusKm: 3,
    branch: "severn",
    downstreamOrder: 4,
    isReach: true,
    plumeTravelHours: 0,
  },
  {
    name: "Worcester (Barbourne/Claines)",
    label: "Barbourne & Claines",
    lat: 52.213,
    lon: -2.208,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 5,
    isReach: true,
    plumeTravelHours: 0,
  },
  {
    name: "Worcester (Henwick/Bromwich Road)",
    label: "Henwick & Bromwich Road",
    lat: 52.192,
    lon: -2.234,
    radiusKm: 5,
    branch: "severn",
    downstreamOrder: 6,
    isReach: true,
    plumeTravelHours: 0,
  },
  // The downstream end of the reach. Deliberately tighter than the 5 km the
  // rest carry: everything upstream of a stop drains past it, so a wide
  // circle on the last one would pull in Kempsey and beyond - outfalls whose
  // spills flow away from Worcester rather than towards it.
  {
    name: "Diglis",
    label: "Diglis",
    lat: 52.178,
    lon: -2.222,
    radiusKm: 3,
    branch: "severn",
    downstreamOrder: 7,
    isReach: true,
    plumeTravelHours: 0,
  },

  // --- River Stour, joining the Severn at Stourport ---
  {
    name: "Kidderminster (Stour)",
    label: "Kidderminster",
    lat: 52.389,
    lon: -2.249,
    radiusKm: 6,
    branch: "stour",
    downstreamOrder: 0,
    plumeTravelHours: 28,
  },
  {
    name: "Hartlebury/Wilden",
    label: "Hartlebury & Wilden",
    lat: 52.335,
    lon: -2.229,
    radiusKm: 5,
    branch: "stour",
    downstreamOrder: 1,
    plumeTravelHours: 22,
  },

  // --- River Salwarpe, joining the Severn at Hawford ---
  {
    name: "Droitwich/Salwarpe (Hawford)",
    label: "Droitwich & Salwarpe",
    lat: 52.238,
    lon: -2.198,
    radiusKm: 5,
    branch: "salwarpe",
    downstreamOrder: 0,
    plumeTravelHours: 6,
  },
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
