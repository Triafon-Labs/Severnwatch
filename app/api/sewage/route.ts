import { NextResponse } from "next/server";
import { getSewagePayload } from "@/lib/sewage";

// Cache the completed response, including reverse-geocoded place names, for
// the same window as the feed itself (DATA_REVALIDATE_SECONDS in
// lib/fetchCache.ts - this has to be a literal). Without the route cache
// every manual refresh would rebuild the whole response.
export const revalidate = 900;

export async function GET() {
  try {
    return NextResponse.json(await getSewagePayload());
  } catch (error) {
    console.error("Error fetching CSO data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
