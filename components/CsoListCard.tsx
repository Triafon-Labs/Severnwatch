"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  ChipProps,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall, CsoState } from "@/types";
import { useCsoData } from "@/hooks/useCsoData";
import { formatAsOf } from "@/lib/format";

const STATE_ORDER: CsoState[] = ["Ongoing", "Recent", "Not discharging", "Offline"];

const STATE_LABEL: Record<CsoState, string> = {
  Ongoing: "Discharging now",
  Recent: "Recent spill (last 24h)",
  "Not discharging": "Not discharging",
  Offline: "Monitor offline",
};

const STATE_COLOR: Record<CsoState, ChipProps["color"]> = {
  Ongoing: "error",
  Recent: "warning",
  "Not discharging": "success",
  Offline: "default",
};

// Only Ongoing/Recent outfalls are reverse-geocoded (see route.ts), so the
// rest fall back to watercourse + distance to stay distinguishable.
const describeLocation = (o: CsoOutfall): string =>
  o.locationName
    ? `${o.locationName} (${o.watercourse})`
    : `${o.watercourse} — ${o.distanceKm.toFixed(1)} km`;

const describeTiming = (o: CsoOutfall): string | null => {
  switch (o.state) {
    case "Ongoing":
      return o.startISO
        ? `Started ${formatDistanceToNow(new Date(o.startISO), { addSuffix: true })}`
        : null;
    case "Recent":
      return o.endISO
        ? `Ended ${formatDistanceToNow(new Date(o.endISO), { addSuffix: true })}`
        : null;
    case "Not discharging":
      return o.startISO
        ? `Clear since ${formatDistanceToNow(new Date(o.startISO), { addSuffix: true })}`
        : null;
    case "Offline":
      return null;
  }
};

const OutfallStatusRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const timing = describeTiming(o);
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
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
        label={o.state}
        color={STATE_COLOR[o.state]}
        size="small"
        variant={o.state === "Not discharging" || o.state === "Offline" ? "outlined" : "filled"}
        sx={{ flexShrink: 0 }}
      />
    </Stack>
  );
};

const NOTABLE_STATES: CsoState[] = ["Ongoing", "Recent"];
const QUIET_STATES: CsoState[] = ["Not discharging", "Offline"];

const GroupSection: React.FC<{ state: CsoState; outfalls: CsoOutfall[] }> = ({ state, outfalls }) => (
  <Box>
    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
      {STATE_LABEL[state]} ({outfalls.length})
    </Typography>
    <Stack spacing={1}>
      {outfalls.map((o, idx) => (
        <Box key={o.id}>
          {idx > 0 && <Divider sx={{ mb: 1, opacity: 0.3 }} />}
          <OutfallStatusRow outfall={o} />
        </Box>
      ))}
    </Stack>
  </Box>
);

const CsoListCard: React.FC = () => {
  const { data, loading, error } = useCsoData();
  const outfalls = data?.outfalls ?? [];
  const [quietExpanded, setQuietExpanded] = useState(false);

  const groups = STATE_ORDER.map((state) => ({
    state,
    outfalls: outfalls.filter((o) => o.state === state),
  })).filter((group) => group.outfalls.length > 0);

  const notableGroups = groups.filter((g) => NOTABLE_STATES.includes(g.state));
  const quietGroups = groups.filter((g) => QUIET_STATES.includes(g.state));
  const quietCount = quietGroups.reduce((sum, g) => sum + g.outfalls.length, 0);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="h5" component="h2">
            CSO Monitoring Points
          </Typography>
          {!loading && !error && (
            <Typography variant="caption" color="text.secondary">
              {outfalls.length} in catchment
            </Typography>
          )}
        </Stack>

        {loading && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
          </Stack>
        )}

        {!loading && error && (
          <Alert severity="warning" sx={{ borderRadius: 1 }}>
            Couldn&apos;t load CSO monitoring data right now. Try again shortly.
          </Alert>
        )}

        {!loading && !error && (
          <Stack spacing={2}>
            {groups.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No monitored CSOs found in this catchment.
              </Typography>
            )}

            {notableGroups.length === 0 && quietGroups.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Nothing discharging right now.
              </Typography>
            )}

            {notableGroups.map((group) => (
              <GroupSection key={group.state} state={group.state} outfalls={group.outfalls} />
            ))}

            {quietGroups.length > 0 && (
              <Accordion
                expanded={quietExpanded}
                onChange={(_, isExpanded) => setQuietExpanded(isExpanded)}
                variant="outlined"
                disableGutters
                sx={{ "&:before": { display: "none" } }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" color="text.secondary">
                    {quietCount} not discharging
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {quietGroups.map((group) => (
                      <GroupSection key={group.state} state={group.state} outfalls={group.outfalls} />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            <Typography variant="caption" color="text.secondary">
              {data ? formatAsOf(data.asOf) : ""}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoListCard;
