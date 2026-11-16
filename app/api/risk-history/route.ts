import { NextResponse } from "next/server";
import { DayRecord, RiskHistoryResponse } from "@/types";
import { fetchRainHistory } from "@/lib/rainHistory";
import { collectDays, parseMonth } from "@/lib/riskHistory";
import {
  historyAvailable,
  monthKey,
  previousMonthKey,
  readMonth,
} from "@/lib/riskHistoryStore";

// Rain and spills by day, for the Rain vs Water Quality chart. Rain is
// Open-Meteo's archive, fetched here and reaching back past the oldest
// sample; spills are the app's own record, which begins when a Blob store
// is connected. Each is best-effort: with no store the days carry rain
// alone, and with the archive down they carry spills alone.
//
// Cached for three hours: the chart works in days, so nothing on it moves
// faster than that, and every rebuild is one archive request and one
// storage read per month kept. Has to be a literal (see lib/fetchCache.ts).
export const revalidate = 10800;

// How far back recorded spills are read, which bounds the reads per rebuild.
const MAX_MONTHS = 13;

export async function GET() {
  const months: Record<string, DayRecord>[] = [];
  try {
    if (historyAvailable()) {
      // Newest month backwards, stopping at the first month with nothing in
      // it - the months before recording began. (A whole month missed in the
      // middle would hide everything before it; the files would still be
      // there.)
      let key = monthKey(Date.now());
      for (let i = 0; i < MAX_MONTHS; i++) {
        const month = parseMonth(await readMonth(key));
        // The current month can be empty in its first hour.
        if (month.snapshots.length === 0 && i > 0) break;
        months.unshift(month.days);
        key = previousMonthKey(key);
      }
    }
  } catch (error) {
    console.error("Error reading risk history:", error);
  }

  const rain = await fetchRainHistory().catch((error) => {
    console.error("Error fetching rain history:", error);
    return {};
  });

  const body: RiskHistoryResponse = {
    days: collectDays(rain, months),
    asOf: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
