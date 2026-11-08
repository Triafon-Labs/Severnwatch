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
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  COUNT_UNIT,
  SAMPLE_BAND_UI,
  bandForSample,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatDaysAgo, formatLondonDate, londonDaysAgo } from "@/lib/time";
import { useNowTicking } from "@/lib/useNowTicking";
import { WATER_QUALITY_STALE_DAYS } from "@/lib/config";
import { m3Spring, spring, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";
import { tileGridSx } from "@/components/StatTile";
import SampleDetails from "@/components/SampleDetails";

// Mirrors the hero and the count tiles at their rendered heights.
const LatestSampleSkeleton: React.FC = () => (
  <Stack spacing={2} aria-hidden>
    <Skeleton variant="rounded" height={88} sx={{ borderRadius: "28px" }} />
    <Box sx={tileGridSx}>
      {[0, 1].map((i) => (
        <Skeleton key={i} variant="rounded" height={96} animation="wave" />
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

  const band = latest ? bandForSample(latest) : null;
  const ui = band ? SAMPLE_BAND_UI[band] : null;
  const days = latest ? londonDaysAgo(sampleTimeMs(latest), now) : 0;

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
          {waterQuality?.site.name ?? "Grandstand Road"} · counts {COUNT_UNIT}
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
                    {ui?.headline ?? "Sample Recorded"}
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
                    No new sample for {days} days, so this may be out of date.
                  </Typography>
                </InfoPanel>
              )}

              <SampleDetails samples={samples} index={samples.length - 1} />
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default LatestSampleCard;
