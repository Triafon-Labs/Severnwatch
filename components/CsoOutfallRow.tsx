"use client";

import { Box, Chip, Typography } from "@mui/material";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall } from "@/types";
import { formatDuration } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import InfoPanel from "@/components/InfoPanel";

// One monitored outfall, as a labelled row. Shared by the CSO card's
// "discharging now / recent" groups and by the river schematic, where the
// same row appears when a stop is expanded - so an outfall reads identically
// wherever you meet it.

const describeTiming = (o: CsoOutfall): string | null => {
  const since = (iso: string | null, prefix: string) =>
    iso
      ? `${prefix} ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
      : null;

  let baseText: string | null = null;
  switch (o.state) {
    case "Ongoing":
      baseText = since(o.startISO, "Started");
      break;
    case "Recent":
      baseText = since(o.endISO, "Ended");
      break;
    case "Not discharging":
      baseText = since(o.startISO, "Clear since");
      break;
    case "Offline":
      baseText = null;
      break;
  }

  if (!baseText) return null;

  if (o.durationMinutes !== null) {
    const verb = o.state === "Ongoing" ? "running" : "lasted";
    return `${baseText} · ${verb} ${formatDuration(o.durationMinutes)}`;
  }

  return baseText;
};

const CsoOutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const timing = describeTiming(o);
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
        {timing && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {timing}
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
