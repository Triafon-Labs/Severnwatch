import { NextResponse } from "next/server";
import { RainfallResponse } from "@/types";
import { RAINFALL_GAUGES } from "@/lib/config";
import { fetchGaugeData } from "@/lib/rainfall";

export async function GET() {
  try {
    const gauges = await Promise.all(RAINFALL_GAUGES.map(fetchGaugeData));

    const body: RainfallResponse = {
      gauges,
      asOf: new Date().toISOString(),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching rainfall data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
