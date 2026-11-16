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
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  PollutionRiskFactor,
  PollutionRiskFactorKey,
  PollutionRiskLevel,
  RISK_LEVEL_UI,
  derivePollutionRisk,
  formatSpillTime,
} from "@/lib/pollutionRisk";
import {
  collapseMotion,
  m3Spring,
  spring,
  springTransition,
} from "@/lib/m3-palette";
import { useNowTicking } from "@/lib/useNowTicking";
import { useFreshness } from "@/lib/useFreshness";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";

// The scale strip, best to worst, the way it reads left to right.
const RISK_SCALE: PollutionRiskLevel[] = ["low", "raised", "high"];

const RISK_ICONS: Record<PollutionRiskLevel, React.ElementType> = {
  high: ReportProblemIcon,
  raised: WarningAmberIcon,
  low: CheckCircleOutlineIcon,
};

const FACTOR_ICONS: Record<PollutionRiskFactorKey, React.ElementType> = {
  here: PlaceOutlinedIcon,
  recent: WavesIcon,
  rain: WaterDropIcon,
  sample: ScienceOutlinedIcon,
  offline: CloudOffIcon,
};

// Paddlecheck's PaddlingStatusHero, with the scale as a strip underneath -
// but on the level's tonal container pair rather than a saturated fill. The
// headline is an estimate for most of a wet season, and a full-width slab of
// red or amber shouted it louder than the evidence. The strip keeps the
// saturated hues, so the level still reads at a glance.
const RiskHero: React.FC<{ level: PollutionRiskLevel }> = ({ level }) => {
  const ui = RISK_LEVEL_UI[level];
  const Icon = RISK_ICONS[level];

  return (
    <Box>
      <InfoPanel
        sx={{
          gap: { xs: 1.75, sm: 2.5 },
          p: { xs: 2, sm: 3 },
          borderRadius: "16px",
          backgroundColor: `${ui.tonal}.container`,
          color: `${ui.tonal}.onContainer`,
          transition: spring(
            "background-color, color",
            m3Spring.effectsDefault
          ),
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
      {factors.map(({ key, label, value, detail, spillMinutes }) => {
        const Icon = FACTOR_ICONS[key];
        const spillTime = spillMinutes
          ? `${formatSpillTime(spillMinutes)} total`
          : null;
        return (
          <StatTile
            key={key}
            icon={<Icon />}
            label={label}
            value={value}
            detail={[detail, spillTime].filter(Boolean).join(" · ")}
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
    lastUpdated,
  } = useSevernContext();
  const { freshnessText } = useFreshness(lastUpdated);
  const showSkeleton = loading || (isRefreshing && !isOffline);
  // Ticks so a spill starts and stops counting on time between fetches.
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
        <Typography variant="h5" component="h2">
          Pollution Risk
        </Typography>
        {/* When the spill and rainfall data were fetched - Paddlecheck's
            "Updated" line under its status card title. The banners above the
            app bar take over once it's stale or an update has failed. Held at
            one line's height so the card doesn't jump when it fills in. */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 1.5, minHeight: "1.43em" }}
        >
          {isRefreshing
            ? "Updating…"
            : freshnessText
              ? `Updated ${freshnessText}`
              : null}
        </Typography>

        {/* Mirrors the hero and its scale strip, so the card doesn't change
            height when the data lands. */}
        {showSkeleton && (
          <Box>
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{ height: { xs: 72, sm: 104 } }}
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
          <InfoPanel align="flex-start" sx={{ p: 2 }}>
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
