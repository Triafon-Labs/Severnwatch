"use client";

import { useMemo, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Paper, Stack, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { BacteriaCount, WaterQualitySample } from "@/types";
import {
  COUNT_UNIT,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  SampleBand,
  bandForCount,
  formatCount,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatLondonDate, londonMonthStarts } from "@/lib/time";
import { useResolvedColorScheme } from "@/lib/ThemeContext";
import { useTooltipDismiss } from "@/lib/useTooltipDismiss";
import { SERIES_COLORS } from "@/lib/chartColors";
import { revealSx } from "@/lib/chartMotion";

// Every sample for one indicator over time, on a linear scale. A log axis
// was tried first, but SAS's test tops out at ">1000", so the counts only
// span 10 to 1000 - not enough range to need one - and a log axis makes a
// jump from 100 to 1000 look the same size as one from 10 to 100, which
// undersells exactly the results that matter. The cost is that the low
// counts (<10, 20, 80) bunch along the floor; they're all well under the
// limits, and the tooltip and table give the exact figures. If the lab ever
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

// Paddlecheck's river graph tooltip: the time and the headline figure, and
// nothing else. The band is already the dot's colour, and a tester's note
// is shown in full in the sample table below, where it doesn't depend on a
// tap landing on the right point.
const SampleTooltip = ({
  active,
  payload,
}: TooltipContentProps<ValueType, NameType>) => {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <Paper sx={{ p: 2, pointerEvents: "none" }}>
      <Typography variant="body1">
        {formatLondonDate(point.sortKey, { withTime: true })}
      </Typography>
      <Typography variant="body2">
        {formatCount(point.count)} {COUNT_UNIT}
      </Typography>
    </Paper>
  );
};

interface Props {
  samples: WaterQualitySample[];
  indicatorKey: IndicatorKey;
}

const SampleHistoryChart: React.FC<Props> = ({ samples, indicatorKey }) => {
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
  const { tooltipActive, chartMoveProps } = useTooltipDismiss(chartRef);

  const data = useMemo<Point[]>(
    () =>
      samples
        .filter((s) => s[indicatorKey])
        .map((s) => {
          const count = s[indicatorKey]!;
          return {
            sortKey: sampleTimeMs(s),
            plotted: count.value,
            count,
            band: bandForCount(count, indicator),
          };
        }),
    [samples, indicatorKey, indicator]
  );

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
  const renderDot = (props: {
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

  // The labels go on the outside of the pair - Good's above its line,
  // Excellent's below its own - so they can't overprint in the gap between
  // them on a short chart. (recharts' "inside"
  // positions are measured from the line's own zero-height box, so
  // insideBottom is above the line and insideTop below it.)
  //
  // A flat array, not a fragment: recharts walks its children's types and
  // silently drops a Fragment's contents (as in RainfallChart).
  // The Excellent range is left unshaded: a dark-green wash under a
  // light-green one was too close to tell apart, and the dark-green line and
  // dots already mark it.
  const limitMarks = [
    <ReferenceArea
      key="band-good"
      y1={indicator.limits.excellent}
      y2={indicator.limits.good}
      fill={goodColor}
      fillOpacity={0.1}
      strokeWidth={0}
      ifOverflow="hidden"
    />,
    <ReferenceArea
      key="band-poor"
      y1={indicator.limits.good}
      y2={yMax}
      fill={poorColor}
      fillOpacity={0.08}
      strokeWidth={0}
      ifOverflow="hidden"
    />,
    <ReferenceLine
      key="line-excellent"
      y={indicator.limits.excellent}
      stroke={excellentColor}
      strokeDasharray="4 4"
      label={{
        value: "Excellent Limit",
        position: "insideTopLeft",
        fill: chrome.text,
        fontSize: 11,
      }}
    />,
    <ReferenceLine
      key="line-good"
      y={indicator.limits.good}
      stroke={goodColor}
      strokeDasharray="4 4"
      label={{
        value: "Good Limit",
        position: "insideBottomLeft",
        fill: chrome.text,
        fontSize: 11,
      }}
    />,
  ];

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {indicator.label} ({COUNT_UNIT})
      </Typography>
      <Box ref={chartRef} sx={{ width: "100%", height: 240, ...chartRevealSx }}>
        {/* Keyed on the indicator so each one draws in afresh. */}
        <ResponsiveContainer key={indicatorKey} width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            {...chartMoveProps}
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
            <Tooltip active={tooltipActive} content={SampleTooltip} />
            <Line
              dataKey="plotted"
              name={indicator.shortLabel}
              stroke={seriesColor}
              strokeOpacity={0.6}
              strokeWidth={2}
              type="linear"
              dot={renderDot}
              // No active dot, as in Paddlecheck's forecast graph: recharts
              // would draw a plain series-colour dot over the tapped sample,
              // hiding its band colour and its ">" triangle while the
              // tooltip is open.
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
