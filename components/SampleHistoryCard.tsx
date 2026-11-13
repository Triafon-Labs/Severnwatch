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
  IconButton,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  CLASSIFIED_INDICATORS,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  SampleBand,
  bandForSample,
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
import SampleBandChip from "@/components/SampleBandChip";
import SampleDetails from "@/components/SampleDetails";
import { WaterQualitySample } from "@/types";
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

interface StepProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

// A horizontal drag this far across the header or details steps one sample;
// anything shorter, or more vertical than horizontal, is a tap or a scroll.
// Paddlecheck's forecast swipe.
const SWIPE_THRESHOLD_PX = 40;

const swipe = ({ onPrev, onNext, canPrev, canNext }: StepProps) => {
  let start: { x: number; y: number } | null = null;
  return {
    onPointerDown: (e: React.PointerEvent) => {
      // A drag that starts on an arrow isn't a swipe: the arrow's own click
      // would step a second time.
      start = (e.target as HTMLElement).closest("button")
        ? null
        : { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      // Swiping left brings the later sample in, as with any carousel.
      if (dx < 0 && canNext) onNext();
      if (dx > 0 && canPrev) onPrev();
    },
  };
};

// "‹ Wed 28 Oct, 11:45 [Poor] ›" under the chart - Paddlecheck's forecast
// hour header. The picked sample's details follow beneath it, in place of a
// tooltip.
const SampleHeader: React.FC<StepProps & { sample: WaterQualitySample }> = ({
  sample,
  onPrev,
  onNext,
  canPrev,
  canNext,
}) => {
  const band = bandForSample(sample);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <IconButton
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous sample"
        edge="start"
      >
        <ChevronLeftIcon />
      </IconButton>
      <Box
        aria-live="polite"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {formatLondonDate(sampleTimeMs(sample), { withTime: true })}
        </Typography>
        {band && <SampleBandChip band={band} />}
      </Box>
      <IconButton
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next sample"
        edge="end"
      >
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
};

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

  // The picked sample, by Survey ID so it stays put when the data refreshes.
  // Null, or an id no longer in the data, means the newest.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const foundIndex = samples.findIndex((s) => s.id === selectedId);
  const selectedIndex = foundIndex !== -1 ? foundIndex : samples.length - 1;
  const selected = samples[selectedIndex];
  const step = (direction: 1 | -1) => {
    const next = samples[selectedIndex + direction];
    if (next) setSelectedId(next.id);
  };
  const stepProps = {
    onPrev: () => step(-1),
    onNext: () => step(1),
    canPrev: selectedIndex > 0,
    canNext: selectedIndex < samples.length - 1,
  };
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
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                onStep={step}
              />

              {selected && (
                <Box {...swipe(stepProps)} sx={{ touchAction: "pan-y" }}>
                  <SampleHeader sample={selected} {...stepProps} />
                  <Box sx={{ mt: 1.5 }}>
                    <SampleDetails samples={samples} index={selectedIndex} />
                  </Box>
                </Box>
              )}

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
