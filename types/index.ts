// Shared TypeScript types for Severnwatch.
// Feature-specific types are added here as each data source is built out.

// CSO (Combined Sewer Overflow) spill status, from a water company's
// near-real-time Event Duration Monitoring (EDM) feed.
export type CsoState = "Ongoing" | "Recent";

export interface CsoOutfall {
  id: string;
  state: CsoState;
  watercourse: string;
  // Reverse-geocoded place name (e.g. "Hallow, Worcester") - the feed
  // itself has no human-readable site name, only an opaque id.
  locationName: string | null;
  latitude: number;
  longitude: number;
  // Distance to the nearest in-scope catchment waypoint (see
  // CATCHMENT_WAYPOINTS), not to Worcester itself - the corridor follows
  // the river rather than a simple radius.
  distanceKm: number;
  startISO: string | null; // spill start if Ongoing, or last status change
  endISO: string | null; // end of the most recent spill, if state is Recent
  durationMinutes: number | null; // duration so far (Ongoing) or total (Recent)
}

export interface CsoResponse {
  outfalls: CsoOutfall[];
  asOf: string; // ISO timestamp - when this data was fetched from source
}
