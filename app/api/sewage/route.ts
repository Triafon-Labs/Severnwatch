import { NextResponse } from "next/server";
import { CsoOutfall, CsoResponse, CsoState } from "@/types";
import {
  SEWAGE_API_URL,
  SEWAGE_RECENT_SPILL_BASE_HOURS,
  SEWAGE_MAX_RESULTS,
  CSO_SITE_OVERRIDES,
} from "@/lib/config";
import {
  nearestWaypoint,
  isExcludedLocality,
  plumeTravelHoursFor,
  NearestWaypoint,
} from "@/lib/catchment";
import { formatWatercourse } from "@/lib/format";

// Cache the completed response, including reverse-geocoded place names. The
// upstream feed is already cached for five minutes, but without this route
// cache every manual refresh would repeat the slow Nominatim pass.
export const revalidate = 300;

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
// not to burst requests, hence the small delay between calls below.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<string | null> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Severnwatch (River Severn water quality dashboard)",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const address = data?.address || {};
    const specific =
      address.road ||
      address.suburb ||
      address.neighbourhood ||
      address.village;
    const locality = address.town || address.city || address.county;
    if (specific && locality && specific !== locality)
      return `${specific}, ${locality}`;
    return specific || locality || null;
  } catch {
    return null;
  }
};

// The FeatureServer caps each query at maxRecordCount (2000) regardless of
// how many `resultRecordCount` asks for, but the company-wide feed has
// 2400+ outfalls - so a single unpaginated query silently drops whichever
// records sort past the cap. Page through with resultOffset until the
// server stops reporting exceededTransferLimit.
const PAGE_SIZE = 2000;

const fetchAllFeatures = async (): Promise<
  { attributes: SewageFeatureAttributes }[]
> => {
  const all: { attributes: SewageFeatureAttributes }[] = [];
  let offset = 0;
  for (;;) {
    const url = `${SEWAGE_API_URL}?where=1%3D1&outFields=*&f=json&resultRecordCount=${PAGE_SIZE}&resultOffset=${offset}`;
    const response = await fetch(url, {
      next: { revalidate: 300 }, // Near-real-time source; no point polling faster.
    });
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

export async function GET() {
  try {
    const features = await fetchAllFeatures();

    const now = Date.now();

    // How long a finished spill stays "Recent" depends on where it happened.
    // A flat window retires an upstream spill on a fixed clock regardless of
    // whether its water has arrived yet - and since a plume from Bewdley can
    // take better than a day to reach the reach, a 24 h window dropped it
    // from the app *before* the water got here, which is precisely backwards.
    const recentCutoffMsFor = (nearest: NearestWaypoint) =>
      (SEWAGE_RECENT_SPILL_BASE_HOURS +
        plumeTravelHoursFor(nearest.waypoint, nearest.distanceKm)) *
      60 *
      60 *
      1000;

    const outfalls = features
      .map(({ attributes }) => {
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
            durationMinutes = Math.max(
              0,
              Math.round((endMs - startMs) / 60000)
            );
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

    // Reverse-geocode sequentially (not in parallel) to stay well within
    // Nominatim's "no bursts" usage policy. Only the actionable outfalls
    // (Ongoing/Recent) are worth the round-trip, capped at
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

    for (let i = 0; i < toGeocode.length; i++) {
      const { o, index } = toGeocode[i];
      outfalls[index].locationName = await reverseGeocode(
        o.latitude,
        o.longitude
      );
      if (i < toGeocode.length - 1) await sleep(1000);
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

    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching CSO data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
