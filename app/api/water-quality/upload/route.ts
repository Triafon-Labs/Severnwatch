import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { UploadResponse } from "@/types";
import { WATER_QUALITY_SITE_NAME } from "@/lib/config";
import { loadWaterQualitySamples, parseExport } from "@/lib/waterQualityCsv";
import { saveExport, uploadsAvailable } from "@/lib/waterQualityStore";

// Takes one SAS export from the /upload page, checks it, keeps it and has
// /api/water-quality rebuilt. Every error message here is shown to the
// tester as-is, so they're written for them, not for a log.
//
// Guarded by one shared passcode (UPLOAD_PASSCODE). That's a deliberately
// light lock: the worst a stranger with the passcode can do is upload a
// file that passes the SAS export check, which is kept alongside the others
// and can be deleted from the Blob store. A wrong passcode costs a second, so
// guessing it isn't practical.

const MAX_BYTES = 1024 * 1024; // the full season's export is ~10 KB

const fail = (status: number, error: string) =>
  NextResponse.json<UploadResponse>({ ok: false, error }, { status });

// Compared as fixed-length digests so neither the time taken nor an early
// exit on length gives away how much of a guess was right.
const passcodeMatches = (given: string, expected: string) => {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  const expected = process.env.UPLOAD_PASSCODE;
  if (!expected) {
    return fail(
      503,
      "Uploads aren't set up yet: there's no passcode configured for this site."
    );
  }
  if (!uploadsAvailable()) {
    return fail(
      503,
      "Uploads aren't set up yet: there's no storage connected for this site."
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "That upload didn't come through properly. Try again.");
  }

  const passcode = form.get("passcode");
  if (typeof passcode !== "string" || !passcodeMatches(passcode, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fail(401, "That passcode isn't right.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "Choose the CSV file to upload.");
  }
  if (file.size > MAX_BYTES) {
    return fail(
      400,
      "That file is far bigger than an SAS export. Check it's the right one."
    );
  }

  const text = await file.text();
  let parsed;
  try {
    parsed = parseExport(text, file.name);
  } catch (error) {
    return fail(400, (error as Error).message);
  }
  if (parsed.samples.length === 0) {
    return fail(
      400,
      `${file.name} has no approved samples for ${WATER_QUALITY_SITE_NAME}. Check it's the right site's export.`
    );
  }

  // What this adds, against what the site shows now.
  const current = await loadWaterQualitySamples();
  const before = new Map(current.samples.map((s) => [s.id, JSON.stringify(s)]));
  const added = parsed.samples.filter((s) => !before.has(s.id)).length;
  const updated = parsed.samples.filter(
    (s) => before.has(s.id) && before.get(s.id) !== JSON.stringify(s)
  ).length;

  const latest = parsed.samples.reduce<string | null>(
    (newest, s) =>
      newest === null || Date.parse(s.sampledAt) > Date.parse(newest)
        ? s.sampledAt
        : newest,
    null
  );

  // Nothing new: say so without storing a duplicate. Re-uploading the same
  // week by mistake is the likeliest slip, and keeping every copy would make
  // the store harder to tidy if a bad upload ever needs removing.
  if (added === 0 && updated === 0) {
    return NextResponse.json<UploadResponse>({
      ok: true,
      samples: parsed.samples.length,
      added,
      updated,
      latestSampledAt: latest,
    });
  }

  try {
    await saveExport(text);
  } catch (error) {
    console.error("Saving an uploaded export failed:", error);
    return fail(
      500,
      "The file checked out, but it couldn't be saved. Try again in a minute."
    );
  }
  revalidatePath("/api/water-quality");

  return NextResponse.json<UploadResponse>({
    ok: true,
    samples: parsed.samples.length,
    added,
    updated,
    latestSampledAt: latest,
  });
}
