"use client";

import { Box, Chip, Typography } from "@mui/material";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall } from "@/types";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import InfoPanel from "@/components/InfoPanel";

// One monitored outfall, as a labelled row. Shared by the CSO card's
// "discharging now / recent" groups and by the river schematic, where the
// same row appears when a stop is expanded - so an outfall reads identically
// wherever you meet it.

// Only Ongoing/Recent outfalls are reverse-geocoded (see the sewage route), so
// the rest fall back to watercourse + distance to stay distinguishable.
const describeLocation = (o: CsoOutfall): string =>
  o.locationName
    ? `${o.locationName} (${o.watercourse})`
    : `${o.watercourse} — ${o.distanceKm.toFixed(1)} km`;

const describeTiming = (o: CsoOutfall): string | null => {
  const since = (iso: string | null, prefix: string) =>
    iso
      ? `${prefix} ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
      : null;

  switch (o.state) {
    case "Ongoing":
      return since(o.startISO, "Started");
    case "Recent":
      return since(o.endISO, "Ended");
    case "Not discharging":
      return since(o.startISO, "Clear since");
    case "Offline":
      return null;
  }
};

const CsoOutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const timing = describeTiming(o);
  return (
    <InfoPanel sx={{ justifyContent: "space-between" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {describeLocation(o)}
        </Typography>
        {timing && (
          <Typography variant="caption" color="text.secondary">
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
