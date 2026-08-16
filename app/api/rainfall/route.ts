import { NextResponse } from "next/server";
import { RainfallForecastPoint, RainfallResponse } from "@/types";
import { RAINFALL_GAUGES } from "@/lib/config";
import { fetchGaugeData, fetchRainfallForecast } from "@/lib/rainfall";

export async function GET() {
  try {
    const gauges = await Promise.all(RAINFALL_GAUGES.map(fetchGaugeData));

    // Best-effort: Open-Meteo is a "nice to have" forecast layer on top of
    // the EA gauge readings above, not the core data - a failure here
    // shouldn't take down the rest of the rainfall card.
    let forecast: RainfallForecastPoint[] = [];
    try {
      forecast = await fetchRainfallForecast();
    } catch (error) {
      console.error("Error fetching rainfall forecast:", error);
    }

    const body: RainfallResponse = {
      gauges,
      forecast,
      asOf: new Date().toISOString(),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("Error fetching rainfall data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
