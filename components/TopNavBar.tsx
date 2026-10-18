"use client";

import React, { useEffect, useState } from "react";
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
import { DATA_STALE_THRESHOLD_MS, OFFLINE_NO_CACHE_ERROR } from "@/lib/hooks";
import { getLondonHHMM, getRelativeTimeString } from "@/lib/time";
import { formatOutfallSubtitle } from "@/lib/format";
import { collapseMotion } from "@/lib/m3-palette";
import { CsoResponse, RainfallResponse } from "@/types";

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

const buildShareText = (
  cso: CsoResponse | null,
  rainfall: RainfallResponse | null
): string => {
  if (!cso && !rainfall) {
    return "Check current River Severn conditions at Worcester on Severnwatch.";
  }

  const lines: string[] = [];

  if (cso) {
    const ongoing = cso.outfalls.filter((o) => o.state === "Ongoing");
    const recent = cso.outfalls.filter((o) => o.state === "Recent");

    if (ongoing.length > 0) {
      lines.push(
        `🚨 *Sewage spill in progress:* ${ongoing.length} outfall${ongoing.length === 1 ? "" : "s"} discharging`
      );
      ongoing.forEach((o) => {
        const title = o.locationName ?? o.watercourse;
        const subtitle = o.locationName
          ? formatOutfallSubtitle(o.watercourse, o.waypointName)
          : o.waypointName;
        lines.push(`• ${title} - ${subtitle}`);
      });
    } else if (recent.length > 0) {
      lines.push(
        `⚠️ *Recent sewage spill:* ${recent.length} outfall${recent.length === 1 ? "" : "s"}`
      );
      recent.forEach((o) => {
        const title = o.locationName ?? o.watercourse;
        const subtitle = o.locationName
          ? formatOutfallSubtitle(o.watercourse, o.waypointName)
          : o.waypointName;
        lines.push(`• ${title} - ${subtitle}`);
      });
    } else {
      lines.push("✅ *No sewage spills reported* in the Worcester catchment");
    }
  }

  if (rainfall && rainfall.gauges.length > 0) {
    lines.push("");
    const worst24h = Math.max(...rainfall.gauges.map((g) => g.last24hTotalMm));
    lines.push(`🌧️ *Rainfall (worst gauge, last 24h):* ${worst24h} mm`);
  }

  return lines.join("\n");
};

const isDataStale = (lastUpdated: string | null): boolean => {
  if (!lastUpdated) return false;
  return Date.now() - new Date(lastUpdated).getTime() > DATA_STALE_THRESHOLD_MS;
};

const TopNavBar: React.FC = () => {
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const {
    cso,
    rainfall,
    lastUpdated,
    isOffline,
    isRefreshing,
    usingCachedData,
    error,
    refetch,
  } = useSevernContext();

  const isOfflineError = error === OFFLINE_NO_CACHE_ERROR;

  // Seeded from the current value on first render, then ticked on a timer so
  // "3 min ago" keeps counting up between fetches rather than freezing at
  // whatever it said when the data landed.
  const [relativeLastUpdated, setRelativeLastUpdated] = useState<string>(() =>
    getRelativeTimeString(lastUpdated)
  );
  const [isStale, setIsStale] = useState<boolean>(() =>
    isDataStale(lastUpdated)
  );

  useEffect(() => {
    // queueMicrotask breaks the synchronous set-state-in-an-effect the lint
    // rules flag, while still running before paint.
    queueMicrotask(() => {
      setRelativeLastUpdated(getRelativeTimeString(lastUpdated));
      setIsStale(isDataStale(lastUpdated));
    });

    const interval = setInterval(() => {
      setRelativeLastUpdated(getRelativeTimeString(lastUpdated));
      setIsStale(isDataStale(lastUpdated));
    }, 30000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // "Updated just now" alone reads as if this instant triggered a live fetch,
  // when it may just be a fast cache hit on data fetched slightly earlier -
  // pairing it with the clock time it was actually fetched keeps that honest.
  const lastUpdatedClockTime = lastUpdated
    ? getLondonHHMM(new Date(lastUpdated))
    : null;
  const freshnessText =
    lastUpdatedClockTime && relativeLastUpdated
      ? `${lastUpdatedClockTime} (${relativeLastUpdated})`
      : relativeLastUpdated;

  const handleShare = async () => {
    const text = buildShareText(cso, rainfall);
    // Give recipients a way back to the app - the summary alone has no link.
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Severnwatch", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
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
          (usingCachedData || isStale)
        }
        unmountOnExit
        {...collapseMotion}
      >
        <StatusBanner severity="warning">
          {usingCachedData
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
              alt="Severnwatch Logo"
              width={40}
              height={40}
              style={{ flexShrink: 0 }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
                color="text.primary"
              >
                Severnwatch
              </Typography>
              {(isRefreshing || freshnessText) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ lineHeight: 1.2, mt: -0.2 }}
                >
                  {isRefreshing ? "Updating…" : `Updated ${freshnessText}`}
                </Typography>
              )}
            </Box>
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
