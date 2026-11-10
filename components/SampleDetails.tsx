"use client";

import { Box, Stack, Typography } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WbCloudyOutlinedIcon from "@mui/icons-material/WbCloudyOutlined";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import PoolIcon from "@mui/icons-material/Pool";
import { WaterQualitySample } from "@/types";
import {
  CLASSIFIED_INDICATORS,
  INDICATORS,
  IndicatorKey,
  bandForCount,
  formatCount,
  previousCount,
} from "@/lib/waterQuality";
import { formatLondonDate } from "@/lib/time";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SampleBandChip from "@/components/SampleBandChip";

// Everything about one sample: its two counts with their tiers and the
// sample before, the tester's note, and the day's conditions. Shared by the
// Latest Sample card (the newest) and Sample History (whichever sample is
// picked on its chart), so a sample reads the same wherever it's shown.

const COUNT_TILES = CLASSIFIED_INDICATORS;

// One indicator's count and tier, and what the sample before it read - the
// change is usually the story, not the number.
const CountTile: React.FC<{
  samples: WaterQualitySample[];
  index: number;
  indicatorKey: IndicatorKey;
}> = ({ samples, index, indicatorKey }) => {
  const indicator = INDICATORS[indicatorKey];
  const count = samples[index][indicatorKey];
  const band = bandForCount(count, indicator);
  const previous = previousCount(samples, index, indicatorKey);

  return (
    <StatTile
      icon={<BiotechOutlinedIcon />}
      label={indicator.shortLabel}
      value={
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          {formatCount(count)}
          {band && <SampleBandChip band={band} />}
        </Box>
      }
      detail={
        !count
          ? "Not tested"
          : previous
            ? `Was ${formatCount(previous.count)} on ${formatLondonDate(
                Date.parse(previous.sampledAt),
                { withWeekday: false }
              )}`
            : undefined
      }
    />
  );
};

// What the tester recorded about the day, when they recorded it. Most
// samples leave these blank, so each tile only appears with a value and the
// section only with at least one tile.
const conditionTiles = (sample: WaterQualitySample) => {
  const tiles: {
    key: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    detail?: string;
  }[] = [];
  if (sample.weather || sample.weatherDayBefore) {
    tiles.push({
      key: "weather",
      icon: <WbCloudyOutlinedIcon />,
      label: "Weather",
      value: sample.weather ?? "—",
      detail: sample.weatherDayBefore
        ? `Day before: ${sample.weatherDayBefore.toLowerCase()}`
        : undefined,
    });
  }
  if (sample.rainfallMm !== null || sample.rainfallDayBeforeMm !== null) {
    tiles.push({
      key: "rain",
      icon: <WaterDropIcon />,
      label: "Rainfall",
      value: sample.rainfallMm !== null ? `${sample.rainfallMm} mm` : "—",
      detail:
        sample.rainfallDayBeforeMm !== null
          ? `Day before: ${sample.rainfallDayBeforeMm} mm`
          : undefined,
    });
  }
  if (sample.airTemperatureC !== null) {
    tiles.push({
      key: "air",
      icon: <ThermostatIcon />,
      label: "Air Temperature",
      value: `${sample.airTemperatureC}°C`,
    });
  }
  if (sample.swimmers !== null || sample.otherWaterUsers !== null) {
    const parts = [
      sample.swimmers !== null &&
        `${sample.swimmers} swimmer${sample.swimmers === 1 ? "" : "s"}`,
      sample.otherWaterUsers !== null && `${sample.otherWaterUsers} other`,
    ].filter(Boolean);
    tiles.push({
      key: "users",
      icon: <PoolIcon />,
      label: "In the Water",
      value: parts.join(" · "),
    });
  }
  return tiles;
};

const SampleDetails: React.FC<{
  samples: WaterQualitySample[];
  index: number;
}> = ({ samples, index }) => {
  const sample = samples[index];
  const conditions = conditionTiles(sample);
  return (
    <Stack spacing={2}>
      <Box sx={tileGridSx}>
        {COUNT_TILES.map((key) => (
          <CountTile
            key={key}
            samples={samples}
            index={index}
            indicatorKey={key}
          />
        ))}
      </Box>

      {sample.notes && (
        <InfoPanel align="flex-start">
          <FormatQuoteIcon color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Tester&apos;s Note
            </Typography>
            {/* Free text from the export - rendered as text, never as
                markup. */}
            <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
              {sample.notes}
            </Typography>
          </Box>
        </InfoPanel>
      )}

      {conditions.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            On the Day
          </Typography>
          <Box sx={{ ...tileGridSx, mt: 1 }}>
            {conditions.map(({ key, ...tile }) => (
              <StatTile key={key} {...tile} />
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
};

export default SampleDetails;
