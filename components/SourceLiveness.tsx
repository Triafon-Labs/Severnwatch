"use client";

import React, { useId, useState } from "react";
import { Box, ButtonBase, Popover, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSevernContext } from "@/lib/SevernDataContext";
import { DATA_STALE_THRESHOLD_MS, SourceKey, SevernData } from "@/lib/hooks";
import { STATUS_COLORS } from "@/lib/statusColors";
import { HOUR_MS, newestGaugeReadingMs } from "@/lib/rainfallAnalysis";
import { sampleTimeMs } from "@/lib/waterQuality";
import { WATER_QUALITY_STALE_DAYS } from "@/lib/config";
import {
  formatDataAge,
  formatDaysAgo,
  formatLondonDate,
  getLondonHHMM,
  londonDaysAgo,
} from "@/lib/time";
import { useNowTicking } from "@/lib/useNowTicking";

// One dot per data source, under the Pollution Risk title, in place of the
// single "Updated 10:33 · 2 min ago" line it replaced, with the fetch time
// beside them (as in Paddlecheck). That line was the
// oldest fetch across spills and rain, so it could say "just now" while the
// rain gauges were hours behind, and it said nothing about the samples. Each
// dot answers "is this one live?" on its own; a tap gives the times.
//
// The dots go by what the data is, not only when it was fetched: rain is
// judged on its newest gauge reading, since /api/rainfall stamps `asOf` when
// it built the response, which is fresh even when every gauge has gone
// quiet; samples on the newest sample, since they arrive weekly by upload.

type Liveness = "updating" | "live" | "behind" | "failed";

// Past this the newest gauge reading counts as behind. EA gauges upload on
// their own schedules, normally within the half hour; three hours is one
// that has stalled rather than one that is between batches.
const RAIN_BEHIND_MS = 3 * HOUR_MS;

const DOT_COLOR: Record<Liveness, string> = {
  updating: STATUS_COLORS.grey,
  live: STATUS_COLORS.darkGreen,
  behind: STATUS_COLORS.amber,
  failed: STATUS_COLORS.red,
};

interface SourceView {
  key: SourceKey;
  label: string;
  liveness: Liveness;
  state: string; // "Live", "Behind", ...
  detail: string; // the times behind it
}

// The parts every source shares: in flight, failed, from the saved copy, or
// offline. Null when none applies and the source's own check decides.
const commonState = (
  data: SevernData,
  key: SourceKey,
  hasData: boolean
): Pick<SourceView, "liveness" | "state"> | null => {
  const { pending, fromSavedCopy } = data.sources[key];
  if (pending && !(data.isOffline && hasData)) {
    return { liveness: "updating", state: "Updating…" };
  }
  if (!hasData) return { liveness: "failed", state: "Couldn't load" };
  if (data.isOffline) return { liveness: "behind", state: "Offline" };
  if (fromSavedCopy) return { liveness: "behind", state: "Saved copy" };
  return null;
};

const describeSources = (data: SevernData, now: Date): SourceView[] => {
  const nowMs = now.getTime();
  const { cso, rainfall, waterQuality } = data;

  const spills = ((): SourceView => {
    const base = { key: "cso" as const, label: "Spills" };
    const detail = "Severn Trent overflow feed";
    const common = commonState(data, "cso", !!cso);
    if (common) return { ...base, ...common, detail };
    const old = nowMs - new Date(cso!.asOf).getTime() > DATA_STALE_THRESHOLD_MS;
    return old
      ? { ...base, liveness: "behind", state: "Not refreshed", detail }
      : { ...base, liveness: "live", state: "Live", detail };
  })();

  const rain = ((): SourceView => {
    const base = { key: "rainfall" as const, label: "Rain" };
    const newest = rainfall ? newestGaugeReadingMs(rainfall.gauges) : null;
    const detail =
      newest !== null
        ? `Newest EA gauge reading ${getLondonHHMM(new Date(newest))} (${formatDataAge(newest, now)})`
        : "EA rain gauges";
    const common = commonState(data, "rainfall", !!rainfall);
    if (common) return { ...base, ...common, detail };
    if (newest === null) {
      return { ...base, liveness: "behind", state: "No readings", detail };
    }
    if (nowMs - newest > RAIN_BEHIND_MS) {
      return { ...base, liveness: "behind", state: "Gauges behind", detail };
    }
    const old =
      nowMs - new Date(rainfall!.asOf).getTime() > DATA_STALE_THRESHOLD_MS;
    return old
      ? { ...base, liveness: "behind", state: "Not refreshed", detail }
      : { ...base, liveness: "live", state: "Live", detail };
  })();

  const samples = ((): SourceView => {
    const base = { key: "waterQuality" as const, label: "Samples" };
    const latest = waterQuality?.samples[waterQuality.samples.length - 1];
    const latestMs = latest ? sampleTimeMs(latest) : null;
    const days = latestMs !== null ? londonDaysAgo(latestMs, now) : null;
    const detail =
      latestMs !== null && days !== null
        ? `Latest sample ${formatLondonDate(latestMs)} (${formatDaysAgo(days)}), uploaded weekly`
        : "Citizen science samples, uploaded weekly";
    const common = commonState(data, "waterQuality", !!waterQuality);
    if (common) return { ...base, ...common, detail };
    if (days === null) {
      return { ...base, liveness: "behind", state: "None yet", detail };
    }
    return days > WATER_QUALITY_STALE_DAYS
      ? { ...base, liveness: "behind", state: "Gone quiet", detail }
      : { ...base, liveness: "live", state: "Up to date", detail };
  })();

  return [spills, rain, samples];
};

// A step under body2, so the row matches Paddlecheck's, where four items
// and the time have to fit a 360px phone.
const rowTextSx = { fontSize: "0.8125rem" } as const;

const Dot: React.FC<{ liveness: Liveness }> = ({ liveness }) => (
  <Box
    aria-hidden
    sx={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
      bgcolor: DOT_COLOR[liveness],
      // A slow pulse while that source is in flight - the dot is the only
      // sign of it now the "Updating…" line has gone. Reduced motion is
      // handled globally (MuiCssBaseline).
      animation:
        liveness === "updating"
          ? "livenessPulse 1.2s ease-in-out infinite"
          : "none",
      "@keyframes livenessPulse": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.3 },
      },
    }}
  />
);

const SourceLiveness: React.FC = () => {
  const data = useSevernContext();
  const now = useNowTicking(30 * 1000);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const popoverId = useId();
  const views = describeSources(data, now);
  // When the spills and rain were fetched - the oldest of the two, as the
  // banners use - beside the dots, in place of the old "Updated" line.
  const updatedMs = data.lastUpdated
    ? new Date(data.lastUpdated).getTime()
    : null;
  const updatedClock =
    updatedMs !== null ? getLondonHHMM(new Date(updatedMs)) : null;
  const timeText = data.isRefreshing ? "Updating…" : updatedClock;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? popoverId : undefined}
        aria-label={`Data sources: ${views
          .map((v) => `${v.label} ${v.state}`)
          .join(
            ", "
          )}${updatedClock ? `. Updated ${updatedClock}` : ""}. Show details`}
        sx={{
          // Sits on the title's own left edge; the padding is the touch
          // target, pulled back out with the negative margin.
          mx: -1,
          px: 1,
          py: 0.5,
          borderRadius: 2,
          columnGap: 1.25,
          rowGap: 0.25,
          // At the narrowest phones the time and chevron drop to a second
          // line together rather than being cut off.
          flexWrap: "wrap",
          justifyContent: "flex-start",
          maxWidth: "calc(100% + 16px)",
          color: "text.secondary",
        }}
      >
        {views.map((v) => (
          <Stack
            key={v.key}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center" }}
          >
            <Dot liveness={v.liveness} />
            <Typography variant="body2" component="span" sx={rowTextSx}>
              {v.label}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" sx={{ alignItems: "center" }}>
          {timeText && (
            <Typography
              variant="body2"
              component="span"
              sx={{ ...rowTextSx, whiteSpace: "nowrap" }}
            >
              · {timeText}
            </Typography>
          )}
          <ExpandMoreIcon aria-hidden sx={{ fontSize: 18 }} />
        </Stack>
      </ButtonBase>
      <Popover
        id={popoverId}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { p: 2, maxWidth: 340, borderRadius: "16px" },
          },
        }}
      >
        <Stack spacing={1.5}>
          {updatedMs !== null && (
            <Typography variant="body2" color="text.secondary">
              Updated {updatedClock} ({formatDataAge(updatedMs, now)})
            </Typography>
          )}
          {views.map((v) => (
            <Stack
              key={v.key}
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "flex-start" }}
            >
              <Box sx={{ pt: "6px" }}>
                <Dot liveness={v.liveness} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {v.label} · {v.state}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {v.detail}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Popover>
    </>
  );
};

export default SourceLiveness;
