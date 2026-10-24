"use client";

import { Chip, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import HistoryIcon from "@mui/icons-material/History";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { format } from "date-fns";
import { CsoOutfall } from "@/types";
import { formatDuration, formatOutfallSubtitle } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import { getRelativeTimeString } from "@/lib/time";
import InfoPanel from "@/components/InfoPanel";

// One monitored outfall, as a labelled row. Shared by the CSO card's
// "discharging now / recent" groups and by the river schematic, where the
// same row appears when a stop is expanded - so an outfall reads identically
// wherever you meet it.

const getTimingDetails = (
  o: CsoOutfall
): { primaryTiming: string | null; durationText: string | null } => {
  const dateSince = (iso: string | null, prefix: string) =>
    iso ? `${prefix} ${format(new Date(iso), "dd/MM/yyyy")}` : null;

  let primaryTiming: string | null = null;
  switch (o.state) {
    case "Ongoing": {
      if (o.startISO) {
        const relative = getRelativeTimeString(o.startISO);
        const dateTimeStr = format(new Date(o.startISO), "dd/MM/yyyy HH:mm");
        primaryTiming = `Started ${relative} (${dateTimeStr})`;
      } else {
        primaryTiming = null;
      }
      break;
    }
    case "Recent": {
      if (o.endISO) {
        const relative = getRelativeTimeString(o.endISO);
        const dateTimeStr = format(new Date(o.endISO), "dd/MM/yyyy HH:mm");
        primaryTiming = `Ended ${relative} (${dateTimeStr})`;
      } else {
        primaryTiming = null;
      }
      break;
    }
    case "Not discharging":
      primaryTiming = dateSince(o.startISO, "Clear since");
      break;
    case "Offline":
      primaryTiming = null;
      break;
  }

  let durationText: string | null = null;
  if (o.durationMinutes !== null) {
    const verb = o.state === "Ongoing" ? "Running" : "Lasted";
    durationText = `${verb} ${formatDuration(o.durationMinutes)}`;
  }

  return { primaryTiming, durationText };
};

const MetaLine: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    <span
      style={{
        display: "inline-flex",
        flexShrink: 0,
        color: "inherit",
      }}
    >
      {icon}
    </span>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ lineHeight: 1.35 }}
    >
      {children}
    </Typography>
  </Stack>
);

const CsoOutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const { primaryTiming, durationText } = getTimingDetails(o);
  const title = o.locationName ?? o.watercourse;
  const subtitle = o.locationName
    ? formatOutfallSubtitle(o.watercourse, o.waypointName)
    : o.waypointName;

  return (
    <InfoPanel
      sx={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 1.5,
      }}
    >
      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
        >
          {title}
        </Typography>
        <MetaLine icon={<LocationOnOutlinedIcon sx={{ fontSize: 16 }} />}>
          {subtitle}
        </MetaLine>
        {primaryTiming && (
          <MetaLine icon={<HistoryIcon sx={{ fontSize: 16 }} />}>
            {primaryTiming}
          </MetaLine>
        )}
        {durationText && (
          <MetaLine icon={<TimerOutlinedIcon sx={{ fontSize: 16 }} />}>
            {durationText}
          </MetaLine>
        )}
      </Stack>
      <Chip
        label={CSO_STATE_UI[o.state].label}
        size="small"
        sx={{ ...statusChipSx(o.state), flexShrink: 0, mt: 0.125 }}
      />
    </InfoPanel>
  );
};

export default CsoOutfallRow;
