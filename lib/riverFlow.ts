// River Severn flow at Bewdley (EA station 2001, m3/s), for the risk
// history. Server-only, best-effort: null on any failure, since a missing
// flow must never cost a snapshot.
const BEWDLEY_MEASURES_URL =
  "https://environment.data.gov.uk/flood-monitoring/id/stations/2001/measures?parameter=flow";

export const fetchBewdleyFlow = async (): Promise<number | null> => {
  try {
    const response = await fetch(BEWDLEY_MEASURES_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    const value: unknown = data?.items?.[0]?.latestReading?.value;
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.round(value * 10) / 10
      : null;
  } catch {
    return null;
  }
};
