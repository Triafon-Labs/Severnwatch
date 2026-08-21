"use client";

import { Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useSevernContext } from "@/lib/SevernDataContext";
import InfoPanel from "@/components/InfoPanel";
import RiverSchematic from "@/components/RiverSchematic";

const CsoListCard: React.FC = () => {
  const { cso, csoError, loading } = useSevernContext();
  const outfalls = cso?.outfalls ?? [];
  const showSkeleton = loading && !cso;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          CSO Monitoring Map
        </Typography>

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

            {outfalls.length > 0 && (
              <Stack spacing={1}>
                <RiverSchematic outfalls={outfalls} />
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoListCard;
