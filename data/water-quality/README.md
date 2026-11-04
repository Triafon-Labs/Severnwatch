# Citizen science water quality samples

The Latest Sample and Sample History cards, and the sample factor in the
headline pollution risk, are built from the CSV files in this folder.
Surfers Against Sewage's Water Quality map has no public API, so the data
gets here by hand.

## Adding new results

1. On the SAS Water Quality map, download the data for the Grandstand Road
   site (the "SAS Coliforms Map Data" CSV export).
2. Save it here as `SAS_Coliforms_Map_Data_YYYY-MM-DD.csv`, using the date you
   downloaded it. Don't edit the file.
3. Commit and push. The deploy rebuilds the cards from the new file.

Old exports can stay where they are. Every CSV in this folder is read and
merged by Feature ID. A new export that repeats old samples doesn't duplicate
them, and a partial export can't remove samples an earlier one had. Where two
files have the same sample, the one later in name order wins. The dated
filenames mean a correction in a newer export replaces the older value.

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

## If the build fails

The build checks every file's column headings. If SAS rename or drop a
column, or a count has a Range value the parser doesn't recognise, the build
stops with an error naming the file, row and column. That's deliberate:
showing wrong numbers would be worse than showing none. Fix the parser in
`lib/waterQualityCsv.ts`, not the CSV.
