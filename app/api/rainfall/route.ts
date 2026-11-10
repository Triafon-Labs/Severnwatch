import { NextResponse } from "next/server";
import { getRainfallPayload } from "@/lib/rainfall";

// Match the EA gauge and Open-Meteo source cadence (DATA_REVALIDATE_SECONDS
// in lib/fetchCache.ts - this has to be a literal).
export const revalidate = 900;

export async function GET() {
  try {
    return NextResponse.json(await getRainfallPayload());
  } catch (error) {
    console.error("Error fetching rainfall data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
