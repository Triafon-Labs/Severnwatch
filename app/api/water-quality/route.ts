import { NextResponse } from "next/server";
import { WaterQualityResponse } from "@/types";
import { loadWaterQualitySamples } from "@/lib/waterQualityCsv";
import { loadSampleConditions } from "@/lib/sampleConditions";

// The samples are every export uploaded through /upload
// (lib/waterQualityStore.ts). They don't change on their own, so the response is prerendered at build and served as a static file,
// and the upload route calls revalidatePath on this path when a new export
// arrives - the next request rebuilds it. That keeps Blob reads to one list
// per build and per upload, rather than one per cache window.
//
// A stored export that no longer parses fails the build, where it's seen,
// rather than every request. `next dev` runs this per request, so a local
// upload shows up on refresh.
//
// Each sample also carries the gauges' rain and the river's flow in the 72
// hours before it (lib/sampleConditions.ts), fetched here so it is worked out once per build
// rather than per visit. A sample's rain is settled by the time it is
// uploaded, so nothing goes stale between rebuilds; if the gauges were
// unreachable at build, that sample's rain is null until the next one. The
// week-long cache on those fetches also makes this route rebuild weekly,
// which fills any such gap without waiting for an upload.
export const dynamic = "force-static";

export async function GET() {
  const { site, samples } = await loadWaterQualitySamples();
  const body: WaterQualityResponse = {
    site,
    samples,
    ...(await loadSampleConditions(samples)),
    asOf: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
