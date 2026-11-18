import { unstable_cache } from "next/cache";
import { CsoOutfall, CsoResponse, CsoState } from "@/types";
import {
  APP_NAME,
  SEWAGE_API_URL,
  SEWAGE_MAX_RESULTS,
  CSO_SITE_OVERRIDES,
  CATCHMENT_EXCLUDED_OUTFALL_IDS,
} from "@/lib/config";
import {
  nearestWaypoint,
  isExcludedLocality,
  recentCutoffHours,
  NearestWaypoint,
} from "@/lib/catchment";
import { formatWatercourse } from "@/lib/format";
import { FetchLiveness, fetchCacheOptions } from "@/lib/fetchCache";

interface SewageFeatureAttributes {
  Id: string | number;
  Status: number; // 1 = discharging, 0 = not discharging, -1 = monitor offline
  StatusStart: number | null; // epoch ms
  LatestEventStart: number | null; // epoch ms
  LatestEventEnd: number | null; // epoch ms
  Latitude: number;
  Longitude: number;
  ReceivingWaterCourse: string | null;
}

// The FeatureServer has no human-readable site name (only an opaque `Id`),
// so outfalls are reverse-geocoded to a place name instead. Nominatim is
// free and keyless but requires an identifying User-Agent and asks callers
// not to burst requests, so real calls are kept at least a second apart.
const NOMINATIM_GAP_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastNominatimCallAt = 0;

// Throws on a failed request rather than returning null, so a failure (a
// 429, a timeout) is never cached in place of the outfall's name.
const reverseGeocodeUncached = async (
  lat: number,
  lon: number
): Promise<string | null> => {
  const wait = lastNominatimCallAt + NOMINATIM_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatimCallAt = Date.now();
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
    {
      headers: {
        "User-Agent": `${APP_NAME} (River Severn water quality dashboard)`,
      },
    }
  );
  if (!res.ok) throw new Error(`Nominatim: ${res.status}`);
  const data = await res.json();
  const address = data?.address || {};
  const specific =
    address.road || address.suburb || address.neighbourhood || address.village;
  const locality = address.town || address.city || address.county;
  if (specific && locality && specific !== locality)
    return `${specific}, ${locality}`;
  return specific || locality || null;
};

// Outfalls don't move, so a name is kept for 30 days (long enough to pick up
// an OpenStreetMap edit eventually) in Next's persistent cache, which on
// Vercel survives deploys. Before this every rebuild of /api/sewage - and
// every /live call - geocoded each spilling outfall afresh, a second apart:
// ~15 s with a dozen spilling. The gap above lives inside the cached
// function, so it only paces calls that actually reach Nominatim.
//
// unstable_cache rather than "use cache": the directive needs Cache
// Components switched on for the whole app, which changes how every route
// caches. A fetch-level cache alone wouldn't do either - nothing tells the
// caller whether a fetch was answered from the cache, so the gap would still
// apply to every lookup.
const reverseGeocodeCached = unstable_cache(
  reverseGeocodeUncached,
  ["nominatim-reverse"],
  { revalidate: 30 * 24 * 60 * 60 }
);

const reverseGeocode = (lat: number, lon: number): Promise<string | null> =>
  reverseGeocodeCached(lat, lon).catch(() => null);

// The FeatureServer caps each query at maxRecordCount (2000) regardless of
// how many `resultRecordCount` asks for, but the company-wide feed has
// 2400+ outfalls - so a single unpaginated query silently drops whichever
// records sort past the cap. Page through with resultOffset until the
// server stops reporting exceededTransferLimit.
const PAGE_SIZE = 2000;

const fetchAllFeatures = async (
  liveness: FetchLiveness
): Promise<{ attributes: SewageFeatureAttributes }[]> => {
  const all: { attributes: SewageFeatureAttributes }[] = [];
  let offset = 0;
  for (;;) {
    const url = `${SEWAGE_API_URL}?where=1%3D1&outFields=*&f=json&resultRecordCount=${PAGE_SIZE}&resultOffset=${offset}`;
    const response = await fetch(url, fetchCacheOptions(liveness));
    if (!response.ok)
      throw new Error(`CSO feed fetch failed: ${response.status}`);
    const page = await response.json();
    const pageFeatures: { attributes: SewageFeatureAttributes }[] =
      page?.features || [];
    all.push(...pageFeatures);
    if (!page.exceededTransferLimit || pageFeatures.length === 0) break;
    offset += pageFeatures.length;
  }
  return all;
};

// Shared by /api/sewage (cached) and /api/sewage/live (liveness.live: true,
// bypasses the cache) so both build the response identically. Throws when
// the feed itself fails; the routes turn that into a 500.
export const getSewagePayload = async (
  liveness: FetchLiveness = {}
): Promise<CsoResponse> => {
  const features = await fetchAllFeatures(liveness);

  const now = Date.now();

  // How long a finished spill stays "Recent" depends on where it happened:
  // its travel time to the reach plus the 48 h tail (recentCutoffHours). A
  // flat window retires an upstream spill on a fixed clock regardless of
  // whether its water has arrived yet, which is precisely backwards.
  const recentCutoffMsFor = (nearest: NearestWaypoint) =>
    recentCutoffHours(nearest.waypoint, nearest.distanceKm) * 60 * 60 * 1000;

  const outfalls = features
    .map(({ attributes }) => {
      if (CATCHMENT_EXCLUDED_OUTFALL_IDS.includes(String(attributes.Id))) {
        return null; // in a circle, but discharges below the reach
      }
      const nearest = nearestWaypoint(
        attributes.Latitude,
        attributes.Longitude,
        attributes.ReceivingWaterCourse
      );
      if (nearest === null) return null; // outside the catchment corridor

      let state: CsoState;
      if (attributes.Status === 1) {
        state = "Ongoing";
      } else if (attributes.Status === 0) {
        state =
          attributes.LatestEventEnd !== null &&
          now - attributes.LatestEventEnd <= recentCutoffMsFor(nearest)
            ? "Recent"
            : "Not discharging";
      } else {
        // -1 (monitor offline) and any other unrecognized status code.
        state = "Offline";
      }

      let startMs: number | null = null;
      let endMs: number | null = null;
      let durationMinutes: number | null = null;

      if (state === "Ongoing") {
        startMs = attributes.StatusStart ?? attributes.LatestEventStart;
        endMs = null;
        if (startMs !== null) {
          durationMinutes = Math.max(0, Math.round((now - startMs) / 60000));
        }
      } else if (state === "Recent") {
        startMs = attributes.LatestEventStart ?? attributes.StatusStart;
        endMs = attributes.LatestEventEnd;
        if (startMs !== null && endMs !== null && endMs >= startMs) {
          durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
      } else {
        startMs = attributes.StatusStart;
        endMs = attributes.LatestEventEnd;
        durationMinutes = null;
      }

      const idStr = String(attributes.Id);
      const overrideName = CSO_SITE_OVERRIDES[idStr] ?? null;

      return {
        id: idStr,
        state,
        watercourse: formatWatercourse(attributes.ReceivingWaterCourse),
        locationName: overrideName as string | null,
        latitude: attributes.Latitude,
        longitude: attributes.Longitude,
        distanceKm: nearest.distanceKm,
        waypointName: nearest.waypoint.name,
        startISO: startMs !== null ? new Date(startMs).toISOString() : null,
        endISO: endMs !== null ? new Date(endMs).toISOString() : null,
        durationMinutes,
      };
    })
    .filter((o): o is CsoOutfall => o !== null)
    // Ongoing spills take priority, then Recent, then quiet/offline
    // monitors - so a live spill farther away is never bumped out by a
    // closer but less urgent entry; ties broken by distance.
    .sort((a, b) => {
      const priority: Record<CsoState, number> = {
        Ongoing: 0,
        Recent: 1,
        "Not discharging": 2,
        Offline: 3,
      };
      return (
        priority[a.state] - priority[b.state] || a.distanceKm - b.distanceKm
      );
    });

  // Reverse-geocode sequentially (not in parallel): a name not in the cache
  // waits its turn behind the previous Nominatim call (reverseGeocode,
  // above), to stay within its "no bursts" usage policy. Only the
  // actionable outfalls (Ongoing/Recent) are worth the round-trip, capped at
  // SEWAGE_MAX_RESULTS - the rest of the corridor's monitors are still
  // returned below, just identified by watercourse/distance instead of a
  // resolved place name.
  const toGeocode = outfalls
    .map((o, index) => ({ o, index }))
    .filter(
      ({ o }) =>
        !o.locationName && (o.state === "Ongoing" || o.state === "Recent")
    )
    .slice(0, SEWAGE_MAX_RESULTS);

  for (const { o, index } of toGeocode) {
    outfalls[index].locationName = await reverseGeocode(
      o.latitude,
      o.longitude
    );
  }

  // Explicit name-based exclusion as a safety net for localities that are
  // geographically close to an included waypoint but were deliberately
  // left out (see CATCHMENT_EXCLUDED_LOCALITIES). Only meaningful for
  // geocoded (Ongoing/Recent) entries - ungeocoded ones have no name to
  // check and rely solely on the waypoint radius filter above.
  const inScopeOutfalls = outfalls.filter(
    (o) => !isExcludedLocality(o.locationName)
  );

  const body: CsoResponse = {
    outfalls: inScopeOutfalls,
    asOf: new Date().toISOString(),
  };
  return body;
};
