// ============================================================================
// CONFIGURATION
// ============================================================================
// This file contains all the location- and source-specific configuration for
// Severnwatch. It is currently set up for the River Severn at Worcester, UK.
// ============================================================================

// --- App identity ---
// The name and one-line description, in one place - the page title, the
// installed app's name, the app bar, the share text, the settings sheet and
// the User-Agent sent to Nominatim all read these, as Paddlecheck reads its
// APP_NAME. The service worker's cache names (public/sw.js) are a static
// file and can't import this, so they spell it out.
export const APP_NAME = "Severnwatch";
export const APP_DESCRIPTION =
  "River Severn water quality and rainfall conditions at Worcester";

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
// the tail on top of each outfall's latest travel time (see
// plumeTravelRangeFor in lib/catchment.ts), not the whole window. A spill at Bewdley is therefore
// surfaced far longer than one at Diglis, because its water arrives far
// later.
//
// 48 h rather than the 24 h this used to be. SAS's own Safer Seas alerts
// flag an overflow for 48 h after it stops, and the field evidence doesn't
// support anything shorter: on the Seine, E. coli 13-14 h below a CSO had
// only fallen by about two thirds from a peak two orders of magnitude over
// baseline, which still leaves it many times the dry-weather level a day
// later. Bacteria settled into the bed also re-suspend for longer than that.
export const SEWAGE_RECENT_SPILL_BASE_HOURS = 48;

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
// Nominal speed a spill's water moves downriver, used both for the
// waypoints' plumeTravelHours below and for the allowance added on top of
// them per outfall. See plumeTravelHours for how far to trust it.
export const PLUME_SPEED_KMH = 0.7;

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
  // Severn/Stour/Salwarpe at a nominal PLUME_SPEED_KMH, measured from the
  // waypoint itself - plumeTravelRangeFor in lib/catchment.ts widens it for
  // outfalls sitting out towards the edge of the radius.
  //
  // That speed is NOT the slow end of the range, though it used to be
  // described as one. Flood warnings put the *flood peak* Bewdley to
  // Worcester at 12-24 h, and a spill moves at mean flow velocity rather
  // than flood celerity, so at or above roughly half the mean flow
  // (Bewdley's is ~62 m3/s) 0.7 km/h is a fair-to-generous figure. But
  // summer low flow at Bewdley sits around 10-20 m3/s, and through the
  // pools impounded by the Lincomb, Holt and Bevere weirs that works out
  // to roughly 0.1-0.5 km/h on any plausible cross-section (100-300 m2) - so
  // in exactly the season people swim, these hours are too short. A
  // thunderstorm spill onto a low summer river is also the least diluted.
  // The honest fix is to scale travel with the measured Bewdley flow;
  // until then, the longer 48 h tail and the per-outfall allowance are what
  // buy back the margin. No published dye-tracing or time-of-travel study
  // for the middle Severn was found to calibrate against.
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
    lat: 52.25,
    lon: -2.238,
    radiusKm: 4,
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
    radiusKm: 2,
    branch: "severn",
    downstreamOrder: 4,
    isReach: true,
    plumeTravelHours: 0,
  },
  {
    name: "Worcester (Barbourne/Claines)",
    label: "Barbourne & Claines",
    lat: 52.213,
    lon: -2.235,
    radiusKm: 3,
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
export const CATCHMENT_EXCLUDED_LOCALITIES = ["bromsgrove"];

// Watercourses that drain away from or outside the Worcester reach corridor
// (e.g. Bow Brook drains south to the Avon; River Teme joins below Worcester;
// Stoulton, Madresfield, Whiteacres, Cradley brooks drain elsewhere).
export const CATCHMENT_EXCLUDED_WATERCOURSES = [
  "BOW BROOK",
  "TEME",
  "STOULTON",
  "MADRESFIELD",
  "WHITEACRES",
  "CRADLEY",
];

// Known site name overrides for CSO outfalls in the catchment corridor where
// reverse geocoding gives a street name that differs from Severn Trent Water's
// official site location name.
export const CSO_SITE_OVERRIDES: Record<string, string> = {
  SVT02722: "Vale Road, Stourport-on-Severn",
  SVT02633: "Vale Road, Stourport-on-Severn",
};

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
// Linked from the Info tab only. It used to be embedded as a card, until the
// Grandstand Road samples were read into the app directly (see below): the
// embed was UK-wide, heavy, and loaded SAS's own analytics into the page.
export const SAS_MAP_URL =
  "https://app.cartographer.io/embed/map?map=SasWaterQuality&workspace=sas&project=wq";

// --- SAS citizen science samples (manual export) ---
// SAS have no public API, so their "Water Quality Surveys" CSV export is
// added by hand (see the README in data/water-quality/). Every CSV is read
// and merged by Survey ID, so a new export can sit alongside the old
// ones and a partial export can't wipe out earlier samples. The folder path
// itself is written out in lib/waterQualityCsv.ts, where the bundler needs
// it as a literal.

// The one site the cards follow. An export that also covers other sites is
// filtered down to this name.
export const WATER_QUALITY_SITE_NAME = "Grandstand Road";

// How a sample feeds the headline pollution risk. Testing is roughly
// weekly, and a result is only known a day or so after the sample is taken,
// so a sample is never "live" - these keep an old result from outweighing
// what the spill feed says now.
//
// - A Poor sample (over the Good limit) counts as High Risk for this many
//   London calendar days after sampling, then as Raised Risk until
//   WATER_QUALITY_RELEVANT_DAYS.
// - Excellent and Good samples never change the risk: one clean sample says
//   nothing about a spill that started after it was taken.
export const WATER_QUALITY_RECENT_DAYS = 2;
export const WATER_QUALITY_RELEVANT_DAYS = 7;

// Past this, the sample card says plainly that testing has gone quiet.
export const WATER_QUALITY_STALE_DAYS = 14;

// --- Bathing water classification explainer (linked from "How Limits Work") ---
// The app grades one week at a time and never shows an official
// classification, so the season-long method is linked to rather than
// re-explained. SAS's glossary entry: a short plain-English paragraph, not a
// PDF or a long post. The text fragment (#:~:text=) scrolls to the entry in
// browsers that support it; others land at the top of the glossary, where
// the entry is second.
export const CLASSIFICATIONS_EXPLAINER_URL =
  "https://datahq.sas.org.uk/toolkit/glossary/#:~:text=Bathing%20Water%20Classifications";

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
  { name: "Surfers Against Sewage Water Quality Map", url: SAS_MAP_URL },
  { name: "Environment Agency Rainfall Data", url: EA_RAINFALL_DOCS_URL },
];
