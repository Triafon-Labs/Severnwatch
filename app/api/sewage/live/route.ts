import { NextResponse } from "next/server";
import { getSewagePayload } from "@/lib/sewage";

// Bypasses the route cache for a genuinely live response. The client calls
// this when /api/sewage hands back an entry older than the cache window -
// the first open after a quiet spell, when the cache gives that visitor the
// expired copy and only rebuilds behind them. Reverse geocoding still runs a
// second apart, so with many outfalls spilling this can take ~15s.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSewagePayload({ live: true }));
  } catch (error) {
    console.error("Error fetching live CSO data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
