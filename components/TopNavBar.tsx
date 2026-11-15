"use client";

import React, { useState } from "react";
import {
  AppBar,
  Box,
  Collapse,
  IconButton,
  Snackbar,
  Toolbar,
  Typography,
  useScrollTrigger,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import ShareIcon from "@mui/icons-material/Share";
import Image from "next/image";
import SettingsModal from "@/components/SettingsModal";
import { useSevernContext } from "@/lib/SevernDataContext";
import { OFFLINE_NO_CACHE_ERROR } from "@/lib/hooks";
import { useFreshness } from "@/lib/useFreshness";
import { collapseMotion } from "@/lib/m3-palette";
import { APP_NAME } from "@/lib/config";
import { CsoResponse, RainfallResponse, WaterQualityResponse } from "@/types";
import {
  RISK_LEVEL_UI,
  derivePollutionRisk,
  formatLowAgainIn,
} from "@/lib/pollutionRisk";
import {
  SAMPLE_BAND_UI,
  bandForSample,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatDaysAgo, formatLondonDate, londonDaysAgo } from "@/lib/time";

// Filled with the saturated accent rather than the tonal container pair.
// The container roles would be the more orthodox M3 reading of a persistent
// inline strip, but they leave the banner too quiet to notice - and the whole
// point of this strip is that the numbers below it may be stale.
const StatusBanner: React.FC<{
  severity: "warning" | "error";
  children: React.ReactNode;
}> = ({ severity, children }) => (
  <Box
    sx={{
      bgcolor: `${severity}.main`,
      color: `${severity}.contrastText`,
      py: 0.5,
      px: 2,
      textAlign: "center",
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.02em",
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    {children}
  </Box>
);

// The same message as the Pollution Risk card - its level, why, and the
// latest sample - so a shared link doesn't read louder (or more reassuring)
// than the app it points to. No emoji: a siren on a Raised estimate was the
// most alarming thing the app put out.
const buildShareText = (
  cso: CsoResponse | null,
  rainfall: RainfallResponse | null,
  waterQuality: WaterQualityResponse | null
): string => {
  const lines: string[] = [];
  const now = Date.now();

  if (cso) {
    const risk = derivePollutionRisk(cso, rainfall, waterQuality, now);
    lines.push(`River Severn at Worcester: ${RISK_LEVEL_UI[risk.level].label}`);
    risk.factors.forEach((f) =>
      lines.push(`• ${f.label}: ${f.value}${f.detail ? ` (${f.detail})` : ""}`)
    );
    if (risk.lowAgainAt !== null) {
      lines.push(
        `Likely back to Low in ${formatLowAgainIn(risk.lowAgainAt, now)} if it stays dry.`
      );
    }
  }

  const latest = waterQuality?.samples[waterQuality.samples.length - 1];
  const band = latest ? bandForSample(latest) : null;
  if (latest && band) {
    const ms = sampleTimeMs(latest);
    lines.push(
      `Latest sample: ${SAMPLE_BAND_UI[band].label} (${formatLondonDate(ms)}, ${formatDaysAgo(londonDaysAgo(ms, now))})`
    );
  }

  if (lines.length === 0) {
    return `Check current River Severn conditions at Worcester on ${APP_NAME}.`;
  }
  lines.push("", `An estimate, not a water test. More on ${APP_NAME}.`);
  return lines.join("\n");
};

const TopNavBar: React.FC = () => {
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const {
    cso,
    rainfall,
    waterQuality,
    lastUpdated,
    isOffline,
    isRefreshing,
    lastFetchFailed,
    error,
    refetch,
  } = useSevernContext();

  const isOfflineError = error === OFFLINE_NO_CACHE_ERROR;

  const { freshnessText, isStale } = useFreshness(lastUpdated);

  const handleShare = async () => {
    const text = buildShareText(cso, rainfall, waterQuality);
    // Give recipients a way back to the app - the summary alone has no link.
    const url = window.location.origin;
    // The link goes in the text rather than share()'s url field: apps like
    // WhatsApp join the two with a bare space, gluing it to the last line.
    const message = `${text}\n\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: APP_NAME, text: message });
      } else {
        await navigator.clipboard.writeText(message);
        setSnackbarOpen(true);
      }
    } catch (err) {
      // Dismissing the native share sheet rejects with AbortError - that's
      // a normal cancel, not a failure worth surfacing.
      if ((err as DOMException)?.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  };

  return (
    <>
      <Collapse in={isOffline} unmountOnExit {...collapseMotion}>
        <StatusBanner severity="warning">
          Offline
          {freshnessText
            ? ` – showing data from ${freshnessText}`
            : " – showing cached data"}
        </StatusBanner>
      </Collapse>
      {/* Only once an attempt has actually finished - not while one may
          still be in flight. Two different situations, worded differently:
          a fetch that fell back to the cache is a failure, but data that is
          merely old isn't - there is no background poll, so a page left open
          and visible simply hasn't been asked to refresh, and calling that
          "Live update failed" would claim a failure that never happened. */}
      <Collapse
        in={
          !isOffline &&
          !isOfflineError &&
          !isRefreshing &&
          (lastFetchFailed || isStale)
        }
        unmountOnExit
        {...collapseMotion}
      >
        <StatusBanner severity="warning">
          {lastFetchFailed
            ? `Live update failed${freshnessText ? ` – showing data from ${freshnessText}` : ""}`
            : `Showing data from ${freshnessText} – refresh for the latest`}
        </StatusBanner>
      </Collapse>
      <Collapse in={isOfflineError} unmountOnExit {...collapseMotion}>
        <StatusBanner severity="error">{OFFLINE_NO_CACHE_ERROR}</StatusBanner>
      </Collapse>
      {/* M3's small top app bar carries no separator at rest and lifts a tonal
          step once content scrolls under it - the change *is* the signal that
          there's more above. This one wore a permanent border plus a backdrop
          blur instead, which says the same thing whether or not anything is
          behind it. useScrollTrigger fires past 8px, before the first card
          reaches the bar.

          The two states are painted by the MuiAppBar override, which this only
          selects between - an sx colour here would be outranked in the dark
          scheme. See the note there. */}
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        data-scrolled={scrolled}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          {/* minWidth: 0 lets this half shrink past its content on a narrow
              phone. Without it the title sets a floor on the flex item's
              width and the action buttons get pushed off the right edge
              instead - which globals.css's overflow-x then quietly clips. */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              minWidth: 0,
            }}
          >
            {/* A real vector (~38KB), so it's sharp at any pixel density.
                next/image serves .svg sources unoptimised automatically, which
                is what we want here - there's nothing to resize. */}
            <Image
              src="/favicon.svg"
              alt={`${APP_NAME} logo`}
              width={40}
              height={40}
              style={{ flexShrink: 0 }}
            />
            {/* The name alone. The "Updated" line moved into the Water
                Quality Status card, as Paddlecheck moved its own into the
                status card: it says when the headline was worked out, so it
                belongs beside it, and the banners above take over once the
                data is stale or an update has failed. */}
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 600, lineHeight: 1.2, minWidth: 0 }}
              color="text.primary"
            >
              {APP_NAME}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexShrink: 0 }}>
            <IconButton onClick={handleShare} aria-label="share">
              <ShareIcon />
            </IconButton>
            <IconButton
              onClick={() => setSettingsOpen(true)}
              aria-label="settings"
            >
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={refetch} aria-label="refresh">
              <RefreshIcon
                sx={{
                  animation: isRefreshing ? "spin 1s linear infinite" : "none",
                  "@keyframes spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        message="Copied to clipboard"
        // Portalled to <body>, so it misses the safe-area frame in
        // app/layout.tsx. MUI rests it 8px off the bottom of the screen (24px
        // from sm up), which on an installed iOS app is inside the home
        // indicator - so re-declare both offsets with the inset added.
        sx={{
          bottom: {
            xs: "calc(8px + env(safe-area-inset-bottom))",
            sm: "calc(24px + env(safe-area-inset-bottom))",
          },
        }}
      />
    </>
  );
};

export default TopNavBar;
