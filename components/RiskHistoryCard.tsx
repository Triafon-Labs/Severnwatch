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
// None of it is the app's own risk estimate. The rain is what the EA's
// gauges caught in the 72 hours before each sample, worked out with the
// samples (lib/sampleRain.ts), so the Rain view has every sample from the
// start. The spills are the app's own record (lib/riskHistory.ts), which
// only begins once a Blob store is connected - the feed has no history - so
// the Spills view fills in a sample at a time from then on.

// A sample is set against the three days before it - its own day and the
// three before for spills, which are recorded by the day. Not a week: what
// fell six days ago has long gone past and would only blur the picture.
// Roughly a spill's travel time down plus the 48 h it lingers.
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

// Below this many Poor samples the card says there are too few to judge,
// rather than showing counts: "1 of 13 Poor after rain, 0 of 13 without"
// reads as a finding and is one sample.
const MIN_POOR_TO_COMPARE = 3;

type Measure = "rain" | "spills" | "flow";

// Everything that differs between the three views.
interface MeasureUi {
  toggle: string;
  title: string; // "Rain vs Water Quality"
  subject: string; // "If rain makes the water worse..."
  axis: string; // along the bottom
  unit: string;
  source: string; // the line under the chart
  // The tapped sample's figure: "4.9 mm rain in the 3 days before".
  detail: (x: number) => string;
  // The bottom scale always reaches at least this, so a few samples close
  // together don't spread across the chart as if they differed.
  minScale: number;
  // The tiles split the samples above this from the rest. Fixed lines
  // rather than the middle sample, which in a dry run put "wetter" at a
  // couple of millimetres.
  cut: number;
  moreTile: { label: string; detail: string };
  lessTile: { label: string; detail: string };
}

const WET_SPELL_MM = 10;
// Bewdley's long-term mean flow, m3/s (see plumeTravelHours in
// lib/config.ts): above it, the river is running higher than usual.
const MEAN_FLOW_M3S = 62;

const MEASURE_UI: Record<Measure, MeasureUi> = {
  rain: {
    toggle: "Rain",
    title: "Rain vs Water Quality",
    subject: "rain makes",
    axis: "Rain",
    unit: " mm",
    source: "Rain: EA gauges, mean of three",
    detail: (x) => `${x} mm rain in the ${DAYS_BEFORE} days before`,
    minScale: 10,
    cut: WET_SPELL_MM,
    moreTile: {
      label: "After Wet Spells",
      detail: `Over ${WET_SPELL_MM} mm before`,
    },
    lessTile: {
      label: "After Dry Spells",
      detail: `${WET_SPELL_MM} mm or less before`,
    },
  },
  spills: {
    toggle: "Spills",
    title: "Spills vs Water Quality",
    subject: "spills make",
    axis: "Spilling",
    unit: "h",
    source: "Spills: hours across all monitored overflows",
    detail: (x) => `${x}h spilling in the ${DAYS_BEFORE} days before`,
    minScale: 5,
    cut: 0,
    moreTile: { label: "After Spills", detail: "Some spilling before" },
    lessTile: { label: "No Spills", detail: "No spilling before" },
  },
  flow: {
    toggle: "River",
    title: "River vs Water Quality",
    subject: "a high river makes",
    axis: "Peak flow",
    unit: " m³/s",
    source: "River: EA flow gauge at Bewdley",
    detail: (x) =>
      `River peaked at ${Math.round(x)} m³/s in the ${DAYS_BEFORE} days before`,
    minScale: 100,
    cut: MEAN_FLOW_M3S,
    moreTile: {
      label: "High River",
      detail: `Over ${MEAN_FLOW_M3S} m³/s, its average`,
    },
    lessTile: { label: "Low River", detail: `${MEAN_FLOW_M3S} m³/s or less` },
  },
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
  // Null where it isn't known, since a part-known run-up would plot as a
  // drier one.
  rain: number | null; // mm in the 72 hours before
  flow: number | null; // highest m3/s at Bewdley in the 72 hours before
  spills: number | null; // hours of spilling, its own day and three before
}

const RiskHistoryCard: React.FC = () => {
  const days = useRiskHistory();
  const { waterQuality } = useSevernContext();
  const [measure, setMeasure] = useState<Measure>("rain");
  // The dot picked by a tap; the newest sample until one is.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const allPoints = useMemo(() => {
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
      const rain = waterQuality?.rainBeforeMm?.[sample.id];
      const flow = waterQuality?.flowBeforeM3s?.[sample.id];
      result.push({
        id: sample.id,
        when: formatLondonDate(ms),
        band,
        ratio: count.value / INDICATORS[worst].limits.good,
        countText: `${INDICATORS[worst].shortLabel} ${formatCount(count)}`,
        allCounts: CLASSIFIED_INDICATORS.map(
          (key) => `${INDICATORS[key].shortLabel} ${formatCount(sample[key])}`
        ).join(" · "),
        rain: typeof rain === "number" ? rain : null,
        flow: typeof flow === "number" ? flow : null,
        spills:
          before.length > DAYS_BEFORE
            ? round1(before.reduce((sum, d) => sum + d.spillHours, 0))
            : null,
      });
    }
    return result;
  }, [days, waterQuality]);

  // Nothing to show until there's a sample with rain against it - an old
  // saved response has none, and the gauges can be unreachable at a build.
  if (
    !allPoints.some(
      (p) => p.rain !== null || p.spills !== null || p.flow !== null
    )
  ) {
    return null;
  }

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
  const max = Math.max(ui.minScale, ...points.map((p) => p.x));

  // The same answer in counts: the samples split into those after more of
  // it and those after less - any spilling at all, or a wet spell of rain.
  const cut = ui.cut;
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
          {ui.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          Each dot is a sample. If {ui.subject} the water worse, the dots climb
          to the right.
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
                {measure !== "spills"
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
                  {ui.source}
                  {measure === "spills" && spillsSince
                    ? `, since ${spillsSince}`
                    : ""}
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
                        {ui.detail(picked.x)}
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
                    label={ui.moreTile.label}
                    value={poorOf(more)}
                    detail={ui.moreTile.detail}
                  />
                  <StatTile
                    icon={<WbSunnyOutlinedIcon />}
                    label={ui.lessTile.label}
                    value={poorOf(less)}
                    detail={ui.lessTile.detail}
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
