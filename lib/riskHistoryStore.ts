import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { blobConfigured } from "@/lib/waterQualityStore";

// Where the risk history is kept. Server-only.
//
// The same private Vercel Blob store as the sample uploads
// (lib/waterQualityStore.ts), under its own prefix: one JSON file per
// calendar month, risk-history/2026-11.json, holding that month's snapshots
// oldest first. Off Vercel with no store connected it's a gitignored folder,
// data/risk-history/, so recording can be tried on a laptop.
//
// One file a month rather than one per snapshot: reading the history back is
// then a handful of reads however long it has run, where a file per hour
// would be a list and several hundred reads per month. The cost is a
// read-modify-write on every recording, which is safe only because one thing
// records (see app/api/risk-history/record).
//
// Months are addressed by name, never listed: a list is one of Blob's
// metered "advanced" operations, and the names are known.

const BLOB_PREFIX = "risk-history/";

// History can be kept somewhere: a Blob store, or the local folder when not
// running on Vercel.
export const historyAvailable = (): boolean =>
  blobConfigured() || !process.env.VERCEL;

const localDir = () => path.join(process.cwd(), "data", "risk-history");

// "2026-11", in UTC - a file boundary, not a calendar the reader sees.
export const monthKey = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 7);

// The month before a key: "2026-01" -> "2025-12".
export const previousMonthKey = (key: string): string => {
  const [year, month] = key.split("-").map(Number);
  return monthKey(Date.UTC(year, month - 2, 1));
};

// A month's file as text, or null if nothing has been recorded in it.
export const readMonth = async (key: string): Promise<string | null> => {
  if (blobConfigured()) {
    // Straight from origin storage: the recorder reads this back to append
    // to it, and a CDN copy an hour behind would drop the last snapshot.
    const result = await get(`${BLOB_PREFIX}${key}.json`, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).text();
  }
  if (process.env.VERCEL) return null;
  try {
    return await readFile(path.join(localDir(), `${key}.json`), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const writeMonth = async (key: string, text: string): Promise<void> => {
  if (blobConfigured()) {
    await put(`${BLOB_PREFIX}${key}.json`, text, {
      access: "private",
      contentType: "application/json; charset=utf-8",
      // The month's one file, rewritten with each snapshot added.
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("No Blob store is connected to this project.");
  }
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(localDir(), `${key}.json`), text, "utf8");
};
