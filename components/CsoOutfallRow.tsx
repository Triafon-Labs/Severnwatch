"use client";

import { Box, Chip, Typography } from "@mui/material";
import { format, formatDistanceToNow } from "date-fns";
import { CsoOutfall } from "@/types";
import { formatDuration } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import InfoPanel from "@/components/InfoPanel";

// One monitored outfall, as a labelled row. Shared by the CSO card's
// "discharging now / recent" groups and by the river schematic, where the
// same row appears when a stop is expanded - so an outfall reads identically
// wherever you meet it.

const getTimingDetails = (
  o: CsoOutfall
): { primaryTiming: string | null; durationText: string | null } => {
  const relativeSince = (iso: string | null, prefix: string) =>
    iso
      ? `${prefix} ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
      : null;

  const dateSince = (iso: string | null, prefix: string) =>
    iso ? `${prefix} ${format(new Date(iso), "d MMM yyyy")}` : null;

  let primaryTiming: string | null = null;
  switch (o.state) {
    case "Ongoing":
      primaryTiming = relativeSince(o.startISO, "Started");
      break;
    case "Recent":
      primaryTiming = relativeSince(o.endISO, "Ended");
      break;
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

const CsoOutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const { primaryTiming, durationText } = getTimingDetails(o);
  const title = o.locationName ?? o.watercourse;
  const subtitle = o.locationName
    ? `${o.watercourse} (${o.waypointName})`
    : o.waypointName;

  return (
    <InfoPanel
      sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
    >
      <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {subtitle}
        </Typography>
        {primaryTiming && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {primaryTiming}
          </Typography>
        )}
        {durationText && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {durationText}
          </Typography>
        )}
      </Box>
      <Chip
        label={CSO_STATE_UI[o.state].label}
        size="small"
        sx={{ ...statusChipSx(o.state), flexShrink: 0 }}
      />
    </InfoPanel>
  );
};

export default CsoOutfallRow;
