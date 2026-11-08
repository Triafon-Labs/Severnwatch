"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  Grow,
  Skeleton,
  Stack,
  ToggleButton,
  Typography,
} from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CircleIcon from "@mui/icons-material/Circle";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  CLASSIFIED_INDICATORS,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  SampleBand,
  formatCount,
  indicatorStats,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatLondonDate } from "@/lib/time";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { collapseMotion, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";
import { SampleLimitsSection } from "@/components/WaterQualityInfoContent";

const INDICATOR_ORDER = CLASSIFIED_INDICATORS;

const BANDS: SampleBand[] = ["excellent", "good", "poor"];

const numberFormat = new Intl.NumberFormat("en-GB");

// The count range each tier covers for the indicator on the chart.
const bandRange = (
  band: SampleBand,
  limits: { excellent: number; good: number }
) =>
  band === "excellent"
    ? `Under ${numberFormat.format(limits.excellent)}`
    : band === "good"
      ? `${numberFormat.format(limits.excellent)} to ${numberFormat.format(limits.good - 1)}`
      : `${numberFormat.format(limits.good)} or more`;

const isIndicator = (v: string | null): v is IndicatorKey =>
  v !== null && (INDICATOR_ORDER as string[]).includes(v);

const ChartSkeleton: React.FC = () => (
  <Stack spacing={1} aria-hidden>
    <Skeleton variant="text" width={200} height={17} animation="wave" />
    <Skeleton variant="rounded" height={240} animation="wave" />
    <Skeleton variant="text" width={260} height={17} animation="wave" />
  </Stack>
);

// recharts is its own chunk (as with the rainfall chart), and this card sits
// at the bottom of the page, so nothing above waits on it.
const SampleHistoryChart = dynamic(
  () => import("@/components/SampleHistoryChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const SampleHistoryCard: React.FC = () => {
  const { waterQuality, waterQualityError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const showSkeleton = loading || (isRefreshing && !isOffline);
  const samples = waterQuality?.samples ?? [];

  // Seeded from localStorage on first render, like the rainfall range, so the
  // reader's choice is what paints first.
  const [indicatorKey, setIndicatorKey] = useState<IndicatorKey>(() => {
    if (typeof window === "undefined") return "eColi";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEYS.SAMPLE_INDICATOR);
      return isIndicator(saved) ? saved : "eColi";
    } catch {
      return "eColi";
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SAMPLE_INDICATOR, indicatorKey);
    } catch {
      // Storage disabled - the choice just doesn't survive a reload.
    }
  }, [indicatorKey]);

  const [limitsOpen, setLimitsOpen] = useState(false);

  const indicator = INDICATORS[indicatorKey];
  const stats = indicatorStats(samples, indicatorKey);
  const pastNotes = samples
    .slice(0, -1)
    .filter((s) => s.notes)
    .reverse();
  const firstMs = samples[0] ? sampleTimeMs(samples[0]) : null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Sample History
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2 }}
        >
          {samples.length > 0 && firstMs !== null
            ? `${samples.length} samples at ${waterQuality?.site.name} since ${formatLondonDate(
                firstMs,
                { withWeekday: false, withYear: true }
              )}`
            : "Every sample taken at this site"}
        </Typography>

        {showSkeleton && (
          <Stack spacing={2} aria-hidden>
            <Skeleton
              variant="rounded"
              height={41}
              animation="wave"
              sx={{ borderRadius: 9999 }}
            />
            <ChartSkeleton />
          </Stack>
        )}

        {!showSkeleton && waterQualityError && !waterQuality && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load the sample history right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && waterQuality && samples.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No samples have been added yet.
          </Typography>
        )}

        {!showSkeleton && samples.length > 0 && (
          <Grow in appear {...springTransition()}>
            <Stack spacing={2}>
              <SlidingToggleButtonGroup
                value={indicatorKey}
                exclusive
                fullWidth
                size="small"
                aria-label="Bacteria shown"
                onChange={(_, v: IndicatorKey | null) =>
                  v && setIndicatorKey(v)
                }
              >
                {INDICATOR_ORDER.map((key) => (
                  <ToggleButton key={key} value={key} sx={{ fontSize: 12 }}>
                    {INDICATORS[key].shortLabel}
                  </ToggleButton>
                ))}
              </SlidingToggleButtonGroup>

              <SampleHistoryChart
                samples={samples}
                indicatorKey={indicatorKey}
              />

              <Divider />

              {/* How many samples landed in each tier, for the indicator on
                  the chart, and the highest - named after the tiers so they
                  read the same as the chips and the chart's colours. */}
              <Box sx={tileGridSx}>
                {BANDS.map((band) => (
                  <StatTile
                    key={band}
                    icon={
                      <CircleIcon sx={{ color: SAMPLE_BAND_UI[band].color }} />
                    }
                    label={SAMPLE_BAND_UI[band].label}
                    value={`${stats.bands[band]} of ${stats.total}`}
                    detail={bandRange(band, indicator.limits)}
                  />
                ))}
                {stats.highest && (
                  <StatTile
                    icon={<ArrowUpwardIcon />}
                    label="Highest"
                    value={formatCount(stats.highest.count)}
                    detail={formatLondonDate(
                      Date.parse(stats.highest.sampledAt),
                      { withWeekday: false }
                    )}
                  />
                )}
              </Box>

              {/* Earlier samples' notes, which the chart's tooltip doesn't
                  carry - the newest one is on the Latest Sample card. Usually
                  empty, so the section only appears when there's one. */}
              {pastNotes.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Earlier Notes
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {pastNotes.map((s) => (
                      <InfoPanel key={s.id} align="flex-start">
                        <FormatQuoteIcon
                          color="primary"
                          sx={{ flexShrink: 0 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatLondonDate(sampleTimeMs(s), {
                              withWeekday: false,
                            })}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "pre-line" }}
                          >
                            {s.notes}
                          </Typography>
                        </Box>
                      </InfoPanel>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* How the limits on the chart are used here - one sample at a
                  time - against what they mean officially, a season-long
                  classification. Next to the chart that draws them. */}
              <Box sx={{ mt: -1 }}>
                <Button
                  onClick={() => setLimitsOpen((o) => !o)}
                  endIcon={limitsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  aria-expanded={limitsOpen}
                  size="small"
                >
                  {limitsOpen ? "Hide How Limits Work" : "Show How Limits Work"}
                </Button>
                <Collapse in={limitsOpen} unmountOnExit {...collapseMotion}>
                  <Box sx={{ mt: 1 }}>
                    <SampleLimitsSection />
                  </Box>
                </Collapse>
              </Box>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default SampleHistoryCard;
