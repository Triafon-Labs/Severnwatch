import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, list, put } from "@vercel/blob";

// Where uploaded SAS exports live. Server-only.
//
// On Vercel: a private Vercel Blob store, connected to the project in the
// Vercel dashboard (which sets BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID for an
// OIDC-connected store). Private rather than public, so a file is only
// readable through this app - the passcode on the upload page is the one way
// in, and nothing hands out a direct URL to the stored file.
//
// Anywhere else (npm run dev / next start on a laptop) with no store
// connected: a gitignored folder, data/water-quality/uploads/, so the whole
// upload flow can be tried locally without a Vercel account. On Vercel the
// filesystem is read-only, so there the store is required.
//
// Every upload is kept rather than overwritten. They're merged by Survey ID
// in upload order (see loadWaterQualitySamples), so a partial export can't
// remove samples, a later correction wins, and a bad upload is undone by
// deleting that one file in the Vercel dashboard (Storage -> the store).

const BLOB_PREFIX = "water-quality/";

export interface StoredExport {
  name: string;
  text: string;
}

export const blobConfigured = (): boolean =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Uploads can be saved somewhere: a Blob store, or the local folder when
// not running on Vercel.
export const uploadsAvailable = (): boolean =>
  blobConfigured() || !process.env.VERCEL;

const localDir = () =>
  // A literal path rather than one built from a constant: the bundler traces
  // the files a route needs from it (see lib/waterQualityCsv.ts).
  path.join(process.cwd(), "data", "water-quality", "uploads");

const streamToText = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream).text();

// Every stored export, oldest upload first.
export const listStoredExports = async (): Promise<StoredExport[]> => {
  if (blobConfigured()) {
    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_PREFIX, cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    blobs.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
    return Promise.all(
      blobs.map(async (blob) => {
        // Straight from origin storage: this runs at build and right after
        // an upload, when a CDN copy could be the one thing that's behind.
        const result = await get(blob.pathname, {
          access: "private",
          useCache: false,
        });
        if (!result || result.statusCode !== 200) {
          throw new Error(`Couldn't read ${blob.pathname} from the Blob store`);
        }
        return { name: blob.pathname, text: await streamToText(result.stream) };
      })
    );
  }

  if (process.env.VERCEL) return [];
  try {
    const dir = localDir();
    // Named by upload time (below), so name order is upload order.
    const files = (await readdir(dir))
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .sort();
    return Promise.all(
      files.map(async (f) => ({
        name: `uploads/${f}`,
        text: await readFile(path.join(dir, f), "utf8"),
      }))
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

// Keeps an upload, named by when it arrived so the store reads in order.
export const saveExport = async (text: string): Promise<string> => {
  const name = `SAS_export_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  if (blobConfigured()) {
    const blob = await put(`${BLOB_PREFIX}${name}`, text, {
      access: "private",
      contentType: "text/csv; charset=utf-8",
      // Two uploads in the same millisecond is unlikely, but a suffix makes
      // it impossible for one to overwrite the other.
      addRandomSuffix: true,
    });
    return blob.pathname;
  }
  if (process.env.VERCEL) {
    throw new Error("No Blob store is connected to this project.");
  }
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(localDir(), name), text, "utf8");
  return `uploads/${name}`;
};
