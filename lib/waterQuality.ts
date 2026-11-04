import { BacteriaCount, WaterQualitySample } from "@/types";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import { formatLondonDate } from "@/lib/londonDate";

// How the citizen science counts are read, in one place for the sample card,
// the history chart and the headline pollution risk.
//
// A bathing water classification is a statistic over years of samples (see
// WaterQualityInfoContent), so no single sample "is" Excellent or Poor. What
// a single count can honestly be compared against is the same limits: below
// the Excellent limit, between Excellent and Good, or over the Good limit.
// The Sufficient limits are left out on purpose - they sit *below* Good's
// (900 vs 1000 E. coli) because they're judged on a different percentile, so
// on a single number the ladder would run backwards.

// Only the two the bathing water classification is judged on. The export
// also carries total thermotolerant coliforms, which the parser still reads
// (WaterQualitySample.coliforms) but the cards leave out: they're a broader
// count that E. coli is the main part of, have had no limit since the 2006
// bathing water rules replaced them, and with nothing to compare against,
// a reading of "690" just looks alarming.
export type IndicatorKey = "eColi" | "enterococci";

export interface Indicator {
  key: IndicatorKey;
  label: string;
  shortLabel: string;
  // The single-sample limits, per 100 ml: the inland Excellent and Good
  // limits from the Bathing Water Regulations 2013.
  limits: { excellent: number; good: number };
}

export const INDICATORS: Record<IndicatorKey, Indicator> = {
  eColi: {
    key: "eColi",
    label: "E. coli",
    shortLabel: "E. coli",
    limits: { excellent: 500, good: 1000 },
  },
  enterococci: {
    key: "enterococci",
    label: "Intestinal Enterococci",
    shortLabel: "Enterococci",
    limits: { excellent: 200, good: 400 },
  },
};

// The two that the classification is judged on, in display order.
export const CLASSIFIED_INDICATORS: IndicatorKey[] = ["eColi", "enterococci"];

export type SampleBand = "low" | "elevated" | "high";

export const SAMPLE_BAND_UI: Record<
  SampleBand,
  {
    label: string;
    headline: string;
    color: string;
    onColor: string;
    description: string;
  }
> = {
  low: {
    label: "Low",
    headline: "Low Bacteria",
    color: STATUS_COLORS.darkGreen,
    onColor: ON_STATUS_COLORS.darkGreen,
    description: "Below the Excellent limit",
  },
  elevated: {
    label: "Elevated",
    headline: "Elevated Bacteria",
    color: STATUS_COLORS.amber,
    onColor: ON_STATUS_COLORS.amber,
    description: "Over the Excellent limit, within Good",
  },
  high: {
    label: "High",
    headline: "High Bacteria",
    color: STATUS_COLORS.red,
    onColor: ON_STATUS_COLORS.red,
    description: "Over the Good limit",
  },
};

const BAND_RANK: Record<SampleBand, number> = { low: 0, elevated: 1, high: 2 };

export const worseBand = (a: SampleBand, b: SampleBand): SampleBand =>
  BAND_RANK[a] >= BAND_RANK[b] ? a : b;

// Where one count sits against an indicator's limits. A censored count is
// placed by its limit: "<10" is below 10, so it's low; ">1000" is at least
// 1000, so it's at least that band - the true count can only be worse.
export const bandForCount = (
  count: BacteriaCount | null,
  indicator: Indicator
): SampleBand | null => {
  if (!count) return null;
  const { excellent, good } = indicator.limits;
  if (count.value >= good) return "high";
  if (count.value >= excellent) return "elevated";
  return "low";
};

// The worse of the two classified indicators - the same "whichever comes
// out lower" rule the classification itself uses.
export const bandForSample = (sample: WaterQualitySample): SampleBand | null =>
  CLASSIFIED_INDICATORS.reduce<SampleBand | null>((worst, key) => {
    const band = bandForCount(sample[key], INDICATORS[key]);
    if (!band) return worst;
    return worst ? worseBand(worst, band) : band;
  }, null);

// The indicator driving a sample's band: the one furthest over its Good
// limit, as a ratio, so "E. coli >1,000" and "Enterococci 720" can be
// weighed against limits of different sizes.
export const worstIndicator = (
  sample: WaterQualitySample
): IndicatorKey | null => {
  let worst: IndicatorKey | null = null;
  let worstRatio = -Infinity;
  for (const key of CLASSIFIED_INDICATORS) {
    const count = sample[key];
    const limits = INDICATORS[key].limits;
    if (!count) continue;
    const ratio = count.value / limits.good;
    if (ratio > worstRatio) {
      worst = key;
      worstRatio = ratio;
    }
  }
  return worst;
};

const numberFormat = new Intl.NumberFormat("en-GB");

// "<10", "720", ">1,000" - the qualifier is part of the reading.
export const formatCount = (count: BacteriaCount | null): string => {
  if (!count) return "—";
  const n = numberFormat.format(count.value);
  return count.qualifier === "below"
    ? `<${n}`
    : count.qualifier === "above"
      ? `>${n}`
      : n;
};

export const COUNT_UNIT = "per 100 ml";

export const sampleTimeMs = (sample: WaterQualitySample): number =>
  Date.parse(sample.sampledAt);

// Comparable order for "is this the highest?": a ">1000" beats an exact
// 1000, which beats a "<1000".
const countRank = (count: BacteriaCount): number =>
  count.value +
  (count.qualifier === "above" ? 0.5 : count.qualifier === "below" ? -0.5 : 0);

export interface IndicatorStats {
  total: number; // samples with a count for this indicator
  overGood: number;
  overExcellent: number; // includes those over Good
  highest: { count: BacteriaCount; sampledAt: string } | null;
  median: BacteriaCount | null;
}

export const indicatorStats = (
  samples: WaterQualitySample[],
  key: IndicatorKey
): IndicatorStats => {
  const indicator = INDICATORS[key];
  const withCount = samples.filter((s) => s[key]);
  let overGood = 0;
  let overExcellent = 0;
  let highest: IndicatorStats["highest"] = null;
  for (const s of withCount) {
    const count = s[key]!;
    const band = bandForCount(count, indicator);
    if (band === "high") overGood++;
    if (band === "high" || band === "elevated") overExcellent++;
    if (!highest || countRank(count) > countRank(highest.count)) {
      highest = { count, sampledAt: s.sampledAt };
    }
  }
  // The median holds up to censoring where a mean can't: it only needs the
  // middle value to be a real number, and when that one is itself "<10"
  // the honest median is "<10".
  const sorted = withCount
    .map((s) => s[key]!)
    .sort((a, b) => countRank(a) - countRank(b));
  const median =
    sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)];

  return { total: withCount.length, overGood, overExcellent, highest, median };
};

// Plain-English observations about the newest sample, for the sample card:
// counts at the top of the test's range, record highs, and how it compares
// with the run of samples before it. Ordered most striking first.
export const notableFindings = (samples: WaterQualitySample[]): string[] => {
  const latest = samples[samples.length - 1];
  if (!latest) return [];
  const earlier = samples.slice(0, -1);
  const findings: string[] = [];

  for (const key of CLASSIFIED_INDICATORS) {
    const count = latest[key];
    if (count?.qualifier === "above") {
      findings.push(
        `${INDICATORS[key].shortLabel} was above the test's upper limit of ${numberFormat.format(count.value)}, so the true count could be much higher.`
      );
    }
  }

  if (earlier.length > 0) {
    const since = formatLondonDate(sampleTimeMs(samples[0]), {
      withWeekday: false,
      withYear: true,
    });
    for (const key of CLASSIFIED_INDICATORS) {
      const count = latest[key];
      if (!count || count.qualifier === "below") continue;
      const previous = earlier
        .map((s) => s[key])
        .filter((c): c is BacteriaCount => c !== null);
      if (previous.length === 0) continue;
      const topRank = Math.max(...previous.map(countRank));
      const rank = countRank(count);
      if (rank > topRank) {
        findings.push(
          `Highest ${INDICATORS[key].shortLabel} of the ${previous.length + 1} samples taken since ${since}.`
        );
      } else if (rank === topRank) {
        findings.push(
          `Joint highest ${INDICATORS[key].shortLabel} of the ${previous.length + 1} samples taken since ${since}.`
        );
      }
    }
  }

  const band = bandForSample(latest);
  if (band === "low") {
    findings.push(
      "Both E. coli and Enterococci were below the Excellent limits."
    );
  }

  return findings;
};

// The newest sample before this one with a count for `key`, for "previous"
// comparisons on the sample card.
export const previousCount = (
  samples: WaterQualitySample[],
  key: IndicatorKey
): { count: BacteriaCount; sampledAt: string } | null => {
  for (let i = samples.length - 2; i >= 0; i--) {
    const count = samples[i][key];
    if (count) return { count, sampledAt: samples[i].sampledAt };
  }
  return null;
};
