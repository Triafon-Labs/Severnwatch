"use client";

import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import HistoryIcon from "@mui/icons-material/History";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import ThunderstormIcon from "@mui/icons-material/Thunderstorm";
import { CsoState } from "@/types";
import { CSO_STATE_UI, CSO_STATE_ORDER } from "@/lib/csoStatus";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import {
  SEWAGE_RECENT_SPILL_BASE_HOURS,
  WATER_QUALITY_RECENT_DAYS,
  WATER_QUALITY_RELEVANT_DAYS,
} from "@/lib/config";
import { MAX_PLUME_TRAVEL_HOURS } from "@/lib/catchment";
import { PollutionRiskLevel, RISK_LEVEL_UI } from "@/lib/pollutionRisk";
import { HOURLY_HEAVY_MM, HOURLY_MODERATE_MM } from "@/lib/rainfallAnalysis";
import { SERIES_COLORS } from "@/lib/chartColors";
import { useResolvedColorScheme } from "@/lib/ThemeContext";

// The longest a finished spill stays "Recent": the base window plus the
// furthest outfall's travel time to the reach (see the sewage route).
const MAX_RECENT_HOURS =
  SEWAGE_RECENT_SPILL_BASE_HOURS + MAX_PLUME_TRAVEL_HOURS;

const STATE_ICONS: Record<CsoState, React.ElementType> = {
  Ongoing: ReportProblemIcon,
  Recent: HistoryIcon,
  Offline: CloudOffIcon,
  "Not discharging": CheckCircleOutlineIcon,
};

const STATE_DESCRIPTIONS: Record<CsoState, string> = {
  Ongoing: "A monitored outfall is releasing sewage into the river right now.",
  Recent: `Stopped within the last ${SEWAGE_RECENT_SPILL_BASE_HOURS} hours, plus the time the water takes to reach Worcester - up to ${MAX_RECENT_HOURS} hours for the furthest stops upstream.`,
  Offline:
    "The monitor isn't reporting, so its status is unknown. Not the same as clear.",
  "Not discharging":
    "No spill now, and none recent enough to still be on its way down to Worcester.",
};

// What each of the headline card's levels means (see lib/pollutionRisk.ts).
const RISK_DESCRIPTIONS: Record<PollutionRiskLevel, string> = {
  high: `Water from a spill is estimated to be passing Worcester, or a sample in the last ${WATER_QUALITY_RECENT_DAYS} days was over the Good limit.`,
  raised: `A spill is on its way down or passed in the last ${SEWAGE_RECENT_SPILL_BASE_HOURS} hours, moderate or heavy rain is falling or due within a few hours, or a sample came back over the Excellent limit in the last ${WATER_QUALITY_RECENT_DAYS} days or over the Good limit in the last ${WATER_QUALITY_RELEVANT_DAYS}.`,
  lower:
    "No monitored spills affecting Worcester and no recent high sample. Not a guarantee the water is clean.",
};

const RISK_ORDER: PollutionRiskLevel[] = ["high", "raised", "lower"];

const SectionHeading: React.FC<{
  children: React.ReactNode;
  first?: boolean;
}> = ({ children, first }) => (
  <Typography
    variant="subtitle2"
    color="text.secondary"
    gutterBottom
    sx={{ mt: first ? 0 : 2 }}
  >
    {children}
  </Typography>
);

// Leading visual, label and one-line explanation, with an optional chip on
// the end - the same row anatomy as Paddlecheck's Conditions Key.
const KeyRow: React.FC<{
  lead: React.ReactNode;
  label: string;
  description: string;
  chip?: { label: string; bg: string; fg: string };
}> = ({ lead, label, description, chip }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
    <Box
      sx={{
        width: 28,
        display: "flex",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {lead}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {/* Block, not the span a caption renders as by default: inline, it
          sits on the line boxes of the 16px body text it inherits from the
          Box around it, which spread a wrapped description out well past
          the caption's own line height. */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {description}
      </Typography>
    </Box>
    {chip && (
      // --chip-bg/--chip-fg rather than backgroundColor/color: see the
      // MuiChip override in lib/themes.ts for why the direct properties lose
      // to the theme in dark mode.
      <Chip
        label={chip.label}
        size="small"
        sx={{
          "--chip-bg": chip.bg,
          "--chip-fg": chip.fg,
          fontWeight: 500,
          flexShrink: 0,
        }}
      />
    )}
  </Box>
);

// A replica of the river map's stop marker (RiverSchematic's StationDot).
const MapDot: React.FC<{
  color: string;
  reach?: boolean;
  hollow?: boolean;
}> = ({ color, reach, hollow }) => (
  <Box
    sx={{
      width: 13,
      height: 13,
      borderRadius: "50%",
      boxSizing: "border-box",
      ...(hollow
        ? { border: "2px solid", borderColor: color }
        : { backgroundColor: color }),
      ...(reach && {
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: 2,
      }),
    }}
  />
);

const LineSwatch: React.FC<{ color: string; dashed?: boolean }> = ({
  color,
  dashed,
}) => (
  <svg width="28" height="4" aria-hidden>
    <line
      x1="0"
      y1="2"
      x2="28"
      y2="2"
      stroke={color}
      strokeWidth="2"
      strokeDasharray={dashed ? "5 5" : undefined}
    />
  </svg>
);

// What every colour and marker on the home screen means. The deep dive below
// it explains how CSOs and the classifications work; this is the legend.
const ConditionsKey: React.FC = () => {
  const lineColor = SERIES_COLORS[useResolvedColorScheme()][0];

  return (
    <>
      <SectionHeading first>Pollution Risk</SectionHeading>
      {RISK_ORDER.map((level) => (
        <KeyRow
          key={level}
          lead={<MapDot color={RISK_LEVEL_UI[level].color} />}
          label={RISK_LEVEL_UI[level].label}
          description={RISK_DESCRIPTIONS[level]}
        />
      ))}

      <SectionHeading>Spill Status</SectionHeading>
      {CSO_STATE_ORDER.map((state) => {
        const ui = CSO_STATE_UI[state];
        const Icon = STATE_ICONS[state];
        return (
          <KeyRow
            key={state}
            lead={
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: ui.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon sx={{ color: ui.onColor, fontSize: 16 }} />
              </Box>
            }
            label={ui.groupLabel}
            description={STATE_DESCRIPTIONS[state]}
            chip={{ label: ui.label, bg: ui.color, fg: ui.onColor }}
          />
        );
      })}

      <SectionHeading>River Map</SectionHeading>
      <KeyRow
        lead={<MapDot color={STATUS_COLORS.red} />}
        label="Coloured stop"
        description="The worst status among the monitors at that stop - one discharging outfall turns the whole stop red."
      />
      <KeyRow
        lead={<MapDot color="surfaces.outline" hollow />}
        label="Hollow stop"
        description={
          "No monitored outfalls near this point on the river. A solid grey stop is different: its monitors are offline."
        }
      />
      <KeyRow
        lead={<MapDot color={STATUS_COLORS.darkGreen} reach />}
        label="Ringed stop"
        description="Part of your reach - the stretch the app is centred on."
      />

      <SectionHeading>Rainfall Chart</SectionHeading>
      <KeyRow
        lead={
          <WaterDropIcon fontSize="small" sx={{ color: "text.secondary" }} />
        }
        label={`${HOURLY_MODERATE_MM}–${HOURLY_HEAVY_MM} mm/hr`}
        description="Moderate rain."
        chip={{
          label: "Moderate",
          bg: STATUS_COLORS.amber,
          fg: ON_STATUS_COLORS.amber,
        }}
      />
      <KeyRow
        lead={
          <ThunderstormIcon fontSize="small" sx={{ color: "text.secondary" }} />
        }
        label={`${HOURLY_HEAVY_MM} mm/hr and above`}
        description="Heavy rain, by the Met Office's radar definition - the kind that can overwhelm combined sewers."
        chip={{
          label: "Heavy",
          bg: STATUS_COLORS.red,
          fg: ON_STATUS_COLORS.red,
        }}
      />
      <KeyRow
        lead={<LineSwatch color={lineColor} />}
        label="Solid line"
        description="Measured rainfall, one colour per gauge. On the Forecast view, the average across the gauges."
      />
      <KeyRow
        lead={<LineSwatch color={lineColor} dashed />}
        label="Dashed line"
        description="Forecast rainfall for Worcester, from Open-Meteo."
      />
    </>
  );
};

export default ConditionsKey;
