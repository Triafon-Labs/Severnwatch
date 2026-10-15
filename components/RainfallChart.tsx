"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Paper, Stack, ToggleButton, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
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
import { SERIES_COLORS } from "@/lib/chartColors";

// Paddlecheck's chart tooltip, so a reading looks the same in both apps: a
// plain Paper - which the MuiPaper override gives the raised containerHigh
// tone, with no border - at a 16px inset, the time in body1 and each value
// in body2 beneath it. The recharts default this replaces was a bordered
// box in 13px type. With more than one series on the chart, each row carries
// its line's colour, since the names alone don't say which line is which.
const ChartTooltip = ({
  active,
  payload,
  label,
  unit,
  nameFor = (name) => String(name),
}: TooltipContentProps<ValueType, NameType> & {
  unit: string;
  nameFor?: (name: NameType | undefined) => string;
}) => {
  const rows = (payload ?? []).filter((p) => typeof p.value === "number");
  if (!active || rows.length === 0 || label == null) return null;
  return (
    <Paper sx={{ p: 2, pointerEvents: "none" }}>
      <Typography variant="body1">{formatTimeTick(Number(label))}</Typography>
      {rows.map((p) => (
        <Box
          key={String(p.dataKey)}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          {rows.length > 1 && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: p.color,
                flexShrink: 0,
              }}
            />
          )}
          <Typography variant="body2">
            {nameFor(p.name)}: {p.value} {unit}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
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

const RANGES: Range[] = ["7d", "24h", "8h", "1h", "forecast"];

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
  const stepMs = stepMinutes * MIN_MS;
  let t = Math.ceil(minMs / MIN_MS) * MIN_MS;

  // Find the first timestamp aligned to the stepMinutes boundary
  while (t <= maxMs) {
    const { hour, minute } = londonParts(t);
    if ((hour * 60 + Number(minute)) % stepMinutes === 0) break;
    t += MIN_MS;
  }

  const ticks: number[] = [];
  while (t <= maxMs) {
    ticks.push(t);
    t += stepMs;
  }
  return ticks;
};

interface Props {
  gauges: RainfallGaugeData[];
  forecast: RainfallForecastPoint[];
  // Age of the newest gauge reading, e.g. "12 min ago".
  dataAgeLabel: string | null;
}

const RainfallChart: React.FC<Props> = ({ gauges, forecast, dataAgeLabel }) => {
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
  const thresholdBands = () => {
    if (isDaily) return [];

    return [
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
  };

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

  return (
    <Stack spacing={1}>
      <Stack spacing={1}>
        {/* Shares a row with the chart's caption rather than stacking a second
            caption line above the toggle. Same styling as Paddlecheck's "As
            of" over its river graph: text.disabled, right-aligned. */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "baseline" }}
        >
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
          {dataAgeLabel && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ flexShrink: 0, textAlign: "right" }}
            >
              As of {dataAgeLabel}
            </Typography>
          )}
        </Stack>
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
                content={(props: TooltipContentProps<ValueType, NameType>) => (
                  <ChartTooltip {...props} unit="mm" />
                )}
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
                content={(props: TooltipContentProps<ValueType, NameType>) => (
                  <ChartTooltip
                    {...props}
                    unit="mm/hr"
                    nameFor={(name) =>
                      name === "observedMm" ? "Observed" : "Forecast"
                    }
                  />
                )}
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
                content={(props: TooltipContentProps<ValueType, NameType>) => (
                  <ChartTooltip {...props} unit="mm/hr" />
                )}
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
