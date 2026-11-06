import { NextResponse } from "next/server";
import { WaterQualityResponse } from "@/types";
import { loadWaterQualitySamples } from "@/lib/waterQualityCsv";

// The samples are the CSVs committed to data/water-quality/ plus every export
// uploaded through /upload (lib/waterQualityStore.ts). Neither changes on its
// own, so the response is prerendered at build and served as a static file,
// and the upload route calls revalidatePath on this path when a new export
// arrives - the next request rebuilds it. That keeps Blob reads to one list
// per build and per upload, rather than one per cache window.
//
// A stored export that no longer parses fails the build, where it's seen,
// rather than every request. `next dev` runs this per request, so a file
// dropped into the folder shows up on refresh.
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
