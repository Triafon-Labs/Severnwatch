"use client";

import { useMemo, useState } from "react";
import { useColorScheme, useTheme } from "@mui/material/styles";
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
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
  buildDailyTotals,
  buildForecastSeries,
  buildHourlyIntensity,
} from "@/lib/rainfallAnalysis";

// Categorical palette, first 3 slots - validated all-pairs CVD-safe in both
// light and dark mode (see the dataviz skill's reference palette).
const SERIES_COLORS: Record<"light" | "dark", string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};

const CHROME = {
  light: { grid: "#e1e0d9", axis: "#898781", text: "#52514e" },
  dark: { grid: "#2c2c2a", axis: "#898781", text: "#c3c2b7" },
};

const BAND_CEILING = 1000; // clipped to the plot area regardless of axis domain
const FORECAST_HISTORY_HOURS = 24; // how far back the "Forecast" view shows observed data
const FORECAST_TICK_STEP_MINUTES = 480; // 8h - spans ~24h history + the forecast horizon

type Range = "forecast" | "1h" | "8h" | "24h" | "7d";

const RANGE_LABEL: Record<Range, string> = {
  forecast: "Forecast",
  "1h": "1h",
  "8h": "8h",
  "24h": "24h",
  "7d": "7d",
};

// Reads a timestamp's Europe/London wall-clock time without pulling in a
// timezone library - used to align x-axis ticks to clean local times and to
// build human-readable tick/tooltip labels.
const londonParts = (ms: number) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: get("minute") };
};

const formatTimeTick = (ms: number) => {
  const { weekday, hour, minute } = londonParts(ms);
  return `${weekday} ${String(hour).padStart(2, "0")}:${minute}`;
};

const MIN_MS = 60 * 1000;

// Computed purely from the time range (not from the data points, which may
// have gaps or - like the UK gauges - land a few seconds off a clean
// boundary), so the axis always gets clean, evenly spaced marks. UK clocks
// never sit on a half-hour UTC offset, so minute-of-day in London tracks
// minute-of-day in UTC exactly - only which minutes are multiples of the
// step needs checking.
const buildTimeTicks = (minMs: number, maxMs: number, stepMinutes: number): number[] => {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || minMs >= maxMs) return [];
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
  const [range, setRange] = useState<Range>("forecast");
  const { mode, systemMode } = useColorScheme();
  const theme = useTheme();
  const resolvedMode: "light" | "dark" =
    (mode === "system" ? systemMode : mode) === "dark" ? "dark" : "light";
  const colors = SERIES_COLORS[resolvedMode];
  const chrome = CHROME[resolvedMode];
  const moderateColor = theme.palette.warning.main;
  const heavyColor = theme.palette.error.main;
  const forecastColor = colors[0];

  const isDaily = range === "7d";
  const isForecast = range === "forecast";
  const intensityHours = range === "1h" ? 1 : range === "8h" ? 8 : range === "24h" ? 24 : 0;
  const intensityTickStepMinutes = range === "1h" ? 15 : range === "8h" ? 120 : 360;

  const intensityData = useMemo(
    () => (intensityHours > 0 ? buildHourlyIntensity(gauges, intensityHours) : []),
    [gauges, intensityHours]
  );
  const dailyData = useMemo(() => (isDaily ? buildDailyTotals(gauges) : []), [gauges, isDaily]);

  const observedAvg = useMemo(
    () => (isForecast ? buildCatchmentAverageIntensity(gauges, FORECAST_HISTORY_HOURS) : []),
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
    ? "Daily rainfall (mm), last 7 days"
    : isForecast
      ? `Rainfall intensity (mm/hr) - Worcester, last ${FORECAST_HISTORY_HOURS}h & forecast`
      : `Rainfall intensity (mm/hr), last ${range}`;

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
        <ToggleButtonGroup
          value={range}
          exclusive
          size="small"
          onChange={(_, value: Range | null) => value && setRange(value)}
        >
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <ToggleButton key={r} value={r} sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>
              {RANGE_LABEL[r]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {isDaily ? (
            <BarChart data={dailyData} barGap={2} barCategoryGap="20%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} strokeDasharray="0" />
              <ReferenceArea y1={moderateMm} y2={heavyMm} fill={moderateColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceArea y1={heavyMm} y2={BAND_CEILING} fill={heavyColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceLine
                y={moderateMm}
                stroke={moderateColor}
                strokeDasharray="4 4"
                label={{ value: "Moderate", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              <ReferenceLine
                y={heavyMm}
                stroke={heavyColor}
                strokeDasharray="4 4"
                label={{ value: "Heavy", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: chrome.axis, fontSize: 12 }}
                axisLine={{ stroke: chrome.grid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chrome.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={(value, name) => [`${value} mm`, name]} contentStyle={{ fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: chrome.text }} />
              {gauges.map((gauge, i) => (
                <Bar
                  key={gauge.id}
                  dataKey={gauge.id}
                  name={gauge.label}
                  fill={colors[i % colors.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              ))}
            </BarChart>
          ) : isForecast ? (
            <ComposedChart data={forecastData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} strokeDasharray="0" />
              <ReferenceArea y1={moderateMm} y2={heavyMm} fill={moderateColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceArea y1={heavyMm} y2={BAND_CEILING} fill={heavyColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceLine
                y={moderateMm}
                stroke={moderateColor}
                strokeDasharray="4 4"
                label={{ value: "Moderate", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              <ReferenceLine
                y={heavyMm}
                stroke={heavyColor}
                strokeDasharray="4 4"
                label={{ value: "Heavy", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              {boundaryMs !== undefined && (
                <ReferenceLine
                  x={boundaryMs}
                  stroke={chrome.axis}
                  strokeDasharray="3 3"
                  label={{ value: "Now", position: "top", fill: chrome.text, fontSize: 11 }}
                />
              )}
              <XAxis
                dataKey="sortKey"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={forecastTicks}
                tickFormatter={formatTimeTick}
                tick={{ fill: chrome.axis, fontSize: 11 }}
                axisLine={{ stroke: chrome.grid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chrome.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                labelFormatter={(value) => formatTimeTick(value as number)}
                formatter={(value, name) => [`${value} mm/hr`, name === "observedMm" ? "Observed" : "Forecast"]}
                contentStyle={{ fontSize: 13 }}
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
            <ComposedChart data={intensityData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} strokeDasharray="0" />
              <ReferenceArea y1={moderateMm} y2={heavyMm} fill={moderateColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceArea y1={heavyMm} y2={BAND_CEILING} fill={heavyColor} fillOpacity={0.08} strokeWidth={0} />
              <ReferenceLine
                y={moderateMm}
                stroke={moderateColor}
                strokeDasharray="4 4"
                label={{ value: "Moderate", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              <ReferenceLine
                y={heavyMm}
                stroke={heavyColor}
                strokeDasharray="4 4"
                label={{ value: "Heavy", position: "insideTopRight", fill: chrome.text, fontSize: 11 }}
              />
              <XAxis
                dataKey="sortKey"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={intensityTicks}
                tickFormatter={formatTimeTick}
                tick={{ fill: chrome.axis, fontSize: 11 }}
                axisLine={{ stroke: chrome.grid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: chrome.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                labelFormatter={(value) => formatTimeTick(value as number)}
                formatter={(value, name) => [`${value} mm/hr`, name]}
                contentStyle={{ fontSize: 13 }}
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

      {isForecast && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {forecast.length > 0
            ? "Dashed line is Open-Meteo's forecast for Worcester - a single point for the whole catchment, not a per-gauge reading. For guidance only."
            : "Forecast is temporarily unavailable - showing observed rainfall only."}
        </Typography>
      )}
    </Stack>
  );
};

export default RainfallChart;
