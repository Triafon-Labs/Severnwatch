import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { CsoResponse, RainfallResponse, WaterQualityResponse } from "@/types";
import {
  buildDayRecords,
  buildSnapshot,
  hourKey,
  mergeDayRecords,
  parseMonth,
} from "@/lib/riskHistory";
import {
  historyAvailable,
  monthKey,
  readMonth,
  writeMonth,
} from "@/lib/riskHistoryStore";
import { fetchBewdleyFlow } from "@/lib/riverFlow";
import { londonDayKey } from "@/lib/time";

// Records what the app is saying right now, and the last few days' rain and
// spills as they now stand, at most once an hour.
//
// Called by the keep-alive workflow every 15 minutes
// (.github/workflows/keep-alive.yml). Four chances an hour because GitHub
// runs schedules late and skips some; the first to land in a new hour
// records, the rest find that hour taken and do nothing.
//
// Open to anyone, deliberately - there is nothing to protect. It takes no
// input: the snapshot is built from this app's own responses, so a caller
// can't put anything into the history, only prompt a recording that was due
// anyway.
//
// Always answers 200 with what happened, even when nothing can be kept (no
// store connected yet) or a feed is down: the workflow treats 4xx/5xx as the
// site being broken, and a missed snapshot isn't that.
export const dynamic = "force-dynamic";

// The hour last recorded by this server instance, so the calls that follow
// in the same hour skip the read from storage.
let lastRecordedHour: string | null = null;

const getOwn = async <T>(request: NextRequest, path: string): Promise<T> => {
  // The app's own routes, so the snapshot is drawn from the very responses
  // (cached, geocoded) a visitor is being shown.
  const response = await fetch(new URL(path, request.nextUrl.origin), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
};

export async function GET(request: NextRequest) {
  if (!historyAvailable()) {
    return NextResponse.json({ recorded: false, reason: "no-store" });
  }

  const now = Date.now();
  const hour = hourKey(new Date(now).toISOString());
  if (lastRecordedHour === hour) {
    return NextResponse.json({ recorded: false, reason: "already-recorded" });
  }

  try {
    const month = monthKey(now);
    const stored = parseMonth(await readMonth(month));
    const { snapshots } = stored;
    const last = snapshots[snapshots.length - 1];
    if (last && hourKey(last.at) === hour) {
      lastRecordedHour = hour;
      return NextResponse.json({ recorded: false, reason: "already-recorded" });
    }

    // Spills are the one source a snapshot can't do without; the others
    // degrade to null, as they do on the card.
    const [cso, rainfall, waterQuality, flow] = await Promise.all([
      getOwn<CsoResponse>(request, "/api/sewage"),
      getOwn<RainfallResponse>(request, "/api/rainfall").catch(() => null),
      getOwn<WaterQualityResponse>(request, "/api/water-quality").catch(
        () => null
      ),
      fetchBewdleyFlow(),
    ]);

    const snapshot = buildSnapshot(cso, rainfall, waterQuality, flow, now);
    snapshots.push(snapshot);
    // The last few days' rain and spills, filled in a little further.
    const days = mergeDayRecords(
      stored.days,
      buildDayRecords(cso, rainfall, now)
    );
    await writeMonth(month, JSON.stringify({ snapshots, days }));
    lastRecordedHour = hour;
    // The chart is drawn in days, so its route only needs rebuilding ahead
    // of its own three-hour cycle when a new day starts - which also makes
    // the card appear straight after the very first recording.
    if (!last || londonDayKey(Date.parse(last.at)) !== londonDayKey(now)) {
      revalidatePath("/api/risk-history");
    }
    return NextResponse.json({ recorded: true, snapshot });
  } catch (error) {
    console.error("Error recording risk history:", error);
    return NextResponse.json({ recorded: false, reason: "error" });
  }
}
