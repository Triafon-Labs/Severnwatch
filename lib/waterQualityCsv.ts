import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BacteriaCount,
  CountQualifier,
  WaterQualitySample,
  WaterQualitySite,
} from "@/types";
import { WATER_QUALITY_SITE_NAME } from "@/lib/config";
import { londonWallClockToUtcMs } from "@/lib/time";
import { listStoredExports } from "@/lib/waterQualityStore";

// Reads SAS's Cartographer "Download data" export. Server-only: it reads the
// filesystem, and is imported by /api/water-quality and its upload route.
//
// The export's shape is checked rather than trusted. A file whose columns
// don't match is an error, not something to guess at: if SAS rename a column,
// the build should fail where someone will see it rather than quietly show
// empty cards, or worse, numbers from the wrong column.

const COLUMNS = {
  featureId: "Feature ID",
  location: "Location",
  status: "Status",
  river: "River",
  site: "Site",
  date: "Date/Time: Date",
  time: "Date/Time: Time",
  eColi: "Escherichia Coli",
  eColiRange: "Escherichia Coli Range",
  coliforms: "Total Thermotolerant Coliforms",
  coliformsRange: "Total Thermotolerant Coliforms Range",
  enterococci: "Intestinal Enterococci",
  enterococciRange: "Intestinal Enterococci Range",
  airTemperature: "Air Temperature",
  weather: "Weather",
  weatherDayBefore: "Weather Day Before",
  rainfall: "Rainfall",
  rainfallDayBefore: "Rainfall Day Before",
  swimmers: "Number Of Swimmers",
  otherWaterUsers: "Number Of Other Water Users",
  notes: "Notes",
} as const;

type ColumnKey = keyof typeof COLUMNS;

// RFC 4180: fields separated by commas, optionally double-quoted, with "" as
// an escaped quote and newlines allowed inside quotes. The tester's Notes
// column is free text, so a comma or a line break in it is expected.
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 byte order mark, which Excel adds if the file has been
  // opened and re-saved there.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines (the export ends with one) come through as a single empty
  // field.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

// "28 Oct 2026" + "11:45", in Worcester wall-clock time.
const parseSampledAt = (date: string, time: string): string | null => {
  const d = date.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/);
  if (!d) return null;
  const month = MONTHS[d[2].toLowerCase()];
  if (!month) return null;
  const t = time.trim().match(/^(\d{1,2}):(\d{2})/);
  // A sample with no time is placed at midday, so it can't slip a calendar
  // day either side of where it was written down.
  const hour = t ? Number(t[1]) : 12;
  const minute = t ? Number(t[2]) : 0;
  return new Date(
    londonWallClockToUtcMs(Number(d[3]), month, Number(d[1]), hour, minute)
  ).toISOString();
};

const QUALIFIERS: Record<string, CountQualifier> = {
  LessThan: "below",
  InRange: "exact",
  GreaterThan: "above",
};

const parseCount = (
  value: string,
  range: string,
  where: string
): BacteriaCount | null => {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`${where}: "${v}" is not a number`);
  }
  const r = range.trim();
  const qualifier = QUALIFIERS[r];
  if (!qualifier && r !== "") {
    // An unrecognised qualifier is reported rather than read as exact: a
    // count marked as some new kind of limit shown as a plain number would
    // be the one wrong answer that looks right.
    throw new Error(`${where}: unrecognised range "${r}"`);
  }
  return { value: n, qualifier: qualifier ?? "exact" };
};

const parseNumber = (value: string): number | null => {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// "IntermittentShowers" -> "Intermittent showers".
const humanise = (value: string): string | null => {
  const v = value.trim();
  if (v === "") return null;
  const words = v.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export interface ParsedExport {
  site: WaterQualitySite | null;
  samples: WaterQualitySample[];
}

// One export, checked and parsed. Throws with the file, row and column named
// when it doesn't look like the SAS export - which the upload route shows to
// the tester as-is, so the messages are written for them.
export const parseExport = (text: string, fileName: string): ParsedExport => {
  const rows = parseCsv(text);
  if (rows.length === 0) return { site: null, samples: [] };

  const header = rows[0].map((h) => h.trim());
  const index = {} as Record<ColumnKey, number>;
  const missing: string[] = [];
  for (const [key, name] of Object.entries(COLUMNS) as [ColumnKey, string][]) {
    const i = header.indexOf(name);
    if (i === -1) missing.push(name);
    index[key] = i;
  }
  // Most columns missing means it's a different file altogether, and a list
  // of twenty column names helps nobody; a few missing means SAS have changed
  // the export, and the names are what needs fixing in COLUMNS above.
  if (missing.length > Object.keys(COLUMNS).length / 2) {
    throw new Error(
      `${fileName} isn't the SAS water quality export. Download the data again from the SAS map and upload that file.`
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `${fileName} looks like the SAS export, but it's missing column(s): ${missing.join(", ")}. SAS may have changed the export format.`
    );
  }

  let site: WaterQualitySite | null = null;
  const samples: WaterQualitySample[] = [];

  rows.slice(1).forEach((row, i) => {
    const get = (key: ColumnKey) => row[index[key]] ?? "";
    const where = `${fileName} row ${i + 2}`;

    if (get("site").trim() !== WATER_QUALITY_SITE_NAME) return;
    // Only results SAS have approved. A pending one may still be corrected
    // or withdrawn, and this app has no way to un-show it once it's spread.
    if (get("status").trim().toLowerCase() !== "approved") return;

    const sampledAt = parseSampledAt(get("date"), get("time"));
    if (!sampledAt) {
      throw new Error(`${where}: can't read the date "${get("date")}"`);
    }

    site ??= {
      name: WATER_QUALITY_SITE_NAME,
      river: get("river").trim(),
      gridRef: get("location").trim(),
    };

    samples.push({
      id: get("featureId").trim(),
      sampledAt,
      eColi: parseCount(get("eColi"), get("eColiRange"), `${where} E. coli`),
      enterococci: parseCount(
        get("enterococci"),
        get("enterococciRange"),
        `${where} Enterococci`
      ),
      coliforms: parseCount(
        get("coliforms"),
        get("coliformsRange"),
        `${where} coliforms`
      ),
      airTemperatureC: parseNumber(get("airTemperature")),
      weather: humanise(get("weather")),
      weatherDayBefore: humanise(get("weatherDayBefore")),
      rainfallMm: parseNumber(get("rainfall")),
      rainfallDayBeforeMm: parseNumber(get("rainfallDayBefore")),
      swimmers: parseNumber(get("swimmers")),
      otherWaterUsers: parseNumber(get("otherWaterUsers")),
      notes: get("notes").trim() || null,
    });
  });

  return { site, samples };
};

// Exports merged by Feature ID, in the order given: a later export's copy of
// a sample replaces an earlier one, so a correction wins.
export const mergeExports = (
  parsed: ParsedExport[]
): { site: WaterQualitySite; samples: WaterQualitySample[] } => {
  const byId = new Map<string, WaterQualitySample>();
  let site: WaterQualitySite | null = null;
  for (const file of parsed) {
    site ??= file.site;
    for (const sample of file.samples) byId.set(sample.id, sample);
  }
  return {
    site: site ?? {
      name: WATER_QUALITY_SITE_NAME,
      river: "River Severn",
      gridRef: "",
    },
    samples: [...byId.values()].sort(
      (a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt)
    ),
  };
};

// Every committed CSV in data/water-quality/ (in name order - the dated names
// in its README make that oldest first), then every uploaded export (in
// upload order, lib/waterQualityStore.ts). The committed files are the
// baseline; uploads layer on top and win where they repeat a sample.
export const loadWaterQualitySamples = async (): Promise<{
  site: WaterQualitySite;
  samples: WaterQualitySample[];
}> => {
  // Spelled out rather than read from a constant: the bundler traces which
  // files this route needs from the literal path, and a variable here makes
  // it include the whole project in the server output.
  const dir = path.join(process.cwd(), "data", "water-quality");
  const files = (await readdir(dir))
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  const committed = await Promise.all(
    files.map(async (file) =>
      parseExport(await readFile(path.join(dir, file), "utf8"), file)
    )
  );
  const uploaded = (await listStoredExports()).map(({ name, text }) =>
    parseExport(text, name)
  );
  return mergeExports([...committed, ...uploaded]);
};
