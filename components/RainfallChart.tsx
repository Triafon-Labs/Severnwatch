"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Stack, ToggleButton, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RainfallForecastPoint, RainfallGaugeData } from "@/types";
import {
  DAILY_HEAVY_MM,
  DAILY_MODERATE_MM,
  HOURLY_HEAVY_MM,
  HOURLY_MODERATE_MM,
  buildCatchmentAverageIntensity,
  buildCumulative7dSeries,
  buildForecastSeries,
  buildHourlyIntensity,
} from "@/lib/rainfallAnalysis";
import { useResolvedColorScheme } from "@/lib/ThemeContext";
import { useTooltipDismiss } from "@/lib/useTooltipDismiss";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { formatTimeTick, londonParts } from "@/lib/time";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";

// Categorical palette, first 3 slots - validated all-pairs CVD-safe in both
// light and dark mode. Deliberately *not* the theme's primary teal: these
// identify one gauge from another, and a series colour that matches the
// interface's accent reads as "this one is selected" rather than "this one is
// Bewdley".
const SERIES_COLORS: Record<"light" | "dark", string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};

const BAND_CEILING = 1000; // clipped to the plot area regardless of axis domain
const FORECAST_HISTORY_HOURS = 24; // how far back the "Forecast" view shows observed data
const FORECAST_TICK_STEP_MINUTES = 480; // 8h - spans ~24h history + the forecast horizon
const MIN_MS = 60 * 1000;

type Range = "forecast" | "1h" | "8h" | "24h" | "7d";

const RANGE_LABEL: Record<Range, string> = {
  forecast: "Forecast",
  "1h": "1h",
  "8h": "8h",
  "24h": "24h",
  "7d": "7d",
};

const RANGES = Object.keys(RANGE_LABEL) as Range[];

const isRange = (value: string | null): value is Range =>
  value !== null && (RANGES as string[]).includes(value);

// Computed purely from the time range (not from the data points, which may
// have gaps or - like the UK gauges - land a few seconds off a clean
// boundary), so the axis always gets clean, evenly spaced marks. UK clocks
// never sit on a half-hour UTC offset, so minute-of-day in London tracks
// minute-of-day in UTC exactly - only which minutes are multiples of the
// step needs checking.
const buildTimeTicks = (
  minMs: number,
  maxMs: number,
  stepMinutes: number
): number[] => {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || minMs >= maxMs)
    return [];
  const ticks: number[] = [];
  for (let t = Math.ceil(minMs / MIN_MS) * MIN_MS; t <= maxMs; t += MIN_MS) {
    const { hour, minute } = londonParts(t);
    if ((hour * 60 + Number(minute)) % stepMinutes === 0) ticks.push(t);
  }
  return ticks;
};

interface Props {
  gauges: RainfallGaugeData[];
  forecast: RainfallForecastPoint[];
}

const RainfallChart: React.FC<Props> = ({ gauges, forecast }) => {
  // Seeded from localStorage on first render rather than in an effect, so the
  // reader's chosen range is what paints - not a frame of "Forecast" that
  // then jumps to "7d".
  const [range, setRange] = useState<Range>(() => {
    if (typeof window === "undefined") return "forecast";
    const saved = window.localStorage.getItem(STORAGE_KEYS.RAINFALL_RANGE);
    return isRange(saved) ? saved : "forecast";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.RAINFALL_RANGE, range);
    } catch {
      // Storage disabled or full - the chart still works, the choice just
      // doesn't survive a reload.
    }
  }, [range]);

  const theme = useTheme();
  const resolvedMode = useResolvedColorScheme();
  const colors = SERIES_COLORS[resolvedMode];

  // Recharts takes these as SVG attributes, so they can't come through `sx`
  // and have to be read off the theme in JS. That read is only correct in dark
  // mode because the provider sets `forceThemeRerender` - see lib/ThemeContext.
  const chrome = {
    grid: theme.palette.divider,
    axis: theme.palette.surfaces.onVariant,
    text: theme.palette.text.secondary,
  };
  const moderateColor = theme.palette.warning.main;
  const heavyColor = theme.palette.error.main;
  const forecastColor = colors[0];

  // A recharts tooltip on a touchscreen never receives the pointer-leave that
  // would close it, so it hangs over the chart until the chart is touched
  // again. This closes it on any press elsewhere on the page.
  const chartRef = useRef<HTMLDivElement>(null);
  const { tooltipActive, chartMoveProps } = useTooltipDismiss(chartRef);

  const isDaily = range === "7d";
  const isForecast = range === "forecast";
  const intensityHours =
    range === "1h" ? 1 : range === "8h" ? 8 : range === "24h" ? 24 : 0;
  const intensityTickStepMinutes =
    range === "1h" ? 15 : range === "8h" ? 120 : 360;

  const intensityData = useMemo(
    () =>
      intensityHours > 0 ? buildHourlyIntensity(gauges, intensityHours) : [],
    [gauges, intensityHours]
  );
  const cumulative7dData = useMemo(
    () => (isDaily ? buildCumulative7dSeries(gauges) : []),
    [gauges, isDaily]
  );

  const observedAvg = useMemo(
    () =>
      isForecast
        ? buildCatchmentAverageIntensity(gauges, FORECAST_HISTORY_HOURS)
        : [],
    [gauges, isForecast]
  );
  const forecastData = useMemo(
    () => (isForecast ? buildForecastSeries(observedAvg, forecast) : []),
    [observedAvg, forecast, isForecast]
  );
  // Where the solid observed line ends and the dashed forecast line begins -
  // the last real reading, not the device clock, so it lines up with the
  // data even if it's a few minutes stale.
  const boundaryMs = observedAvg[observedAvg.length - 1]?.sortKey;

  const cumulative7dTicks = useMemo(
    () =>
      isDaily
        ? buildTimeTicks(
            cumulative7dData[0]?.sortKey,
            cumulative7dData[cumulative7dData.length - 1]?.sortKey,
            1440
          )
        : [],
    [cumulative7dData, isDaily]
  );
  const intensityTicks = useMemo(
    () =>
      intensityHours > 0
        ? buildTimeTicks(
            intensityData[0]?.sortKey,
            intensityData[intensityData.length - 1]?.sortKey,
            intensityTickStepMinutes
          )
        : [],
    [intensityData, intensityHours, intensityTickStepMinutes]
  );
  const forecastTicks = useMemo(
    () =>
      isForecast
        ? buildTimeTicks(
            forecastData[0]?.sortKey,
            forecastData[forecastData.length - 1]?.sortKey,
            FORECAST_TICK_STEP_MINUTES
          )
        : [],
    [forecastData, isForecast]
  );

  const moderateMm = isDaily ? DAILY_MODERATE_MM : HOURLY_MODERATE_MM;
  const heavyMm = isDaily ? DAILY_HEAVY_MM : HOURLY_HEAVY_MM;

  const caption = isDaily
    ? "Cumulative rainfall (mm), last 7 days"
    : isForecast
      ? "Rainfall intensity (mm/hr)"
      : `Rainfall intensity (mm/hr), last ${range}`;

  // The moderate/heavy bands and their threshold lines are identical across
  // all three chart shapes. Returned as a flat array rather than a fragment:
  // recharts inspects its children's types to decide what to render, and a
  // Fragment is opaque to that walk, so its contents are silently dropped.
  const thresholdBands = () => [
    <ReferenceArea
      key="band-moderate"
      y1={moderateMm}
      y2={heavyMm}
      fill={moderateColor}
      fillOpacity={0.08}
      strokeWidth={0}
      ifOverflow="hidden"
    />,
    <ReferenceArea
      key="band-heavy"
      y1={heavyMm}
      y2={BAND_CEILING}
      fill={heavyColor}
      fillOpacity={0.08}
      strokeWidth={0}
      ifOverflow="hidden"
    />,
    <ReferenceLine
      key="line-moderate"
      y={moderateMm}
      stroke={moderateColor}
      strokeDasharray="4 4"
      label={{
        value: "Moderate",
        position: "insideTopRight",
        fill: chrome.text,
        fontSize: 11,
      }}
    />,
    <ReferenceLine
      key="line-heavy"
      y={heavyMm}
      stroke={heavyColor}
      strokeDasharray="4 4"
      label={{
        value: "Heavy",
        position: "insideTopRight",
        fill: chrome.text,
        fontSize: 11,
      }}
    />,
  ];

  const yAxis = () => (
    <YAxis
      tick={{ fill: chrome.axis, fontSize: 12 }}
      axisLine={false}
      tickLine={false}
      width={28}
    />
  );

  const timeAxis = (ticks: number[]) => (
    <XAxis
      dataKey="sortKey"
      type="number"
      domain={["dataMin", "dataMax"]}
      ticks={ticks}
      tickFormatter={formatTimeTick}
      tick={{ fill: chrome.axis, fontSize: 11 }}
      axisLine={{ stroke: chrome.grid }}
      tickLine={false}
    />
  );

  // M3's plain tooltip shape, matched to the one the theme gives MUI's own
  // Tooltip - recharts renders its own DOM node and never sees that override.
  const tooltipStyle = {
    fontSize: 13,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.surfaces.containerHigh,
    color: theme.palette.text.primary,
    boxShadow: "none",
  };

  return (
    <Stack spacing={1}>
      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
        <SlidingToggleButtonGroup
          value={range}
          exclusive
          fullWidth
          size="small"
          aria-label="Rainfall time range"
          onChange={(_, value: Range | null) => value && setRange(value)}
        >
          {RANGES.map((r) => (
            <ToggleButton key={r} value={r} sx={{ fontSize: 12 }}>
              {RANGE_LABEL[r]}
            </ToggleButton>
          ))}
        </SlidingToggleButtonGroup>
      </Stack>

      <Box ref={chartRef} sx={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {isDaily ? (
            <ComposedChart
              data={cumulative7dData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              {...chartMoveProps}
            >
              <CartesianGrid
                vertical={false}
                stroke={chrome.grid}
                strokeDasharray="0"
              />
              {thresholdBands()}
              {timeAxis(cumulative7dTicks)}
              {yAxis()}
              <Tooltip
                active={tooltipActive}
                labelFormatter={(value) => formatTimeTick(value as number)}
                formatter={(value, name) => [`${value} mm`, name]}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: chrome.text }} />
              {gauges.map((gauge, i) => (
                <Line
                  key={gauge.id}
                  dataKey={gauge.id}
                  name={gauge.label}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  type="monotone"
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          ) : isForecast ? (
            <ComposedChart
              data={forecastData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              {...chartMoveProps}
            >
              <CartesianGrid
                vertical={false}
                stroke={chrome.grid}
                strokeDasharray="0"
              />
              {thresholdBands()}
              {boundaryMs !== undefined && (
                <ReferenceLine
                  x={boundaryMs}
                  stroke={chrome.axis}
                  strokeDasharray="3 3"
                  label={{
                    value: "Now",
                    position: "top",
                    fill: chrome.text,
                    fontSize: 11,
                  }}
                />
              )}
              {timeAxis(forecastTicks)}
              {yAxis()}
              <Tooltip
                active={tooltipActive}
                labelFormatter={(value) => formatTimeTick(value as number)}
                formatter={(value, name) => [
                  `${value} mm/hr`,
                  name === "observedMm" ? "Observed" : "Forecast",
                ]}
                contentStyle={tooltipStyle}
              />
              <Line
                dataKey="observedMm"
                name="observedMm"
                stroke={forecastColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                type="monotone"
                isAnimationActive={false}
              />
              <Line
                dataKey="forecastMm"
                name="forecastMm"
                stroke={forecastColor}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                type="monotone"
                isAnimationActive={false}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={intensityData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              {...chartMoveProps}
            >
              <CartesianGrid
                vertical={false}
                stroke={chrome.grid}
                strokeDasharray="0"
              />
              {thresholdBands()}
              {timeAxis(intensityTicks)}
              {yAxis()}
              <Tooltip
                active={tooltipActive}
                labelFormatter={(value) => formatTimeTick(value as number)}
                formatter={(value, name) => [`${value} mm/hr`, name]}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: chrome.text }} />
              {gauges.map((gauge, i) => (
                <Line
                  key={gauge.id}
                  dataKey={gauge.id}
                  name={gauge.label}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  type="monotone"
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </Box>

      {isForecast && forecast.length === 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          Forecast is temporarily unavailable - showing observed rainfall only.
        </Typography>
      )}
    </Stack>
  );
};

export default RainfallChart;
