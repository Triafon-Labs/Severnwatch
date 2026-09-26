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
import HistoryIcon from "@mui/icons-material/History";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { CSO_STATE_UI } from "@/lib/csoStatus";
import { CsoState } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { m3Spring, spring, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";

const CSO_STATUS_SCALE = ["Not discharging", "Recent", "Ongoing"] as const;

const CsoStatusHero: React.FC<{
  ongoingCount: number;
  recentCount: number;
}> = ({ ongoingCount, recentCount }) => {
  const activeState: CsoState =
    ongoingCount > 0
      ? "Ongoing"
      : recentCount > 0
      ? "Recent"
      : "Not discharging";

  const ui = CSO_STATE_UI[activeState];

  let Icon = CheckCircleOutlineIcon;
  let label = "No Recent Spills";
  let subtitle: string | null = null;

  if (activeState === "Ongoing") {
    Icon = ReportProblemIcon;
    label = `${ongoingCount} Active Spill${ongoingCount === 1 ? "" : "s"}`;
    if (recentCount > 0) {
      subtitle = `Plus ${recentCount} Recent Spill${recentCount === 1 ? "" : "s"}`;
    }
  } else if (activeState === "Recent") {
    Icon = HistoryIcon;
    label = `${recentCount} Recent Spill${recentCount === 1 ? "" : "s"}`;
  }

  const otherStatuses = CSO_STATUS_SCALE.filter((s) => s !== activeState)
    .map((s) => CSO_STATE_UI[s].groupLabel)
    .join(" and ");

  const fullAriaLabel = `Sewage spill scale: ${label}${
    subtitle ? `, ${subtitle}` : ""
  }, step ${CSO_STATUS_SCALE.indexOf(activeState) + 1} of ${
    CSO_STATUS_SCALE.length
  }. Other statuses are ${otherStatuses}.`;

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
        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h3"
            component="p"
            sx={{
              fontWeight: 500,
              lineHeight: 1.1,
              fontSize: { xs: "1.625rem", sm: "2rem" },
            }}
          >
            {label}
          </Typography>
          {subtitle && (
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500,
                opacity: 0.9,
                fontSize: { xs: "0.95rem", sm: "1.1rem" },
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Stack>
      </InfoPanel>

      <Box
        role="img"
        aria-label={fullAriaLabel}
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
  const recent = (cso?.outfalls ?? []).filter(
    (outfall) => outfall.state === "Recent"
  );
  const showSkeleton = loading || (isRefreshing && !isOffline);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Water Quality Status
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
              <CsoStatusHero
                ongoingCount={ongoing.length}
                recentCount={recent.length}
              />
            </Box>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoSpillCard;
