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
import { RainfallGaugeData } from "@/types";

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

// Rough intensity bands, not a validated meteorological or hydrological
// standard - a heuristic to make bursts and sustained rain visually
// legible, not a guarantee of spill risk. Broadly aligned with Met Office
// "moderate"/"heavy" rain intensity, and typical CSO trigger behaviour
// (short heavy bursts and prolonged moderate rain both fill sewer capacity).
const HOURLY_MODERATE_MM = 2; // mm/hr - sustained rain, medium likelihood
const HOURLY_HEAVY_MM = 8; // mm/hr - thunderstorm-level burst, high likelihood
const DAILY_MODERATE_MM = 10; // mm/day - a wet day, medium likelihood
const DAILY_HEAVY_MM = 25; // mm/day - a very wet day, high likelihood

const HOURLY_WINDOW_HOURS = 48;
const HOURLY_TICK_STEP_HOURS = 8; // gridline every 8h - clean, unambiguous labels
const BAND_CEILING = 1000; // clipped to the plot area regardless of axis domain

type View = "hourly" | "daily";

interface Bucket {
  label: string;
  sortKey: number;
  [gaugeId: string]: number | string;
}

// Reads a timestamp's Europe/London wall-clock hour/minute without pulling
// in a timezone library - used to align x-axis ticks to clean local times
// (00:00, 08:00, ...) and to build human-readable tick/tooltip labels.
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

const formatHourlyTick = (ms: number) => {
  const { weekday, hour, minute } = londonParts(ms);
  return `${weekday} ${String(hour).padStart(2, "0")}:${minute}`;
};

const HOUR_MS = 60 * 60 * 1000;

// Computed purely from the time range (not from the data points, which may
// have gaps or - like the UK gauges - land a few seconds off a clean
// boundary), so the axis always gets clean, evenly spaced hour marks. UK
// clocks never sit on a half-hour UTC offset, so every UTC hour boundary is
// already a London :00 - only which of those hours are multiples of the
// step needs checking.
const buildHourlyTicks = (minMs: number, maxMs: number, stepHours: number): number[] => {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || minMs >= maxMs) return [];
  const ticks: number[] = [];
  for (let t = Math.ceil(minMs / HOUR_MS) * HOUR_MS; t <= maxMs; t += HOUR_MS) {
    if (londonParts(t).hour % stepHours === 0) ticks.push(t);
  }
  return ticks;
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const dayStartMs = (iso: string) => {
  const londonDate = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return new Date(`${londonDate}T00:00:00Z`).getTime();
};

const buildDailyTotals = (gauges: RainfallGaugeData[]): Bucket[] => {
  const days = new Map<string, Bucket>();
  for (const gauge of gauges) {
    for (const r of gauge.readings) {
      const key = dayLabel(r.dateTime);
      if (!days.has(key)) {
        days.set(key, { label: key, sortKey: dayStartMs(r.dateTime) });
      }
      const bucket = days.get(key)!;
      const current = typeof bucket[gauge.id] === "number" ? (bucket[gauge.id] as number) : 0;
      bucket[gauge.id] = current + r.valueMm;
    }
  }
  return Array.from(days.values())
    .map((b) => {
      const rounded: Bucket = { label: b.label, sortKey: b.sortKey };
      for (const gauge of gauges) {
        if (typeof b[gauge.id] === "number") {
          rounded[gauge.id] = Math.round((b[gauge.id] as number) * 10) / 10;
        }
      }
      return rounded;
    })
    .sort((a, b) => a.sortKey - b.sortKey);
};

// Uses the raw 15-min readings directly (already fetched for the 7-day
// history) rather than re-aggregating to daily totals, so a burst lasting
// even one 15-min tip shows up as a spike instead of being smoothed away.
const buildHourlyIntensity = (gauges: RainfallGaugeData[]): Bucket[] => {
  const cutoff = Date.now() - HOURLY_WINDOW_HOURS * 60 * 60 * 1000;
  const points = new Map<string, Bucket>();
  for (const gauge of gauges) {
    for (const r of gauge.readings) {
      const ts = new Date(r.dateTime).getTime();
      if (ts < cutoff) continue;
      if (!points.has(r.dateTime)) {
        points.set(r.dateTime, { label: formatHourlyTick(ts), sortKey: ts });
      }
      points.get(r.dateTime)![gauge.id] = Math.round(r.valueMm * 4 * 10) / 10; // mm/15min -> mm/hr
    }
  }
  return Array.from(points.values()).sort((a, b) => a.sortKey - b.sortKey);
};

interface Props {
  gauges: RainfallGaugeData[];
}

const RainfallChart: React.FC<Props> = ({ gauges }) => {
  const [view, setView] = useState<View>("hourly");
  const { mode, systemMode } = useColorScheme();
  const theme = useTheme();
  const resolvedMode: "light" | "dark" =
    (mode === "system" ? systemMode : mode) === "dark" ? "dark" : "light";
  const colors = SERIES_COLORS[resolvedMode];
  const chrome = CHROME[resolvedMode];
  const moderateColor = theme.palette.warning.main;
  const heavyColor = theme.palette.error.main;

  const hourlyData = useMemo(() => buildHourlyIntensity(gauges), [gauges]);
  const dailyData = useMemo(() => buildDailyTotals(gauges), [gauges]);
  const hourlyTicks = useMemo(
    () =>
      buildHourlyTicks(
        hourlyData[0]?.sortKey,
        hourlyData[hourlyData.length - 1]?.sortKey,
        HOURLY_TICK_STEP_HOURS
      ),
    [hourlyData]
  );
  const data = view === "hourly" ? hourlyData : dailyData;
  const moderateMm = view === "hourly" ? HOURLY_MODERATE_MM : DAILY_MODERATE_MM;
  const heavyMm = view === "hourly" ? HOURLY_HEAVY_MM : DAILY_HEAVY_MM;

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary">
          {view === "hourly"
            ? `Rainfall intensity (mm/hr), last ${HOURLY_WINDOW_HOURS}h`
            : "Daily rainfall (mm), last 7 days"}
        </Typography>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, value: View | null) => value && setView(value)}
        >
          <ToggleButton value="hourly" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
            Hourly
          </ToggleButton>
          <ToggleButton value="daily" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
            Daily
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {view === "hourly" ? (
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                ticks={hourlyTicks}
                tickFormatter={formatHourlyTick}
                tick={{ fill: chrome.axis, fontSize: 11 }}
                axisLine={{ stroke: chrome.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chrome.axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                labelFormatter={(value) => formatHourlyTick(value as number)}
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
          ) : (
            <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
              <YAxis
                tick={{ fill: chrome.axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
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
          )}
        </ResponsiveContainer>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        Shaded bands are a rough guide to spill likelihood from rainfall
        alone (moderate ≈ sustained rain, heavy ≈ thunderstorm-level) - actual
        risk also depends on sewer capacity and ground conditions.
      </Typography>
    </Stack>
  );
};

export default RainfallChart;
