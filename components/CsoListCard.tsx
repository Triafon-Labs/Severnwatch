"use client";

import { Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { CsoOutfall, CsoState } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { formatAsOf } from "@/lib/format";
import {
  CSO_NOTABLE_STATES,
  CSO_STATE_ORDER,
  CSO_STATE_UI,
} from "@/lib/csoStatus";
import InfoPanel from "@/components/InfoPanel";
import CsoOutfallRow from "@/components/CsoOutfallRow";
import RiverSchematic from "@/components/RiverSchematic";

// Anything discharging or recently discharged is spelled out in full above
// the diagram. The schematic below carries the whole network - including
// these - but a live spill is news, and news should not be something you have
// to find by reading colours off a map.
const NotableGroup: React.FC<{ state: CsoState; outfalls: CsoOutfall[] }> = ({
  state,
  outfalls,
}) => (
  <Stack spacing={1}>
    <Typography variant="overline" color="text.secondary">
      {CSO_STATE_UI[state].groupLabel} ({outfalls.length})
    </Typography>
    {outfalls.map((o) => (
      <CsoOutfallRow key={o.id} outfall={o} />
    ))}
  </Stack>
);

const CsoListCard: React.FC = () => {
  const { cso, csoError, loading } = useSevernContext();
  const outfalls = cso?.outfalls ?? [];
  const showSkeleton = loading && !cso;

  const notableGroups = CSO_STATE_ORDER.filter((state) =>
    CSO_NOTABLE_STATES.includes(state)
  )
    .map((state) => ({
      state,
      outfalls: outfalls.filter((o) => o.state === state),
    }))
    .filter((group) => group.outfalls.length > 0);

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
            {outfalls.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No monitored CSOs found in this catchment.
              </Typography>
            )}

            {outfalls.length > 0 && notableGroups.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nothing discharging right now.
              </Typography>
            )}

            {notableGroups.map((group) => (
              <NotableGroup
                key={group.state}
                state={group.state}
                outfalls={group.outfalls}
              />
            ))}

            {outfalls.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="overline" color="text.secondary">
                  The catchment upstream
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stops run downstream, so anything discharging above your reach
                  drains past it. Tap a stop for its monitors.
                </Typography>
                <RiverSchematic outfalls={outfalls} />
                <Typography variant="caption" color="text.secondary">
                  A monitor records when an overflow starts and stops — not how
                  much was discharged, and not the water quality. Spills stay
                  listed longer the further upstream they are, because their
                  water takes longer to arrive. Canal inflows at Diglis and
                  Hawford, and runoff from land, aren&apos;t monitored at all.
                </Typography>
              </Stack>
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
