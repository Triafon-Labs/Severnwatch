# Citizen science water quality samples

The Latest Sample and Sample History cards, and the sample factor in the
headline pollution risk, are built from Surfers Against Sewage's CSV export.
SAS's Water Quality map has no public API, so each week's export is added by
hand.

## Adding new results

1. On the SAS Water Quality map, download the data for the Grandstand Road
   site (the "SAS Coliforms Map Data" CSV export). Don't edit the file.
2. In the app, open **Settings → Info → For Testers → Upload Sample
   Results** (or go straight to `/upload`), enter the passcode, choose the
   file and press Upload.

The page checks the file before anything is stored, then says what it found:
"25 samples read - 1 new", or exactly what's wrong with the file. The cards
pick the new samples up within a minute, with no redeploy.

The page asks search engines not to list it.

## Where the samples come from

The app merges, by Feature ID:

1. **Every CSV committed in this folder**, in name order. This is the
   baseline, and how the first season's export got here.
2. **Every export uploaded through `/upload`**, in upload order. These are
   stored in a private Vercel Blob store (`lib/waterQualityStore.ts`).

A later copy of a sample replaces an earlier one, so a corrected result wins.
A partial export can't remove samples an earlier one had. Uploading a file
with nothing new in it stores nothing.

To undo a bad upload, delete that file from the Blob store in the Vercel
dashboard (Storage → the store → `water-quality/`), then redeploy or upload
again so the route rebuilds.

Committing a CSV here still works too: name it
`SAS_Coliforms_Map_Data_YYYY-MM-DD.csv` and push.

## Setting it up on Vercel

Two things, both in the Vercel dashboard for the project:

- **Connect a Blob store** (Storage → Create → Blob, and choose **Private**
  access). Connecting it sets `BLOB_READ_WRITE_TOKEN` for you.
- **Set `UPLOAD_PASSCODE`** (Settings → Environment Variables) to the
  passcode testers will use, then redeploy.

Until both are set, `/upload` explains that uploads aren't set up, and the
cards carry on with the committed CSVs.

Running locally (`npm run dev`) needs neither: set `UPLOAD_PASSCODE` in
`.env.local` to try the page, and uploads are saved to
`data/water-quality/uploads/` (gitignored) instead of Blob.

## What's read

- Only rows whose Site is **Grandstand Road** (`WATER_QUALITY_SITE_NAME` in
  `lib/config.ts`). Any other sites in the export are ignored.
- Only rows with Status **approved**.
- E. coli and Intestinal Enterococci, with their Range column kept:
  `LessThan 10` is shown as "<10" and `GreaterThan 1000` as ">1000", never
  as plain numbers.
- Air temperature, weather, rainfall, water users and Notes when they're
  filled in.
- Total Thermotolerant Coliforms are parsed but not shown. They're a broader
  count that E. coli is the main part of, and they've had no bathing water
  limit since 2006, so there's nothing to judge them against.

## If a file is rejected, or the build fails

Every file's column headings are checked. If SAS rename or drop a column, or
a count has a Range value the parser doesn't recognise, the upload is
refused with the file, row and column named. A committed file that fails
the same check stops the build. That's deliberate: showing wrong numbers
would be worse than showing none. Fix the parser in `lib/waterQualityCsv.ts`,
not the CSV.
