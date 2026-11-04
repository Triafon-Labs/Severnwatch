"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WbCloudyOutlinedIcon from "@mui/icons-material/WbCloudyOutlined";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import PoolIcon from "@mui/icons-material/Pool";
import { WaterQualitySample } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  COUNT_UNIT,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  bandForCount,
  bandForSample,
  formatCount,
  notableFindings,
  previousCount,
  sampleTimeMs,
} from "@/lib/waterQuality";
import {
  formatDaysAgo,
  formatLondonDate,
  londonDaysAgo,
} from "@/lib/londonDate";
import { useNowTicking } from "@/lib/time";
import { WATER_QUALITY_STALE_DAYS } from "@/lib/config";
import { m3Spring, spring, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SampleBandChip from "@/components/SampleBandChip";

const numberFormat = new Intl.NumberFormat("en-GB");

const COUNT_TILES: IndicatorKey[] = ["eColi", "enterococci", "coliforms"];

// One indicator's count, with where it sits against the limits and what the
// sample before it read - the change is usually the story, not the number.
const CountTile: React.FC<{
  samples: WaterQualitySample[];
  indicatorKey: IndicatorKey;
}> = ({ samples, indicatorKey }) => {
  const indicator = INDICATORS[indicatorKey];
  const latest = samples[samples.length - 1];
  const count = latest[indicatorKey];
  const band = bandForCount(count, indicator);
  const previous = previousCount(samples, indicatorKey);

  const limitLine = indicator.limits
    ? band === "high"
      ? `Over the Good limit (${numberFormat.format(indicator.limits.good)})`
      : band === "elevated"
        ? `Over the Excellent limit (${numberFormat.format(indicator.limits.excellent)})`
        : `Under the Excellent limit (${numberFormat.format(indicator.limits.excellent)})`
    : "Not used for classification";

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
        <>
          {count ? limitLine : "Not tested"}
          {previous && (
            <Box component="span" sx={{ display: "block" }}>
              Previously {formatCount(previous.count)} on{" "}
              {formatLondonDate(Date.parse(previous.sampledAt), {
                withWeekday: false,
              })}
            </Box>
          )}
        </>
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
      label: "Air",
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
      label: "In the water",
      value: parts.join(" · "),
    });
  }
  return tiles;
};

// Mirrors the hero and the count tiles at their rendered heights.
const LatestSampleSkeleton: React.FC = () => (
  <Stack spacing={2} aria-hidden>
    <Skeleton variant="rounded" height={88} sx={{ borderRadius: "28px" }} />
    <Box sx={tileGridSx}>
      {COUNT_TILES.map((key) => (
        <Skeleton key={key} variant="rounded" height={118} animation="wave" />
      ))}
    </Box>
  </Stack>
);

const LatestSampleCard: React.FC = () => {
  const { waterQuality, waterQualityError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const showSkeleton = loading || (isRefreshing && !isOffline);
  const now = useNowTicking();

  const samples = useMemo(() => waterQuality?.samples ?? [], [waterQuality]);
  const latest = samples[samples.length - 1];
  const findings = useMemo(() => notableFindings(samples), [samples]);

  const band = latest ? bandForSample(latest) : null;
  const ui = band ? SAMPLE_BAND_UI[band] : null;
  const days = latest ? londonDaysAgo(sampleTimeMs(latest), now) : 0;
  const conditions = latest ? conditionTiles(latest) : [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Latest Sample
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2 }}
        >
          {waterQuality?.site.name ?? "Grandstand Road"},{" "}
          {waterQuality?.site.river ?? "River Severn"} · citizen science testing
          for Surfers Against Sewage
        </Typography>

        {showSkeleton && <LatestSampleSkeleton />}

        {!showSkeleton && waterQualityError && !waterQuality && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load the water quality samples right now. It&apos;ll
              retry on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && waterQuality && !latest && (
          <Typography variant="body2" color="text.secondary">
            No samples have been added yet.
          </Typography>
        )}

        {!showSkeleton && latest && (
          <Grow in appear {...springTransition()}>
            <Stack spacing={2}>
              <InfoPanel
                sx={{
                  gap: 2,
                  p: 2,
                  borderRadius: "28px",
                  backgroundColor: ui?.color ?? "surfaces.containerHigh",
                  color: ui?.onColor ?? "text.primary",
                  transition: spring(
                    "background-color",
                    m3Spring.effectsDefault
                  ),
                }}
              >
                <ScienceOutlinedIcon sx={{ fontSize: 40, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    component="p"
                    sx={{ fontWeight: 500, lineHeight: 1.2 }}
                  >
                    {ui?.headline ?? "Sample recorded"}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatLondonDate(sampleTimeMs(latest), { withTime: true })}{" "}
                    · {formatDaysAgo(days)}
                  </Typography>
                </Box>
              </InfoPanel>

              {days > WATER_QUALITY_STALE_DAYS && (
                <InfoPanel align="flex-start">
                  <EventBusyIcon color="warning" sx={{ flexShrink: 0 }} />
                  <Typography variant="body2" color="text.secondary">
                    No new sample for {days} days. Testing is usually weekly, so
                    this may not reflect the river now.
                  </Typography>
                </InfoPanel>
              )}

              <Box sx={tileGridSx}>
                {COUNT_TILES.map((key) => (
                  <CountTile key={key} samples={samples} indicatorKey={key} />
                ))}
              </Box>

              {findings.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notable
                  </Typography>
                  <Box
                    component="ul"
                    sx={{ m: 0, mt: 0.5, pl: 2.5, "& li + li": { mt: 0.5 } }}
                  >
                    {findings.map((f) => (
                      <Typography key={f} component="li" variant="body2">
                        {f}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {latest.notes && (
                <InfoPanel align="flex-start">
                  <FormatQuoteIcon color="primary" sx={{ flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Tester&apos;s note
                    </Typography>
                    {/* Free text from the export - rendered as text, never
                        as markup. */}
                    <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                      {latest.notes}
                    </Typography>
                  </Box>
                </InfoPanel>
              )}

              {conditions.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    On the day
                  </Typography>
                  <Box sx={{ ...tileGridSx, mt: 1 }}>
                    {conditions.map(({ key, ...tile }) => (
                      <StatTile key={key} {...tile} />
                    ))}
                  </Box>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary">
                Counts are colony-forming units {COUNT_UNIT}, compared with the
                inland bathing water limits. One sample is a snapshot, not a
                bathing water classification - and results arrive a day or more
                after the water is collected.
              </Typography>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default LatestSampleCard;
