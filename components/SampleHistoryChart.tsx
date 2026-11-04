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
import { formatLondonDate, londonMonthStarts } from "@/lib/londonDate";
import { useResolvedColorScheme } from "@/lib/ThemeContext";
import { useTooltipDismiss } from "@/lib/useTooltipDismiss";
import { SERIES_COLORS } from "@/lib/chartColors";
import { revealSx } from "@/lib/chartMotion";

// Every sample for one indicator over time, on a log scale: the counts run
// from "<10" to ">1000" and the interesting differences are factors of ten,
// which a linear axis would flatten into a line along the floor with the odd
// spike. Each dot carries its band colour, so the chart reads the same way
// as the sample card's chips.

const chartRevealSx = revealSx(".recharts-line", 1200, "ease");

const DAY_MS = 24 * 60 * 60 * 1000;
// Log scale has no zero, and a "0" count is as legitimate as "<10" - both
// are drawn on the floor.
const FLOOR = 5;

interface Point {
  sortKey: number;
  plotted: number;
  count: BacteriaCount;
  band: SampleBand | null;
  hasNote: boolean;
}

const monthTick = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    month: "short",
  });

const SampleTooltip = ({
  active,
  payload,
  indicatorKey,
}: TooltipContentProps<ValueType, NameType> & {
  indicatorKey: IndicatorKey;
}) => {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <Paper sx={{ p: 2, pointerEvents: "none" }}>
      <Typography variant="body1">
        {formatLondonDate(point.sortKey, { withTime: true })}
      </Typography>
      <Typography variant="body2">
        {INDICATORS[indicatorKey].shortLabel}: {formatCount(point.count)}{" "}
        {COUNT_UNIT}
      </Typography>
      {point.band && (
        <Typography variant="body2" color="text.secondary">
          {SAMPLE_BAND_UI[point.band].description}
        </Typography>
      )}
      {point.hasNote && (
        <Typography variant="body2" color="text.secondary">
          Has a tester&apos;s note
        </Typography>
      )}
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
  const elevatedColor = theme.palette.warning.main;
  const highColor = theme.palette.error.main;

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
            plotted: Math.max(count.value, FLOOR),
            count,
            band: bandForCount(count, indicator),
            hasNote: Boolean(s.notes),
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

  const maxPlotted = Math.max(...data.map((d) => d.plotted), 1000);
  const yMax = 10 ** Math.ceil(Math.log10(maxPlotted * 1.5));
  const yTicks = [10, 100, 1000, 10000, 100000].filter((t) => t <= yMax);

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

  // On a log axis 500 and 1000 sit close together, so the labels go on the
  // outside of the pair - Good's above its line, Excellent's below its own -
  // rather than both in the gap, where they overprint. (recharts' "inside"
  // positions are measured from the line's own zero-height box, so
  // insideBottom is above the line and insideTop below it.)
  //
  // A flat array, not a fragment: recharts walks its children's types and
  // silently drops a Fragment's contents (as in RainfallChart).
  const limitMarks = indicator.limits
    ? [
        <ReferenceArea
          key="band-elevated"
          y1={indicator.limits.excellent}
          y2={indicator.limits.good}
          fill={elevatedColor}
          fillOpacity={0.08}
          strokeWidth={0}
          ifOverflow="hidden"
        />,
        <ReferenceArea
          key="band-high"
          y1={indicator.limits.good}
          y2={yMax}
          fill={highColor}
          fillOpacity={0.08}
          strokeWidth={0}
          ifOverflow="hidden"
        />,
        <ReferenceLine
          key="line-excellent"
          y={indicator.limits.excellent}
          stroke={elevatedColor}
          strokeDasharray="4 4"
          label={{
            value: "Excellent limit",
            position: "insideTopLeft",
            fill: chrome.text,
            fontSize: 11,
          }}
        />,
        <ReferenceLine
          key="line-good"
          y={indicator.limits.good}
          stroke={highColor}
          strokeDasharray="4 4"
          label={{
            value: "Good limit",
            position: "insideBottomLeft",
            fill: chrome.text,
            fontSize: 11,
          }}
        />,
      ]
    : [];

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {indicator.label} ({COUNT_UNIT}, log scale)
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
              scale="log"
              domain={[FLOOR, yMax]}
              ticks={yTicks}
              allowDataOverflow
              tickFormatter={(v: number) => v.toLocaleString("en-GB")}
              tick={{ fill: chrome.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width="auto"
            />
            <Tooltip
              active={tooltipActive}
              content={(props: TooltipContentProps<ValueType, NameType>) => (
                <SampleTooltip {...props} indicatorKey={indicatorKey} />
              )}
            />
            <Line
              dataKey="plotted"
              name={indicator.shortLabel}
              stroke={seriesColor}
              strokeOpacity={0.6}
              strokeWidth={2}
              type="linear"
              dot={renderDot}
              activeDot={{ r: 6 }}
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
