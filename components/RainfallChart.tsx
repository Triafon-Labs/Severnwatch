"use client";

import { useMemo } from "react";
import { useColorScheme } from "@mui/material/styles";
import { Box } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

interface DayBucket {
  day: string;
  sortKey: number;
  [gaugeId: string]: number | string;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const dayStartMs = (iso: string) => {
  // Bucket key: midnight Europe/London for the reading's date, used only for
  // chronological sort order (the label itself is what's displayed).
  const d = new Date(iso);
  const londonDate = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return new Date(`${londonDate}T00:00:00Z`).getTime();
};

const buildDailyTotals = (gauges: RainfallGaugeData[]): DayBucket[] => {
  const days = new Map<string, DayBucket>();
  for (const gauge of gauges) {
    for (const r of gauge.readings) {
      const key = dayLabel(r.dateTime);
      if (!days.has(key)) {
        days.set(key, { day: key, sortKey: dayStartMs(r.dateTime) });
      }
      const bucket = days.get(key)!;
      const current = typeof bucket[gauge.id] === "number" ? (bucket[gauge.id] as number) : 0;
      bucket[gauge.id] = current + r.valueMm;
    }
  }
  return Array.from(days.values())
    .map((b) => {
      const rounded: DayBucket = { day: b.day, sortKey: b.sortKey };
      for (const gauge of gauges) {
        if (typeof b[gauge.id] === "number") {
          rounded[gauge.id] = Math.round((b[gauge.id] as number) * 10) / 10;
        }
      }
      return rounded;
    })
    .sort((a, b) => a.sortKey - b.sortKey);
};

interface Props {
  gauges: RainfallGaugeData[];
}

const RainfallChart: React.FC<Props> = ({ gauges }) => {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode: "light" | "dark" =
    (mode === "system" ? systemMode : mode) === "dark" ? "dark" : "light";
  const colors = SERIES_COLORS[resolvedMode];
  const chrome = CHROME[resolvedMode];

  const data = useMemo(() => buildDailyTotals(gauges), [gauges]);

  return (
    <Box sx={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="20%">
          <CartesianGrid
            vertical={false}
            stroke={chrome.grid}
            strokeDasharray="0"
          />
          <XAxis
            dataKey="day"
            tick={{ fill: chrome.axis, fontSize: 12 }}
            axisLine={{ stroke: chrome.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: chrome.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
            label={{
              value: "mm",
              position: "insideTopLeft",
              fill: chrome.axis,
              fontSize: 12,
            }}
          />
          <Tooltip
            formatter={(value, name) => [`${value} mm`, name]}
            contentStyle={{ fontSize: 13 }}
          />
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
      </ResponsiveContainer>
    </Box>
  );
};

export default RainfallChart;
