import { CATCHMENT_WAYPOINTS, CATCHMENT_EXCLUDED_LOCALITIES } from "@/lib/config";

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

// Is this point within the Worcester-to-Bewdley catchment corridor? True if
// it falls within radiusKm of any named waypoint (see CATCHMENT_WAYPOINTS).
export const nearestWaypointDistanceKm = (
  lat: number,
  lon: number
): number | null => {
  let nearest: number | null = null;
  for (const wp of CATCHMENT_WAYPOINTS) {
    const d = distanceKm(lat, lon, wp.lat, wp.lon);
    if (d <= wp.radiusKm && (nearest === null || d < nearest)) {
      nearest = d;
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
