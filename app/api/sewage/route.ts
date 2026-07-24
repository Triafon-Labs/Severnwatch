import { NextResponse } from "next/server";
import { CsoOutfall, CsoResponse, CsoState } from "@/types";
import { SEWAGE_API_URL, SEWAGE_RECENT_SPILL_HOURS, SEWAGE_MAX_RESULTS } from "@/lib/config";
import { nearestWaypointDistanceKm, isExcludedLocality } from "@/lib/catchment";

interface SewageFeatureAttributes {
  Id: string | number;
  Status: number; // 1 = discharging, 0 = not discharging, -1 = monitor offline
  StatusStart: number | null; // epoch ms
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
      address.road || address.suburb || address.neighbourhood || address.village;
    const locality = address.town || address.city || address.county;
    if (specific && locality && specific !== locality) return `${specific}, ${locality}`;
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
    if (!response.ok) throw new Error(`CSO feed fetch failed: ${response.status}`);
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

    const recentCutoffMs = SEWAGE_RECENT_SPILL_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    const outfalls: (CsoOutfall & { locationName: string | null })[] = features
      .map(({ attributes }) => {
        const waypointDistance = nearestWaypointDistanceKm(
          attributes.Latitude,
          attributes.Longitude
        );
        if (waypointDistance === null) return null; // outside the catchment corridor

        let state: CsoState | null = null;
        if (attributes.Status === 1) {
          state = "Ongoing";
        } else if (
          attributes.Status === 0 &&
          attributes.LatestEventEnd !== null &&
          now - attributes.LatestEventEnd <= recentCutoffMs
        ) {
          state = "Recent";
        }
        // Status === -1 (monitor offline) and any other unmatched status
        // fall through to state === null and get dropped below - a dead
        // monitor isn't actionable, so it's not worth surfacing.
        if (state === null) return null;

        const startMs = attributes.StatusStart;
        const endMs = state === "Recent" ? attributes.LatestEventEnd : null;
        const durationMinutes =
          startMs !== null
            ? Math.round(((endMs ?? now) - startMs) / 60000)
            : null;

        return {
          id: String(attributes.Id),
          state,
          watercourse: attributes.ReceivingWaterCourse || "Unknown watercourse",
          locationName: null as string | null,
          latitude: attributes.Latitude,
          longitude: attributes.Longitude,
          distanceKm: waypointDistance,
          startISO: startMs !== null ? new Date(startMs).toISOString() : null,
          endISO: endMs !== null ? new Date(endMs).toISOString() : null,
          durationMinutes,
        };
      })
      .filter((o): o is CsoOutfall & { locationName: string | null } => o !== null)
      // Ongoing spills always take priority over Recent entries, so a live
      // spill farther away is never bumped out by a closer but less urgent
      // one; ties broken by distance.
      .sort((a, b) => {
        const priority: Record<CsoState, number> = { Ongoing: 0, Recent: 1 };
        return priority[a.state] - priority[b.state] || a.distanceKm - b.distanceKm;
      })
      .slice(0, SEWAGE_MAX_RESULTS);

    // Reverse-geocode sequentially (not in parallel) to stay well within
    // Nominatim's "no bursts" usage policy - there are at most
    // SEWAGE_MAX_RESULTS of these, so the added latency is small and this
    // whole route is cached for 5 minutes anyway.
    for (let i = 0; i < outfalls.length; i++) {
      outfalls[i].locationName = await reverseGeocode(
        outfalls[i].latitude,
        outfalls[i].longitude
      );
      if (i < outfalls.length - 1) await sleep(1000);
    }

    // Explicit name-based exclusion as a safety net for localities that are
    // geographically close to an included waypoint but were deliberately
    // left out (see CATCHMENT_EXCLUDED_LOCALITIES).
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
