import { NextResponse } from "next/server";
import { WaterQualityResponse } from "@/types";
import { loadWaterQualitySamples } from "@/lib/waterQualityCsv";

// The samples come from CSVs committed to data/water-quality/, so nothing
// here changes between deploys: prerender the response at build time and
// serve it as a static file. A malformed export then fails the build, where
// it's seen, rather than every request at runtime. `next dev` still runs it
// per request, so a file dropped into the folder shows up on refresh.
//
// Moving the files to a shared Google Drive folder later means swapping the
// loader and giving this a `revalidate` - the response shape stays the same.
export const dynamic = "force-static";

export async function GET() {
  const { site, samples } = await loadWaterQualitySamples();
  const body: WaterQualityResponse = {
    site,
    samples,
    asOf: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
