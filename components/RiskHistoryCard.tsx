"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  Typography,
} from "@mui/material";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import { RiskHistoryDay } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { useRiskHistory } from "@/lib/useRiskHistory";
import {
  INDICATORS,
  SAMPLE_BAND_UI,
  SampleBand,
  bandForSample,
  formatCount,
  sampleTimeMs,
  worstIndicator,
} from "@/lib/waterQuality";
import { formatLondonDate, londonDayKey } from "@/lib/time";
import { DAY_MS } from "@/lib/rainfallAnalysis";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";

// One question: is there a link between rain or sewage spills and poor
// water quality? Answered the way that question is - a scatter. Each dot is
// a sample: how much rain (or spilling) came in the days before it along
// the bottom, how much bacteria it found up the side. If there is a link the
// dots climb to the right; if there isn't, they sit level.
//
// Two tiles under it say the same thing in counts, for anyone who doesn't
// read charts: of the samples after more rain or spilling, how many were
// Poor, against those after less.
//
// Everything plotted is measured - the gauges' rain, the monitors' spill
// time, the lab's counts - not the app's estimate. The rain and spill days
// are recorded by the app as they happen (lib/riskHistory.ts), so a sample
// only joins once the days before it were recorded, and the card renders
// nothing until recording has begun.

// A sample is set against its own day and this many before it. Not a week:
// what fell six days ago has long gone past, and would only blur the
// picture. Roughly a spill's travel time down plus the 48 h it lingers.
const DAYS_BEFORE = 3;

const PLOT_HEIGHT = 200;
const DOT_SIZE = 14;

// Up the side: the sample's bacteria as a multiple of the Good limit, for
// whichever of E. coli and enterococci is further over - the reading that
// decides its band, so every Poor sample sits in the Poor zone. (Plotting
// E. coli alone left a sample that failed on enterococci looking clean.)
// On a log scale, a hundredth of the limit to a hundred times it: on a
// linear one every ordinary sample would sit on the floor beside a bad one.
const RATIO_FLOOR = 0.01;
const RATIO_CEILING = 100;
const RATIO_TICKS: { ratio: number; label: string }[] = [
  { ratio: 100, label: "100×" },
  { ratio: 10, label: "10×" },
  { ratio: 1, label: "Limit" },
  { ratio: 0.1, label: "1/10" },
  { ratio: 0.01, label: "1/100" },
];

// The bottom scale always reaches at least this, so a few dry samples
// don't spread across the chart as if they differed.
const MIN_SCALE = { rain: 10, spills: 5 };

type Measure = "rain" | "spills";

const MEASURE_UI: Record<
  Measure,
  { toggle: string; axis: string; unit: string }
> = {
  rain: { toggle: "Rain", axis: "Rain", unit: " mm" },
  spills: { toggle: "Sewage Spills", axis: "Spilling", unit: "h" },
};

const keyToMs = (key: string) => Date.parse(`${key}T12:00:00Z`);

const round1 = (n: number) => Math.round(n * 10) / 10;

// Where a multiple of the limit sits up the plot, 0 (floor) to 1 (ceiling).
const ratioFraction = (ratio: number) =>
  Math.log10(
    Math.min(RATIO_CEILING, Math.max(RATIO_FLOOR, ratio)) / RATIO_FLOOR
  ) / Math.log10(RATIO_CEILING / RATIO_FLOOR);

interface Point {
  id: string;
  when: string; // "Sun 8 Nov"
  band: SampleBand;
  ratio: number; // the worse indicator, as a multiple of its Good limit
  countText: string; // "Enterococci 520"
  rain: number; // mm over the days before
  spills: number; // hours of spilling over the days before
}

const RiskHistoryCard: React.FC = () => {
  const days = useRiskHistory();
  const { waterQuality } = useSevernContext();
  const [measure, setMeasure] = useState<Measure>("rain");

  const points = useMemo(() => {
    if (days.length === 0) return null;
    const byDate = new Map<string, RiskHistoryDay>(
      days.map((d) => [d.date, d])
    );
    const result: Point[] = [];
    for (const sample of waterQuality?.samples ?? []) {
      const band = bandForSample(sample);
      const worst = worstIndicator(sample);
      const count = worst && sample[worst];
      if (!band || !worst || !count) continue;
      const ms = sampleTimeMs(sample);
      const sampleDay = keyToMs(londonDayKey(ms));
      const before: RiskHistoryDay[] = [];
      for (let i = 0; i <= DAYS_BEFORE; i++) {
        const day = byDate.get(londonDayKey(sampleDay - i * DAY_MS));
        if (day) before.push(day);
      }
      // Only samples whose whole run-up was recorded: a part-recorded one
      // would be plotted as drier than it was.
      if (before.length <= DAYS_BEFORE) continue;
      result.push({
        id: sample.id,
        when: formatLondonDate(ms),
        band,
        ratio: count.value / INDICATORS[worst].limits.good,
        countText: `${INDICATORS[worst].shortLabel} ${formatCount(count)}`,
        rain: round1(before.reduce((sum, d) => sum + (d.rainMm ?? 0), 0)),
        spills: round1(before.reduce((sum, d) => sum + d.spillHours, 0)),
      });
    }
    return result;
  }, [days, waterQuality]);

  if (!points) return null;

  const ui = MEASURE_UI[measure];
  const since = formatLondonDate(keyToMs(days[0].date), {
    withWeekday: false,
  });
  const max = Math.max(MIN_SCALE[measure], ...points.map((p) => p[measure]));

  // The same answer in counts: the samples split into those after more of
  // it and those after less. Spills split on any at all; rain at the middle
  // sample, so both halves have something in them.
  const sorted = [...points].sort((a, b) => a[measure] - b[measure]);
  const cut =
    measure === "spills"
      ? 0
      : sorted.length > 1
        ? sorted[Math.ceil(sorted.length / 2) - 1].rain
        : 0;
  const more = points.filter((p) => p[measure] > cut);
  const less = points.filter((p) => p[measure] <= cut);
  const poorOf = (group: Point[]) =>
    group.length === 0
      ? "None yet"
      : `${group.filter((p) => p.band === "poor").length} of ${group.length} Poor`;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Rain vs Water Quality
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          Each dot is a sample, set against the {DAYS_BEFORE} days before it ·
          recording since {since}
        </Typography>

        {points.length === 0 ? (
          <InfoPanel>
            <Typography variant="body2" color="text.secondary">
              No samples to plot yet. Each one joins the chart once the{" "}
              {DAYS_BEFORE} days before it have been recorded.
            </Typography>
          </InfoPanel>
        ) : (
          <Stack spacing={2}>
            <SlidingToggleButtonGroup
              value={measure}
              exclusive
              fullWidth
              size="small"
              aria-label="Compare the samples with"
              onChange={(_, v: Measure | null) => v && setMeasure(v)}
            >
              {(Object.keys(MEASURE_UI) as Measure[]).map((key) => (
                <ToggleButton key={key} value={key} sx={{ fontSize: 12 }}>
                  {MEASURE_UI[key].toggle}
                </ToggleButton>
              ))}
            </SlidingToggleButtonGroup>

            <Box
              role="img"
              aria-label={`Bacteria in each of ${points.length} samples against ${ui.axis.toLowerCase()} in the ${DAYS_BEFORE} days before. ${poorOf(more)} after more, ${poorOf(less)} after less.`}
            >
              <Box sx={{ display: "flex" }}>
                {/* Count scale, on the plot's own lines. */}
                <Box
                  aria-hidden
                  sx={{
                    position: "relative",
                    width: 44,
                    flexShrink: 0,
                    height: PLOT_HEIGHT,
                  }}
                >
                  {RATIO_TICKS.map((tick) => (
                    <Typography
                      key={tick.ratio}
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        position: "absolute",
                        right: 6,
                        bottom: `${ratioFraction(tick.ratio) * 100}%`,
                        transform: "translateY(50%)",
                        lineHeight: 1,
                      }}
                    >
                      {tick.label}
                    </Typography>
                  ))}
                </Box>

                <Box
                  sx={{
                    position: "relative",
                    flex: 1,
                    height: PLOT_HEIGHT,
                    borderLeft: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    // Room for half a dot at the right-hand end.
                    mr: `${DOT_SIZE / 2}px`,
                  }}
                >
                  {/* The Poor zone: everything over the Good limit. */}
                  <Box
                    aria-hidden
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: `-${DOT_SIZE / 2}px`,
                      top: 0,
                      bottom: `${ratioFraction(1) * 100}%`,
                      bgcolor: "error.container",
                      opacity: 0.5,
                      borderBottom: "1px dashed",
                      borderColor: "error.main",
                    }}
                  />
                  <Typography
                    aria-hidden
                    variant="caption"
                    sx={{
                      position: "absolute",
                      left: 6,
                      top: 4,
                      color: "error.main",
                      fontWeight: 600,
                    }}
                  >
                    Poor
                  </Typography>

                  {points.map((p) => (
                    <Box
                      key={p.id}
                      title={`${p.when}: ${p.countText}, ${p[measure]}${ui.unit} before`}
                      sx={{
                        position: "absolute",
                        left: `${(p[measure] / max) * 100}%`,
                        bottom: `${ratioFraction(p.ratio) * 100}%`,
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        transform: "translate(-50%, 50%)",
                        borderRadius: "50%",
                        backgroundColor: SAMPLE_BAND_UI[p.band].color,
                        // A ring in the card's own colour, so dots that
                        // land on each other stay countable.
                        border: "2px solid",
                        borderColor: "background.paper",
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Bottom scale. */}
              <Stack
                aria-hidden
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  pl: "44px",
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  0
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ui.axis} in the {DAYS_BEFORE} days before →
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(max)}
                  {ui.unit}
                </Typography>
              </Stack>
              <Typography
                aria-hidden
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}
              >
                ↑ Bacteria against the Good limit. A link shows as dots climbing
                to the right.
              </Typography>
            </Box>

            <Box sx={tileGridSx}>
              <StatTile
                icon={<WaterDropIcon />}
                label={measure === "rain" ? "Wetter Half" : "After Spills"}
                value={poorOf(more)}
                detail={
                  measure === "rain"
                    ? `Over ${cut} mm before`
                    : "Some spilling before"
                }
              />
              <StatTile
                icon={<WbSunnyOutlinedIcon />}
                label={measure === "rain" ? "Drier Half" : "No Spills"}
                value={poorOf(less)}
                detail={
                  measure === "rain"
                    ? `${cut} mm or less before`
                    : "No spilling before"
                }
              />
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskHistoryCard;
