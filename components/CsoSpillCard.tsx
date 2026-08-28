"use client";

import {
  Box,
  Card,
  CardContent,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { CSO_STATE_UI } from "@/lib/csoStatus";
import { useSevernContext } from "@/lib/SevernDataContext";
import { m3Spring, spring, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";

const CSO_STATUS_SCALE = ["Not discharging", "Recent", "Ongoing"] as const;

const CsoStatusHero: React.FC<{ ongoingCount: number }> = ({
  ongoingCount,
}) => {
  const isDischarging = ongoingCount > 0;
  const activeState = isDischarging ? "Ongoing" : "Not discharging";
  const ui = CSO_STATE_UI[activeState];
  const Icon = isDischarging ? ReportProblemIcon : CheckCircleOutlineIcon;
  const label = isDischarging ? "Discharging now" : "No active spills";

  return (
    <Box>
      <InfoPanel
        sx={{
          gap: { xs: 1.75, sm: 2.5 },
          p: { xs: 2, sm: 3 },
          borderRadius: "28px",
          backgroundColor: ui.color,
          color: ui.onColor,
          transition: spring("background-color", m3Spring.effectsDefault),
        }}
      >
        <Icon sx={{ fontSize: { xs: 40, sm: 56 }, flexShrink: 0 }} />
        <Typography
          variant="h3"
          component="p"
          sx={{
            minWidth: 0,
            fontWeight: 500,
            lineHeight: 1.1,
            fontSize: { xs: "1.625rem", sm: "2rem" },
          }}
        >
          {label}
        </Typography>
      </InfoPanel>

      <Box
        role="img"
        aria-label={`Sewage spill scale: ${label}, step ${CSO_STATUS_SCALE.indexOf(activeState) + 1} of ${CSO_STATUS_SCALE.length}. Other statuses are Not discharging and Recent.`}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}
      >
        {CSO_STATUS_SCALE.map((state) => {
          const isActive = state === activeState;
          return (
            <Box
              key={state}
              title={CSO_STATE_UI[state].groupLabel}
              sx={{
                flex: isActive ? 2.2 : 1,
                height: isActive ? 10 : 6,
                borderRadius: 9999,
                backgroundColor: CSO_STATE_UI[state].color,
                opacity: isActive ? 1 : 0.32,
                transition: [
                  spring("flex-grow, height", m3Spring.spatialDefault),
                  spring("opacity", m3Spring.effectsDefault),
                ].join(", "),
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

const CsoSpillCard: React.FC = () => {
  const { cso, csoError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const ongoing = (cso?.outfalls ?? []).filter(
    (outfall) => outfall.state === "Ongoing"
  );
  const showSkeleton = loading || (isRefreshing && !isOffline);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Sewage Spill Status
        </Typography>

        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton
              variant="rounded"
              height={120}
              animation="wave"
              sx={{ borderRadius: "28px" }}
            />
          </Stack>
        )}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start" sx={{ borderRadius: 3, p: 2 }}>
            <CloudOffIcon
              color="warning"
              sx={{ flexShrink: 0, fontSize: 32 }}
            />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load sewage spill data right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && cso && (
          <Grow in appear {...springTransition()}>
            <Box>
              <CsoStatusHero ongoingCount={ongoing.length} />
            </Box>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoSpillCard;
