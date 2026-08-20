import {
  CATCHMENT_WAYPOINTS,
  CATCHMENT_EXCLUDED_LOCALITIES,
  CATCHMENT_EXCLUDED_WATERCOURSES,
  CatchmentWaypoint,
  RiverBranchId,
} from "@/lib/config";

// Haversine distance in km between two lat/long points.
export const distanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export interface NearestWaypoint {
  waypoint: CatchmentWaypoint;
  distanceKm: number;
}

// Is this point within the Worcester-to-Bewdley catchment corridor, and if
// so which waypoint does it sit closest to? Non-null when it falls within
// radiusKm of any named waypoint (see CATCHMENT_WAYPOINTS).
//
// The waypoint identity - not just the distance - is what lets the river
// schematic place the outfall as a stop on the right branch, in the right
// order, without needing river-network topology we don't have.
// Check if a watercourse drains away from or outside the catchment corridor
export const isExcludedWatercourse = (
  watercourse?: string | null
): boolean => {
  if (!watercourse) return false;
  const upper = watercourse.toUpperCase();
  return CATCHMENT_EXCLUDED_WATERCOURSES.some((excluded) =>
    upper.includes(excluded)
  );
};

export const nearestWaypoint = (
  lat: number,
  lon: number,
  watercourse?: string | null
): NearestWaypoint | null => {
  if (isExcludedWatercourse(watercourse)) return null;

  // Determine branch affinity if watercourse is provided
  let preferredBranch: RiverBranchId | null = null;
  if (watercourse) {
    const upper = watercourse.toUpperCase();
    if (upper.includes("STOUR")) {
      preferredBranch = "stour";
    } else if (upper.includes("SALWARPE")) {
      preferredBranch = "salwarpe";
    }
  }

  // If a branch preference exists, check if any waypoint on that branch is within range
  if (preferredBranch) {
    let bestBranch: NearestWaypoint | null = null;
    for (const wp of CATCHMENT_WAYPOINTS) {
      if (wp.branch !== preferredBranch) continue;
      const d = distanceKm(lat, lon, wp.lat, wp.lon);
      if (
        d <= wp.radiusKm &&
        (bestBranch === null || d < bestBranch.distanceKm)
      ) {
        bestBranch = { waypoint: wp, distanceKm: d };
      }
    }
    if (bestBranch) return bestBranch;
  }

  // Fall back to nearest waypoint across all branches
  let nearest: NearestWaypoint | null = null;
  for (const wp of CATCHMENT_WAYPOINTS) {
    const d = distanceKm(lat, lon, wp.lat, wp.lon);
    if (d <= wp.radiusKm && (nearest === null || d < nearest.distanceKm)) {
      nearest = { waypoint: wp, distanceKm: d };
    }
  }
  return nearest;
};

// Safety-net exclusion by resolved place name, for localities that are
// geographically close to an included waypoint but were deliberately left
// out (see CATCHMENT_EXCLUDED_LOCALITIES for why).
export const isExcludedLocality = (locationName: string | null): boolean => {
  if (!locationName) return false;
  const lower = locationName.toLowerCase();
  return CATCHMENT_EXCLUDED_LOCALITIES.some((excluded) =>
    lower.includes(excluded)
  );
};
