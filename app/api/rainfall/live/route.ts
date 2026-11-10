import { NextResponse } from "next/server";
import { getRainfallPayload } from "@/lib/rainfall";

// Bypasses the route cache for a genuinely live response. The client calls
// this when /api/rainfall hands back an entry older than the cache window
// (see /api/sewage/live for why that happens).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getRainfallPayload({ live: true }));
  } catch (error) {
    console.error("Error fetching live rainfall data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
