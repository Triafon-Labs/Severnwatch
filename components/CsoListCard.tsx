"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall, CsoState } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { formatAsOf } from "@/lib/format";
import {
  CSO_NOTABLE_STATES,
  CSO_QUIET_STATES,
  CSO_STATE_ORDER,
  CSO_STATE_UI,
  statusChipSx,
} from "@/lib/csoStatus";
import InfoPanel from "@/components/InfoPanel";

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

const OutfallStatusRow: React.FC<{ outfall: CsoOutfall }> = ({
  outfall: o,
}) => {
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

const GroupSection: React.FC<{ state: CsoState; outfalls: CsoOutfall[] }> = ({
  state,
  outfalls,
}) => (
  <Box>
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ display: "block", mb: 0.75 }}
    >
      {CSO_STATE_UI[state].groupLabel} ({outfalls.length})
    </Typography>
    <Stack spacing={1}>
      {outfalls.map((o) => (
        <OutfallStatusRow key={o.id} outfall={o} />
      ))}
    </Stack>
  </Box>
);

const CsoListCard: React.FC = () => {
  const { cso, csoError, loading } = useSevernContext();
  const outfalls = cso?.outfalls ?? [];
  const [quietExpanded, setQuietExpanded] = useState(false);
  const showSkeleton = loading && !cso;

  const groups = CSO_STATE_ORDER.map((state) => ({
    state,
    outfalls: outfalls.filter((o) => o.state === state),
  })).filter((group) => group.outfalls.length > 0);

  const notableGroups = groups.filter((g) =>
    CSO_NOTABLE_STATES.includes(g.state)
  );
  const quietGroups = groups.filter((g) => CSO_QUIET_STATES.includes(g.state));
  const quietCount = quietGroups.reduce((sum, g) => sum + g.outfalls.length, 0);

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="h5" component="h2">
            CSO Monitoring Points
          </Typography>
          {cso && (
            <Typography variant="caption" color="text.secondary">
              {outfalls.length} in catchment
            </Typography>
          )}
        </Stack>

        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
          </Stack>
        )}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load CSO monitoring data right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && cso && (
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
              <GroupSection
                key={group.state}
                state={group.state}
                outfalls={group.outfalls}
              />
            ))}

            {quietGroups.length > 0 && (
              <Accordion
                expanded={quietExpanded}
                onChange={(_, isExpanded) => setQuietExpanded(isExpanded)}
                disableGutters
                elevation={0}
                // Pulled out to the card's inner edge so the summary row's own
                // padding lines the label up with the headings above it,
                // rather than indenting it by a second inset.
                sx={{ "&:before": { display: "none" }, mx: -1 }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 1 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {quietCount} not discharging
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 1, pt: 0 }}>
                  <Stack spacing={2}>
                    {quietGroups.map((group) => (
                      <GroupSection
                        key={group.state}
                        state={group.state}
                        outfalls={group.outfalls}
                      />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            <Typography variant="caption" color="text.secondary">
              {formatAsOf(cso.asOf)}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoListCard;
