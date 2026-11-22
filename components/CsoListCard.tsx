"use client";

import { Card, CardContent, Grow, Stack, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useSevernContext } from "@/lib/SevernDataContext";
import { showSkeletonFor } from "@/lib/hooks";
import InfoPanel from "@/components/InfoPanel";
import RiverSchematic, {
  RiverSchematicSkeleton,
} from "@/components/RiverSchematic";
import { springTransition } from "@/lib/m3-palette";

const CsoListCard: React.FC = () => {
  const data = useSevernContext();
  const { cso, csoError } = data;
  const outfalls = cso?.outfalls ?? [];
  const showSkeleton = showSkeletonFor(data, { key: "cso", hasData: !!cso });

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Sewage Overflows
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          The river flows down the page to Worcester.
        </Typography>

        {showSkeleton && <RiverSchematicSkeleton />}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load CSO monitoring data. Try refreshing.
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
