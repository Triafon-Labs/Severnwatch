"use client";

import React from "react";
import { Box, Stack, Typography } from "@mui/material";
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

// How live each data source is, worked out once and shown in two places
// (as in Paddlecheck):
//
// - DataSourcesList, in Settings → Info: every source, with its times.
// - SourceAlerts, under the Pollution Risk title: only a source with a
//   problem nothing else on the page already reports. Nothing when all is
//   well, which is most of the time - a row of green dots on every visit
//   said nothing a reader needed. Being offline, a failed update and data
//   left to age are the banners' to say; a sample that has gone quiet is
//   the Latest Sample card's; spills that failed to load are the Pollution
//   Risk card's own error panel, right under where the alert would sit.
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
  // Worth flagging on the home page (see the note at the top).
  notable: boolean;
}

type Judged = Pick<SourceView, "liveness" | "state" | "notable">;
const live = (state = "Live"): Judged => ({
  liveness: "live",
  state,
  notable: false,
});
// Behind, but already said elsewhere on the page.
const quietlyBehind = (state: string): Judged => ({
  liveness: "behind",
  state,
  notable: false,
});
const behind = (state: string): Judged => ({
  liveness: "behind",
  state,
  notable: true,
});

// The parts every source shares: in flight, failed, from the saved copy, or
// offline. Null when none applies and the source's own check decides.
const commonState = (
  data: SevernData,
  key: SourceKey,
  hasData: boolean
): Judged | null => {
  const { pending, fromSavedCopy } = data.sources[key];
  if (pending && !(data.isOffline && hasData)) {
    return { liveness: "updating", state: "Updating…", notable: false };
  }
  if (!hasData) {
    // Spills failing shows as the Pollution Risk card's own error panel.
    return {
      liveness: "failed",
      state: "Couldn't load",
      notable: key !== "cso",
    };
  }
  if (data.isOffline) return quietlyBehind("Offline");
  if (fromSavedCopy) return quietlyBehind("Saved copy");
  return null;
};

const describeSources = (data: SevernData, now: Date): SourceView[] => {
  const nowMs = now.getTime();
  const { cso, rainfall, waterQuality } = data;

  const spills = ((): SourceView => {
    const base = { key: "cso" as const, label: "Spills" };
    const detail = "Severn Trent feed";
    const common = commonState(data, "cso", !!cso);
    if (common) return { ...base, ...common, detail };
    const old = nowMs - new Date(cso!.asOf).getTime() > DATA_STALE_THRESHOLD_MS;
    return {
      ...base,
      detail,
      ...(old ? quietlyBehind("Not refreshed") : live()),
    };
  })();

  const rain = ((): SourceView => {
    const base = { key: "rainfall" as const, label: "Rain" };
    const newest = rainfall ? newestGaugeReadingMs(rainfall.gauges) : null;
    const detail =
      newest !== null
        ? `Last reading ${getLondonHHMM(new Date(newest))}, ${formatDataAge(newest, now)}`
        : "EA rain gauges";
    const common = commonState(data, "rainfall", !!rainfall);
    if (common) return { ...base, ...common, detail };
    if (newest === null) return { ...base, detail, ...behind("No readings") };
    if (nowMs - newest > RAIN_BEHIND_MS) {
      return { ...base, detail, ...behind("Gauges behind") };
    }
    const old =
      nowMs - new Date(rainfall!.asOf).getTime() > DATA_STALE_THRESHOLD_MS;
    return {
      ...base,
      detail,
      ...(old ? quietlyBehind("Not refreshed") : live()),
    };
  })();

  const samples = ((): SourceView => {
    const base = { key: "waterQuality" as const, label: "Samples" };
    const latest = waterQuality?.samples[waterQuality.samples.length - 1];
    const latestMs = latest ? sampleTimeMs(latest) : null;
    const days = latestMs !== null ? londonDaysAgo(latestMs, now) : null;
    const detail =
      latestMs !== null && days !== null
        ? `Last sample ${formatLondonDate(latestMs)}, ${formatDaysAgo(days)}`
        : "Weekly citizen science samples";
    const common = commonState(data, "waterQuality", !!waterQuality);
    if (common) return { ...base, ...common, detail };
    // Both said on the Latest Sample card.
    if (days === null) return { ...base, detail, ...quietlyBehind("None yet") };
    return {
      ...base,
      detail,
      ...(days > WATER_QUALITY_STALE_DAYS
        ? quietlyBehind("Gone quiet")
        : live("Up to date")),
    };
  })();

  return [spills, rain, samples];
};

const Dot: React.FC<{ liveness: Liveness }> = ({ liveness }) => (
  <Box
    aria-hidden
    sx={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
      bgcolor: DOT_COLOR[liveness],
      // A slow pulse while that source is in flight. Reduced motion is
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

const useSourceViews = () => {
  const data = useSevernContext();
  const now = useNowTicking(30 * 1000);
  return { data, now, views: describeSources(data, now) };
};

// One source as a dot, its name and state, and the detail beneath.
const SourceRow: React.FC<{ view: SourceView }> = ({ view }) => (
  <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
    <Box sx={{ pt: "6px" }}>
      <Dot liveness={view.liveness} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {view.label} · {view.state}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {view.detail}
      </Typography>
    </Box>
  </Stack>
);

// Under the Pollution Risk title: only the sources worth flagging, and
// nothing at all otherwise.
export const SourceAlerts: React.FC = () => {
  const { views } = useSourceViews();
  const notable = views.filter((v) => v.notable);
  if (notable.length === 0) return null;
  return (
    <Stack spacing={1} role="status" sx={{ mt: -0.5, mb: 1.5 }}>
      {notable.map((v) => (
        <SourceRow key={v.key} view={v} />
      ))}
    </Stack>
  );
};

// Settings → Info: every source, and when the spills and rain were fetched
// (the older of the two, as the banners use).
export const DataSourcesList: React.FC = () => {
  const { data, now, views } = useSourceViews();
  const updatedMs = data.lastUpdated
    ? new Date(data.lastUpdated).getTime()
    : null;
  return (
    <Stack spacing={1.5}>
      {updatedMs !== null && (
        <Typography variant="body2" color="text.secondary">
          Updated {getLondonHHMM(new Date(updatedMs))},{" "}
          {formatDataAge(updatedMs, now)}
        </Typography>
      )}
      {views.map((v) => (
        <SourceRow key={v.key} view={v} />
      ))}
    </Stack>
  );
};
