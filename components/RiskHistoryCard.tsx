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
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import { RiskHistoryDay } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { useRiskHistory } from "@/lib/useRiskHistory";
import {
  CLASSIFIED_INDICATORS,
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
import SampleBandChip from "@/components/SampleBandChip";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";

// One question: is there a link between rain or sewage spills and poor
// water quality? Answered the way that question is - a scatter. Each dot is
// a sample: how much rain (or spilling) came in the days before it along
// the bottom, how much bacteria it found up the side. If there is a link the
// dots climb to the right; if there isn't, they sit level.
//
// Tapping a dot shows which sample it is. Under that, the same answer in
// counts for anyone who doesn't read charts - of the samples after a wet
// spell or any spilling, how many were Poor, against the rest - or, while
// there are too few Poor samples for counts to mean anything, a line saying
// so.
//
// None of it is the app's own risk estimate. The rain is Open-Meteo's
// modelled figure for Worcester (lib/rainHistory.ts), which reaches back
// past the oldest sample, so the Rain view has every sample from the start.
// The spills are the app's own record (lib/riskHistory.ts), which only
// begins once a Blob store is connected - the feed has no history - so the
// Spills view fills in a sample at a time from then on.

// A sample is set against its own day and this many before it. Not a week:
// what fell six days ago has long gone past, and would only blur the
// picture. Roughly a spill's travel time down plus the 48 h it lingers.
const DAYS_BEFORE = 3;

const PLOT_HEIGHT = 200;
const AXIS_WIDTH = 54;
const DOT_SIZE = 14;

// Up the side: the sample's bacteria as a multiple of the Good limit, for
// whichever of E. coli and enterococci is further over - the reading that
// decides its band, so every Poor sample sits in the Poor zone. (Plotting
// E. coli alone left a sample that failed on enterococci looking clean.)
// On a log scale, a hundredth of the limit to a hundred times it: on a
// linear one every ordinary sample would sit on the floor beside a bad one.
const RATIO_FLOOR = 0.01;
const RATIO_CEILING = 100;
// Words rather than multiples ("10×", "1/10"): the scale is there to say
// up is dirtier, and the shaded zone already marks where Poor starts.
const RATIO_TICKS: { ratio: number; label: string }[] = [
  { ratio: RATIO_CEILING, label: "Dirtier" },
  { ratio: 1, label: "Limit" },
  { ratio: RATIO_FLOOR, label: "Cleaner" },
];

// The tiles split the samples at this much rain over the days before: a
// properly wet spell against the rest. A fixed line rather than the middle
// sample, which in a dry run put "wetter" at a couple of millimetres.
const WET_SPELL_MM = 10;

// Below this many Poor samples the card says there are too few to judge,
// rather than showing counts: "1 of 13 Poor after rain, 0 of 13 without"
// reads as a finding and is one sample.
const MIN_POOR_TO_COMPARE = 3;

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
  countText: string; // "Enterococci 520" - the worse indicator
  allCounts: string; // "E. coli 100 · Enterococci 60"
  // Over the sample's day and the days before; null if any of those days
  // is missing, since a part-known run-up would plot as a drier one.
  rain: number | null; // mm
  spills: number | null; // hours of spilling
}

const RiskHistoryCard: React.FC = () => {
  const days = useRiskHistory();
  const { waterQuality } = useSevernContext();
  const [measure, setMeasure] = useState<Measure>("rain");
  // The dot picked by a tap; the newest sample until one is.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const allPoints = useMemo(() => {
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
      const total = (pick: (d: RiskHistoryDay) => number | null) => {
        const values = before.map(pick);
        return before.length > DAYS_BEFORE && values.every((v) => v !== null)
          ? round1(values.reduce<number>((sum, v) => sum + (v ?? 0), 0))
          : null;
      };
      result.push({
        id: sample.id,
        when: formatLondonDate(ms),
        band,
        ratio: count.value / INDICATORS[worst].limits.good,
        countText: `${INDICATORS[worst].shortLabel} ${formatCount(count)}`,
        allCounts: CLASSIFIED_INDICATORS.map(
          (key) => `${INDICATORS[key].shortLabel} ${formatCount(sample[key])}`
        ).join(" · "),
        rain: total((d) => d.rainMm),
        spills: total((d) => d.spillHours),
      });
    }
    return result;
  }, [days, waterQuality]);

  if (!allPoints) return null;

  const ui = MEASURE_UI[measure];
  // The samples this view can place, each with its figure for the measure.
  const points = allPoints.flatMap((p) => {
    const x = p[measure];
    return x === null ? [] : [{ ...p, x }];
  });
  // The first day spills were recorded, if recording has begun.
  const firstSpillDay = days.find((d) => d.spillHours !== null)?.date;
  const spillsSince = firstSpillDay
    ? formatLondonDate(keyToMs(firstSpillDay), { withWeekday: false })
    : null;
  const max = Math.max(MIN_SCALE[measure], ...points.map((p) => p.x));

  // The same answer in counts: the samples split into those after more of
  // it and those after less - any spilling at all, or a wet spell of rain.
  const cut = measure === "spills" ? 0 : WET_SPELL_MM;
  const more = points.filter((p) => p.x > cut);
  const less = points.filter((p) => p.x <= cut);
  const poorCount = points.filter((p) => p.band === "poor").length;
  // Samples arrive oldest first, so the last is the newest.
  const picked =
    points.find((p) => p.id === pickedId) ?? points[points.length - 1];
  const poorOf = (group: Point[]) =>
    group.length === 0
      ? "None yet"
      : `${group.filter((p) => p.band === "poor").length} of ${group.length} Poor`;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          {measure === "rain" ? "Rain" : "Spills"} vs Water Quality
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          Each dot is a sample. If {measure === "rain" ? "rain" : "spills"}{" "}
          {measure === "rain" ? "makes" : "make"} the water worse, the dots
          climb to the right.
        </Typography>

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

          {points.length === 0 ? (
            <InfoPanel>
              <Typography variant="body2" color="text.secondary">
                {measure === "rain"
                  ? "No samples to plot yet."
                  : spillsSince
                    ? `Recording since ${spillsSince}. Samples appear here as they come in.`
                    : "Spills aren't being recorded yet. Samples will appear here once they are."}
              </Typography>
            </InfoPanel>
          ) : (
            <>
              <Box
                role="group"
                aria-label={`Bacteria in each of ${points.length} samples against ${ui.axis.toLowerCase()} in the ${DAYS_BEFORE} days before. ${poorOf(more)} after more, ${poorOf(less)} after less.`}
              >
                <Box sx={{ display: "flex" }}>
                  {/* Count scale, on the plot's own lines. */}
                  <Box
                    aria-hidden
                    sx={{
                      position: "relative",
                      width: AXIS_WIDTH,
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

                    {points.map((p) => {
                      const isPicked = p.id === picked?.id;
                      return (
                        <Box
                          key={p.id}
                          component="button"
                          type="button"
                          onClick={() => setPickedId(p.id)}
                          aria-pressed={isPicked}
                          aria-label={`${p.when}: ${SAMPLE_BAND_UI[p.band].label}, ${p.x}${ui.unit} before`}
                          sx={{
                            position: "absolute",
                            left: `${(p.x / max) * 100}%`,
                            bottom: `${ratioFraction(p.ratio) * 100}%`,
                            width: DOT_SIZE,
                            height: DOT_SIZE,
                            p: 0,
                            transform: "translate(-50%, 50%)",
                            borderRadius: "50%",
                            backgroundColor: SAMPLE_BAND_UI[p.band].color,
                            // A ring in the card's own colour, so dots that
                            // land on each other stay countable.
                            border: "2px solid",
                            borderColor: "background.paper",
                            cursor: "pointer",
                            // The picked dot wears a second ring and sits
                            // on top of its neighbours.
                            outline: isPicked ? "2px solid" : "none",
                            outlineColor: "text.primary",
                            zIndex: isPicked ? 1 : 0,
                            // A finger-sized target around a 14px dot.
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              inset: -10,
                            },
                            "&:focus-visible": {
                              outline: "2px solid",
                              outlineColor: "primary.main",
                              outlineOffset: 2,
                            },
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>

                {/* Bottom scale. */}
                <Stack
                  aria-hidden
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    pl: `${AXIS_WIDTH}px`,
                    mt: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    0
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ui.axis}, {DAYS_BEFORE} days before →
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
                  {measure === "rain"
                    ? "Rain: Open-Meteo estimate for Worcester"
                    : `Spills: hours across all monitored overflows${spillsSince ? `, since ${spillsSince}` : ""}`}
                </Typography>
              </Box>

              {/* The dot that was tapped. */}
              {picked && (
                <InfoPanel sx={{ display: "block" }}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {picked.when}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {picked.allCounts}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {measure === "rain"
                          ? `${picked.x} mm rain`
                          : `${picked.x}h spilling`}{" "}
                        in the {DAYS_BEFORE} days before
                      </Typography>
                    </Box>
                    <SampleBandChip band={picked.band} />
                  </Stack>
                </InfoPanel>
              )}

              {poorCount < MIN_POOR_TO_COMPARE ? (
                <InfoPanel align="flex-start">
                  <HourglassEmptyIcon
                    sx={{ flexShrink: 0, color: "text.secondary" }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {poorCount === 0
                      ? "No Poor samples yet"
                      : `Only ${poorCount} Poor sample${poorCount === 1 ? "" : "s"} so far`}
                    , too few to tell either way.
                  </Typography>
                </InfoPanel>
              ) : (
                <Box sx={tileGridSx}>
                  <StatTile
                    icon={<WaterDropIcon />}
                    label={
                      measure === "rain" ? "After Wet Spells" : "After Spills"
                    }
                    value={poorOf(more)}
                    detail={
                      measure === "rain"
                        ? `Over ${cut} mm before`
                        : "Some spilling before"
                    }
                  />
                  <StatTile
                    icon={<WbSunnyOutlinedIcon />}
                    label={
                      measure === "rain" ? "After Dry Spells" : "No Spills"
                    }
                    value={poorOf(less)}
                    detail={
                      measure === "rain"
                        ? `${cut} mm or less before`
                        : "No spilling before"
                    }
                  />
                </Box>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RiskHistoryCard;
