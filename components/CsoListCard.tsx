"use client";

import { Card, CardContent, Grow, Stack, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useSevernContext } from "@/lib/SevernDataContext";
import InfoPanel from "@/components/InfoPanel";
import RiverSchematic, {
  RiverSchematicSkeleton,
} from "@/components/RiverSchematic";
import { springTransition } from "@/lib/m3-palette";

const CsoListCard: React.FC = () => {
  const { cso, csoError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const outfalls = cso?.outfalls ?? [];
  const showSkeleton = loading || (isRefreshing && !isOffline);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          CSO Monitoring Map
        </Typography>

        {showSkeleton && <RiverSchematicSkeleton />}

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
          <Grow in appear {...springTransition()}>
            <Stack spacing={2}>
              {outfalls.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No monitored CSOs found in this catchment.
                </Typography>
              )}

              {outfalls.length > 0 && (
                <Stack spacing={1}>
                  <RiverSchematic outfalls={outfalls} />
                </Stack>
              )}
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoListCard;
