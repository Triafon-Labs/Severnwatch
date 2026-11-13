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

// Reads SAS's "Water Quality Surveys" CSV export from Cartographer (one row
// per survey, keyed by its Survey ID). Server-only: it reads the
// filesystem, and is imported by /api/water-quality and its upload route.
//
// The export's shape is checked rather than trusted. A file whose columns
// don't match is an error, not something to guess at: if SAS rename a column,
// the build should fail where someone will see it rather than quietly show
// empty cards, or worse, numbers from the wrong column.

const COLUMNS = {
  surveyId: "Survey",
  gridRef: "Location: NGR",
  status: "Status",
  river: "River",
  site: "Site Name",
  date: "Date/Time of Survey: Date",
  time: "Date/Time of Survey: Time",
  eColi: "Escherichia Coli (CFU/100ml)",
  coliforms: "Total Thermotolerant Coliforms (CFU/100ml)",
  enterococci: "Intestinal Enterococci (CFU/100ml)",
  airTemperature: "Air Temperature (C)",
  weather: "Weather on Sampling Day",
  weatherDayBefore: "Weather on Day Before Sampling Day",
  rainfall24h: "Rainfall in Last 24 Hours (mm)",
  rainfall3Days: "Rainfall in Last 3 Days (mm)",
  swimmers: "Number of Swimmers",
  otherWaterUsers: "Number of Other Water Users",
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

// "28/10/2026" + "11:45", in Worcester wall-clock time.
const parseSampledAt = (date: string, time: string): string | null => {
  const d = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!d) return null;
  const day = Number(d[1]);
  const month = Number(d[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const t = time.trim().match(/^(\d{1,2}):(\d{2})/);
  // A sample with no time is placed at midday, so it can't slip a calendar
  // day either side of where it was written down.
  const hour = t ? Number(t[1]) : 12;
  const minute = t ? Number(t[2]) : 0;
  return new Date(
    londonWallClockToUtcMs(Number(d[3]), month, day, hour, minute)
  ).toISOString();
};

// The lab's limits of detection come through as text in the count itself:
// "<10" below the lowest dilution, ">1000" above the highest.
const QUALIFIERS: Record<string, CountQualifier> = {
  "<": "below",
  ">": "above",
};

const parseCount = (value: string, where: string): BacteriaCount | null => {
  const v = value.trim();
  if (v === "") return null;
  const m = v.match(/^([^\d\s.]*)\s*(\d+(?:\.\d+)?)$/);
  if (!m) {
    throw new Error(`${where}: "${v}" is not a count`);
  }
  const prefix = m[1];
  const qualifier = prefix === "" ? "exact" : QUALIFIERS[prefix];
  if (!qualifier) {
    // An unrecognised qualifier is reported rather than read as exact: a
    // count marked as some new kind of limit shown as a plain number would
    // be the one wrong answer that looks right.
    throw new Error(`${where}: unrecognised qualifier "${prefix}" in "${v}"`);
  }
  return { value: Number(m[2]), qualifier };
};

const parseNumber = (value: string): number | null => {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// "Intermittent Showers" -> "Intermittent showers".
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
  // The map's "SAS Coliforms Map Data" download is the likeliest mix-up: it
  // has the same samples, but less of what the tester recorded, and keys
  // them by a different ID.
  if (header.includes("Feature ID")) {
    throw new Error(
      `${fileName} is the SAS map's Coliforms Map Data download. Upload the Water Quality Surveys export instead.`
    );
  }
  if (missing.length > Object.keys(COLUMNS).length / 2) {
    throw new Error(
      `${fileName} isn't the SAS Water Quality Surveys export. Download it again from SAS and upload that file.`
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
    // Only results SAS have approved. A draft may still be corrected or
    // withdrawn (and the export's drafts usually have no counts at all), and
    // this app has no way to un-show a result once it's spread.
    if (get("status").trim().toLowerCase() !== "approved") return;

    const sampledAt = parseSampledAt(get("date"), get("time"));
    if (!sampledAt) {
      throw new Error(`${where}: can't read the date "${get("date")}"`);
    }

    site ??= {
      name: WATER_QUALITY_SITE_NAME,
      river: get("river").trim(),
      gridRef: get("gridRef").trim(),
    };

    samples.push({
      id: get("surveyId").trim(),
      sampledAt,
      eColi: parseCount(get("eColi"), `${where} E. coli`),
      enterococci: parseCount(get("enterococci"), `${where} Enterococci`),
      coliforms: parseCount(get("coliforms"), `${where} coliforms`),
      airTemperatureC: parseNumber(get("airTemperature")),
      weather: humanise(get("weather")),
      weatherDayBefore: humanise(get("weatherDayBefore")),
      rainfall24hMm: parseNumber(get("rainfall24h")),
      rainfall3DaysMm: parseNumber(get("rainfall3Days")),
      swimmers: parseNumber(get("swimmers")),
      otherWaterUsers: parseNumber(get("otherWaterUsers")),
      notes: get("notes").trim() || null,
    });
  });

  return { site, samples };
};

// Exports merged by Survey ID, in the order given: a later export's copy of
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
