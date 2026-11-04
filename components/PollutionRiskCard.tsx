"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import WavesIcon from "@mui/icons-material/Waves";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HistoryIcon from "@mui/icons-material/History";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  PollutionRiskFactor,
  PollutionRiskFactorKey,
  PollutionRiskLevel,
  RISK_LEVEL_UI,
  derivePollutionRisk,
} from "@/lib/pollutionRisk";
import {
  collapseMotion,
  m3Spring,
  spring,
  springTransition,
} from "@/lib/m3-palette";
import { useNowTicking } from "@/lib/time";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";

// The scale strip, best to worst, the way it reads left to right.
const RISK_SCALE: PollutionRiskLevel[] = ["lower", "raised", "high"];

const RISK_ICONS: Record<PollutionRiskLevel, React.ElementType> = {
  high: ReportProblemIcon,
  raised: WarningAmberIcon,
  lower: CheckCircleOutlineIcon,
};

const FACTOR_ICONS: Record<PollutionRiskFactorKey, React.ElementType> = {
  passing: WavesIcon,
  arriving: ScheduleIcon,
  lingering: HistoryIcon,
  rain: WaterDropIcon,
  sample: ScienceOutlinedIcon,
};

// Matches Paddlecheck's PaddlingStatusHero: the label alone in the status
// colour, with the scale as a strip underneath.
const RiskHero: React.FC<{ level: PollutionRiskLevel }> = ({ level }) => {
  const ui = RISK_LEVEL_UI[level];
  const Icon = RISK_ICONS[level];

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
          {ui.label}
        </Typography>
      </InfoPanel>

      <Box
        role="img"
        aria-label={`Pollution risk scale: ${ui.label}, step ${
          RISK_SCALE.indexOf(level) + 1
        } of ${RISK_SCALE.length}`}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}
      >
        {RISK_SCALE.map((l) => {
          const isActive = l === level;
          return (
            <Box
              key={l}
              title={RISK_LEVEL_UI[l].label}
              sx={{
                flex: isActive ? 2.2 : 1,
                height: isActive ? 10 : 6,
                borderRadius: 9999,
                backgroundColor: RISK_LEVEL_UI[l].color,
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

// Paddlecheck's Contributing Factors: the shared tile, two across, with an
// odd last one spanning the row.
const ContributingFactors: React.FC<{ factors: PollutionRiskFactor[] }> = ({
  factors,
}) => (
  <Box sx={{ mt: 2 }}>
    <Typography variant="subtitle2" color="text.secondary">
      Contributing Factors
    </Typography>
    <Box sx={{ ...tileGridSx, mt: 1 }}>
      {factors.map(({ key, label, value, detail }) => {
        const Icon = FACTOR_ICONS[key];
        return (
          <StatTile
            key={key}
            icon={<Icon />}
            label={label}
            value={value}
            detail={detail}
          />
        );
      })}
    </Box>
  </Box>
);

const PollutionRiskCard: React.FC = () => {
  const {
    cso,
    rainfall,
    waterQuality,
    csoError,
    loading,
    isRefreshing,
    isOffline,
  } = useSevernContext();
  const showSkeleton = loading || (isRefreshing && !isOffline);
  // Ticks so "due in ~N h" counts down, and a spill moves from due to
  // passing, between fetches.
  const now = useNowTicking();

  const risk = useMemo(
    () =>
      cso
        ? derivePollutionRisk(cso, rainfall, waterQuality, now.getTime())
        : null,
    [cso, rainfall, waterQuality, now]
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Water Quality Status
        </Typography>

        {/* Mirrors the hero and its scale strip, so the card doesn't change
            height when the data lands. */}
        {showSkeleton && (
          <Box>
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{ height: { xs: 72, sm: 104 }, borderRadius: "28px" }}
            />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                height: 10,
                mt: 1.5,
              }}
            >
              {RISK_SCALE.map((level) => (
                <Skeleton
                  key={level}
                  variant="rounded"
                  height={6}
                  animation="wave"
                  sx={{ flex: 1, borderRadius: 9999 }}
                />
              ))}
            </Box>
          </Box>
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

        {!showSkeleton && risk && (
          <Grow in appear {...springTransition()}>
            <Stack>
              <RiskHero level={risk.level} />
              <Collapse
                in={risk.factors.length > 0}
                unmountOnExit
                {...collapseMotion}
              >
                <ContributingFactors factors={risk.factors} />
              </Collapse>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default PollutionRiskCard;
