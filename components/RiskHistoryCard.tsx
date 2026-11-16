"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { RiskHistoryDay } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { useRiskHistory } from "@/lib/useRiskHistory";
import { CSO_STATE_UI } from "@/lib/csoStatus";
import {
  SAMPLE_BAND_UI,
  SampleBand,
  bandForSample,
  formatCount,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatLondonDate, londonDayKey } from "@/lib/time";
import { DAY_MS } from "@/lib/rainfallAnalysis";
import StatTile, { tileGridSx } from "@/components/StatTile";

// Rain, spills and sample results on the same run of days, so the three can
// be read against each other: did the rain set spills off, and did the
// samples that followed come back worse.
//
// Three rows of bars drawn alike, one step per day. What they show is
// measured - the gauges' rain, the monitors' spill time, the lab's counts -
// not the app's own estimate of the risk. The rain and spill days are
// recorded by the app as they happen (lib/riskHistory.ts), so the card
// renders nothing until recording has begun.

// How many days the rows show, newest on the right.
const WINDOW_DAYS = 56;
const ROW_HEIGHT = 40;

// A sample is held against spills on its own day and this many before it.
const SPILL_LOOKBACK_DAYS = 3;

// The rain row always reaches at least this, so a week of drizzle doesn't
// fill the row the way a storm would.
const MIN_RAIN_SCALE_MM = 10;

// E. coli is drawn on a log scale between these counts (cfu/100 ml): the
// range runs from under 10 to tens of thousands, and on a linear one every
// ordinary sample would be a sliver beside one bad one.
const COUNT_FLOOR = 10;
const COUNT_CEILING = 10000;

// "2026-11-16" for each of the last `count` London days, oldest first. Noon
// UTC is the same calendar day in London all year, so stepping by 24 hours
// from it never skips or repeats one across a clock change.
const lastDayKeys = (count: number): string[] => {
  const todayNoon = Date.parse(`${londonDayKey(Date.now())}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    londonDayKey(todayNoon - (count - 1 - i) * DAY_MS)
  );
};

const keyToMs = (key: string) => Date.parse(`${key}T12:00:00Z`);

const dayLabel = (key: string) =>
  formatLondonDate(keyToMs(key), { withWeekday: false });

interface Bar {
  // 0-1 of the row's height; null for a day with nothing to draw.
  fraction: number | null;
  colour?: string;
  title?: string;
}

// One row: its name, its scale, then a bar per day on a faint track.
const BarRow: React.FC<{
  label: string;
  scale: string;
  keys: string[];
  bars: Map<string, Bar>;
  colour: string;
}> = ({ label, scale, keys, bars, colour }) => (
  <Box>
    <Stack
      direction="row"
      sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {scale}
      </Typography>
    </Stack>
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))`,
        columnGap: "2px",
        height: ROW_HEIGHT,
      }}
    >
      {keys.map((key) => {
        const bar = bars.get(key);
        return (
          <Box
            key={key}
            title={bar?.title}
            sx={{
              display: "flex",
              alignItems: "flex-end",
              borderRadius: "2px",
              bgcolor: "surfaces.containerHigh",
              overflow: "hidden",
            }}
          >
            {bar && bar.fraction !== null && (
              <Box
                sx={{
                  width: "100%",
                  // Anything recorded gets at least a visible sliver.
                  height: `${Math.max(8, Math.round(bar.fraction * 100))}%`,
                  borderRadius: "2px",
                  backgroundColor: bar.colour ?? colour,
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  </Box>
);

const LegendItem: React.FC<{
  colour: string;
  children: React.ReactNode;
}> = ({ colour, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    <Box
      sx={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: "2px",
        backgroundColor: colour,
      }}
    />
    <Typography variant="caption" color="text.secondary">
      {children}
    </Typography>
  </Stack>
);

const RiskHistoryCard: React.FC = () => {
  const days = useRiskHistory();
  const { waterQuality } = useSevernContext();

  const view = useMemo(() => {
    if (days.length === 0) return null;
    const keys = lastDayKeys(WINDOW_DAYS);
    const shown = new Set(keys);
    const byDate = new Map<string, RiskHistoryDay>(
      days.map((d) => [d.date, d])
    );
    const since = days[0].date;

    const inWindow = days.filter((d) => shown.has(d.date));
    const maxRain = Math.max(
      MIN_RAIN_SCALE_MM,
      ...inWindow.map((d) => d.rainMm ?? 0)
    );
    const maxSpill = Math.max(1, ...inWindow.map((d) => d.spillHours));

    const rain = new Map<string, Bar>();
    const spills = new Map<string, Bar>();
    for (const d of inWindow) {
      const when = dayLabel(d.date);
      if (d.rainMm !== null && d.rainMm > 0) {
        rain.set(d.date, {
          fraction: d.rainMm / maxRain,
          title: `${when}: ${d.rainMm} mm`,
        });
      }
      if (d.spillHours > 0) {
        spills.set(d.date, {
          fraction: d.spillHours / maxSpill,
          title: `${when}: ${d.spillHours}h of spilling from ${d.spillOutfalls} overflow${d.spillOutfalls === 1 ? "" : "s"}`,
        });
      }
    }

    // The newest sample on each day since recording began.
    const samples = new Map<string, Bar>();
    const sampleBands = new Map<string, SampleBand>();
    for (const sample of waterQuality?.samples ?? []) {
      const band = bandForSample(sample);
      const key = londonDayKey(sampleTimeMs(sample));
      if (!band || key < since) continue;
      sampleBands.set(key, band);
      const count = sample.eColi?.value ?? COUNT_FLOOR;
      const clamped = Math.min(COUNT_CEILING, Math.max(COUNT_FLOOR, count));
      samples.set(key, {
        fraction:
          Math.log10(clamped / COUNT_FLOOR) /
          Math.log10(COUNT_CEILING / COUNT_FLOOR),
        colour: SAMPLE_BAND_UI[band].color,
        title: `${dayLabel(key)}: ${SAMPLE_BAND_UI[band].label}, E. coli ${formatCount(sample.eColi)}`,
      });
    }

    // Whether any overflow spilled on a sample's day or the few before it.
    const spilledBefore = (key: string) => {
      for (let i = 0; i <= SPILL_LOOKBACK_DAYS; i++) {
        const day = byDate.get(londonDayKey(keyToMs(key) - i * DAY_MS));
        if (day && day.spillHours > 0) return true;
      }
      return false;
    };
    const all = [...sampleBands];
    const poor = all.filter(([, band]) => band === "poor");
    const clean = all.filter(([, band]) => band !== "poor");

    return {
      keys,
      since,
      rain,
      spills,
      samples,
      maxRain,
      maxSpill,
      sampleCount: all.length,
      poor: poor.length,
      poorAfterSpill: poor.filter(([key]) => spilledBefore(key)).length,
      clean: clean.length,
      cleanNoSpill: clean.filter(([key]) => !spilledBefore(key)).length,
    };
  }, [days, waterQuality]);

  if (!view) return null;

  const since = dayLabel(view.since);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Rain, Spills and Samples
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          Day by day · recording since {since}
        </Typography>

        <Stack
          spacing={1.5}
          role="img"
          aria-label={`Daily rain, hours of sewage spills and sample results since ${since}`}
        >
          <BarRow
            label="Rain"
            scale={`up to ${Math.round(view.maxRain)} mm a day`}
            keys={view.keys}
            bars={view.rain}
            colour="primary.main"
          />
          <BarRow
            label="Spills"
            scale={`up to ${Math.round(view.maxSpill)}h a day`}
            keys={view.keys}
            bars={view.spills}
            colour={CSO_STATE_UI.Recent.color}
          />
          <Box>
            <BarRow
              label="Samples"
              scale="E. coli, taller is more"
              keys={view.keys}
              bars={view.samples}
              colour={SAMPLE_BAND_UI.excellent.color}
            />
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", mt: 0.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                {dayLabel(view.keys[0])}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Today
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 1.5, mt: 1 }}>
          <LegendItem colour={SAMPLE_BAND_UI.excellent.color}>
            Excellent
          </LegendItem>
          <LegendItem colour={SAMPLE_BAND_UI.good.color}>Good</LegendItem>
          <LegendItem colour={SAMPLE_BAND_UI.poor.color}>Poor</LegendItem>
        </Stack>

        {/* How the samples lined up with the spills before them. */}
        <Box sx={{ ...tileGridSx, mt: 2 }}>
          {view.sampleCount === 0 ? (
            <StatTile
              icon={<ScienceOutlinedIcon />}
              label="Samples"
              value="None yet"
              detail="Since recording began"
            />
          ) : (
            <>
              <StatTile
                icon={<WarningAmberIcon />}
                label="Poor Samples"
                value={
                  view.poor === 0
                    ? "None yet"
                    : `${view.poorAfterSpill} of ${view.poor}`
                }
                detail={
                  view.poor === 0
                    ? "Since recording began"
                    : `After a spill in the ${SPILL_LOOKBACK_DAYS} days before`
                }
              />
              <StatTile
                icon={<CheckCircleOutlineIcon />}
                label="Clean Samples"
                value={
                  view.clean === 0
                    ? "None yet"
                    : `${view.cleanNoSpill} of ${view.clean}`
                }
                detail={
                  view.clean === 0
                    ? "Since recording began"
                    : `With no spill in the ${SPILL_LOOKBACK_DAYS} days before`
                }
              />
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RiskHistoryCard;
