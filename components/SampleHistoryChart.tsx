"use client";

import { useMemo, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Stack, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { BacteriaCount, WaterQualitySample } from "@/types";
import {
  COUNT_UNIT,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  SampleBand,
  bandForCount,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { londonMonthStarts } from "@/lib/time";
import { useResolvedColorScheme } from "@/lib/ThemeContext";
import { SERIES_COLORS } from "@/lib/chartColors";
import { revealSx } from "@/lib/chartMotion";

// Every sample for one indicator over time, on a linear scale. A log axis
// was tried first, but SAS's test tops out at ">1000", so the counts only
// span 10 to 1000 - not enough range to need one - and a log axis makes a
// jump from 100 to 1000 look the same size as one from 10 to 100, which
// undersells exactly the results that matter. The cost is that the low
// counts (<10, 20, 80) bunch along the floor; they're all well under the
// limits, and picking a point gives the exact figures. If the lab ever
// reports far higher counts, clip the axis and mark the off-scale points
// rather than going back to log. Each dot carries its band colour, so the
// chart reads the same way as the sample card's chips.

const chartRevealSx = revealSx(".recharts-line", 1200, "ease");

const DAY_MS = 24 * 60 * 60 * 1000;
// A round axis step giving about five gridlines up to `max`: 100, 250,
// 500, 1000 and so on.
const niceStep = (max: number): number => {
  const rough = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10;
  return step * magnitude;
};

interface Point {
  id: string;
  sortKey: number;
  plotted: number;
  count: BacteriaCount;
  band: SampleBand | null;
}

const monthTick = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    month: "short",
  });

interface Props {
  samples: WaterQualitySample[];
  indicatorKey: IndicatorKey;
  // The picked sample, shown in full under the chart (SampleHistoryCard).
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStep: (direction: 1 | -1) => void;
}

// No tooltip, as on Paddlecheck's forecast graph: tapping or dragging across
// the chart picks a sample, which is ringed here and shown in full under the
// chart with arrows to step through the rest. A tooltip on a phone sat under
// the finger doing the picking and vanished as soon as it lifted.
const SampleHistoryChart: React.FC<Props> = ({
  samples,
  indicatorKey,
  selectedId,
  onSelect,
  onStep,
}) => {
  const indicator = INDICATORS[indicatorKey];
  const theme = useTheme();
  const resolvedMode = useResolvedColorScheme();
  const seriesColor = SERIES_COLORS[resolvedMode][0];

  // SVG attributes can't take CSS variables - read off the theme in JS, as
  // the rainfall chart does (correct in dark mode via forceThemeRerender).
  const chrome = {
    grid: theme.palette.divider,
    axis: theme.palette.surfaces.onVariant,
    text: theme.palette.text.secondary,
    surface: theme.palette.background.paper,
  };
  // The tier hues, as on the dots and the classification tables: the Good
  // range is light green and over Good is red. These used to be the theme's
  // warning and error colours, which put the Good range in amber - the
  // Sufficient tier's colour - beside a table that calls it Good.
  const excellentColor = SAMPLE_BAND_UI.excellent.color;
  const goodColor = SAMPLE_BAND_UI.good.color;
  const poorColor = SAMPLE_BAND_UI.poor.color;

  const chartRef = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);

  const data = useMemo<Point[]>(
    () =>
      samples
        .filter((s) => s[indicatorKey])
        .map((s) => {
          const count = s[indicatorKey]!;
          return {
            id: s.id,
            sortKey: sampleTimeMs(s),
            plotted: count.value,
            count,
            band: bandForCount(count, indicator),
          };
        }),
    [samples, indicatorKey, indicator]
  );

  // Picks the sample whose dot is nearest the pointer across the chart. Read
  // from the dots as drawn, rather than worked out from the axis scale, so it
  // can't drift from what's on screen whatever width the y-axis takes.
  const pickAt = (clientX: number) => {
    const dots = chartRef.current?.querySelectorAll(".recharts-line-dots > *");
    if (!dots || dots.length === 0) return;
    let nearest = -1;
    let nearestGap = Infinity;
    dots.forEach((dot, i) => {
      const box = dot.getBoundingClientRect();
      const gap = Math.abs(box.left + box.width / 2 - clientX);
      if (gap < nearestGap) {
        nearest = i;
        nearestGap = gap;
      }
    });
    const point = data[nearest];
    if (point && point.id !== selectedId) onSelect(point.id);
  };

  const first = data[0]?.sortKey ?? 0;
  const last = data[data.length - 1]?.sortKey ?? 0;
  // A few days' margin either side, so the end dots aren't cut in half by
  // the plot edge.
  const xDomain: [number, number] = [first - 4 * DAY_MS, last + 4 * DAY_MS];
  const ticks = useMemo(() => londonMonthStarts(first, last), [first, last]);

  // Always tall enough to show the Good limit, so a run of clean samples
  // still reads against it, with headroom so a ">1000" triangle at the top
  // isn't clipped.
  const yTop =
    Math.max(...data.map((d) => d.plotted), indicator.limits.good) * 1.1;
  const yStep = niceStep(yTop);
  const yMax = Math.ceil(yTop / yStep) * yStep;
  const yTicks = Array.from({ length: yMax / yStep + 1 }, (_, i) => i * yStep);

  // The dot is the reading: filled in its band colour, hollow where the
  // count was under the test's detection limit, and an upward triangle where
  // it was over the test's top limit - the true value is above the mark.
  const renderMark = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: Point;
  }) => {
    const { cx, cy, index, payload } = props;
    if (cx == null || cy == null || !payload) {
      return <g key={`dot-${index}`} />;
    }
    const fill = payload.band
      ? SAMPLE_BAND_UI[payload.band].color
      : seriesColor;
    if (payload.count.qualifier === "above") {
      const r = 6;
      return (
        <path
          key={`dot-${index}`}
          d={`M ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.75} L ${cx - r} ${cy + r * 0.75} Z`}
          fill={fill}
          stroke={chrome.surface}
          strokeWidth={1.5}
        />
      );
    }
    if (payload.count.qualifier === "below") {
      return (
        <circle
          key={`dot-${index}`}
          cx={cx}
          cy={cy}
          r={4}
          fill={chrome.surface}
          stroke={fill}
          strokeWidth={2}
        />
      );
    }
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4.5}
        fill={fill}
        stroke={chrome.surface}
        strokeWidth={1.5}
      />
    );
  };

  // The picked sample gets a ring around its mark, as Paddlecheck outlines
  // its picked hour's bar.
  const renderDot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: Point;
  }) => {
    const mark = renderMark(props);
    const { cx, cy, index, payload } = props;
    if (cx == null || cy == null || payload?.id !== selectedId) return mark;
    return (
      <g key={`dot-${index}`}>
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="none"
          stroke={theme.palette.text.primary}
          strokeWidth={2}
        />
        {mark}
      </g>
    );
  };

  // The three tiers as bands, each shaded in its tier colour (as the dots
  // and chips are) and named in its own top-left corner. Labelling the bands
  // rather than the limit lines between them keeps each name inside the
  // range it describes - "Good Limit" above the line used to sit in the Poor
  // band - and top-left is the corner the data least often reaches, as the
  // season starts low. The band edges mark the limits, so no separate lines.
  //
  // A flat array, not a fragment: recharts walks its children's types and
  // silently drops a Fragment's contents (as in RainfallChart).
  // Per scheme, as one wash can't suit both backgrounds: on the light card a
  // faint red turns mauve against the teal-grey, and on the dark card every
  // band all but vanishes. Dark gets stronger washes throughout.
  const bandOpacity =
    resolvedMode === "dark"
      ? { excellent: 0.16, good: 0.24, poor: 0.3 }
      : { excellent: 0.08, good: 0.16, poor: 0.2 };
  const bandLabel = (value: string) => ({
    value,
    position: "insideTopLeft" as const,
    fill: chrome.text,
    fontSize: 11,
    fontWeight: 600,
  });
  const limitMarks = [
    <ReferenceArea
      key="band-excellent"
      y1={0}
      y2={indicator.limits.excellent}
      fill={excellentColor}
      fillOpacity={bandOpacity.excellent}
      strokeWidth={0}
      ifOverflow="hidden"
      label={bandLabel(SAMPLE_BAND_UI.excellent.label)}
    />,
    <ReferenceArea
      key="band-good"
      y1={indicator.limits.excellent}
      y2={indicator.limits.good}
      fill={goodColor}
      fillOpacity={bandOpacity.good}
      strokeWidth={0}
      ifOverflow="hidden"
      label={bandLabel(SAMPLE_BAND_UI.good.label)}
    />,
    <ReferenceArea
      key="band-poor"
      y1={indicator.limits.good}
      y2={yMax}
      fill={poorColor}
      fillOpacity={bandOpacity.poor}
      strokeWidth={0}
      ifOverflow="hidden"
      label={bandLabel(SAMPLE_BAND_UI.poor.label)}
    />,
  ];

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {indicator.label} ({COUNT_UNIT})
      </Typography>
      <Box
        ref={chartRef}
        role="group"
        tabIndex={0}
        aria-label={`${indicator.label} history. Use the left and right arrow keys to step through samples.`}
        onPointerDown={(e) => {
          pressing.current = true;
          pickAt(e.clientX);
        }}
        onPointerMove={(e) => {
          if (pressing.current) pickAt(e.clientX);
        }}
        onPointerUp={() => {
          pressing.current = false;
        }}
        onPointerLeave={() => {
          pressing.current = false;
        }}
        onPointerCancel={() => {
          pressing.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onStep(-1);
          else if (e.key === "ArrowRight") onStep(1);
          else return;
          e.preventDefault();
        }}
        sx={{
          width: "100%",
          height: 240,
          cursor: "pointer",
          // Vertical drags still scroll the page; horizontal ones scrub.
          touchAction: "pan-y",
          ...chartRevealSx,
        }}
      >
        {/* Keyed on the indicator so each one draws in afresh. */}
        <ResponsiveContainer key={indicatorKey} width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={chrome.grid}
              strokeDasharray="0"
            />
            {limitMarks}
            <XAxis
              dataKey="sortKey"
              type="number"
              domain={xDomain}
              ticks={ticks}
              tickFormatter={monthTick}
              tick={{ fill: chrome.axis, fontSize: 11 }}
              axisLine={{ stroke: chrome.grid }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              tickFormatter={(v: number) => v.toLocaleString("en-GB")}
              tick={{ fill: chrome.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width="auto"
            />
            <Line
              dataKey="plotted"
              name={indicator.shortLabel}
              stroke={seriesColor}
              strokeOpacity={0.6}
              strokeWidth={2}
              type="linear"
              dot={renderDot}
              // No active dot: with no tooltip there's no hover state, and the
              // picked sample has its own ring (renderDot).
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary">
        ○ below the test&apos;s detection limit · ▲ over its upper limit, so the
        true count is higher
      </Typography>
    </Stack>
  );
};

export default SampleHistoryChart;
