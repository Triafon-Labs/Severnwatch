import { CsoResponse, RainfallResponse, WaterQualityResponse } from "@/types";
import { APP_NAME } from "@/lib/config";
import {
  PollutionRiskFactor,
  PollutionRiskLevel,
  RISK_LEVEL_UI,
  derivePollutionRisk,
} from "@/lib/pollutionRisk";
import {
  SAMPLE_BAND_UI,
  SampleBand,
  bandForSample,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatDaysAgo, formatLondonDate, londonDaysAgo } from "@/lib/time";

// What the share button sends: the Pollution Risk card's level and reasons,
// then the latest sample, written as sentences so it reads as a message
// rather than a list of tile captions. Nothing louder than the card itself:
// a coloured dot (the scale strip's hue), never a siren.

const RISK_DOT: Record<PollutionRiskLevel, string> = {
  high: "🔴",
  raised: "🟠",
  low: "🟢",
};

const SAMPLE_DOT: Record<SampleBand, string> = {
  excellent: "🟢",
  good: "🟢",
  poor: "🔴",
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// One factor tile as a sentence. The sample factor is left out: the sample
// gets its own line below, whatever its band.
const factorLine = (f: PollutionRiskFactor): string | null => {
  switch (f.key) {
    case "here":
      return `🚰 ${f.value} discharging in Worcester right now`;
    case "passing":
      return `🌊 ${f.value} from upstream passing Worcester now (estimated)`;
    case "arriving":
      return `🌊 ${f.value} from upstream ${lcFirst(f.detail ?? "on the way")}`;
    case "lingering":
      return `🌊 ${f.value} passed Worcester ${lcFirst(f.detail ?? "recently")}`;
    case "rain":
      return f.value === "Heavy"
        ? `🌧️ Heavy rain ${lcFirst(f.detail ?? "")}`.trim()
        : `🌧️ ${f.value} of rain, ${lcFirst(f.detail ?? "")}`;
    case "sample":
      return null;
  }
};

export const buildShareText = (
  cso: CsoResponse | null,
  rainfall: RainfallResponse | null,
  waterQuality: WaterQualityResponse | null,
  now: number = Date.now()
): string => {
  const lines: string[] = [];

  if (cso) {
    const risk = derivePollutionRisk(cso, rainfall, waterQuality, now);
    const ui = RISK_LEVEL_UI[risk.level];
    lines.push(
      `${RISK_DOT[risk.level]} *River Severn at Worcester: ${ui.label}*`
    );
    const reasons = risk.factors
      .map(factorLine)
      .filter((l): l is string => !!l);
    if (reasons.length > 0) {
      lines.push(...reasons);
    } else if (risk.level === "low") {
      lines.push("No sewage spills reaching Worcester and no heavy rain");
    }
  }

  const latest = waterQuality?.samples[waterQuality.samples.length - 1];
  const band = latest ? bandForSample(latest) : null;
  if (latest && band) {
    const ms = sampleTimeMs(latest);
    const when = `${formatLondonDate(ms)}, ${formatDaysAgo(londonDaysAgo(ms, now))}`;
    if (lines.length > 0) lines.push("");
    lines.push(
      `${SAMPLE_DOT[band]} Latest water sample: ${SAMPLE_BAND_UI[band].label} (${when})`
    );
  }

  if (lines.length === 0) {
    return `Check current River Severn conditions at Worcester on ${APP_NAME}.`;
  }
  return lines.join("\n");
};
